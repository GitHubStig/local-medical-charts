/**
 * Checks that the Tailwind classes in the app's .vue templates are written in
 * their canonical form, using the same canonicalizer as the Tailwind VS Code
 * extension's `suggestCanonicalClasses` warning: the spacing scale rather than
 * pixels in brackets, current names rather than older aliases.
 *
 * Lives in app/ so `tailwindcss` resolves from app/package.json, as it does for
 * vite.config.ts.
 *
 *   deno task classes           # lists classes to change; exits 1 if there are any
 *   deno task classes --write   # rewrites them in place
 */
import { __unstable__loadDesignSystem } from "tailwindcss";

const write = Deno.args.includes("--write");
const app = new URL("./", import.meta.url);
const src = new URL("src/", app);

const design = await __unstable__loadDesignSystem(
  await Deno.readTextFile(new URL("style.css", src)),
  {
    base: src.pathname,
    // Font stylesheets don't affect class names, so only Tailwind itself is loaded.
    loadStylesheet: async (id, base) => ({
      path: id,
      base,
      content: id === "tailwindcss"
        ? await Deno.readTextFile(
          new URL("node_modules/tailwindcss/index.css", app),
        )
        : "",
    }),
  },
);

/** Every .vue file in a folder and its subfolders, in a stable order. */
async function vueFiles(dir: URL): Promise<URL[]> {
  const files: URL[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isDirectory) {
      files.push(...await vueFiles(new URL(`${entry.name}/`, dir)));
    } else if (entry.name.endsWith(".vue")) {
      files.push(new URL(entry.name, dir));
    }
  }
  return files.sort((a, b) => a.pathname.localeCompare(b.pathname));
}

// Anything that could be a class; words Tailwind doesn't recognise come back unchanged.
const CANDIDATE = /[!a-z0-9@:\[\]().\/%#,_-]*-[!a-z0-9@:\[\]().\/%#,_-]+/gi;
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");

let count = 0;
for (const file of await vueFiles(src)) {
  const source = await Deno.readTextFile(file);
  const templateStart = source.indexOf("<template>");
  if (templateStart < 0) continue;
  const name = `app/${file.pathname.slice(app.pathname.length)}`;
  let template = source.slice(templateStart);

  for (const candidate of new Set(template.match(CANDIDATE))) {
    // The root font size is the browser default, 16 px, as the extension assumes.
    const [canonical] = design.canonicalizeCandidates([candidate], { rem: 16 });
    if (!canonical || canonical === candidate) continue;
    // Whole class names only: between spaces, quotes or backticks.
    const pattern = new RegExp(
      `(?<=[\\s"'\`])${escapeRegExp(candidate)}(?=[\\s"'\`])`,
      "g",
    );
    for (const match of source.slice(templateStart).matchAll(pattern)) {
      const line =
        source.slice(0, templateStart + match.index).split("\n").length;
      console.log(`${name}:${line}: ${candidate} → ${canonical}`);
      count++;
    }
    template = template.replace(pattern, canonical);
  }

  if (write) {
    const updated = source.slice(0, templateStart) + template;
    if (updated !== source) await Deno.writeTextFile(file, updated);
  }
}

if (count === 0) {
  console.log("Tailwind classes are all in canonical form.");
} else if (write) {
  console.log(`Rewrote ${count} ${count === 1 ? "class" : "classes"}.`);
} else {
  console.log(
    `${count} to change. Run \`deno task classes --write\` to rewrite them.`,
  );
  Deno.exit(1);
}
