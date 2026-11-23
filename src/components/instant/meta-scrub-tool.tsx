'use client'

// Metadata Cleaner — a real EXIF/PNG metadata viewer and scrubber, built on
// hand-written parsers (no exif library). The JPEG path walks segment
// markers and decodes the EXIF TIFF IFDs (IFD0, Exif sub-IFD, GPS IFD); the
// PNG path walks chunks, verifies CRCs, decodes tEXt/zTXt/iTXt and the eXIf
// block. The scrubber rewrites bytes on this device: JPEG is stripped to its
// structural segments (pixels byte-identical), PNG is rebuilt from critical
// chunks only. The cleaned file is re-parsed in memory as proof. Nothing is
// uploaded — there is no upload code.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Download, Loader2, MapPin, ScanSearch, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropZone,
  PrivacyStrip,
  downloadBlob,
  formatBytes,
} from '@/components/instant/instant-kit'

// -------------------------------------------------------------- constants ---

const MAX_BYTES = 100 * 1024 * 1024

type Format = 'JPEG' | 'PNG'

/** An ArrayBuffer-backed byte view — the only kind a BlobPart accepts under TS 5.9. */
type Bytes = Uint8Array<ArrayBuffer>

interface ExifTag {
  label: string
  value: string
}

interface GpsInfo {
  latDec: number
  lonDec: number
  latHemi: string
  lonHemi: string
  latDms: string
  lonDms: string
  altitude?: string
  when?: string
}

interface Container {
  name: string
  size: number
  note?: string
  counted?: boolean
  crcOk?: boolean
}

interface PngInfo {
  width: number
  height: number
  bitDepth: number
  colorType: string
  dpi: number | null
}

interface Analysis {
  format: Format
  records: number
  parts: string[]
  hasGps: boolean
  gps: GpsInfo | null
  tags: ExifTag[]
  thumbnailUrl: string | null
  containers: Container[]
  warnings: string[]
  png: PngInfo | null
}

interface ScrubResult {
  blob: Blob
  filename: string
  methodNote: string
  fallbackReason?: string
  beforeSize: number
  afterSize: number
  dropped: Container[]
  verifyRecords: number
  verifyGps: boolean
}

// ---------------------------------------------------------------- helpers ---

const latin1 = new TextDecoder('latin1')

function hex4(n: number): string {
  return n.toString(16).toUpperCase().padStart(4, '0')
}

function startsWithAscii(b: Uint8Array, off: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (off + i >= b.length || b[off + i] !== text.charCodeAt(i)) return false
  }
  return true
}

function asciiText(b: Uint8Array, off: number, max: number): string {
  let end = off
  const limit = Math.min(off + max, b.length)
  while (end < limit && b[end] !== 0) end++
  return latin1.decode(b.subarray(off, end))
}

/** EXIF "YYYY:MM:DD HH:mm:ss" -> "YYYY-MM-DD HH:mm:ss" (date-only also); anything else verbatim. */
function fmtExifDate(raw: string): string {
  const m = /^(\d{4}):(\d{2}):(\d{2})(?: (\d{2}:\d{2}:\d{2}))?$/.exec(raw.trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${m[4]}` : ''}` : raw
}

function trimNum(v: number, digits = 2): string {
  return parseFloat(v.toFixed(digits)).toString()
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(b: Bytes, start: number, end: number): number {
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const ORIENTATION_WORDS: Record<number, string> = {
  1: 'Normal',
  2: 'Mirrored horizontally',
  3: 'Rotated 180°',
  4: 'Mirrored vertically',
  5: 'Mirrored, then rotated 90° CCW',
  6: 'Rotated 90° CW',
  7: 'Mirrored, then rotated 90° CW',
  8: 'Rotated 90° CCW',
}

function flashWord(v: number): string {
  const fired = (v & 1) === 1
  const mode = (v >> 3) & 0x3
  const modeTxt =
    mode === 1 ? ', compulsory' : mode === 2 ? ', suppressed' : mode === 3 ? ', auto' : ''
  return (fired ? 'Fired' : 'Did not fire') + modeTxt
}

function meteringWord(v: number): string {
  return (
    { 0: 'Unknown', 1: 'Average', 2: 'Center-weighted', 3: 'Spot', 4: 'Multi-spot', 5: 'Evaluative', 6: 'Partial' }[
      v
    ] ?? `Type ${v}`
  )
}

function colorTypeWord(v: number): string {
  return { 0: 'Grayscale', 2: 'RGB', 3: 'Palette', 4: 'Grayscale + alpha', 6: 'RGBA' }[v] ?? `Type ${v}`
}

const EXIF_TAG_NAMES: Record<number, string> = {
  0x0100: 'Image width',
  0x0101: 'Image height',
  0x010e: 'Image description',
  0x010f: 'Camera make',
  0x0110: 'Camera model',
  0x0112: 'Orientation',
  0x011a: 'X resolution',
  0x011b: 'Y resolution',
  0x0128: 'Resolution unit',
  0x0131: 'Software',
  0x0132: 'File changed',
  0x013b: 'Artist',
  0x8298: 'Copyright',
  0x829a: 'Exposure',
  0x829d: 'F-number',
  0x8822: 'Exposure program',
  0x8827: 'ISO',
  0x8830: 'Sensitivity type',
  0x9000: 'EXIF version',
  0x9003: 'Taken (original)',
  0x9004: 'Digitized',
  0x9101: 'Component configuration',
  0x9102: 'Compressed bits per pixel',
  0x9201: 'Shutter speed (APEX)',
  0x9202: 'Aperture (APEX)',
  0x9203: 'Brightness (APEX)',
  0x9204: 'Exposure bias',
  0x9205: 'Max aperture',
  0x9206: 'Subject distance',
  0x9207: 'Metering',
  0x9208: 'Light source',
  0x9209: 'Flash',
  0x920a: 'Focal length',
  0x927c: 'Maker note',
  0x9286: 'User comment',
  0x9290: 'Subsecond (file)',
  0x9291: 'Subsecond (taken)',
  0x9292: 'Subsecond (digitized)',
  0xa000: 'Flashpix version',
  0xa001: 'Color space',
  0xa002: 'Exif width',
  0xa003: 'Exif height',
  0xa004: 'Related sound file',
  0xa20e: 'Focal plane X resolution',
  0xa20f: 'Focal plane Y resolution',
  0xa402: 'Exposure mode',
  0xa403: 'White balance',
  0xa404: 'Digital zoom',
  0xa405: 'Focal length (35 mm)',
  0xa406: 'Scene capture type',
  0xa407: 'Gain control',
  0xa408: 'Contrast',
  0xa409: 'Saturation',
  0xa40a: 'Sharpness',
  0xa40c: 'Subject distance range',
  0xa420: 'Image unique ID',
  0xa430: 'Camera owner',
  0xa431: 'Body serial number',
  0xa432: 'Lens specification',
  0xa433: 'Lens make',
  0xa434: 'Lens model',
  0xa435: 'Lens serial number',
}

const GPS_TAG_NAMES: Record<number, string> = {
  0x0000: 'GPS version ID',
  0x0001: 'GPS latitude ref',
  0x0002: 'GPS latitude',
  0x0003: 'GPS longitude ref',
  0x0004: 'GPS longitude',
  0x0005: 'GPS altitude ref',
  0x0006: 'GPS altitude',
  0x0007: 'GPS timestamp',
  0x0008: 'GPS satellites',
  0x0009: 'GPS status',
  0x000a: 'GPS measure mode',
  0x000b: 'GPS dilution',
  0x000c: 'GPS speed ref',
  0x000d: 'GPS speed',
  0x0010: 'GPS direction ref',
  0x0011: 'GPS direction',
  0x0012: 'GPS map datum',
  0x001d: 'GPS date',
  0x001f: 'GPS positioning error',
}

// ------------------------------------------------------------- JPEG walk ----

interface JBlock {
  marker: number
  start: number
  end: number
  dataStart: number
  dataEnd: number
}

type WalkResult =
  | { ok: true; blocks: JBlock[]; eoiFound: boolean }
  | { ok: false; reason: string }

/** Walk JPEG segment markers; the SOS block includes the entropy-coded scan. */
function walkJpeg(b: Bytes): WalkResult {
  if (b.length < 4) return { ok: false, reason: 'the file is too short to be a JPEG' }
  if (b[0] !== 0xff || b[1] !== 0xd8) return { ok: false, reason: 'the SOI marker (FF D8) is missing' }
  const blocks: JBlock[] = [{ marker: 0xd8, start: 0, end: 2, dataStart: 0, dataEnd: 0 }]
  let pos = 2
  let eoiFound = false
  while (pos < b.length) {
    if (b[pos] !== 0xff) return { ok: false, reason: `marker alignment is lost at byte ${pos}` }
    const ffStart = pos
    while (pos < b.length && b[pos] === 0xff) pos++
    if (pos >= b.length) return { ok: false, reason: 'the file ends inside a marker' }
    const marker = b[pos]
    pos++
    if (marker === 0xd9) {
      blocks.push({ marker: 0xd9, start: ffStart, end: pos, dataStart: pos, dataEnd: pos })
      eoiFound = true
      break
    }
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (pos + 1 >= b.length) return { ok: false, reason: 'the file ends inside a segment header' }
    const segLen = (b[pos] << 8) | b[pos + 1]
    if (segLen < 2) return { ok: false, reason: `a degenerate segment length appears at byte ${ffStart}` }
    const segEnd = pos + segLen
    if (segEnd > b.length) return { ok: false, reason: 'a segment length runs past the end of the file' }
    const dataStart = pos + 2
    if (marker === 0xda) {
      // SOS: header ends at segEnd, then entropy-coded data up to the next
      // real marker (0xFF followed by neither a stuffing byte nor an RST).
      let i = segEnd
      while (i < b.length - 1) {
        if (b[i] === 0xff) {
          const nx = b[i + 1]
          if (nx !== 0x00 && !(nx >= 0xd0 && nx <= 0xd7)) break
        }
        i++
      }
      const entropyEnd = i >= b.length - 1 ? b.length : i
      blocks.push({ marker: 0xda, start: ffStart, end: entropyEnd, dataStart, dataEnd: segEnd })
      pos = entropyEnd
    } else {
      blocks.push({ marker, start: ffStart, end: segEnd, dataStart, dataEnd: segEnd })
      pos = segEnd
    }
  }
  return { ok: true, blocks, eoiFound }
}

const XMP_PREFIX = 'http://ns.adobe.com/xap/1.0/\u0000'
const XMP_EXT_PREFIX = 'http://ns.adobe.com/xmp/extension/\u0000'

function appSegmentLabel(marker: number, payload: Uint8Array): string {
  if (marker === 0xfe) return 'COM (comment)'
  if (marker < 0xe0 || marker > 0xef) return `Marker 0x${marker.toString(16).toUpperCase()}`
  const n = marker - 0xe0
  if (startsWithAscii(payload, 0, 'Exif\u0000\u0000')) return 'APP1 (EXIF)'
  if (startsWithAscii(payload, 0, XMP_PREFIX)) return 'APP1 (XMP)'
  if (startsWithAscii(payload, 0, XMP_EXT_PREFIX)) return 'APP1 (XMP extension)'
  if (startsWithAscii(payload, 0, 'ICC_PROFILE\u0000')) return `APP${n} (ICC profile)`
  if (startsWithAscii(payload, 0, 'MPF\u0000')) return `APP${n} (MPF multi-picture)`
  if (marker === 0xe0) return 'APP0 (JFIF)'
  if (marker === 0xed) return 'APP13 (Photoshop IRB)'
  if (marker === 0xee) return 'APP14 (Adobe)'
  return `APP${n}`
}

// ------------------------------------------------- TIFF / EXIF IFD decode ---

interface TiffResult {
  ok: boolean
  entryCount: number
  tags: ExifTag[]
  gps: GpsInfo | null
  thumb: { start: number; length: number } | null
  warnings: string[]
}

function parseTiff(t: Bytes): TiffResult {
  const res: TiffResult = {
    ok: false,
    entryCount: 0,
    tags: [],
    gps: null,
    thumb: null,
    warnings: [],
  }
  if (t.length < 8) {
    res.warnings.push('The EXIF block is too short to hold a TIFF header.')
    return res
  }
  const dv = new DataView(t.buffer, t.byteOffset, t.byteLength)
  const bom = dv.getUint16(0)
  const little = bom === 0x4949
  if (!little && bom !== 0x4d4d) {
    res.warnings.push('The EXIF byte-order mark is unreadable (not II/MM).')
    return res
  }
  if (dv.getUint16(2, little) !== 0x2a) {
    res.warnings.push('The EXIF TIFF magic (0x2A) is missing.')
    return res
  }
  res.ok = true

  const sizeOf = (type: number) =>
    ([0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] ?? 1) as number

  function readAscii(valOff: number, count: number): string {
    if (valOff < 0 || valOff + count > t.length) return ''
    return asciiText(t, valOff, count)
  }

  function readNums(type: number, valOff: number, count: number): number[] {
    const out: number[] = []
    const sz = sizeOf(type)
    for (let i = 0; i < count; i++) {
      const o = valOff + i * sz
      if (o + sz > t.length) break
      if (type === 3) out.push(dv.getUint16(o, little))
      else if (type === 4) out.push(dv.getUint32(o, little))
      else if (type === 8) out.push(dv.getInt16(o, little))
      else if (type === 9) out.push(dv.getInt32(o, little))
      else out.push(t[o])
    }
    return out
  }

  function readRationals(type: number, valOff: number, count: number): Array<[number, number]> {
    const out: Array<[number, number]> = []
    if (valOff < 0 || valOff + count * 8 > t.length) return out
    for (let i = 0; i < count; i++) {
      const o = valOff + i * 8
      out.push(
        type === 5
          ? [dv.getUint32(o, little), dv.getUint32(o + 4, little)]
          : [dv.getInt32(o, little), dv.getInt32(o + 4, little)],
      )
    }
    return out
  }

  function ratsText(rats: Array<[number, number]>): string {
    return rats.map(([n, d]) => (d === 1 ? `${n}` : `${n}/${d}`)).join(', ')
  }

  function userComment(valOff: number, count: number): string {
    if (valOff < 0 || valOff + count > t.length || count <= 8) return `binary, ${count} B`
    const head = latin1.decode(t.subarray(valOff, valOff + 8))
    if (/^(ASCII|UNICODE|JIS)\u0000+$/.test(head)) {
      const body = t.subarray(valOff + 8, valOff + count)
      if (head.startsWith('UNICODE')) {
        try {
          return new TextDecoder('utf-16le').decode(body).replace(/\u0000+$/g, '').trim()
        } catch {
          /* fall through */
        }
      }
      return latin1.decode(body).replace(/\u0000+$/g, '').trim()
    }
    return `binary, ${count} B`
  }

  function fmtRationalTag(tag: number, rats: Array<[number, number]>): string {
    const [n, d] = rats[0] ?? [0, 0]
    const v = d === 0 ? 0 : n / d
    switch (tag) {
      case 0x829a: {
        if (v >= 1) return `${trimNum(v)} s`
        return d === 0 ? `${n}/0 s` : `1/${Math.round(1 / v)} s`
      }
      case 0x829d:
      case 0x9202:
      case 0x9205:
        return `f/${trimNum(Math.round(Math.pow(2, v / 2) * 10) / 10, 1)}`
      case 0x9201:
        return v === 0 ? '0 s' : `1/${Math.round(Math.pow(2, v))} s`
      case 0x9203:
        return `${trimNum(v)} EV`
      case 0x9204: {
        const s = v >= 0 ? '+' : ''
        return `${s}${trimNum(v)} EV`
      }
      case 0x9206:
        return `${trimNum(v)} m`
      case 0x920a:
        return `${trimNum(v)} mm`
      case 0xa432:
        return rats.map(([rn, rd]) => (rd === 1 ? `${rn}` : `${trimNum(rn / rd)} mm`)).join(', ')
      default:
        return ratsText(rats)
    }
  }

  function fmtNumTag(tag: number, nums: number[], type: number): string {
    const v = nums[0]
    switch (tag) {
      case 0x0100:
      case 0x0101:
      case 0xa002:
      case 0xa003:
        return `${v} px`
      case 0x0112:
        return ORIENTATION_WORDS[v] ?? `Value ${v}`
      case 0x9209:
        return flashWord(v)
      case 0x9207:
        return meteringWord(v)
      case 0x8822:
        return { 0: 'Unknown', 1: 'Manual', 2: 'Program auto', 3: 'Aperture priority', 4: 'Shutter priority', 5: 'Creative', 6: 'Action', 7: 'Portrait', 8: 'Landscape', 9: 'Bulb' }[v] ?? `Program ${v}`
      case 0xa402:
        return { 0: 'Auto', 1: 'Manual', 2: 'Auto bracket' }[v] ?? `Value ${v}`
      case 0xa403:
        return v === 0 ? 'Auto' : 'Manual'
      case 0xa404:
        return `×${trimNum(v)}`
      case 0xa405:
        return `${v} mm (35 mm equiv)`
      case 0xa001:
        return v === 1 ? 'sRGB' : v === 0xffff ? 'Adobe RGB' : `Value ${v}`
      case 0x0128:
        return { 1: 'none', 2: 'inches', 3: 'cm' }[v] ?? `Value ${v}`
      default:
        return nums.join(', ')
    }
  }

  // GPS pieces are collected raw and composed after the walk.
  const gpsRec: Record<string, string | Array<[number, number]> | number | undefined> = {}

  function pushGps(tag: number, type: number, valOff: number, count: number) {
    if (type === 2) gpsRec[`s${tag}`] = readAscii(valOff, count)
    else if (type === 5 || type === 10) gpsRec[`r${tag}`] = readRationals(type, valOff, count)
    else if (type === 1 || type === 3 || type === 4) gpsRec[`n${tag}`] = readNums(type, valOff, count)[0]
  }

  function fmtGpsTag(tag: number, type: number, valOff: number, count: number): string {
    if (tag === 0x0002 || tag === 0x0004) {
      const rats = readRationals(5, valOff, count)
      if (rats.length < 3) return ratsText(rats)
      const [d, m, s] = rats
      const dd = d[0] / (d[1] || 1)
      const mm = m[0] / (m[1] || 1)
      const ss = s[0] / (s[1] || 1)
      return `${trimNum(dd, 0)}° ${trimNum(mm, 0)}′ ${trimNum(ss)}″`
    }
    if (type === 2) {
      const text = readAscii(valOff, count)
      return tag === 0x001d ? fmtExifDate(text) : text
    }
    if (type === 5 || type === 10) {
      const rats = readRationals(type, valOff, count)
      if (tag === 0x0006) {
        const [an, ad] = rats[0] ?? [0, 1]
        return `${trimNum(an / (ad || 1))} m`
      }
      return ratsText(rats)
    }
    return fmtNumTag(tag, readNums(type, valOff, count), type)
  }

  function walkIfd(
    dirOff: number,
    space: 'ifd0' | 'exif' | 'gps',
  ): { exifPtr: number; gpsPtr: number; thumbOff: number; thumbLen: number } {
    const out = { exifPtr: -1, gpsPtr: -1, thumbOff: -1, thumbLen: -1 }
    if (dirOff <= 0 || dirOff + 2 > t.length) {
      res.warnings.push(`The EXIF ${space} directory offset is out of range — walked what was readable.`)
      return out
    }
    const n = dv.getUint16(dirOff, little)
    if (n > 1024) {
      res.warnings.push(`The EXIF ${space} directory claims ${n} entries — refused as implausible.`)
      return out
    }
    for (let i = 0; i < n; i++) {
      const e = dirOff + 2 + i * 12
      if (e + 12 > t.length) {
        res.warnings.push(`The EXIF ${space} directory is truncated after ${i} entries.`)
        break
      }
      const tag = dv.getUint16(e, little)
      const type = dv.getUint16(e + 2, little)
      const count = dv.getUint32(e + 4, little)
      const size = sizeOf(type) * count
      const valOff = size <= 4 ? e + 8 : dv.getUint32(e + 8, little)
      if (type === 0 || count === 0) continue

      if (space === 'ifd0') {
        if (tag === 0x8769 && type === 4) {
          out.exifPtr = dv.getUint32(e + 8, little)
          continue
        }
        if (tag === 0x8825 && type === 4) {
          out.gpsPtr = dv.getUint32(e + 8, little)
          continue
        }
        if (tag === 0x0201 && (type === 3 || type === 4)) {
          out.thumbOff = readNums(type, valOff, count)[0] ?? -1
          continue
        }
        if (tag === 0x0202 && (type === 3 || type === 4)) {
          out.thumbLen = readNums(type, valOff, count)[0] ?? -1
          continue
        }
      }

      res.entryCount++
      if (space === 'gps') pushGps(tag, type, valOff, count)

      const name =
        space === 'gps'
          ? GPS_TAG_NAMES[tag] ?? `GPS tag 0x${hex4(tag)}`
          : EXIF_TAG_NAMES[tag] ?? `Tag 0x${hex4(tag)}`
      let value: string
      if (space === 'gps') value = fmtGpsTag(tag, type, valOff, count)
      else if (type === 2) value = readAscii(valOff, count)
      else if (tag === 0x9286 && type === 7) value = userComment(valOff, count)
      else if (type === 7 || type === 1 || type === 6) value = `binary, ${count} B`
      else if (type === 5 || type === 10) value = fmtRationalTag(tag, readRationals(type, valOff, count))
      else value = fmtNumTag(tag, readNums(type, valOff, count), type)
      res.tags.push({ label: name, value: value || '(empty)' })
    }
    return out
  }

  const ifd0 = walkIfd(dv.getUint32(4, little), 'ifd0')
  if (ifd0.exifPtr >= 0) walkIfd(ifd0.exifPtr, 'exif')
  if (ifd0.gpsPtr >= 0) walkIfd(ifd0.gpsPtr, 'gps')

  if (ifd0.thumbOff >= 0 && ifd0.thumbLen > 0) {
    if (ifd0.thumbOff + ifd0.thumbLen <= t.length) {
      res.thumb = { start: ifd0.thumbOff, length: ifd0.thumbLen }
    } else {
      res.warnings.push('A thumbnail is referenced but its bytes fall outside the EXIF block.')
    }
  }

  // Compose GPS coordinates from the collected pieces.
  const latRats = gpsRec.r2 as Array<[number, number]> | undefined
  const lonRats = gpsRec.r4 as Array<[number, number]> | undefined
  const latRef = (gpsRec.s1 as string | undefined)?.trim().toUpperCase()
  const lonRef = (gpsRec.s3 as string | undefined)?.trim().toUpperCase()
  if (latRats && lonRats && latRats.length >= 3 && lonRats.length >= 3) {
    const dms = (rats: Array<[number, number]>) => {
      const [d, m, s] = rats
      return d[0] / (d[1] || 1) + m[0] / (m[1] || 1) / 60 + s[0] / (s[1] || 1) / 3600
    }
    const latHemi = latRef === 'S' ? 'S' : 'N'
    const lonHemi = lonRef === 'W' ? 'W' : 'E'
    const dmsTxt = (rats: Array<[number, number]>, hemi: string) => {
      const [d, m, s] = rats
      return `${trimNum(d[0] / (d[1] || 1), 0)}° ${trimNum(m[0] / (m[1] || 1), 0)}′ ${trimNum(s[0] / (s[1] || 1))}″ ${hemi}`
    }
    const info: GpsInfo = {
      latDec: dms(latRats),
      lonDec: dms(lonRats),
      latHemi,
      lonHemi,
      latDms: dmsTxt(latRats, latHemi),
      lonDms: dmsTxt(lonRats, lonHemi),
    }
    const altRats = gpsRec.r6 as Array<[number, number]> | undefined
    if (altRats && altRats.length) {
      const [an, ad] = altRats[0]
      const below = (gpsRec.n5 as number | undefined) === 1
      info.altitude = `${trimNum(an / (ad || 1))} m ${below ? 'below' : 'above'} sea level`
    }
    const dateStamp = gpsRec.s29 as string | undefined
    if (dateStamp) {
      const timeRats = gpsRec.r7 as Array<[number, number]> | undefined
      const time = timeRats
        ? timeRats.map(([tn, td]) => String(Math.round(tn / (td || 1))).padStart(2, '0')).join(':')
        : undefined
      info.when = `${fmtExifDate(dateStamp)}${time ? ` at ${time} UTC` : ''}`
    }
    res.gps = info
  }
  return res
}

// --------------------------------------------------------- JPEG analysis ----

function analyzeJpeg(b: Bytes): Analysis {
  const walk = walkJpeg(b)
  if (!walk.ok) {
    throw new Error(
      `This file starts like a JPEG but its segment structure could not be walked: ${walk.reason}. The viewer needs a well-formed file — try re-exporting it as a plain JPEG first.`,
    )
  }
  const warnings: string[] = []
  if (!walk.eoiFound) warnings.push('No EOI marker found — the file appears to be truncated, but everything before the cut was parsed.')

  let tiff: TiffResult | null = null
  const containers: Container[] = []
  let records = 0

  for (const blk of walk.blocks) {
    const isAppn = blk.marker >= 0xe0 && blk.marker <= 0xef
    const isCom = blk.marker === 0xfe
    if (!isAppn && !isCom) continue
    const payload = b.subarray(blk.dataStart, blk.dataEnd)
    const label = appSegmentLabel(blk.marker, payload)
    const size = blk.dataEnd - blk.dataStart
    let note: string | undefined
    if (label === 'APP1 (EXIF)') {
      if (!tiff) {
        tiff = parseTiff(payload.subarray(6))
        warnings.push(...tiff.warnings)
        note = 'decoded into the table below — cut in the scrub'
      } else {
        note = 'a second EXIF block — cut in the scrub'
      }
    } else if (label === 'APP1 (XMP)' || label === 'APP1 (XMP extension)') {
      note = 'Adobe XMP metadata — cut in the scrub, counted as one record (not decoded in detail)'
    } else if (label.endsWith('(ICC profile)')) {
      note = 'color profile — cut in the scrub; sRGB photos shift nothing, wide-gamut photos can shift slightly'
    } else if (label === 'COM (comment)') {
      const text = asciiText(payload, 0, 60)
      note = text ? `“${text}”` : undefined
    }
    const counted = !(label === 'APP1 (EXIF)' || label === 'APP0 (JFIF)')
    if (counted) records++
    containers.push({ name: label, size, note, counted })
  }

  if (tiff) records += tiff.entryCount

  let thumbnailUrl: string | null = null
  if (tiff?.thumb && tiff.ok) {
    // EXIF offsets are relative to the TIFF header, which sits 6 bytes into
    // the APP1 payload ("Exif\0\0" then the TIFF block).
    const tiffStart = findTiffStart(b, walk.blocks)
    if (tiffStart >= 0) {
      const slice = b.slice(tiffStart + tiff.thumb.start, tiffStart + tiff.thumb.start + tiff.thumb.length)
      thumbnailUrl = URL.createObjectURL(new Blob([slice], { type: 'image/jpeg' }))
    }
  }

  const parts: string[] = []
  if (tiff?.entryCount) parts.push(`${tiff.entryCount} EXIF tags`)
  const others = containers.filter((c) => c.counted).length
  if (others) parts.push(`${others} container${others === 1 ? '' : 's'}`)

  return {
    format: 'JPEG',
    records,
    parts,
    hasGps: !!tiff?.gps,
    gps: tiff?.gps ?? null,
    tags: tiff?.tags ?? [],
    thumbnailUrl,
    containers,
    warnings,
    png: null,
  }
}

/** Offset (in the whole file) of the TIFF header inside the first EXIF APP1. */
function findTiffStart(b: Bytes, blocks: JBlock[]): number {
  for (const blk of blocks) {
    if (blk.marker !== 0xe1) continue
    if (startsWithAscii(b, blk.dataStart, 'Exif\u0000\u0000')) return blk.dataStart + 6
  }
  return -1
}

// ---------------------------------------------------------- PNG analysis ----

interface PChunk {
  type: string
  start: number
  dataStart: number
  dataEnd: number
  crcOk: boolean
}

function walkPng(b: Bytes): PChunk[] {
  const chunks: PChunk[] = []
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let pos = 8
  while (pos + 8 <= b.length) {
    const len = dv.getUint32(pos)
    if (len > 0x7fffffff) throw new Error(`PNG chunk length is implausible (${len} B) at byte ${pos}.`)
    const dataEnd = pos + 8 + len
    if (dataEnd + 4 > b.length) {
      throw new Error(`The PNG is truncated inside a "${b.slice(pos + 4, pos + 8)}" chunk — parsed what was readable.`)
    }
    const type = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7])
    const crcStored = dv.getUint32(dataEnd)
    const crcOk = crcStored === crc32(b, pos + 4, dataEnd)
    chunks.push({ type, start: pos, dataStart: pos + 8, dataEnd, crcOk })
    pos = dataEnd + 4
    if (type === 'IEND') break
  }
  return chunks
}

async function inflateText(data: Bytes): Promise<string> {
  const ds = new DecompressionStream('deflate')
  const stream = new Blob([data]).stream().pipeThrough(ds)
  const buf = await new Response(stream).arrayBuffer()
  return latin1.decode(new Uint8Array(buf)).replace(/\u0000+$/g, '')
}

async function analyzePng(b: Bytes): Promise<Analysis> {
  const warnings: string[] = []
  const chunks = walkPng(b)
  if (!chunks.length) throw new Error('No PNG chunks found after the signature.')
  if (chunks[chunks.length - 1].type !== 'IEND') {
    warnings.push('No IEND chunk — the file is truncated, but every chunk before the cut was parsed.')
  }

  const ihdr = chunks.find((c) => c.type === 'IHDR')
  if (!ihdr) throw new Error('This file carries the PNG signature but no IHDR chunk — it is not a valid PNG.')
  if (ihdr.dataEnd - ihdr.dataStart < 13) {
    throw new Error('The IHDR chunk is shorter than the 13 bytes the PNG spec requires.')
  }

  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const width = dv.getUint32(ihdr.dataStart)
  const height = dv.getUint32(ihdr.dataStart + 4)
  const bitDepth = b[ihdr.dataStart + 8]
  const colorType = colorTypeWord(b[ihdr.dataStart + 9])

  let dpi: number | null = null
  const tags: ExifTag[] = []
  const containers: Container[] = []
  let records = 0
  let tiff: TiffResult | null = null

  for (const c of chunks) {
    const critical = c.type[0] === c.type[0].toUpperCase()
    const size = c.dataEnd - c.dataStart
    const d = b.subarray(c.dataStart, c.dataEnd)
    let note: string | undefined = critical
      ? 'critical — kept in the scrub'
      : 'ancillary — dropped in the scrub'
    if (!c.crcOk) {
      warnings.push(
        `Chunk ${c.type}: CRC mismatch — the stored checksum does not match the data. The file may be corrupt or edited.`,
      )
      note = `CRC mismatch — the stored checksum does not match the data. ${note}`
    }

    if (c.type === 'pHYs' && size >= 9) {
      const ppuX = dv.getUint32(c.dataStart)
      const unit = b[c.dataStart + 8]
      if (unit === 1) dpi = Math.round(ppuX * 0.0254)
      note = 'pixel density (rendering info, not private) — dropped in the scrub'
    } else if (c.type === 'tEXt') {
      const nul = d.indexOf(0)
      if (nul > 0) {
        const key = latin1.decode(d.subarray(0, nul))
        const value = latin1.decode(d.subarray(nul + 1)) || '(empty)'
        tags.push({ label: `${key} (tEXt)`, value })
        records++
        note = 'text chunk — decoded below; this is where Software/Comment keys hide'
      }
    } else if (c.type === 'zTXt') {
      const nul = d.indexOf(0)
      if (nul > 0) {
        const key = latin1.decode(d.subarray(0, nul))
        try {
          const value = (await inflateText(d.subarray(nul + 2))) || '(empty)'
          tags.push({ label: `${key} (zTXt, deflated)`, value })
          records++
          note = 'deflated text chunk — decoded below'
        } catch {
          warnings.push(`zTXt chunk "${key}" could not be inflated — it is still dropped by the scrub.`)
          records++
          note = 'deflated text chunk — unreadable here, still dropped in the scrub'
        }
      }
    } else if (c.type === 'iTXt') {
      const nul = d.indexOf(0)
      if (nul > 0) {
        const key = latin1.decode(d.subarray(0, nul))
        const compFlag = d[nul + 1]
        let rest = nul + 3
        // language tag \0 translated keyword \0, then the text
        while (rest < d.length && d[rest] !== 0) rest++
        rest++
        while (rest < d.length && d[rest] !== 0) rest++
        rest++
        try {
          const value =
            compFlag === 1
              ? (await inflateText(d.subarray(rest))) || '(empty)'
              : latin1.decode(d.subarray(rest)) || '(empty)'
          tags.push({ label: `${key} (iTXt${compFlag === 1 ? ', deflated' : ''})`, value })
          records++
          note = 'international text chunk — decoded below'
        } catch {
          warnings.push(`iTXt chunk "${key}" could not be inflated — it is still dropped by the scrub.`)
          records++
          note = 'international text chunk — unreadable here, still dropped in the scrub'
        }
      }
    } else if (c.type === 'tIME' && size >= 7) {
      const year = dv.getUint16(c.dataStart)
      const when = `${year}-${String(d[c.dataStart + 2]).padStart(2, '0')}-${String(d[c.dataStart + 3]).padStart(2, '0')} ${String(d[c.dataStart + 4]).padStart(2, '0')}:${String(d[c.dataStart + 5]).padStart(2, '0')}:${String(d[c.dataStart + 6]).padStart(2, '0')}`
      tags.push({ label: 'Last modified (tIME)', value: when })
      records++
      note = 'modification timestamp — decoded below'
    } else if (c.type === 'eXIf') {
      tiff = parseTiff(d)
      warnings.push(...tiff.warnings)
      records += tiff.entryCount
      note = 'EXIF block — decoded into the table below'
    } else if (c.type === 'iCCP') {
      const nul = d.indexOf(0)
      const key = nul > 0 ? latin1.decode(d.subarray(0, nul)) : 'profile'
      records++
      note = `color profile (${key}) — dropped in the scrub; sRGB images shift nothing, wide-gamut images can shift slightly`
    }

    containers.push({ name: c.type, size, note, counted: !critical, crcOk: c.crcOk })
  }

  const parts: string[] = []
  if (tiff?.entryCount) parts.push(`${tiff.entryCount} EXIF tags (eXIf chunk)`)
  const textCount = tags.filter((t) => /\((tEXt|zTXt|iTXt)/.test(t.label)).length
  if (textCount) parts.push(`${textCount} text chunk${textCount === 1 ? '' : 's'}`)
  const ancillary = chunks.filter((c) => c.type[0] === c.type[0].toLowerCase()).length
  if (ancillary) parts.push(`${ancillary} ancillary chunk${ancillary === 1 ? '' : 's'}`)

  return {
    format: 'PNG',
    records,
    parts,
    hasGps: !!tiff?.gps,
    gps: tiff?.gps ?? null,
    tags,
    thumbnailUrl: null,
    containers,
    warnings,
    png: { width, height, bitDepth, colorType, dpi },
  }
}

async function analyze(bytes: Bytes, format: Format): Promise<Analysis> {
  return format === 'JPEG' ? analyzeJpeg(bytes) : analyzePng(bytes)
}

function detectFormat(b: Bytes): Format | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'JPEG'
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return 'PNG'
  }
  return null
}

// -------------------------------------------------------------- scrubbers ---

const JPEG_KEEP = new Set<number>([
  0xc4, // DHT
  0xdb, // DQT
  0xdd, // DRI
  0xdc, // DNL
  0xcc, // DAC
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf, // SOFs
  0xda, // SOS (+ entropy data, included in the block)
  0xd9, // EOI
])

type JpegScrub =
  | { ok: true; out: Bytes; dropped: Container[]; hadSos: boolean; eoiFound: boolean }
  | { ok: false; reason: string }

function scrubJpegLossless(b: Bytes): JpegScrub {
  const walk = walkJpeg(b)
  if (!walk.ok) return { ok: false, reason: walk.reason }
  const keepBlocks = walk.blocks.filter((blk) => blk.marker === 0xd8 || JPEG_KEEP.has(blk.marker))
  const droppedBlocks = walk.blocks.filter((blk) => blk.marker !== 0xd8 && !JPEG_KEEP.has(blk.marker))
  const hadSos = keepBlocks.some((blk) => blk.marker === 0xda)
  if (!hadSos) return { ok: false, reason: 'no image data (SOS) was found, so there is nothing to keep' }
  if (!keepBlocks.some((blk) => blk.marker === 0xdb || (blk.marker >= 0xc0 && blk.marker <= 0xcf))) {
    return { ok: false, reason: 'no quantization/frame segments were found, so the strip would be unsafe' }
  }

  const eoiBytes = walk.eoiFound ? 0 : 2
  let total = 2 + eoiBytes
  for (const blk of keepBlocks) {
    if (blk.marker === 0xd8) continue
    total += blk.end - blk.start
  }
  const out = new Uint8Array(total)
  out[0] = 0xff
  out[1] = 0xd8
  let pos = 2
  for (const blk of keepBlocks) {
    if (blk.marker === 0xd8) continue
    out.set(b.subarray(blk.start, blk.end), pos)
    pos += blk.end - blk.start
  }
  if (!walk.eoiFound) {
    out[pos] = 0xff
    out[pos + 1] = 0xd9
  }

  const dropped: Container[] = droppedBlocks.map((blk) => ({
    name: appSegmentLabel(blk.marker, b.subarray(blk.dataStart, blk.dataEnd)),
    size: blk.dataEnd - blk.dataStart,
  }))
  return { ok: true, out, dropped, hadSos, eoiFound: walk.eoiFound }
}

const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND'])

type PngScrub =
  | { ok: true; out: Bytes; dropped: Container[] }
  | { ok: false; reason: string }

/** Rebuild the PNG from critical chunks only; every written CRC is recomputed. */
function scrubPng(b: Bytes): PngScrub {
  let chunks: PChunk[]
  try {
    chunks = walkPng(b)
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'the chunk walk failed' }
  }
  const hasIhdr = chunks.some((c) => c.type === 'IHDR')
  const hasIdat = chunks.some((c) => c.type === 'IDAT')
  const hasIend = chunks.some((c) => c.type === 'IEND')
  if (!hasIhdr || !hasIdat || !hasIend) {
    return { ok: false, reason: 'the file is missing IHDR, IDAT or IEND — a valid PNG cannot be rebuilt' }
  }
  const kept = chunks.filter((c) => PNG_KEEP.has(c.type))
  const unknownCritical = chunks.filter((c) => !PNG_KEEP.has(c.type) && c.type[0] === c.type[0].toUpperCase())
  if (unknownCritical.length) {
    return {
      ok: false,
      reason: `the file carries unknown critical chunk(s) (${unknownCritical
        .map((c) => c.type)
        .join(', ')}) that cannot be dropped safely`,
    }
  }
  const droppedChunks = chunks.filter((c) => !PNG_KEEP.has(c.type))
  const dropped: Container[] = droppedChunks.map((c) => ({
    name: c.type,
    size: c.dataEnd - c.dataStart,
    note: 'ancillary chunk',
  }))

  let total = 8
  for (const c of kept) total += 12 + (c.dataEnd - c.dataStart)
  const out = new Uint8Array(total)
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  const dv = new DataView(out.buffer)
  let pos = 8
  for (const c of kept) {
    const len = c.dataEnd - c.dataStart
    dv.setUint32(pos, len)
    for (let i = 0; i < 4; i++) out[pos + 4 + i] = b[c.start + 4 + i]
    out.set(b.subarray(c.dataStart, c.dataEnd), pos + 8)
    dv.setUint32(pos + 8 + len, crc32(out, pos + 4, pos + 8 + len))
    pos += 12 + len
  }
  return { ok: true, out, dropped }
}

async function reencodeJpeg(file: File): Promise<Bytes> {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('this browser refused to provide a drawing context')
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (!blob) throw new Error('the canvas refused to encode a JPEG')
  return new Uint8Array(await blob.arrayBuffer())
}

// ------------------------------------------------------------- component ----

function GpsCard({ gps }: { gps: GpsInfo }) {
  return (
    <div className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
        <MapPin className="size-4" aria-hidden="true" />
        This photo carries GPS coordinates
      </p>
      <p className="mt-2 font-mono text-lg tabular-nums text-foreground">
        {Math.abs(gps.latDec).toFixed(6)}° {gps.latHemi}, {Math.abs(gps.lonDec).toFixed(6)}° {gps.lonHemi}
      </p>
      <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
        Signed decimals: {gps.latHemi === 'S' ? '-' : ''}
        {gps.latDec.toFixed(6)}, {gps.lonHemi === 'W' ? '-' : ''}
        {gps.lonDec.toFixed(6)} · DMS: {gps.latDms}, {gps.lonDms} · plain coordinates only — no map, no lookup
      </p>
      {gps.altitude && <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">Altitude: {gps.altitude}</p>}
      {gps.when && <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">Fix time: {gps.when}</p>}
    </div>
  )
}

export function MetaScrubTool() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [scrub, setScrub] = useState<ScrubResult | null>(null)
  const [scrubBusy, setScrubBusy] = useState(false)
  const fileRef = useRef<File | null>(null)
  const thumbUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (thumbUrlRef.current) URL.revokeObjectURL(thumbUrlRef.current)
    }
  }, [])

  const handleFile = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setError(null)
    setScrub(null)
    setAnalysis(null)
    if (thumbUrlRef.current) {
      URL.revokeObjectURL(thumbUrlRef.current)
      thumbUrlRef.current = null
    }
    if (file.size > MAX_BYTES) {
      setFileInfo(null)
      fileRef.current = null
      setError(
        `That photo is ${formatBytes(file.size)} — this page caps at 100 MB per photo, because the scrub holds the file in memory twice. Use a desktop tool for anything bigger.`,
      )
      return
    }
    setFileInfo({ name: file.name, size: file.size })
    fileRef.current = file
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer()) as Bytes
      const format = detectFormat(bytes)
      if (!format) {
        setFileInfo(null)
        fileRef.current = null
        setError(
          'The magic bytes say this is neither JPEG nor PNG (the format is checked, not the file name). HEIC/HEIF — the iPhone default — and WebP cannot be parsed here; export the photo as JPEG first and come back.',
        )
        return
      }
      const a = await analyze(bytes, format)
      if (a.thumbnailUrl) thumbUrlRef.current = a.thumbnailUrl
      setAnalysis(a)
    } catch (err) {
      setFileInfo(null)
      fileRef.current = null
      setError(err instanceof Error ? err.message : 'Could not parse that file.')
    } finally {
      setBusy(false)
    }
  }, [])

  const doScrub = useCallback(async () => {
    const file = fileRef.current
    if (!file || !analysis || !fileInfo) return
    setScrubBusy(true)
    setError(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer()) as Bytes
      let out: Bytes
      let methodNote: string
      let fallbackReason: string | undefined
      let dropped: Container[]
      let mime: string
      let ext: string

      if (analysis.format === 'JPEG') {
        const r = scrubJpegLossless(bytes)
        if (r.ok) {
          out = r.out
          dropped = r.dropped
          methodNote = 'Lossless segment strip — the pixels are byte-identical to the original; only metadata segments were cut out.'
          fallbackReason = undefined
          mime = 'image/jpeg'
          ext = 'jpg'
        } else {
          out = await reencodeJpeg(file)
          dropped = analysis.containers
          methodNote = 'Re-encoded fallback — pixels touched, metadata gone.'
          fallbackReason = `The segment walk failed (${r.reason}), so the photo was redrawn on a canvas at quality 0.92 instead of being cut segment by segment.`
          mime = 'image/jpeg'
          ext = 'jpg'
        }
      } else {
        const r = scrubPng(bytes)
        if (!r.ok) throw new Error(`The PNG could not be rebuilt: ${r.reason}`)
        out = r.out
        dropped = r.dropped
        methodNote = 'Critical-chunk rebuild — the PNG was rebuilt from IHDR/PLTE/IDAT/IEND only; pixel data untouched, ancillary chunks gone.'
        fallbackReason = undefined
        mime = 'image/png'
        ext = 'png'
      }

      const blob = new Blob([out], { type: mime })
      const verify = await analyze(new Uint8Array(await blob.arrayBuffer()) as Bytes, analysis.format)
      const base = fileInfo.name.replace(/\.[^.]+$/, '') || 'photo'
      setScrub({
        blob,
        filename: `${base}-clean.${ext}`,
        methodNote,
        fallbackReason,
        beforeSize: fileInfo.size,
        afterSize: blob.size,
        dropped,
        verifyRecords: verify.records,
        verifyGps: verify.hasGps,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scrubbing failed unexpectedly.')
    } finally {
      setScrubBusy(false)
    }
  }, [analysis, fileInfo])

  return (
    <div>
      <DropZone
        onFiles={(f) => void handleFile(f)}
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        multiple={false}
        title={analysis ? 'Drop another photo' : 'Drop a photo to inspect its metadata'}
        hint="JPEG or PNG, checked by magic bytes. Parsed on this device — nothing is uploaded."
      />

      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Walking the file…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {analysis && fileInfo && (
        <div className="mt-5 space-y-4">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ScanSearch className="size-4 text-primary" aria-hidden="true" />
            <span className="font-medium text-foreground">{fileInfo.name}</span>
            <span>· {formatBytes(fileInfo.size)}</span>
            <span className="rounded-full border bg-card px-2 py-0.5 text-xs font-medium">{analysis.format}</span>
          </p>

          {/* verdict */}
          {analysis.records > 0 ? (
            <div
              className={
                analysis.hasGps
                  ? 'rounded-xl border border-amber-500/50 bg-amber-500/5 p-4'
                  : 'rounded-xl border bg-card p-4'
              }
            >
              <p
                className={
                  analysis.hasGps
                    ? 'flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400'
                    : 'flex items-center gap-2 text-sm font-semibold'
                }
              >
                {analysis.hasGps ? (
                  <>
                    <MapPin className="size-4" aria-hidden="true" />
                    Found: {analysis.records} metadata records, including GPS location
                  </>
                ) : (
                  <>
                    <ScanSearch className="size-4 text-primary" aria-hidden="true" />
                    Found: {analysis.records} metadata records — no GPS coordinates
                  </>
                )}
              </p>
              {analysis.parts.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">{analysis.parts.join(' · ')}</p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Check className="size-4" aria-hidden="true" />
                No metadata found
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                No readable EXIF, text chunks or metadata containers in this file — there is nothing to scrub.
              </p>
            </div>
          )}

          {analysis.gps && <GpsCard gps={analysis.gps} />}

          <div className={analysis.thumbnailUrl ? 'grid gap-4 lg:grid-cols-[1fr_240px]' : ''}>
            {analysis.tags.length > 0 && (
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Every metadata record, decoded</h3>
                  <span className="text-xs text-muted-foreground">{analysis.tags.length} rows</span>
                </div>
                <ul className="max-h-96 divide-y overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                  {analysis.tags.map((t, i) => (
                    <li key={`${t.label}-${i}`} className="flex items-baseline justify-between gap-4 px-4 py-2 text-sm">
                      <span className="shrink-0 text-muted-foreground">{t.label}</span>
                      <span className="min-w-0 break-words text-right font-medium">{t.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.thumbnailUrl && (
              <figure className="rounded-xl border bg-card p-4">
                <figcaption className="text-xs font-semibold text-muted-foreground">Embedded thumbnail (EXIF)</figcaption>
                <img
                  src={analysis.thumbnailUrl}
                  alt="EXIF thumbnail embedded in the photo"
                  className="mt-2 max-h-56 w-full rounded border object-contain"
                />
              </figure>
            )}
          </div>

          {analysis.png && (
            <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
              IHDR: {analysis.png.width}×{analysis.png.height} px · {analysis.png.bitDepth}-bit · {analysis.png.colorType}
              {analysis.png.dpi ? ` · ${analysis.png.dpi} DPI (pHYs)` : ''}
            </p>
          )}

          {analysis.containers.length > 0 && (
            <div className="rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">
                  {analysis.format === 'JPEG' ? 'Segments this file carries' : 'Chunk map'}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {analysis.format === 'JPEG'
                    ? 'Every APPn/COM container, with what it holds — all of them are cut in the scrub.'
                    : 'Every chunk with its size and checksum verdict; ancillary chunks are dropped in the scrub.'}
                </p>
              </div>
              <ul className="max-h-64 divide-y overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                {analysis.containers.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatBytes(c.size)}
                      </span>
                    </div>
                    {c.note && <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.warnings.length > 0 && (
            <ul className="space-y-1.5 rounded-xl border border-amber-500/50 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
              {analysis.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {w}
                </li>
              ))}
            </ul>
          )}

          {/* scrub */}
          {analysis.records > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold">Scrub it</h3>
              <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
                {analysis.format === 'JPEG'
                  ? 'The JPEG is rebuilt from its structural segments only — quantization tables, frame, Huffman tables, scan data and EOI. Every APPn (EXIF, ICC, XMP…) and every comment is cut, and the pixels stay byte-identical because nothing is re-encoded.'
                  : 'The PNG is rebuilt from its critical chunks only — IHDR, PLTE if present, IDATs and IEND, checksums recomputed. Every ancillary chunk (text, EXIF, timestamps, color profile) is dropped, and pixel data is untouched.'}
              </p>
              <Button onClick={() => void doScrub()} disabled={scrubBusy} className="mt-3 h-11 px-5">
                {scrubBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <X className="size-4" aria-hidden="true" />
                )}
                {scrubBusy ? 'Scrubbing…' : 'Scrub metadata and verify'}
              </Button>

              {scrub && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <p className="flex items-start gap-2 text-sm font-medium text-primary" role="status">
                    <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {scrub.methodNote}
                  </p>
                  {scrub.fallbackReason && (
                    <p className="rounded-lg border border-amber-500/50 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      {scrub.fallbackReason}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-center" aria-label="Size before and after">
                    <div className="rounded-lg border bg-muted/30 px-2 py-2">
                      <p className="text-sm font-semibold tabular-nums">{formatBytes(scrub.beforeSize)}</p>
                      <p className="text-[11px] text-muted-foreground">Before</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-2 py-2">
                      <p className="text-sm font-semibold tabular-nums">{formatBytes(scrub.afterSize)}</p>
                      <p className="text-[11px] text-muted-foreground">After</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-2 py-2">
                      <p className="text-sm font-semibold tabular-nums">
                        {scrub.beforeSize >= scrub.afterSize ? '−' : '+'}
                        {formatBytes(Math.abs(scrub.beforeSize - scrub.afterSize))}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {scrub.beforeSize >= scrub.afterSize ? 'Removed' : 'Re-encode added'}
                      </p>
                    </div>
                  </div>

                  {scrub.dropped.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Dropped, by name ({scrub.dropped.length})
                      </p>
                      <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                        {scrub.dropped.map((d, i) => (
                          <li key={`${d.name}-${i}`} className="flex items-baseline justify-between gap-4 text-sm">
                            <span className="min-w-0 break-words">{d.name}</span>
                            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                              {formatBytes(d.size)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p
                    className={
                      scrub.verifyRecords === 0
                        ? 'flex items-start gap-2 text-sm font-medium text-primary'
                        : 'flex items-start gap-2 text-sm font-medium text-amber-700 dark:text-amber-400'
                    }
                  >
                    {scrub.verifyRecords === 0 ? (
                      <>
                        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        Proof pass: the cleaned file was re-parsed in memory — 0 metadata records, no GPS. This is the
                        result, not a promise.
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        Proof pass: the cleaned file re-parsed to {scrub.verifyRecords} records
                        {scrub.verifyGps ? ', including GPS' : ''} — reported honestly instead of claimed clean.
                      </>
                    )}
                  </p>

                  <Button variant="outline" className="h-11 px-5" onClick={() => downloadBlob(scrub.blob, scrub.filename)}>
                    <Download className="size-4" aria-hidden="true" />
                    Download {scrub.filename}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <PrivacyStrip detail="Photos are parsed and rebuilt on this device — nothing is uploaded, there is no upload code." />
    </div>
  )
}
