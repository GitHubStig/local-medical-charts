/**
 * The fictional sample reports (samples/), as files the fake bindings import.
 * Regenerate them with `deno task samples`.
 */
import type { ImportFile } from "../../../desktop/contract.ts";
import alex1 from "../../../samples/alex-tan-2024-11-12.json" with {
  type: "json",
};
import alex2 from "../../../samples/alex-tan-2025-05-20.json" with {
  type: "json",
};
import alex3 from "../../../samples/alex-tan-2025-10-03.json" with {
  type: "json",
};
import alex4 from "../../../samples/alex-tan-2026-03-18.json" with {
  type: "json",
};
import sam1 from "../../../samples/sam-rivera-2026-08-07.json" with {
  type: "json",
};

export const SAMPLE_REPORTS: ImportFile[] = [
  { name: "alex-tan-2024-11-12.json", text: JSON.stringify(alex1) },
  { name: "alex-tan-2025-05-20.json", text: JSON.stringify(alex2) },
  { name: "alex-tan-2025-10-03.json", text: JSON.stringify(alex3) },
  { name: "alex-tan-2026-03-18.json", text: JSON.stringify(alex4) },
  { name: "sam-rivera-2026-08-07.json", text: JSON.stringify(sam1) },
];
