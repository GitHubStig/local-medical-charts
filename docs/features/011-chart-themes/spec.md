# 011. Chart themes: spec

## Problem

Flint ships formal visual themes. The charts should be able to use them, and
pick up new themes and wider library support as Flint and the chart libraries
are updated, without losing what makes a lab chart honest.

## User stories

- As a user, I can pick a chart theme, such as The Economist or Swiss, beside
  the chart library and curve, and it's remembered.
- As a user, I can tell when the chosen chart library can't show a theme yet.
- As a developer, updating Flint or a chart library brings new themes and
  support without code changes, and a test tells me what changed.

## Requirements

1. The Chart theme dropdown lists App, then every theme the installed Flint
   ships.
2. A library shows a theme only where Flint styles its output for it; otherwise
   the chart keeps the App look, and the option says so ("The Economist (not in
   ECharts yet)").
3. A themed chart takes Flint's background, font, line and axis styling. Flagged
   results keep the app's warning colour, bounds stay hollow, reference bands
   stay visible, and every axis tick keeps its label
   ([ADR 0016](../../adr/0016-flint-chart-themes.md)).
4. Themes apply to the cards and the large view, in light and dark mode.
5. A saved theme that Flint no longer ships shows as App.
6. Choosing App looks exactly as the charts did before themes.

## Acceptance criteria

- Choosing The Economist restyles the Vega-Lite and Plotly charts and is still
  chosen after a reload; ECharts and Chart.js keep the App look and say so.
- A test lists which libraries each theme applies to and fails when that
  changes.
- Flint's theme code isn't in the main bundle.

## Out of scope

- The app's own theme presets.
- Theming ECharts and Chart.js before Flint supports them.
- Dark versions of Flint's light themes.
