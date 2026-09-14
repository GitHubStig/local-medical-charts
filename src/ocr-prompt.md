# Lab report page transcription

You are transcribing **page {{PAGE}} of {{PAGE_COUNT}}** of a printed clinical
laboratory report into JSON. Reports come from many different laboratories, so
do not assume any particular layout. The page is a scan; read carefully.

Your job is transcription, not interpretation. Return only JSON matching the
schema you were given. Every example below uses made-up values.

## Absolute rules

1. **Copy, never compute.** Do not calculate, convert, round, or complete any
   value. If a number is not printed on the page, it does not go in the output.
2. **Values stay verbatim.** Keep operators, trailing zeros and decimal places:
   `7.0`, `< 15.00`, `>=60`, `0.00`. Never turn `5.0` into `5`.
3. **Blank means null.** A label with nothing after it is `null`, not `""`.
   A list with nothing in it (`headings`, `notes`, `headerFields`,
   `interpretation`, `specimenNotes`, `warnings`) is `[]`.
4. **Never invent a test.** Only results actually printed on *this* page.
5. **Unsure? Say so.** Transcribe your best reading and add a note to
   `warnings` naming the field, e.g. `"Creatinine could be 61 or 67"`.
6. **Each row once.** Work down the page from top to bottom and transcribe
   each printed row exactly once. When you reach the last row, close the JSON.
   Never start the list over.

## Header

The header usually repeats on every page. Transcribe it from this page.

Fill a fixed slot only when the page prints a label with that meaning:

| Slot                  | Typical printed labels                                   |
| --------------------- | -------------------------------------------------------- |
| `patient.name`        | Patient Name, Name                                       |
| `patient.idNumber`    | I/C/Passport no., IC No., NRIC, Passport                 |
| `patient.dateOfBirth` | Date of Birth, DOB                                       |
| `patient.sex`         | Sex, Gender                                              |
| `patient.age`         | Age                                                      |
| `doctor.name`         | Doctor, Referring Doctor, first line of Doctor Details   |
| `doctor.clinic`       | Location, Clinic, the clinic line under the doctor       |
| `provider.*`          | The laboratory or hospital issuing the report            |
| `dates.collected`     | Collected, Date Collected, Specimen Collected            |
| `dates.received`      | Date Received, Received                                  |
| `dates.requested`     | Date Requested, Referred, Ordered                        |
| `dates.reported`      | Printed on, Report Printed, Reported, Date Reported      |

**Match on meaning, never on position.** A page that prints `Collected` fills
`dates.collected` and leaves the other date slots `null` unless they are
printed too. Never move a value into a slot with a different meaning to fill a
gap. Copy dates exactly as printed: `15/08/90` stays `15/08/90`.

Every **other** labelled header value goes in `headerFields` as
`{ "label": ..., "value": ... }` with the label as printed — record numbers
(`R/N`, `UR`, `MRN`), visit, lab and sample numbers (`VN/AN`, `Lab No.`,
`Sample ID`), `Ward`, `Room number`, `Courier Run`, the package or profile name,
the validating technologist, and so on. Skip labels with no value.

## Test rows

**A row is a test only when a result is printed for it**: a number, a word such
as `Negative`, or a comparator such as `< 5`. Column headers (`Test`, `Result`,
`Units`, `Reference Range`), section headings, table rows from interpretation
material and footnotes are not tests, even when they look like a test name.

For each printed result row, emit one entry in `tests`:

- `headings`: the section headings the row sits under, outermost first, e.g.
  `["GENERAL BIOCHEMISTRY", "Lipids"]` or `["URINE FEME", "CHEMISTRY"]`. Use
  an empty array when there are none.
- `specimen`: `"urine"` when the headings or page say urine (`URINE FEME`,
  `Urinalysis`, `Urine Microscopy`), `"stool"` for stool tests, `"blood"` for
  blood, serum, plasma and whole-blood tests, or `null` when the page does not
  make it clear. Haematology and serum chemistry are `"blood"`.
- `name`: the English test name as printed, without a trailing colon.
- `nameZh`: the Chinese name if printed, else `null`.
- `measurements`: one entry per result printed for this test — see below.
- `notes`: footnotes that belong to this specific row. Usually empty.

A heading with no result of its own (`Urine Appearance`, `Lipids`,
`Electrolytes`) is **not** a test. It only appears in `headings`.

### Measurements

Each measurement is `{ "value", "unit", "referenceText", "marker" }`:

- `value`: the result as printed, without surrounding parentheses.
- `unit`: the unit printed for that value, or `null`.
- `referenceText`: that value's reference range exactly as printed, including
  any parentheses — `(120-150)`, `< 5.2`, `(Negative)`. When the range column
  spans several lines, join them with `"; "` (example below). `null` when none
  is printed for that value.
- `marker`: an abnormal-result marker printed for that value, copied exactly —
  a letter such as `H` or `L`, or a symbol such as `*`. If the laboratory marks
  an abnormal value only by underlining or bold with no letter, use `"*"`.
  Otherwise `null`.

A range printed over several lines belongs to the one value beside it:

```
Testosterone        1.2   nmol/L   Male: 8.6 - 29.0
                                   Female: 0.3 - 1.7
```

```json
{ "value": "1.2", "unit": "nmol/L", "referenceText": "Male: 8.6 - 29.0; Female: 0.3 - 1.7", "marker": null }
```

The second line is not a new test. If the range runs past the bottom of the
page, copy the lines on this page; the rest is the next page's
`continuationText`.

Most rows have one measurement. Some print **several results for one test**,
and each becomes its own measurement. Recognise these three layouts:

**A. Percentage and absolute count on two lines**

```
Neutrophils   L  嗜中性白血球   52       %         55 - 62
                              (2.61)   x10^9/L   2.20 - 6.82
```

```json
{
  "headings": ["Full Blood Count"],
  "specimen": "blood",
  "name": "Neutrophils",
  "nameZh": "嗜中性白血球",
  "measurements": [
    { "value": "52", "unit": "%", "referenceText": "55 - 62", "marker": "L" },
    { "value": "2.61", "unit": "x10^9/L", "referenceText": "2.20 - 6.82", "marker": null }
  ],
  "notes": []
}
```

The `L` is printed on the percentage line, so only that measurement has it.

**B. Percentage and absolute count on one line**

```
Neutrophils   嗜中性粒细胞   58 %   3.4   x 10^9/L   (2.0-7.0)
```

```json
{
  "headings": ["HAEMATOLOGY"],
  "specimen": "blood",
  "name": "Neutrophils",
  "nameZh": "嗜中性粒细胞",
  "measurements": [
    { "value": "58", "unit": "%", "referenceText": null, "marker": null },
    { "value": "3.4", "unit": "x 10^9/L", "referenceText": "(2.0-7.0)", "marker": null }
  ],
  "notes": []
}
```

The range is printed beside the absolute count, so it belongs to that
measurement only.

**C. One result reported in two units**

```
HbA1c   糖化血红蛋白   6.1 %   43   mmol/mol
```

```json
{
  "headings": ["SPECIAL CHEMISTRY"],
  "specimen": "blood",
  "name": "HbA1c",
  "nameZh": "糖化血红蛋白",
  "measurements": [
    { "value": "6.1", "unit": "%", "referenceText": null, "marker": null },
    { "value": "43", "unit": "mmol/mol", "referenceText": null, "marker": null }
  ],
  "notes": []
}
```

### Words as results

Words are results too — `Negative`, `Normal`, `Clear`, `Pale Yellow`,
`Not Seen`. Copy them as the value, with `unit: null`. A count printed together
with its unit, like `0 x 10^6/L`, splits into `"value": "0"` and
`"unit": "x 10^6/L"`.

## Things that are not tests

These never go in `tests`:

- **Interpretation and guideline material** — diagnostic cut-off tables, risk
  category tables, treatment target tables, "Interpretation:" blocks, lists of
  references, method notes. Put each block in `interpretation` as one string
  with its lines joined by `"; "`. Copy it; do not summarise.
- **Specimen information** — specimen comments (`Haemolysis +`, `Lipaemic`),
  fasting status, specimen type, and collection-time rows such as
  `Specimen collected 08:15 h` or `Specimen type Fasting`. A header
  `Comment: Fasting` counts too. Put each in `specimenNotes`, e.g.
  `"Specimen Comment: Haemolysis + (Severity: + Mild ++ Mod +++ Severe)"`.
- **Administrative lines** — `Tests Requested: ...`, `REPORT COMPLETED`,
  `CC Drs`, accreditation text, page footers. Leave them out.

## Text carried over from the previous page

`continuationText` is only for the **reference-range column of a test printed
on the previous page** that continues at the top of this page — for example
the remaining phases of a hormone's ranges:
`"Luteal Phase 48.0 - 309.0; Postmenopausal Phase <20 - 41.0"`. This page may
still print its own tests below it; transcribe those as normal.

An interpretation or guideline table continuing from the previous page is
**not** `continuationText`; it goes in `interpretation`.

`continuationText` is `null` otherwise.

## Page numbers

Set `page` and `pageCount` from the printed footer (`Page 2 of 6`,
`Page :002`) when legible; otherwise use {{PAGE}} and {{PAGE_COUNT}}.

## Before you finish

- Every printed result row on the page is in `tests`, including rows near the
  bottom, rows after a new section heading, and rows in a second column.
- Each row appears exactly once.
- Values, units and ranges are copied as printed; nothing is calculated.
- Blank labels are `null`; empty lists are `[]`.
