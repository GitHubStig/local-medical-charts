import { assertEquals } from "@std/assert";
import * as mupdf from "mupdf";
import { findImages, lastFilter } from "./pdf-images.ts";

// PDF objects built in memory with mupdf: no files, nothing real.

function withDocument(fn: (doc: mupdf.PDFDocument) => void) {
  const doc = new mupdf.PDFDocument();
  try {
    fn(doc);
  } finally {
    doc.destroy();
  }
}

/** A one-pixel grey image XObject. */
const image = (doc: mupdf.PDFDocument) =>
  doc.addStream(new Uint8Array([128]), {
    Type: doc.newName("XObject"),
    Subtype: doc.newName("Image"),
    Width: 1,
    Height: 1,
    ColorSpace: doc.newName("DeviceGray"),
    BitsPerComponent: 8,
  });

/** A form XObject drawing whatever its resources hold. */
const form = (doc: mupdf.PDFDocument, resources: mupdf.PDFObject) =>
  doc.addStream(new Uint8Array(), {
    Type: doc.newName("XObject"),
    Subtype: doc.newName("Form"),
    BBox: [0, 0, 10, 10],
    Resources: resources,
  });

const ids = (found: { ref: mupdf.PDFObject }[]) =>
  found.map((f) => f.ref.asIndirect()).sort();

Deno.test("images drawn inside a form are found along with the page's own", () => {
  withDocument((doc) => {
    const direct = image(doc);
    const nested = image(doc);
    const resources = doc.addObject({
      XObject: {
        Im0: direct,
        Fm0: form(doc, doc.addObject({ XObject: { Im1: nested } })),
      },
    });
    assertEquals(
      ids(findImages(resources)),
      [direct.asIndirect(), nested.asIndirect()].sort(),
    );
  });
});

Deno.test("a form that draws itself is read once instead of looping", () => {
  withDocument((doc) => {
    const picture = image(doc);
    const looping = form(doc, doc.addObject({ XObject: { Im0: picture } }));
    looping.get("Resources").get("XObject").put("Fm0", looping);
    const resources = doc.addObject({ XObject: { Fm0: looping } });
    assertEquals(ids(findImages(resources)), [picture.asIndirect()]);
  });
});

Deno.test("resources with no images, or only other kinds of object, give none", () => {
  withDocument((doc) => {
    assertEquals(findImages(doc.addObject({})), []);
    const other = doc.addObject({ Subtype: doc.newName("PS") });
    const unnamed = doc.addObject({ Width: 1 });
    assertEquals(
      findImages(doc.addObject({ XObject: { Ps0: other, X0: unnamed } })),
      [],
    );
  });
});

Deno.test("an image's encoding is its last filter, whether one name or a chain", () => {
  withDocument((doc) => {
    assertEquals(
      lastFilter(doc.addObject({ Filter: doc.newName("DCTDecode") })),
      "DCTDecode",
    );
    const chain = doc.newArray();
    chain.push(doc.newName("FlateDecode"));
    chain.push(doc.newName("JPXDecode"));
    assertEquals(lastFilter(doc.addObject({ Filter: chain })), "JPXDecode");
    assertEquals(lastFilter(doc.addObject({})), undefined);
    assertEquals(
      lastFilter(doc.addObject({ Filter: doc.newArray() })),
      undefined,
    );
  });
});
