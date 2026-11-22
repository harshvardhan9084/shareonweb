// Helpers for picking and normalizing folders of files.
//
// Two sources of "many files with structure":
//  1. <input webkitdirectory>  -> File.webkitRelativePath is set ("Root/sub/a.txt")
//  2. Drag & drop of folders   -> DataTransferItem.webkitGetAsEntry() traversal;
//     constructed File objects do NOT carry webkitRelativePath, so we track the
//     path alongside each file.
//
// Convention: `relPath` ALWAYS includes the root folder name when the files
// came from a folder ("Root/sub/a.txt"), and is undefined for loose files.
// Every surface (grouping, ZIP download) reads the same field.

export interface FolderItem {
  file: File
  /** Path including the root folder name; undefined for loose files. */
  relPath?: string
}

/** Pull the relative path from a File picked via webkitdirectory inputs. */
export function relPathFromFile(file: File): string | undefined {
  const raw = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return raw && raw.includes('/') ? raw : undefined
}

/** Directory portion of a relPath ('' for loose files). */
export function dirnameOf(path: string | undefined): string {
  if (!path) return ''
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}

/** First path segment ("Root/sub/a.txt" -> "Root"); '' when there is none. */
export function rootNameOf(path: string | undefined): string {
  if (!path) return ''
  const idx = path.indexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}

// ---------------------------------------------------------------------------
// Drag & drop traversal
// ---------------------------------------------------------------------------

interface FsEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  file: (cb: (f: File) => void, err?: (e: unknown) => void) => void
  createReader: () => {
    readEntries: (cb: (entries: FsEntry[]) => void, err?: (e: unknown) => void) => void
  }
}

function readAllEntries(dir: FsEntry): Promise<FsEntry[]> {
  return new Promise((resolve, reject) => {
    const out: FsEntry[] = []
    const reader = dir.createReader()
    const step = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(out)
          return
        }
        out.push(...entries)
        step()
      }, reject)
    }
    step()
  })
}

function entryToItems(entry: FsEntry, parentPrefix: string): Promise<FolderItem[]> {
  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file(
        (f) =>
          resolve([
            { file: f, relPath: parentPrefix ? `${parentPrefix}/${entry.name}` : undefined },
          ]),
        reject,
      )
    })
  }
  const childPrefix = parentPrefix ? `${parentPrefix}/${entry.name}` : entry.name
  return readAllEntries(entry).then((children) =>
    Promise.all(children.map((c) => entryToItems(c, childPrefix))).then((g) => g.flat()),
  )
}

/**
 * Collect plain files and folders from a drop event. Top-level folders are
 * traversed recursively; the folder name becomes the first relPath segment
 * (consistent with directory-picker picks). Top-level files stay loose.
 */
export async function folderItemsFromDataTransfer(dt: DataTransfer): Promise<FolderItem[]> {
  const items = Array.from(dt.items ?? [])
  const entries: FsEntry[] = []
  let sawEntries = false

  for (const item of items) {
    const getter = (
      item as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }
    ).webkitGetAsEntry
    if (typeof getter === 'function') {
      const entry = getter.call(item)
      if (entry) {
        sawEntries = true
        entries.push(entry)
      }
    }
  }

  if (!sawEntries) {
    return Array.from(dt.files).map((file) => ({ file }))
  }

  const groups = await Promise.all(entries.map((e) => entryToItems(e, '')))
  return groups.flat()
}
