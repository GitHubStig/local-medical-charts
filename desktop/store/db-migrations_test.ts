import { assertEquals, assertThrows } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import {
  assertExpectedTables,
  DATABASE_MIGRATIONS,
  type DatabaseMigration,
  databaseVersion,
  DatabaseVersionError,
  migrateDatabase,
} from "./db-migrations.ts";

const tables = (db: DatabaseSync) =>
  (db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all() as {
    name: string;
  }[]).map((r) => r.name);

Deno.test("a new database is migrated to the latest version", () => {
  const db = new DatabaseSync(":memory:");
  const result = migrateDatabase(db);
  assertEquals([result.from, result.to], [0, DATABASE_MIGRATIONS.length]);
  assertEquals(tables(db), ["patients", "reports", "results", "settings"]);
  db.close();
});

Deno.test("migrating an up-to-date database does nothing", () => {
  const db = new DatabaseSync(":memory:");
  migrateDatabase(db);
  assertEquals(migrateDatabase(db).applied, []);
  db.close();
});

Deno.test("a database from a newer app is refused", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA user_version = ${DATABASE_MIGRATIONS.length + 1}`);
  assertThrows(
    () => migrateDatabase(db),
    DatabaseVersionError,
    "newer than this app",
  );
  db.close();
});

const first: DatabaseMigration = {
  version: 1,
  description: "notes",
  sql: "CREATE TABLE notes (id INTEGER PRIMARY KEY)",
};
const second: DatabaseMigration = {
  version: 2,
  description: "add body",
  sql: "ALTER TABLE notes ADD COLUMN body TEXT",
};

Deno.test("migrations run in order from the database's current version", () => {
  const db = new DatabaseSync(":memory:");
  assertEquals(migrateDatabase(db, [first]).applied, ["notes"]);
  assertEquals(migrateDatabase(db, [first, second]).applied, ["add body"]);
  assertEquals(databaseVersion(db), 2);
  db.close();
});

Deno.test("a failing migration rolls back, leaving the version unchanged", () => {
  const db = new DatabaseSync(":memory:");
  const broken: DatabaseMigration = {
    version: 2,
    description: "broken",
    sql:
      "CREATE TABLE extra (id INTEGER); ALTER TABLE missing ADD COLUMN x TEXT",
  };
  migrateDatabase(db, [first]);
  assertThrows(
    () => migrateDatabase(db, [first, broken]),
    DatabaseVersionError,
    "broken",
  );
  assertEquals(databaseVersion(db), 1);
  assertEquals(tables(db), ["notes"]);
  db.close();
});

Deno.test("migrations must be numbered without gaps", () => {
  const db = new DatabaseSync(":memory:");
  assertThrows(
    () => migrateDatabase(db, [second]),
    DatabaseVersionError,
    "numbered",
  );
  db.close();
});

Deno.test("a stale development database gets a clear error, not a missing-table failure", () => {
  const db = new DatabaseSync(":memory:");
  migrateDatabase(db);
  assertExpectedTables(db);
  // What an earlier build of migration 1 would have left behind.
  db.exec("DROP TABLE settings");
  assertThrows(
    () => assertExpectedTables(db),
    DatabaseVersionError,
    "delete the data folder",
  );
  db.close();
});
