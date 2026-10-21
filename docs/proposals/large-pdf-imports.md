# Large PDF imports

- **Status:** Parked by the owner.

A PDF with many pages probably freezes the app while it's turned into page
images. Not measured yet.

- **Why:** `startImport` calls `ImportQueue.add`, which calls `pagesFromUpload`
  (`desktop/imports/sources.ts`). That renders every page with mupdf at once,
  synchronously, on the desktop process's main thread, so every binding waits,
  the quit prompt included.
- **Memory:** every page image of every import stays in memory until it's saved
  or discarded (ADR 0012), and there's no limit on page count.
- **Size checks:** the 100 MB limit is checked only in the page
  (`app/src/lib/uploads.ts`), per file rather than per upload; the desktop side
  doesn't check sizes.
- **First step when resumed:** time `pagesFromUpload` on fictional PDFs of a few
  sizes (e.g. 5, 50 and 200 pages, scanned and rendered), and watch memory.
- **Then, depending on what that shows:** a page-count or total-size limit
  checked on the desktop side, and rendering pages one at a time as they're read
  (or in a worker) instead of all up front.
