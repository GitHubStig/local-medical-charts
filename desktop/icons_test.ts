import { assert, assertEquals } from "@std/assert";
import { basename, fromFileUrl, join } from "@std/path";
import { walk } from "@std/fs";
import { ICON_NAMES } from "../app/src/icon-names.ts";

const APP_SRC = fromFileUrl(new URL("../app/src", import.meta.url));
const ICONS = join(APP_SRC, "assets", "icons");

const iconFiles = () =>
  [...Deno.readDirSync(ICONS)]
    .filter((e) => e.name.endsWith(".svg"))
    .map((e) => e.name.slice(0, -".svg".length))
    .sort();

Deno.test("the icon name list matches the icons folder", () => {
  assertEquals([...ICON_NAMES].sort(), iconFiles());
});

Deno.test("icons follow the text colour and let <Icon> size them", () => {
  for (const name of iconFiles()) {
    const svg = Deno.readTextFileSync(join(ICONS, `${name}.svg`));
    const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
    assert(
      /viewBox="0 0 (16 16|24 24)"/.test(root),
      `${name}: viewBox must be 16×16 or 24×24`,
    );
    assert(
      !/\s(width|height)="/.test(root),
      `${name}: no width or height on <svg>`,
    );
    assert(svg.includes("currentColor"), `${name}: use currentColor`);
    assert(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(svg), `${name}: no fixed colours`);
    assert(
      !/<script|\son\w+=/i.test(svg),
      `${name}: no scripts or event handlers`,
    );
  }
});

Deno.test("every <Icon name> used in a component exists", async () => {
  const known = new Set<string>(ICON_NAMES);
  const missing: string[] = [];
  for await (const entry of walk(APP_SRC, { exts: [".vue"] })) {
    const source = await Deno.readTextFile(entry.path);
    for (const match of source.matchAll(/<Icon\b[^>]*?\sname="([^"]+)"/g)) {
      if (!known.has(match[1])) {
        missing.push(`${basename(entry.path)}: ${match[1]}`);
      }
    }
  }
  assertEquals(missing, []);
});
