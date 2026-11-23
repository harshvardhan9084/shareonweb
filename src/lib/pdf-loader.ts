'use client'

// One shared pdf.js loader for the three PDF tools (/pdf, /pdf-view,
// /pdf-text). pdf.js needs its worker served from a URL it can fetch — we
// vendor `pdf.worker.min.mjs` into public/ (scripts/sync-pdf-worker.mjs, run
// on postinstall) so the version always matches the pdfjs-dist package here.
//
// Everything is dynamically imported so the ~400 KB parser only reaches the
// browser when a PDF tool is actually used, never on first paint.

import type * as Pdfjs from 'pdfjs-dist'

type PdfjsModule = typeof Pdfjs

let cached: PdfjsModule | null = null

/** Load and configure pdf.js once per tab; later calls return the same module. */
export async function getPdfjs(): Promise<PdfjsModule> {
  if (cached) return cached
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  cached = pdfjs
  return pdfjs
}

/** Read a File into an ArrayBuffer pdf.js can consume. */
export async function fileToPdfData(file: File | Blob): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  return new Uint8Array(buf)
}

/** Wrap pdf-lib's saved bytes in a download-ready Blob (copy = own buffer). */
export function pdfToBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}
