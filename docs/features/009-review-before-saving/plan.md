# 009. Review before saving: plan

## Approach

The store works out where a report would be filed using the same checks as
saving, without writing anything. The review binding returns the merged report,
the job and that filing preview; the page renders it with tested wording
helpers.

## Modules

| File                           | Role                                                                     |
| ------------------------------ | ------------------------------------------------------------------------ |
| `desktop/store/store.ts`       | `previewFiling`: existing or new patient, warnings, similar saved report |
| `desktop/bindings.ts`          | `getImportReview` includes the filing; `saveImport` adds and forgets     |
| `app/src/lib/review.ts`        | Rows, summary, details, notes, filing banner wording                     |
| `app/src/views/ReviewView.vue` | Banner, page viewer, details, results table, save and discard            |
| `app/src/lib/route.ts`         | `#/review/:id`                                                           |
