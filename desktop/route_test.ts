import { assertEquals } from "@std/assert";
import { parseRoute } from "../app/src/lib/route.ts";

Deno.test("the address fragment picks the screen", () => {
  assertEquals(parseRoute("#/settings"), { name: "settings" });
  assertEquals(parseRoute("#settings"), { name: "settings" });
  assertEquals(parseRoute("#/review/12"), { name: "review", importId: 12 });
  assertEquals(parseRoute(""), { name: "home" });
  assertEquals(parseRoute("#/"), { name: "home" });
  assertEquals(parseRoute("#/settings/more"), { name: "home" });
  assertEquals(parseRoute("#/review/0"), { name: "home" });
  assertEquals(parseRoute("#/review/abc"), { name: "home" });
});
