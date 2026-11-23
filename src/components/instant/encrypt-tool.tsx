'use client'

// Encrypt — real password encryption with WebCrypto, entirely in this tab.
// AES-GCM-256; the key is stretched from the password with PBKDF2-SHA256
// (310,000 iterations, fresh 16-byte salt and 12-byte IV per operation) and
// the CryptoKey is non-extractable, so it exists only inside this tab's
// engine. Files wrap into the documented KENC1 container (.enc); text wraps
// into the same container rendered as Base64. There is no upload code on
// this page — the plaintext and the password never leave the device.

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileLock2,
  Loader2,
  LockKeyhole,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropZone,
  PrivacyStrip,
  downloadBlob,
  formatBytes,
} from '@/components/instant/instant-kit'

// -------------------------------------------------------------- constants ---
const PBKDF2_ITERATIONS = 310_000
const SALT_BYTES = 16
const IV_BYTES = 12
const VERSION = 1
// "KENC1" in ASCII: the first five bytes of every container.
const MAGIC = new Uint8Array([0x4b, 0x45, 0x4e, 0x43, 0x31])
const HEADER_BYTES = MAGIC.length + 1 + SALT_BYTES + IV_BYTES // 34
// Files are held whole in this tab's memory, so an honest cap protects
// ordinary devices. Bigger jobs need a desktop tool (age, GPG).
const MAX_FILE_BYTES = 256 * 1024 * 1024

// The most-chosen passwords from public breach lists. A match means the
// password is weak no matter what the entropy math says.
const COMMON_PASSWORDS = new Set([
  '123456', 'password', '123456789', '12345678', '12345', 'qwerty',
  '1234567', '111111', '1234567890', '123123', 'abc123', 'password1',
  '1234', 'qwerty123', '000000', 'iloveyou', 'admin', 'welcome',
  'monkey', 'login', 'dragon', 'letmein', 'football', 'sunshine',
  'princess', 'master', 'hello', 'freedom', 'whatever', 'qazwsx',
  'trustno1', 'batman', 'superman', '654321', '555555', 'shadow',
  'michael', 'jennifer', 'hunter', 'summer', 'starwars', 'passw0rd',
])

/** Undo the usual letter substitutions before the common-password check. */
function normalizeForCommonCheck(pw: string): string {
  return pw
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
}

type Strength = {
  bits: number
  common: boolean
  score: 0 | 1 | 2 | 3
  label: string
  tone: 'rose' | 'amber' | 'teal' | 'emerald'
}

function assessPassword(pw: string): Strength | null {
  if (!pw) return null
  const common =
    COMMON_PASSWORDS.has(pw.toLowerCase()) ||
    COMMON_PASSWORDS.has(normalizeForCommonCheck(pw))
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33
  const bits = pool === 0 ? 0 : Math.round(pw.length * Math.log2(pool))
  if (common) return { bits, common: true, score: 0, label: 'Very weak — it is on the common-password list', tone: 'rose' }
  if (bits < 36) return { bits, common: false, score: 0, label: 'Weak', tone: 'rose' }
  if (bits < 60) return { bits, common: false, score: 1, label: 'Fair', tone: 'amber' }
  if (bits < 90) return { bits, common: false, score: 2, label: 'Strong', tone: 'teal' }
  return { bits, common: false, score: 3, label: 'Excellent', tone: 'emerald' }
}

// ------------------------------------------------------------------ crypto ---
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password) as unknown as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  // extractable=false: the key cannot be pulled back out of the engine.
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Build one KENC1 container: magic + version + salt + iv + ciphertext. */
async function encryptToContainer(password: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
      key,
      plaintext as unknown as ArrayBuffer,
    ),
  )
  const out = new Uint8Array(HEADER_BYTES + ciphertext.length)
  out.set(MAGIC, 0)
  out[MAGIC.length] = VERSION
  out.set(salt, MAGIC.length + 1)
  out.set(iv, MAGIC.length + 1 + SALT_BYTES)
  out.set(ciphertext, HEADER_BYTES)
  return out
}

type ParsedContainer = { salt: Uint8Array; iv: Uint8Array; ciphertext: Uint8Array }

/**
 * Validate the header against the spec. Returns null when the bytes are not
 * a KENC1 container (wrong magic, unknown version, or simply too short).
 */
function parseContainer(bytes: Uint8Array): ParsedContainer | { badVersion: true } | null {
  if (bytes.length <= HEADER_BYTES) return null
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) return null
  }
  if (bytes[MAGIC.length] !== VERSION) return { badVersion: true }
  return {
    salt: bytes.slice(MAGIC.length + 1, MAGIC.length + 1 + SALT_BYTES),
    iv: bytes.slice(MAGIC.length + 1 + SALT_BYTES, HEADER_BYTES),
    ciphertext: bytes.slice(HEADER_BYTES),
  }
}

/**
 * Decrypt a parsed container. GCM authentication failing (wrong password,
 * flipped bit anywhere) surfaces as WebCrypto OperationError — reported
 * honestly instead of producing garbage.
 */
async function decryptContainer(password: string, c: ParsedContainer): Promise<Uint8Array> {
  const key = await deriveKey(password, c.salt)
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: c.iv as unknown as ArrayBuffer },
      key,
      c.ciphertext as unknown as ArrayBuffer,
    ),
  )
}

// ----------------------------------------------------------------- base64 ---
function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function base64ToBytes(input: string): Uint8Array | null {
  const clean = input.replace(/\s+/g, '')
  if (!clean) return null
  try {
    const bin = atob(clean)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

function stripEncSuffix(name: string): string {
  return name.replace(/\.enc$/i, '')
}

// ------------------------------------------------------------------ shared ---
type Mode = 'files' | 'text'
type Direction = 'encrypt' | 'decrypt'
type PickedFile = { file: File; name: string; size: number }

const TONE_CLASS: Record<Strength['tone'], string> = {
  rose: 'text-rose-600 dark:text-rose-400',
  amber: 'text-amber-600 dark:text-amber-400',
  teal: 'text-teal-600 dark:text-teal-400',
  emerald: 'text-primary',
}
const TONE_FILL: Record<Strength['tone'], string> = {
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  teal: 'bg-teal-500',
  emerald: 'bg-primary',
}

/** The pill switch used for mode and direction, matching the instant kit. */
function PillSwitch<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (next: T) => void
  label: string
}) {
  return (
    <div className="flex w-fit gap-1.5 rounded-full border bg-muted/40 p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={
            value === o.id
              ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
              : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function PasswordField({
  id,
  labelField,
  password,
  onChange,
  visible,
  onToggle,
  placeholder,
  autoComplete,
}: {
  id: string
  labelField: string
  password: string
  onChange: (v: string) => void
  visible: boolean
  onToggle: () => void
  placeholder: string
  autoComplete: 'new-password' | 'current-password'
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{labelField}</Label>
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide passwords' : 'Show passwords'}
          className="flex min-h-11 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={password}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
        className="mt-1.5 h-11 pr-3 font-mono text-sm"
      />
    </div>
  )
}

function StrengthMeter({ strength }: { strength: Strength }) {
  const filled = strength.score + 1
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < filled ? TONE_FILL[strength.tone] : 'bg-border'}`}
          />
        ))}
      </div>
      <p className={`mt-1.5 text-xs font-medium ${TONE_CLASS[strength.tone]}`}>
        {strength.label}
        {!strength.common && ` — about ${strength.bits} bits of entropy`}
      </p>
    </div>
  )
}

function HonestNotes() {
  return (
    <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-foreground/90">
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <span>
          There is no password recovery. Lose the password and the data is gone — that is the price
          of encryption that actually works. And strength cannot save a leaked password: if this
          phrase is reused anywhere else, assume it is already known.
        </span>
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ tool ---
export function EncryptTool() {
  const [mode, setMode] = useState<Mode>('files')
  const [direction, setDirection] = useState<Direction>('encrypt')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)

  // files state
  const [picked, setPicked] = useState<PickedFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  // text state
  const [textInput, setTextInput] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [outputLabel, setOutputLabel] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const strength = assessPassword(password)
  const mismatch = direction === 'encrypt' && confirm.length > 0 && confirm !== password

  const textStats = useMemo(() => {
    if (mode !== 'text') return null
    return { chars: textInput.length, bytes: utf8ByteLength(textInput) }
  }, [mode, textInput])

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setDone(null)
    setOutput(null)
    setOutputLabel(null)
    setCopied(false)
  }

  function switchDirection(next: Direction) {
    setDirection(next)
    setError(null)
    setDone(null)
    setOutput(null)
    setOutputLabel(null)
    setCopied(false)
    setConfirm('')
  }

  function takeFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setDone(null)
    if (file.size > MAX_FILE_BYTES) {
      setPicked(null)
      setError(
        `That file is ${formatBytes(file.size)} — this tool caps at 256 MB, because the whole file is held in this tab\u2019s memory. For bigger files use a desktop tool such as age or GPG.`,
      )
      return
    }
    setPicked({ file, name: file.name, size: file.size })
  }

  function copyOutput(value: string) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  async function runFiles() {
    setError(null)
    setDone(null)
    if (!picked) return
    if (!crypto?.subtle) {
      setError('This browser is not offering Web Crypto (it needs a secure context), so encryption is unavailable here.')
      return
    }
    if (!password) {
      setError('Enter a password first — an empty password is refused.')
      return
    }
    if (direction === 'encrypt' && password !== confirm) return

    setBusy(true)
    try {
      const plain = new Uint8Array(await picked.file.arrayBuffer())
      if (direction === 'encrypt') {
        const container = await encryptToContainer(password, plain)
        const outName = `${picked.name}.enc`
        downloadBlob(new Blob([container as unknown as ArrayBuffer], { type: 'application/octet-stream' }), outName)
        setDone(`Encrypted ${picked.name} (${formatBytes(picked.size)}) \u2192 ${outName} (${formatBytes(container.length)}), downloaded.`)
      } else {
        const parsed = parseContainer(plain)
        if (parsed === null) {
          setError('That is not a Kontivo .enc container — the bytes do not start with the KENC1 magic. Files from other tools (GPG, OpenSSL, 7-Zip) cannot be opened here.')
          return
        }
        if ('badVersion' in parsed) {
          setError('This container was written by a newer version of the format than this page understands. Nothing was decrypted.')
          return
        }
        let plainOut: Uint8Array
        try {
          plainOut = await decryptContainer(password, parsed)
        } catch {
          setError('Wrong password, or the file is damaged.')
          return
        }
        const outName = stripEncSuffix(picked.name) || 'decrypted.bin'
        downloadBlob(new Blob([plainOut as unknown as ArrayBuffer], { type: 'application/octet-stream' }), outName)
        setDone(`Decrypted ${picked.name} (${formatBytes(picked.size)}) \u2192 ${outName} (${formatBytes(plainOut.length)}), downloaded.`)
      }
    } catch {
      setError('Something went wrong while working on that file — very large files can exceed this device\u2019s memory.')
    } finally {
      setBusy(false)
    }
  }

  async function runText() {
    setError(null)
    setDone(null)
    setOutput(null)
    setOutputLabel(null)
    if (!crypto?.subtle) {
      setError('This browser is not offering Web Crypto (it needs a secure context), so encryption is unavailable here.')
      return
    }
    if (!password) {
      setError('Enter a password first — an empty password is refused.')
      return
    }
    if (direction === 'encrypt' && password !== confirm) return
    if (direction === 'encrypt' && !textInput) {
      setError('There is nothing to encrypt — type or paste some text first.')
      return
    }
    if (direction === 'decrypt' && !textInput.trim()) {
      setError('Paste the Base64 container first.')
      return
    }

    setBusy(true)
    try {
      if (direction === 'encrypt') {
        const container = await encryptToContainer(password, new TextEncoder().encode(textInput))
        const b64 = bytesToBase64(container)
        setOutput(b64)
        setOutputLabel(`Encrypted container — ${b64.length} characters (${formatBytes(container.length)})`)
      } else {
        const bytes = base64ToBytes(textInput)
        if (!bytes) {
          setError('That is not valid Base64 — check the paste and try again.')
          return
        }
        const parsed = parseContainer(bytes)
        if (parsed === null) {
          setError('That decodes to something that is not a Kontivo container — the bytes do not start with the KENC1 magic.')
          return
        }
        if ('badVersion' in parsed) {
          setError('This container was written by a newer version of the format than this page understands. Nothing was decrypted.')
          return
        }
        let plainOut: Uint8Array
        try {
          plainOut = await decryptContainer(password, parsed)
        } catch {
          setError('Wrong password, or the text is damaged.')
          return
        }
        const text = new TextDecoder().decode(plainOut)
        setOutput(text)
        setOutputLabel(`Decrypted text — ${text.length} characters (${formatBytes(plainOut.length)})`)
      }
    } catch {
      setError('Something went wrong during encryption — the text may be too large for this tab\u2019s memory.')
    } finally {
      setBusy(false)
    }
  }

  const canRun =
    !!password &&
    (direction === 'decrypt' || (password === confirm && confirm.length > 0)) &&
    (mode === 'files' ? !!picked : direction === 'decrypt' ? !!textInput.trim() : !!textInput)

  return (
    <div>
      {/* mode tabs */}
      <div className="mb-4 flex w-fit gap-1.5 rounded-full border bg-muted/40 p-1" role="tablist" aria-label="What to encrypt">
        {(
          [
            ['files', 'Files'],
            ['text', 'Text'],
          ] as Array<[Mode, string]>
        ).map(([m, label]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={
              mode === m
                ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* direction switch */}
      <PillSwitch
        value={direction}
        onChange={switchDirection}
        label={mode === 'files' ? 'Encrypt or decrypt a file' : 'Encrypt or decrypt text'}
        options={
          mode === 'files'
            ? [
                { id: 'encrypt', label: 'Encrypt a file' },
                { id: 'decrypt', label: 'Decrypt a .enc file' },
              ]
            : [
                { id: 'encrypt', label: 'Encrypt text' },
                { id: 'decrypt', label: 'Decrypt Base64' },
              ]
        }
      />

      {/* ---------------------------------------------------------- files mode */}
      {mode === 'files' ? (
        <div className="mt-4">
          <DropZone
            onFiles={(files) => takeFile(files[0])}
            accept={direction === 'decrypt' ? '.enc' : undefined}
            multiple={false}
            title={direction === 'encrypt' ? 'Drop the file to encrypt' : 'Drop the .enc file to decrypt'}
            hint={
              direction === 'encrypt'
                ? 'Any file type — documents, archives, photos. It comes back as <name>.enc.'
                : 'A Kontivo .enc container made here. Other tools\u2019 formats are refused honestly.'
            }
            compact
          />

          {picked && (
            <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                <FileLock2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate font-medium">{picked.name}</span>
                <span className="shrink-0 text-muted-foreground">· {formatBytes(picked.size)}</span>
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPicked(null)
                  setDone(null)
                }}
              >
                Remove
              </Button>
            </div>
          )}

          {direction === 'encrypt' && picked?.name.toLowerCase().endsWith('.enc') && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              That file is already a Kontivo container — encrypting again adds a second layer, which is allowed but rarely what you want.
            </p>
          )}
        </div>
      ) : (
        /* ----------------------------------------------------------- text mode */
        <div className="mt-4">
          <Label htmlFor="encrypt-text">
            {direction === 'encrypt' ? 'Text to encrypt' : 'The Base64 container to decrypt'}
          </Label>
          <Textarea
            id="encrypt-text"
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value)
              setOutput(null)
              setOutputLabel(null)
            }}
            placeholder={
              direction === 'encrypt'
                ? 'Type or paste the secret — a note, a key, a recovery phrase…'
                : 'Paste the encrypted Base64 — line breaks and spaces are fine, they are stripped.'
            }
            className="mt-1.5 min-h-28 font-mono text-xs"
          />
          {textStats && (
            <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
              {textStats.chars.toLocaleString()} characters · {textStats.bytes.toLocaleString()} bytes
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------ password block */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <PasswordField
          id="encrypt-password"
          labelField="Password"
          password={password}
          onChange={(v) => {
            setPassword(v)
            setDone(null)
          }}
          visible={visible}
          onToggle={() => setVisible((v) => !v)}
          placeholder={direction === 'encrypt' ? 'Choose a long, unique password' : 'The password it was encrypted with'}
          autoComplete={direction === 'encrypt' ? 'new-password' : 'current-password'}
        />
        {direction === 'encrypt' ? (
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="encrypt-confirm">Confirm password</Label>
              {mismatch && (
                <span className="text-xs font-medium text-destructive" role="alert">
                  Does not match
                </span>
              )}
            </div>
            <Input
              id="encrypt-confirm"
              type={visible ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again — there is no recovery"
              autoComplete="new-password"
              spellCheck={false}
              aria-invalid={mismatch}
              className="mt-1.5 h-11 font-mono text-sm"
            />
          </div>
        ) : (
          <p className="self-end pb-1 text-xs leading-relaxed text-muted-foreground sm:pb-2.5">
            Decryption needs exactly the password used to encrypt. A wrong one is not guessed at —
            it is refused.
          </p>
        )}
      </div>

      {strength && direction === 'encrypt' && <StrengthMeter strength={strength} />}
      <HonestNotes />

      {/* ------------------------------------------------------------ action */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void (mode === 'files' ? runFiles() : runText())}
          disabled={!canRun || busy || mismatch}
          className="h-11 w-full sm:w-auto"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LockKeyhole className="size-4" aria-hidden="true" />
          )}
          {busy
            ? 'Working…'
            : mode === 'files'
              ? direction === 'encrypt'
                ? 'Encrypt file'
                : 'Decrypt file'
              : direction === 'encrypt'
                ? 'Encrypt text'
                : 'Decrypt text'}
        </Button>
        {!canRun && !busy && (
          <p className="text-xs text-muted-foreground">
            {direction === 'encrypt'
              ? password && !mismatch
                ? confirm
                  ? mode === 'files'
                    ? 'Pick a file to continue.'
                    : 'Type some text to continue.'
                  : 'Confirm the password to continue.'
                : 'Type a password to start.'
              : mode === 'files'
                ? picked
                  ? 'Type the password to continue.'
                  : 'Pick a .enc file and type the password.'
                : 'Paste the container and type the password.'}
          </p>
        )}
      </div>

      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Deriving the key (310,000 iterations) and working on it locally…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {done}
        </p>
      )}

      {/* ----------------------------------------------------- text result box */}
      {mode === 'text' && output !== null && (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {direction === 'encrypt' ? 'Encrypted container (Base64)' : 'Decrypted text'}
            </p>
            {outputLabel && <p className="text-xs tabular-nums text-muted-foreground">{outputLabel}</p>}
          </div>
          <Textarea
            readOnly
            value={output}
            aria-label={direction === 'encrypt' ? 'Encrypted container output' : 'Decrypted text output'}
            className="mt-2 min-h-28 bg-background font-mono text-xs"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => copyOutput(output)}>
              {copied ? (
                <Check className="size-3.5 text-primary" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([output], { type: 'text/plain;charset=utf-8' }),
                  direction === 'encrypt' ? 'encrypted.txt' : 'decrypted.txt',
                )
              }
            >
              <Download className="size-3.5" aria-hidden="true" />
              Download .txt
            </Button>
            {direction === 'encrypt' && (
              <p className="text-xs text-muted-foreground">
                This raw Base64 round-trips: paste it into Decrypt and it restores the text.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ container mini-diagram */}
      <details className="mt-6 rounded-xl border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          How this container is laid out
        </summary>
        <div className="border-t px-4 py-4">
          <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            Every operation writes the same byte layout — a .enc file and the Base64 text container
            differ only in transport. Nothing is hidden; decrypting means reading these fields in
            order.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-96 border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">Bytes</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Field</th>
                  <th scope="col" className="py-2 font-semibold">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">0–4</td>
                  <td className="py-2 pr-4">Magic — the ASCII letters KENC1</td>
                  <td className="py-2 tabular-nums">5</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">5</td>
                  <td className="py-2 pr-4">Format version (currently 1)</td>
                  <td className="py-2 tabular-nums">1</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">6–21</td>
                  <td className="py-2 pr-4">PBKDF2 salt — random, fresh every operation</td>
                  <td className="py-2 tabular-nums">16</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">22–33</td>
                  <td className="py-2 pr-4">AES-GCM IV — random, fresh every operation</td>
                  <td className="py-2 tabular-nums">12</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">34+</td>
                  <td className="py-2 pr-4">Ciphertext — AES-256-GCM of your data, no additional data</td>
                  <td className="py-2 tabular-nums">N</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-[62ch] text-xs leading-relaxed text-muted-foreground">
            Honest notes: this is Kontivo’s own container, not a GPG or OpenSSL format — the
            primitives (AES-256-GCM, PBKDF2-SHA256) are the standard ones browsers use for TLS, but
            only a tool that reads KENC1 opens these files. And GCM’s authentication tag means
            a wrong password or a flipped byte anywhere refuses to decrypt.
          </p>
        </div>
      </details>

      <PrivacyStrip detail="The key is derived in this tab and never leaves it — there is no upload code on this page." />
    </div>
  )
}
