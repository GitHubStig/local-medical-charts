import { assert, assertEquals } from "@std/assert";
import {
  comparableName,
  idMatchWarnings,
  sameNameAndBirthDate,
  uploadProblem,
} from "./upload-checks.ts";

// Synthetic values only.

const report = { schemaVersion: 1, tests: [], pages: [{}], patient: {} };

Deno.test("a merged report has no upload problem", () => {
  assertEquals(uploadProblem(report), null);
});

Deno.test("common wrong files are explained", () => {
  assert(uploadProblem([])?.includes("expected a JSON object"));
  assert(uploadProblem(null)?.includes("expected a JSON object"));
  assert(
    uploadProblem({
      schemaVersion: 1,
      model: "m",
      promptHash: "p",
      extraction: {},
    })
      ?.includes("single OCR page file"),
  );
  assert(
    uploadProblem({ instructions: "", suggestions: [] })?.includes(
      "suggestions file",
    ),
  );
  assert(uploadProblem({ hello: 1 })?.includes("no schemaVersion"));
  assert(
    uploadProblem({ ...report, schemaVersion: "1" })?.includes(
      "invalid schemaVersion",
    ),
  );
  assert(
    uploadProblem({ ...report, schemaVersion: 99 })?.includes(
      "newer version of the app",
    ),
  );
  assert(
    uploadProblem({ ...report, pages: undefined })?.includes(
      "no embedded pages",
    ),
  );
});

Deno.test("names compare by letters, ignoring case, spacing and hyphens", () => {
  assertEquals(comparableName("  Alex  Example-Smith "), "ALEX EXAMPLE SMITH");
  assertEquals(comparableName("ALEX EXAMPLE SMITH"), "ALEX EXAMPLE SMITH");
  assertEquals(comparableName("  "), null);
  assertEquals(comparableName(null), null);
});

Deno.test("an ID match warns only about details that actually disagree", () => {
  const onFile = { name: "ALEX EXAMPLE", dateOfBirth: "1990-08-15" };
  assertEquals(
    idMatchWarnings(onFile, {
      name: "Alex Example",
      dateOfBirth: "1990-08-15",
    }),
    [],
  );
  assertEquals(idMatchWarnings(onFile, { name: null, dateOfBirth: null }), []);

  const [name] = idMatchWarnings(onFile, {
    name: "JORDAN EXAMPLE",
    dateOfBirth: "1990-08-15",
  });
  assert(
    name.includes("names JORDAN EXAMPLE") && name.includes("check the ID"),
  );

  const [dob] = idMatchWarnings(onFile, {
    name: "ALEX EXAMPLE",
    dateOfBirth: "1990-08-16",
  });
  assert(dob.includes("date of birth differs"));
});

Deno.test("same name and birth date needs both to match", () => {
  const a = { name: "Alex Example", dateOfBirth: "1990-08-15" };
  assert(
    sameNameAndBirthDate(a, {
      name: "ALEX EXAMPLE",
      dateOfBirth: "1990-08-15",
    }),
  );
  assert(
    !sameNameAndBirthDate(a, {
      name: "ALEX EXAMPLE",
      dateOfBirth: "1991-08-15",
    }),
  );
  assert(!sameNameAndBirthDate({ name: "Alex Example", dateOfBirth: null }, a));
});
