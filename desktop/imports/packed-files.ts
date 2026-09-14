/**
 * One upload's files as they cross a binding: names and sizes in one argument,
 * every file's bytes back to back in another.
 *
 * A Uint8Array only survives a binding as an argument of its own. Nested inside
 * an object it reaches the desktop side as a plain object of numbered keys, and
 * slowly (12 s for 3 MB). No runtime imports: the page, the browser-development
 * fake and the desktop side all use this.
 */
import type { ImportFileInfo } from "../types.ts";

export type NamedBytes = { name: string; bytes: Uint8Array };

export function packFiles(
  files: readonly NamedBytes[],
): { files: ImportFileInfo[]; bytes: Uint8Array } {
  const bytes = new Uint8Array(
    files.reduce((total, f) => total + f.bytes.byteLength, 0),
  );
  let offset = 0;
  for (const file of files) {
    bytes.set(file.bytes, offset);
    offset += file.bytes.byteLength;
  }
  return {
    files: files.map((f) => ({ name: f.name, size: f.bytes.byteLength })),
    bytes,
  };
}

/** The files again, from their names, sizes and bytes. Throws when the sizes don't add up. */
export function unpackFiles(
  files: readonly ImportFileInfo[],
  bytes: Uint8Array,
): NamedBytes[] {
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total !== bytes.byteLength) {
    throw new RangeError(
      `the file sizes add up to ${total} bytes, but ${bytes.byteLength} bytes arrived`,
    );
  }
  let offset = 0;
  return files.map((file) => {
    const part = bytes.subarray(offset, offset + file.size);
    offset += file.size;
    return { name: file.name, bytes: part };
  });
}
