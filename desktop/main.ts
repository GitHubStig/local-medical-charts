/**
 * Desktop entrypoint: opens the report database, upgrades stored reports,
 * exposes the bindings to the page, and serves the built Vue app.
 *
 *   deno task desktop    build the app, then open it in a desktop window
 */
import { serveDir } from "@std/http/file-server";
import { join } from "@std/path";
import catalogJson from "../src/analytes.json" with { type: "json" };
import { catalogFromJson } from "../src/catalog.ts";
import { SCHEMA_VERSION } from "../src/schema.ts";
import { createBindings, unavailableBindings } from "./bindings.ts";
import type { ReadingNotice } from "./imports/notice.ts";
import { ollamaPageReader } from "./imports/reader.ts";
import { createOllamaService } from "./ocr/ollama.ts";
import type { DesktopBindings, StartupStatus } from "./contract.ts";
import { databasePath } from "./store/paths.ts";
import { ReportStore } from "./store/store.ts";

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

// A notification is only worth sending while the window is behind. It opens in front.
let windowInFront = true;
win.addEventListener("focus", () => (windowInFront = true));
win.addEventListener("blur", () => (windowInFront = false));

/** A system notification for a finished reading; clicking it brings the window back to that import. */
async function showNotice(notice: ReadingNotice): Promise<void> {
  if (windowInFront) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return;
  const shown = new Notification(notice.title, {
    body: notice.body,
    tag: notice.tag,
  });
  shown.addEventListener("click", () => {
    win.show();
    win.focus();
    win.executeJs(`location.hash = ${JSON.stringify(notice.href)}`);
  });
}

// Imported as a module, so the catalog is part of the app rather than a file
// looked up at runtime. Same content hash as the CLI's loadCatalog().
const catalog = await catalogFromJson(catalogJson, "src/analytes.json");
const dbPath = databasePath(Deno.build.os, Deno.env);

let bindings: DesktopBindings;
try {
  const store = ReportStore.open(dbPath);
  const startup: StartupStatus = {
    ok: true,
    databasePath: dbPath,
    schemaVersion: SCHEMA_VERSION,
    catalogHash: catalog.hash,
    upgrade: store.upgradeAll(catalog),
  };
  bindings = createBindings({
    store,
    catalog,
    startup,
    ollama: createOllamaService(),
    pageReader: ollamaPageReader,
    notify: (notice) => {
      showNotice(notice).catch((err) =>
        console.error("Couldn't show a notification:", err)
      );
    },
  });
} catch (err) {
  // Keep the window usable so the page can explain what went wrong.
  bindings = unavailableBindings({
    ok: false,
    databasePath: dbPath,
    error: err instanceof Error ? err.message : String(err),
  });
}

win.bind("getStartupStatus", bindings.getStartupStatus);
win.bind("listPatients", bindings.listPatients);
win.bind("getDashboard", bindings.getDashboard);
win.bind("importReports", bindings.importReports);
win.bind("deleteReport", bindings.deleteReport);
win.bind("clearAll", bindings.clearAll);
win.bind("getSettings", bindings.getSettings);
win.bind("updateSettings", bindings.updateSettings);
win.bind("listOcrModels", bindings.listOcrModels);
win.bind("testOcr", bindings.testOcr);
win.bind("startImport", bindings.startImport);
win.bind("listImports", bindings.listImports);
win.bind("cancelImport", bindings.cancelImport);
win.bind("retryImport", bindings.retryImport);
win.bind("discardImport", bindings.discardImport);
win.bind("getImportReview", bindings.getImportReview);
win.bind("getImportPage", bindings.getImportPage);
win.bind("saveImport", bindings.saveImport);

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
