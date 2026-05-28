/**
 * Display-name resolution for files coming from File Storage, the per-printer
 * queue, print-job records, or upload progress entries.
 *
 * Preference order (the first non-empty wins):
 *   1. `originalFileName`            (AvailableFile from /print-queue/.../available-files)
 *   2. `metadata._originalFileName`  (FileStorage rows return the full metadata JSON)
 *   3. `fileName`                    (PrintJob / QueuedJob / FileStorage fallback)
 *   4. `metadata.fileName`           (analysed-metadata fallback)
 *   5. `name`                        (raw File / DataTransfer entries)
 *
 * Then strips noisy storage prefixes like `<sha8+>-` or `<timestamp10+>_` so
 * legacy rows without preserved metadata don't leak hashes into the UI.
 */
export function displayFileName(input: unknown, fallback = 'Untitled'): string {
  if (input == null) return fallback
  if (typeof input === 'string') return stripStoragePrefixes(input) || fallback

  if (typeof input === 'object') {
    const obj = input as Record<string, any>
    const candidates: unknown[] = [
      obj.originalFileName,
      obj.metadata?._originalFileName,
      obj.fileName,
      obj.metadata?.fileName,
      obj.name,
    ]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) {
        return stripStoragePrefixes(c) || c
      }
    }
  }

  return fallback
}

/**
 * Trim hash- or timestamp-style prefixes that FileStorage may have prepended
 * when a row was saved without the original-name metadata. Keeps the human
 * portion intact for everything else.
 */
function stripStoragePrefixes(name: string): string {
  return name
    .replace(/^[0-9a-f]{8,}[-_]/i, '')
    .replace(/^\d{10,}[-_]/, '')
}
