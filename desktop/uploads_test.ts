import { assertEquals } from "@std/assert";
import {
  MAX_UPLOAD_BYTES,
  moveItem,
  photoGroups,
  planUploads,
  readUpload,
} from "../app/src/lib/uploads.ts";

// Made-up file names and contents only.

const file = (name: string, type = "", size = 3) =>
  new File(["x".repeat(size)], name, { type });
const names = (files: File[]) => files.map((f) => f.name);

Deno.test("picked files are sorted into JSON, PDFs and photos; the rest are refused in words", () => {
  const plan = planUploads([
    file("report.json"),
    file("IMG_10.jpg"),
    file("scan.PDF"),
    file("IMG_9.webp"),
    file("notes.txt"),
    file("IMG_2.png"),
    file("from-phone.HEIC"),
    file("mystery", "application/pdf"),
  ]);
  assertEquals(names(plan.json), ["report.json"]);
  assertEquals(names(plan.pdfs), ["scan.PDF", "mystery"]);
  assertEquals(names(plan.photos), ["IMG_2.png", "IMG_9.webp", "IMG_10.jpg"]);
  assertEquals(plan.refused, [
    {
      fileName: "notes.txt",
      error:
        "notes.txt isn't a PDF, a photo (JPG, PNG or WebP) or report JSON.",
    },
    {
      fileName: "from-phone.HEIC",
      error:
        "from-phone.HEIC is a HEIC photo, which can't be read. Save it as a JPEG and add that.",
    },
  ]);
});

Deno.test("a PDF or photo too large to read is refused before it's read", () => {
  const huge = new File([], "huge.pdf");
  Object.defineProperty(huge, "size", { value: MAX_UPLOAD_BYTES + 1 });
  const plan = planUploads([huge]);
  assertEquals(plan.pdfs, []);
  assertEquals(
    plan.refused[0].error,
    "huge.pdf is 100 MB, more than the 100 MB that can be read.",
  );
});

Deno.test("confirmed photos become one report, or one report each", () => {
  assertEquals(photoGroups(["a", "b", "c"], false), [["a", "b", "c"]]);
  assertEquals(photoGroups(["a", "b"], true), [["a"], ["b"]]);
  assertEquals(photoGroups([], false), []);
});

Deno.test("moving a photo stops at either end", () => {
  assertEquals(moveItem(["a", "b", "c"], 2, -1), ["a", "c", "b"]);
  assertEquals(moveItem(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assertEquals(moveItem(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
  assertEquals(moveItem(["a", "b", "c"], 2, 1), ["a", "b", "c"]);
});

Deno.test("an upload carries the file's bytes", async () => {
  const upload = await readUpload(
    new File([new Uint8Array([1, 2, 3])], "a.png"),
  );
  assertEquals(upload, { name: "a.png", bytes: new Uint8Array([1, 2, 3]) });
});
