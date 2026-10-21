/**
 * The fictional sample reports (samples/) as the page sees them, through the
 * browser-dev fake bindings, for tests of what the dashboard builds from them.
 */
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import { buildSeries, type Series } from "../app/src/lib/series.ts";
import type { Dashboard } from "./contract.ts";

/** A sample patient's dashboard, by the name on their reports ("ALEX TAN"). */
export async function sampleDashboard(name: string): Promise<Dashboard> {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const patient = (await b.listPatients()).find((p) => p.name === name)!;
  return (await b.getDashboard(patient.id))!;
}

/** One of a sample patient's series, by its card key. */
export async function sampleSeries(
  name: string,
  key: string,
): Promise<Series> {
  return buildSeries(await sampleDashboard(name)).get(key)!;
}
