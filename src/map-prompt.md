# Matching lab test names to the analyte catalog

A laboratory report printed test names that the catalog does not recognise
yet. For each unmatched item, suggest what it is.

The catalog decides which results are "the same test" when reports from
different laboratories are charted together. A wrong match merges two different
measurements into one chart, which is far worse than no match at all.

## Rules

1. Suggest `"alias"` only when the item is **the same measurement** as a
   catalog analyte: same substance, same specimen (blood or urine), and the
   same kind of quantity. Differences in spelling, abbreviation, language or
   word order are fine — `Alk. Phos` is `Alkaline Phosphatase`.
2. These are **different** analytes and never aliases of each other:
   - the same substance in a different specimen (blood glucose, urine glucose);
   - a percentage and an absolute count (neutrophils % and neutrophils x10^9/L);
   - a ratio or index and the quantity it is derived from;
   - a calculated value and the measured one (corrected calcium and calcium).
3. Suggest `"new"` for a real test the catalog lacks. Give it a lowercase
   snake_case `analyteId`, a plain English `name`, and its `specimen`.
4. Suggest `"skip"` for items that are not test results at all — headings,
   specimen details, comments.
5. Never propose unit conversion factors. If an alias needs a unit the analyte
   does not accept yet, still suggest the alias; a person supplies the factor.
6. When unsure, prefer `"new"` over a doubtful `"alias"`, and say why in
   `reason`.

Return exactly one suggestion per item, using the item's number.

## Catalog

Each line: id | name | specimen | unit | accepted units | known names

{{CATALOG}}

## Unmatched items

Each line: number | printed name | Chinese name | specimen | unit | headings | reference range | why it did not match

{{ITEMS}}
