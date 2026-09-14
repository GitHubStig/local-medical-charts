# 008. PDF and photo import: tasks

- [x] Recognise file types by bytes
- [x] PDF pages to images with mupdf; refuse damaged, password-protected and
      empty PDFs in words
- [x] Scan detection: send the scanner's JPEG as is, decode other scan formats
      once, render oversized scans down
- [x] Photos as pages in the given order
- [x] Ollama page reader with time limit and worded failures
- [x] In-memory queue: one at a time, cancel, retry from the next unread page,
      discard, review, page images
- [x] Bindings: start, list, cancel, retry, discard, review, page, save
- [x] Bytes as their own binding argument (names and sizes + packed bytes)
- [x] Fake bindings: pretend reading for browser development
- [x] Upload routing: JSON straight in, PDFs start, photos wait for order
- [x] Photo order dialog with thumbnails, reordering and one-report-per-photo
- [x] Imports panel: status, progress, elapsed time, cancel / retry / remove /
      cancel all
- [x] Progress line under the top bar
- [x] Floating results card with countdown, pause on hover, sticky when
      something needs attention
- [x] Stream, cap and stop replies that repeat; read replies placed in
      `thinking`
- [x] Tests: sources with fictional scanned PDFs, queue, reader against stand-in
      servers, contract lifecycle
