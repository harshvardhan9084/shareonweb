'use client'

// Checklist — a local to-do list that persists in this browser's
// localStorage. Inline editing, four filters, drag-to-reorder plus button
// fallbacks for touch and keyboards, done-counter, clear-completed, and a
// "copy as Markdown" export. The list lives on this device only — there is
// no account, no sync, no server round-trip.

import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowDown, ArrowUp, Check, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

interface Item {
  id: string
  text: string
  done: boolean
  createdAt: number
}

const STORAGE_KEY = 'kontivo-checklist-v1'
type Filter = 'all' | 'active' | 'done'

function loadItems(): Item[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const items: Item[] = []
    for (const e of parsed) {
      if (
        typeof e === 'object' && e !== null &&
        typeof (e as Item).id === 'string' &&
        typeof (e as Item).text === 'string' &&
        typeof (e as Item).done === 'boolean'
      ) {
        items.push({
          id: (e as Item).id,
          text: (e as Item).text,
          done: (e as Item).done,
          createdAt: typeof (e as Item).createdAt === 'number' ? (e as Item).createdAt : Date.now(),
        })
      }
    }
    return items
  } catch {
    return null
  }
}

// The localStorage-backed store. useSyncExternalStore is the React-19-correct
// way to read it: the server snapshot is an empty list (so SSR and the first
// client render agree), the client snapshot reads the real storage after
// hydration, and every mutation writes through and notifies — with
// cross-tab 'storage' events subscribed for free.
const EMPTY: Item[] = []
let cachedSnapshot: Item[] | null = null
const listeners = new Set<() => void>()

function readStore(): Item[] {
  if (cachedSnapshot) return cachedSnapshot
  cachedSnapshot = loadItems() ?? EMPTY
  return cachedSnapshot
}

function writeStore(items: Item[]) {
  cachedSnapshot = items
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* storage full or blocked — the tab still works, it just won't persist */
  }
  for (const l of listeners) l()
}

function subscribeStore(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function TodoTool() {
  // Server snapshot: the empty list (SSR and first client render match);
  // the real persisted list arrives with the client snapshot after hydration.
  const items = useSyncExternalStore(subscribeStore, readStore, () => EMPTY)
  const [filter, setFilter] = useState<Filter>('all')
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [copied, setCopied] = useState(false)
  // The dragged item lives in state, not a ref — the className needs it at
  // render time and the react-hooks/refs rule is right about that.
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const add = () => {
    const text = draft.trim()
    if (!text) return
    writeStore([...items, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, done: false, createdAt: Date.now() }])
    setDraft('')
    inputRef.current?.focus()
  }

  const toggle = (id: string) =>
    writeStore(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)))

  const remove = (id: string) => writeStore(items.filter((it) => it.id !== id))

  const startEdit = (it: Item) => {
    setEditingId(it.id)
    setEditingText(it.text)
  }

  const commitEdit = () => {
    const text = editingText.trim()
    if (editingId && text) writeStore(items.map((it) => (it.id === editingId ? { ...it, text } : it)))
    setEditingId(null)
    setEditingText('')
  }

  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((it) => it.id === id)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= items.length) return
    const next = [...items]
    ;[next[idx], next[to]] = [next[to], next[idx]]
    writeStore(next)
  }

  const onDropOver = (targetId: string) => {
    const from = draggingId
    setDraggingId(null)
    if (!from || from === targetId) return
    const fromIdx = items.findIndex((it) => it.id === from)
    const toIdx = items.findIndex((it) => it.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...items]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    writeStore(next)
  }

  const visible = useMemo(() => {
    if (filter === 'active') return items.filter((it) => !it.done)
    if (filter === 'done') return items.filter((it) => it.done)
    return items
  }, [items, filter])

  const doneCount = items.filter((it) => it.done).length

  const copyMarkdown = async () => {
    const md = items.map((it) => `- [${it.done ? 'x' : ' '}] ${it.text}`).join('\n')
    try {
      await navigator.clipboard.writeText(md || '- [ ] (empty list)')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard denied — items stay visible for manual copy */
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label htmlFor="todo-input" className="sr-only">New item</Label>
            <input
              id="todo-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="What needs doing? Type and press Enter"
              className="h-11 w-full rounded-md border bg-background px-3.5 text-base"
              aria-label="New checklist item"
            />
          </div>
          <Button type="button" onClick={add} disabled={!draft.trim()}>
            <Plus className="size-4" aria-hidden="true" /> Add
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['done', 'Done'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                filter === key ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {label === 'Done' ? `Done (${doneCount})` : label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {items.length === 0 ? 'empty' : `${items.length - doneCount} of ${items.length} open`}
          </span>
        </div>

        <ul className="mt-3 space-y-1.5" aria-label="Checklist">
          {visible.length === 0 ? (
            <li className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-testid="todo-empty">
              {items.length === 0
                ? 'Nothing yet — add your first item above. The list is saved in this browser and survives reloads.'
                : filter === 'done'
                  ? 'Nothing completed yet — it will show up here as you tick things off.'
                  : 'Everything on the list is done. Clear the completed to start fresh.'}
            </li>
          ) : (
            visible.map((it) => (
              <li
                key={it.id}
                draggable={editingId !== it.id}
                onDragStart={() => setDraggingId(it.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropOver(it.id)}
                className={cn(
                  'group flex items-center gap-2 rounded-lg border bg-background px-2 py-2',
                  draggingId === it.id && 'opacity-50',
                )}
                data-testid="todo-item"
              >
                <button
                  type="button"
                  onClick={() => toggle(it.id)}
                  aria-label={it.done ? `Mark ${it.text} as open` : `Mark ${it.text} as done`}
                  aria-pressed={it.done}
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    it.done ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary',
                  )}
                >
                  {it.done && <Check className="size-3" aria-hidden="true" />}
                </button>
                {editingId === it.id ? (
                  <input
                    autoFocus
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={commitEdit}
                    aria-label="Edit item text"
                    className="h-8 flex-1 rounded-md border bg-background px-2 text-sm"
                  />
                ) : (
                  <span
                    onDoubleClick={() => startEdit(it)}
                    className={cn(
                      'flex-1 cursor-default text-sm leading-relaxed',
                      it.done && 'text-muted-foreground line-through',
                    )}
                    title="Double-click to edit"
                  >
                    {it.text}
                  </span>
                )}
                <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {editingId !== it.id && (
                    <button type="button" onClick={() => startEdit(it)} aria-label={`Edit ${it.text}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" onClick={() => move(it.id, -1)} aria-label={`Move ${it.text} up`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => move(it.id, 1)} aria-label={`Move ${it.text} down`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => remove(it.id)} aria-label={`Delete ${it.text}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))
          )}
        </ul>

        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          <Button type="button" variant="outline" size="sm" onClick={() => writeStore(items.filter((it) => !it.done))} disabled={doneCount === 0}>
            Clear completed ({doneCount})
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyMarkdown()} disabled={items.length === 0}>
            <Copy className="size-3.5" aria-hidden="true" />
            {copied ? 'Copied' : 'Copy as Markdown'}
          </Button>
          {items.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => writeStore([])}
            >
              Delete everything
            </Button>
          )}
        </div>
      </div>

      <PrivacyStrip detail="The list persists in this browser's localStorage — that is the entire storage system. No account, no sync, no server: clear your browser data or use Delete everything, and it is gone." />
    </div>
  )
}
