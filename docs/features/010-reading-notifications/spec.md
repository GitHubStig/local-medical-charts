# 010. Reading notifications: spec

## Problem

Reading a PDF takes about a minute a page, so a six-page report takes several
minutes. People switch to other work meanwhile, and have to keep checking back
to see whether the reading is ready or has failed.

## User stories

- As a user, when a reading finishes while I'm in another app, I get a system
  notification and can go straight to its review.
- As a user, when a reading fails while I'm away, I find out without checking
  back.
- As a user, nothing about my health appears on my lock screen or in
  Notification Center.
- As a user, I can turn these notifications off.

## Requirements

1. A system notification when an import becomes ready or fails, **only while the
   window isn't in front**. Cancelled or discarded imports don't notify.
2. **Generic wording**, fixed in one place:
   - ready: "Report ready to review", "6 pages read. Check the results before
     saving."
   - failed: "Couldn't read a report", "Open Local Medical Charts to see why and
     try again."

   No file names (they often contain a patient's name), patient, lab, model,
   results or error text.
3. One notification per import; a retry replaces the earlier one.
4. Clicking a notification brings the window forward: to the review screen when
   the import is ready, to the home screen's imports panel when it failed.
5. Settings: "Notify when a reading finishes", on by default, saved with the
   other settings ([ADR 0007](../../adr/0007-sqlite-storage.md)).
6. Permission is asked the first time a notification would be shown. If it's
   refused, nothing is shown and reading carries on.
7. A notification that can't be shown never affects reading.

## Acceptance criteria

- With the app in front, a finished reading shows no notification.
- With another app in front, a finished reading shows "Report ready to review",
  and clicking it opens that import's review.
- With the setting off, nothing is shown.
- No notification contains the uploaded file's name.

## Out of scope

- Notifications in the browser version (fake bindings).
- A dock badge, sounds, or choosing which events notify.
