// Shared helpers for reassembling chunked file transfers into Blobs.
//
// WHY NOT `atob(chunks.join(''))`: every full transfer chunk is 256 KB
// (262144 bytes), and 262144 ≡ 1 (mod 3) — so each full chunk's base64 ends
// with '=' padding. Concatenating base64 strings puts padding in the middle,
// which makes `atob` throw InvalidCharacterError for ANY multi-chunk file.
// The fix is to decode each chunk independently and concatenate the raw
// bytes as Blob parts, which reconstructs the file exactly.

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return arr
}

/**
 * Reassemble a chunked file transfer into a Blob.
 * Returns null when any chunk is missing or undecodable.
 */
export function chunksToBlob(
  chunks: (string | null)[],
  type: string,
): Blob | null {
  const parts: Uint8Array<ArrayBuffer>[] = []
  for (const chunk of chunks) {
    if (chunk == null) return null
    try {
      parts.push(base64ToBytes(chunk))
    } catch {
      return null
    }
  }
  if (parts.length === 0) return null
  return new Blob(parts, { type: type || 'application/octet-stream' })
}

/** Complete, decodable chunks present? (cheap check before reassembly) */
export function chunksAreComplete(
  chunks: (string | null)[],
  chunkCount: number,
): boolean {
  return (
    chunks.length === chunkCount &&
    chunks.every((c) => c != null)
  )
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
