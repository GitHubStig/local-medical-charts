import { assert, assertEquals } from "@std/assert";
import { MAX_SCAN_SIDE, pagesFromUpload } from "./sources.ts";
import { imageSize, scanJpeg, testPdf } from "./testing.ts";

Deno.test("a lossless scan is decoded once at its own size; an oversized one is rendered down", () => {
  const pdf = testPdf([
    { kind: "scan", image: "lossless" },
    { kind: "scan", image: scanJpeg(300) },
  ]);
  const [lossless, oversized] = pagesFromUpload([
    { name: "scan.pdf", bytes: pdf },
  ]).pages;

  assertEquals([lossless.origin, lossless.type], ["scanned", "image/jpeg"]);
  assertEquals(imageSize(lossless.bytes), [1653, 2339]);

  assertEquals([oversized.origin, oversized.type], ["rendered", "image/png"]);
  const [width, height] = imageSize(oversized.bytes);
  assert(
    Math.abs(height - MAX_SCAN_SIDE) <= 1 && width < height,
    `rendered at ${width}x${height}`,
  );
});
