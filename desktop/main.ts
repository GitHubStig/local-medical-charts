/**
 * Desktop entrypoint: opens the window, exposes bindings to the page, and
 * serves the built Vue app.
 *
 *   deno task desktop    build the app, then open it in a desktop window
 */
import { serveDir } from "@std/http/file-server";
import { join } from "@std/path";
import type { DesktopBindings } from "./contract.ts";

/**
 * Where the built app lives. A packaged app embeds it next to this module; a
 * development run (`deno desktop --hmr`) executes from a temporary copy of the
 * code, so the project folder is found through the working directory instead.
 */
function findAppDist(): string | null {
  const candidates = [
    join(import.meta.dirname ?? "", "..", "app", "dist"),
    join(Deno.cwd(), "app", "dist"),
  ];
  return candidates.find((dir) => {
    try {
      return Deno.statSync(join(dir, "index.html")).isFile;
    } catch {
      return false;
    }
  }) ?? null;
}

// The first BrowserWindow adopts the window the runtime already opened.
const win = new Deno.BrowserWindow<DesktopBindings>({
  title: "Medical Charts",
  width: 1440,
  height: 900,
});

// Bindings always return a Promise, even when the work is synchronous.
win.bind("ping", (message) =>
  Promise.resolve({
    message: `pong: ${message}`,
    deno: Deno.version.deno,
    platform: Deno.build.os,
    receivedAt: new Date().toISOString(),
  }));

const dist = findAppDist();

// With no port given, Deno.serve binds to the address the webview opens.
Deno.serve((request) => {
  if (!dist) {
    return new Response(
      "<!doctype html><title>Medical Charts</title><p>The app hasn't been built. Run <code>deno task desktop</code>, which builds it first.</p>",
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
  return serveDir(request, { fsRoot: dist, quiet: true });
});
