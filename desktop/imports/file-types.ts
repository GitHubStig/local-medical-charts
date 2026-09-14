/**
 * Recognising uploads by their first bytes, not their names. No runtime
 * imports: the browser-development fake uses it as well as the desktop side.
 */

export type ImageType = "image/png" | "image/jpeg" | "image/webp";

const PDF_MARKER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** What a file is, from its first bytes; null when it's none of the types read. */
export function sniffType(
  bytes: Uint8Array,
): "application/pdf" | ImageType | null {
  const at = (offset: number, signature: number[]) =>
    signature.every((b, i) => bytes[offset + i] === b);

  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) {
    return "image/webp";
  }
  // PDF readers accept a little junk before the header, so look a short way in.
  for (let i = 0; i <= Math.min(1024, bytes.length - PDF_MARKER.length); i++) {
    if (at(i, PDF_MARKER)) return "application/pdf";
  }
  return null;
}
