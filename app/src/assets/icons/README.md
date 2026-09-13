# Icons

One SVG per icon, rendered with `<Icon name="file-name" />`
(`src/components/Icon.vue`).

To add one:

1. Save it here as `kebab-case-name.svg`, drawn on a 16×16 grid (24×24 for large
   icons).
2. Use `stroke="currentColor"` (or `fill="currentColor"`) and no fixed colours,
   so it follows the text colour and works in dark mode.
3. Leave out `width` and `height` on the `<svg>`; `<Icon :size>` sets the size.
4. Add the name to `src/icon-names.ts`.

`deno task test` checks all of this (`desktop/icons_test.ts`).
