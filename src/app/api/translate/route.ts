// POST /api/translate — batch caption translation for Live Captions.
//
// Body: { texts: string[], target: string }  (target = BCP-47-ish code, e.g. "hi-IN")
// Returns: { translations: string[] } — same order as texts; on any failure the
// originals are returned so the feed degrades gracefully instead of breaking.

import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'

const MAX_TEXTS = 20
const MAX_CHARS = 4000

const LANGUAGE_NAMES: Record<string, string> = {
  'en-US': 'English',
  'en-IN': 'English (India)',
  'hi-IN': 'Hindi',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
  'pt-BR': 'Portuguese (Brazil)',
  'ru-RU': 'Russian',
  'ar-SA': 'Arabic',
  'zh-CN': 'Chinese (Simplified)',
  'ja-JP': 'Japanese',
}

function languageName(code: string): string {
  if (LANGUAGE_NAMES[code]) return LANGUAGE_NAMES[code]
  const base = code.split('-')[0]?.toLowerCase()
  return LANGUAGE_NAMES[`${base}-US`] ?? code
}

function parseTranslations(raw: string, count: number): string[] | null {
  // The model is asked for a JSON array; be tolerant of markdown fences.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    const parsed: unknown = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.length === count) {
      return parsed.map((x) => (typeof x === 'string' ? x : String(x ?? '')))
    }
    // One-per-line fallback: split on newlines, drop numbering.
    const lines = cleaned
      .split('\n')
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter((l) => l.length > 0)
    if (lines.length === count) return lines
    return null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  let body: { texts?: unknown; target?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawTexts = Array.isArray(body.texts) ? body.texts : []
  const texts = rawTexts
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.slice(0, 400))
    .slice(0, MAX_TEXTS)
  if (texts.length === 0) {
    return NextResponse.json({ error: 'texts must be a non-empty array of strings' }, { status: 400 })
  }
  if (texts.reduce((n, t) => n + t.length, 0) > MAX_CHARS) {
    return NextResponse.json({ error: 'Batch too large' }, { status: 400 })
  }

  const targetCode = typeof body.target === 'string' ? body.target.slice(0, 12) : ''
  const target = languageName(targetCode)
  const originals = [...texts]

  try {
    const zai = await ZAI.create()
    const numbered = texts.map((t, i) => `${i + 1}. ${JSON.stringify(t)}`).join('\n')
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            `You are a real-time caption translator. Translate each numbered line into ${target}. ` +
            'Preserve tone and brevity (these are live spoken captions). Do not add explanations. ' +
            'If a line is already in the target language, return it unchanged. ' +
            'Respond with ONLY a JSON array of the translated strings, in the same order, no numbering.',
        },
        {
          role: 'user',
          content: numbered,
        },
      ],
      thinking: { type: 'disabled' },
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    const parsed = parseTranslations(raw, texts.length)
    if (!parsed) {
      // Graceful degradation: serve originals rather than breaking the feed.
      return NextResponse.json({ translations: originals, degraded: true })
    }
    return NextResponse.json({ translations: parsed })
  } catch (err) {
    console.error('[api/translate] failed:', err)
    return NextResponse.json({ translations: originals, degraded: true })
  }
}
