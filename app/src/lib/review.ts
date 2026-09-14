/**
 * What the review screen shows for a read report before it's saved. Plain
 * functions, tested in desktop/review_test.ts.
 */
import type {
  ImportFiling,
  ImportJob,
  ReportWithoutPages,
} from "../../../desktop/contract.ts";
import { DATE_LABELS } from "./dashboard.ts";
import { type Flag, toFlag } from "./flags.ts";
import {
  dateAndTime,
  dayMonthYear,
  displayName,
  formatDuration,
  formatMeasurement,
  plural,
} from "./format.ts";
import { formatRange } from "./test-grid.ts";

export type ReviewRow = {
  index: number;
  /** As printed. */
  name: string;
  page: number;
  /** "12.1", "< 5", or the words printed. */
  value: string;
  unit: string | null;
  /** The lab's range, in the printed unit. */
  range: string | null;
  flag: Flag | null;
  /** The catalog's name for the test, or null when the catalog has no match. */
  catalogName: string | null;
  /** An extraction note about this page mentions the test: worth checking against the page. */
  check: boolean;
};

export type ExtractionNote = { page: number | null; text: string };

/** The report's warnings, with the page each is about ("p2: …") split off. */
export function extractionNotes(report: ReportWithoutPages): ExtractionNote[] {
  return report.warnings.map((warning) => {
    const match = warning.match(/^p(\d+):\s*(.*)$/s);
    return match
      ? { page: Number(match[1]), text: match[2] }
      : { page: null, text: warning };
  });
}

export function reviewRows(report: ReportWithoutPages): ReviewRow[] {
  const notes = extractionNotes(report).map((n) => ({
    page: n.page,
    text: n.text.toLowerCase(),
  }));
  return report.tests.map((test, index) => {
    const { result } = test;
    // Names too short to search for ("pH") would match notes by accident.
    const names = [test.name, test.analyteName]
      .flatMap((n) => n && n.length >= 3 ? [n.toLowerCase()] : []);
    return {
      index,
      name: test.name,
      page: test.page,
      value: result.kind === "text" ? result.text : formatMeasurement(
        result.value,
        result.kind === "comparator" ? result.op : null,
        null,
      ),
      unit: test.unit,
      range: formatRange(test.range),
      flag: toFlag(test.flag),
      catalogName: test.analyteName,
      check: notes.some((note) =>
        (note.page === null || note.page === test.page) &&
        names.some((name) => note.text.includes(name))
      ),
    };
  });
}

/** "8 results · 2 flagged · 1 not in the catalog" */
export function reviewSummary(report: ReportWithoutPages): string {
  const flagged = report.tests.filter((t) => t.flag !== null).length;
  const unmatched = report.tests.filter((t) => t.analyte === null).length;
  return [
    plural(report.tests.length, "result"),
    flagged ? `${flagged} flagged` : null,
    unmatched ? `${unmatched} not in the catalog` : null,
  ].filter(Boolean).join(" · ");
}

/** How long reading took, when it ran start to finish. */
export function readingTime(job: ImportJob): string | null {
  return job.startedAt && job.finishedAt
    ? formatDuration(Date.parse(job.finishedAt) - Date.parse(job.startedAt))
    : null;
}

/** Who and where the report is about, as read, so a misread is easy to spot. */
export function reviewDetails(
  report: ReportWithoutPages,
): { label: string; value: string }[] {
  const { patient, provider, doctor } = report;
  const notRead = "Not read";
  const born = dayMonthYear(patient.dateOfBirthIso);
  const date = report.collectedAtSource && report.collectedAt
    ? `${DATE_LABELS[report.collectedAtSource]} ${
      dateAndTime(report.collectedAt)
    }`
    : null;
  return [
    {
      label: "Patient",
      value: [
        patient.name ? displayName(patient.name) : notRead,
        born && `born ${born}`,
        patient.idNumber && `ID ${patient.idNumber}`,
      ].filter(Boolean).join(" · "),
    },
    { label: "Lab", value: provider.name ?? notRead },
    { label: "Dates", value: date ?? notRead },
    {
      label: "Doctor",
      value: doctor.name ? displayName(doctor.name) : notRead,
    },
  ];
}

export type FilingMessage = {
  /** match: an existing patient, cleanly; new: a new patient; attention: something to check; blocked: can't be saved. */
  tone: "match" | "new" | "attention" | "blocked";
  before: string;
  /** Shown in bold between `before` and `after`. */
  name: string | null;
  after: string;
  /** Warnings to read before saving. */
  notes: string[];
};

export function filingMessage(filing: ImportFiling): FilingMessage {
  const { patient } = filing;
  const notes = [...filing.warnings];
  if (filing.similarReport) {
    notes.push(
      `${filing.similarReport.fileName} is already saved for this patient, from the same lab and collection time. Saving adds this report as well.`,
    );
  }
  if (!patient) {
    return {
      tone: "blocked",
      before:
        "Can't be saved: no patient ID number, or name and date of birth, was read to file it under.",
      name: null,
      after: "",
      notes,
    };
  }
  const tone = notes.length
    ? "attention"
    : patient.kind === "new"
    ? "new"
    : "match";
  if (patient.kind === "new") {
    return {
      tone,
      before: "Will start a new patient, ",
      name: displayName(patient.name),
      after: ".",
      notes,
    };
  }
  return {
    tone,
    before: "Will be added to ",
    name: displayName(patient.name),
    after: patient.matchedBy === "id-number"
      ? ". The ID number matches."
      : ". The name and date of birth match.",
    notes,
  };
}
