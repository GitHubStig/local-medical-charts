# 006. Charts: spec

## Problem

Each test needs a chart of every result over time that's honest about what the
lab printed: its own reference range, results given as bounds (`< 5`), and
flags. The app shouldn't be locked into one charting library.

## User stories

- As a user, each test card shows a small chart of its results over time.
- As a user, I see each lab's reference range behind the results, even when the
  range changes between labs.
- As a user, I can open a test in a large view, read dates, values and ranges
  without hovering (on a touch screen too), and close it with Esc or a click
  outside.
- As a user, I can press left and right in the large view to move to the
  previous or next test without closing it.
- As a user, I can draw the lines straight, smooth, or as steps that hold each
  result until the next test.
- As a developer, I can switch the chart library at runtime.

## Requirements

1. One series per analyte: every result in the catalog's unit, ranges converted
   the same way, bands that step where the lab's range changes.
2. Results reported as a bound are drawn as hollow markers at the bound; flagged
   results stand out, never by colour alone.
3. The same chart in Vega-Lite, ECharts, Chart.js and Plotly, chosen from a
   dropdown in the top bar and remembered; only the chosen library is loaded.
4. The large view adds a value axis on round numbers, dates and labs under each
   result, and the latest range labelled beside its band.
5. Colours come from the theme, so charts follow light and dark mode.
6. The line is straight, smooth or stepped, chosen from a dropdown beside the
   library and remembered; smooth unless changed. Smooth never bulges past a
   reading, and steps hold each result until the next reading, the same in every
   library.

## Acceptance criteria

- A test measured in g/dL at one lab and g/L at another plots on one scale with
  both ranges converted.
- Switching library redraws every chart without reloading the page.
- The large view is readable with no hover.
- In the large view, left and right open the previous and next test in the order
  shown (cards or table, after search and flagged-only), stopping at the first
  and last.
- Changing the curve redraws every chart in that style, in all four libraries.

## Out of scope

- Chart types other than a line with markers (the line itself can be straight,
  smooth or stepped).
- Guideline targets (lab ranges only).
