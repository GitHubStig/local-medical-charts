/**
 * Generates the sample reports in samples/. EVERY PERSON, LAB, ID AND RESULT IS
 * FICTIONAL.
 *
 * The samples go through the real pipeline — page transcriptions merged with
 * buildReport against the real analyte catalog — so they have exactly the shape
 * the OCR produces. Two fictional labs print names, units, ranges and flags
 * differently, the way real labs do, so the samples also exercise cross-lab
 * matching.
 *
 * Used by the fake bindings in browser development, and handy for trying the
 * desktop app's import without real reports.
 *
 *   deno task samples
 */
import { join } from "@std/path";
import { loadCatalog } from "../src/catalog.ts";
import {
  buildReport,
  classify,
  parseRange,
  parseResult,
} from "../src/normalize.ts";
import {
  type PageExtraction,
  type RawTest,
  ReportSchema,
  type Specimen,
} from "../src/schema.ts";

const OUT = join(import.meta.dirname!, "..", "samples");
const catalog = await loadCatalog();

type Lab = "northside" | "harbour";

/** [value, unit, printed range] — the flag marker is worked out from the range. */
type Measurement = [string, string | null, string | null];

function row(
  lab: Lab,
  name: string,
  specimen: Specimen,
  headings: string[],
  measurements: Measurement[],
): RawTest {
  return {
    headings,
    specimen,
    name,
    nameZh: null,
    measurements: measurements.map(([value, unit, referenceText]) => {
      const found = classify(
        parseResult(value, unit),
        parseRange(referenceText, unit),
      );
      // Northside prints H or L; Harbour marks any abnormal result with *.
      const marker = found === null || found === "normal"
        ? null
        : lab === "northside"
        ? (found === "A" ? "*" : found)
        : "*";
      return { value, unit, referenceText, marker };
    }),
    notes: [],
  };
}

const PROVIDERS = {
  northside: {
    name: "Northside Pathology",
    address: "8 Alder Lane, Brookfield",
    phone: "(02) 5550 0148",
    website: "northside-pathology.example",
  },
  harbour: {
    name: "Harbour Medical Lab",
    address: "14 Wharf Street, Port Ellery",
    phone: "(03) 5550 0192",
    website: "harbour-medical.example",
  },
};

type Patient = {
  name: string;
  idNumber: string;
  dobNorthside: string;
  dobHarbour: string;
  sex: [string, string];
};

const ALEX: Patient = {
  name: "ALEX TAN",
  idNumber: "S1234482K",
  dobNorthside: "02-11-1984",
  dobHarbour: "02/11/84",
  sex: ["FEMALE", "Female"],
};
const SAM: Patient = {
  name: "SAM RIVERA",
  idNumber: "T7654907M",
  dobNorthside: "14-02-1990",
  dobHarbour: "14/02/90",
  sex: ["MALE", "Male"],
};

type Values = {
  hb: number;
  wbc: string;
  plt: string;
  neutPct: string;
  neutAbs: string;
  tc: string;
  ldl: string;
  hdl: string;
  tg: string;
  creat?: string;
  egfr?: string;
  k?: string;
  urea?: string;
  hba1c?: string;
  hba1cIfcc?: string;
  glucose?: string;
  alt?: string;
  ggt?: string;
  tsh?: string;
  ft4?: string;
  clarity?: string;
  blood?: string;
};

function tests(lab: Lab, v: Values): { page1: RawTest[]; page2: RawTest[] } {
  const n = lab === "northside";
  const blood: Specimen = "blood";
  const fbc = n ? ["Full Blood Count"] : ["HAEMATOLOGY"];
  const lipids = n ? ["Lipid Profile"] : ["GENERAL BIOCHEMISTRY", "Lipids"];
  const renal = n
    ? ["Renal Function Test"]
    : ["GENERAL BIOCHEMISTRY", "Renal Function"];

  const page1: RawTest[] = [
    n
      ? row(lab, "Haemoglobin", blood, fbc, [[
        v.hb.toFixed(1),
        "g/dL",
        "11.5 - 16.0",
      ]])
      : row(lab, "Haemoglobin", blood, fbc, [[
        String(Math.round(v.hb * 10)),
        "g/L",
        "(120-155)",
      ]]),
    row(lab, n ? "Total WBC" : "White Cell Count", blood, fbc, [[
      v.wbc,
      n ? "x10^9/L" : "x 10^9/L",
      n ? "4.0 - 11.0" : "(4.0-10.0)",
    ]]),
    row(lab, n ? "Platelet Count" : "Platelets", blood, fbc, [[
      v.plt,
      n ? "x10^9/L" : "x 10^9/L",
      n ? "150 - 400" : "(150-410)",
    ]]),
    row(
      lab,
      "Neutrophils",
      blood,
      fbc,
      n
        ? [[v.neutPct, "%", "40 - 75"], [v.neutAbs, "x10^9/L", "2.0 - 7.5"]]
        : [[v.neutPct, "%", null], [v.neutAbs, "x 10^9/L", "(2.0-7.0)"]],
    ),
    row(lab, n ? "Total Cholesterol" : "Total Chol", blood, lipids, [[
      v.tc,
      "mmol/L",
      n ? "< 5.2" : "(< 5.2)",
    ]]),
    row(lab, n ? "LDL-Cholesterol" : "LDL-C", blood, lipids, [[
      v.ldl,
      "mmol/L",
      n ? "< 3.4" : "(< 3.0)",
    ]]),
    row(lab, n ? "HDL-Cholesterol" : "HDL-C", blood, lipids, [[
      v.hdl,
      "mmol/L",
      n ? "> 1.0" : "(> 1.2)",
    ]]),
    row(lab, n ? "Triglycerides" : "Triglyceride", blood, lipids, [[
      v.tg,
      "mmol/L",
      n ? "< 1.7" : "(< 1.70)",
    ]]),
  ];
  if (v.creat) {
    page1.push(
      row(lab, "Creatinine", blood, renal, [[
        v.creat,
        n ? "µmol/L" : "umol/L",
        n ? "45 - 90" : "(40-80)",
      ]]),
      row(lab, "eGFR", blood, renal, [[
        v.egfr!,
        n ? "ml/min/1.73m^2" : "mL/min/1.73m²",
        n ? "(Ref.Range:>= 60)" : "(>= 60)",
      ]]),
      row(lab, "Potassium", blood, renal, [[
        v.k!,
        "mmol/L",
        n ? "3.5 - 5.1" : "(3.5-5.1)",
      ]]),
      row(lab, "Urea", blood, renal, [[
        v.urea!,
        "mmol/L",
        n ? "2.5 - 7.8" : "(2.5-8.0)",
      ]]),
    );
  }

  const page2: RawTest[] = [];
  if (v.hba1c) {
    page2.push(
      n
        ? row(lab, "HbA1c (NGSP)", blood, ["Biochemistry"], [[
          v.hba1c,
          "%",
          "Normal <5.7%; Prediabetes 5.7-6.2%; Diabetes >=6.3%",
        ]])
        : row(lab, "HbA1c", blood, ["SPECIAL CHEMISTRY"], [
          [v.hba1c, "%", null],
          [v.hba1cIfcc!, "mmol/mol", null],
        ]),
      row(
        lab,
        "Glucose",
        blood,
        n ? ["Biochemistry"] : ["SERUM/PLASMA GLUCOSE"],
        [[v.glucose!, "mmol/L", n ? "3.9 - 6.0" : "(3.9 - 6.0)"]],
      ),
      row(
        lab,
        n ? "ALT (SGPT)" : "ALT",
        blood,
        n ? ["Liver Function Test"] : ["Liver Function"],
        [[v.alt!, n ? "IU/L" : "U/L", n ? "0 - 40" : "(< 35)"]],
      ),
      row(lab, "GGT", blood, n ? ["Liver Function Test"] : ["Liver Function"], [
        [v.ggt!, n ? "IU/L" : "U/L", n ? "5 - 35" : "(< 38)"],
      ]),
      row(lab, "TSH", blood, ["Thyroid"], [[
        v.tsh!,
        n ? "uIU/mL" : "mIU/L",
        n ? "0.4 - 4.0" : "(0.30-4.20)",
      ]]),
      row(lab, "Free T4", blood, ["Thyroid"], [[
        v.ft4!,
        "pmol/L",
        n ? "9.0 - 19.0" : "(10.0-20.0)",
      ]]),
    );
    const urine = n ? ["Urinalysis"] : ["URINE FEME", "CHEMISTRY"];
    page2.push(
      row(lab, n ? "Colour" : "Colour", "urine", urine, [[
        "Pale Yellow",
        null,
        null,
      ]]),
      row(lab, n ? "Clarity" : "Transparency", "urine", urine, [[
        v.clarity ?? "Clear",
        null,
        null,
      ]]),
      row(lab, "Protein", "urine", urine, [["Negative", null, "(Negative)"]]),
      row(lab, "Glucose", "urine", urine, [["Negative", null, "(Negative)"]]),
      row(lab, "Blood", "urine", urine, [[
        v.blood ?? "Negative",
        null,
        "(Negative)",
      ]]),
      row(lab, "Leucocytes", "urine", urine, [[
        "Negative",
        null,
        "(Negative)",
      ]]),
    );
  }
  return { page1, page2 };
}

type Sample = {
  file: string;
  patient: Patient;
  lab: Lab;
  /** ISO date of collection (Harbour) or receipt (Northside, which prints no collection date). */
  date: string;
  age: string;
  notes: string[];
  values: Values;
};

const [ALEX_1, ALEX_2, ALEX_3, ALEX_4] = [
  {
    hb: 12.9,
    wbc: "6.1",
    plt: "245",
    neutPct: "58",
    neutAbs: "3.4",
    tc: "5.4",
    ldl: "3.5",
    hdl: "1.3",
    tg: "1.6",
    creat: "71",
    egfr: ">=90",
    k: "4.3",
    urea: "4.8",
    hba1c: "5.4",
    glucose: "5.1",
    alt: "<5",
    ggt: "22",
    tsh: "1.8",
    ft4: "13.2",
  },
  {
    hb: 12.4,
    wbc: "5.4",
    plt: "262",
    neutPct: "54",
    neutAbs: "2.9",
    tc: "5.1",
    ldl: "3.2",
    hdl: "1.4",
    tg: "1.4",
    creat: "68",
    egfr: "96",
    k: "4.6",
    urea: "5.2",
    hba1c: "5.6",
    glucose: "5.4",
    alt: "18",
    ggt: "19",
    tsh: "2.1",
    ft4: "14.0",
  },
  {
    hb: 11.6,
    wbc: "7.2",
    plt: "231",
    neutPct: "63",
    neutAbs: "4.6",
    tc: "4.9",
    ldl: "2.9",
    hdl: "1.5",
    tg: "1.2",
    creat: "74",
    egfr: "91",
    k: "5.3",
    urea: "3.9",
    hba1c: "5.8",
    hba1cIfcc: "40",
    glucose: "5.6",
    alt: "31",
    ggt: "16",
    tsh: "2.6",
    ft4: "12.8",
    clarity: "Slightly Cloudy",
    blood: "Trace",
  },
  {
    hb: 12.2,
    wbc: "6.8",
    plt: "250",
    neutPct: "60",
    neutAbs: "4.1",
    tc: "5.3",
    ldl: "3.4",
    hdl: "1.4",
    tg: "1.5",
    creat: "70",
    egfr: "94",
    k: "4.8",
    urea: "4.4",
    hba1c: "5.7",
    hba1cIfcc: "39",
    glucose: "5.2",
    alt: "47",
    ggt: "24",
    tsh: "2.3",
    ft4: "13.6",
  },
] satisfies Values[];

const SAMPLES: Sample[] = [
  {
    file: "alex-tan-2024-11-12.json",
    patient: ALEX,
    lab: "northside",
    date: "2024-11-12",
    age: "40Y",
    notes: ["Comment: Fasting"],
    values: ALEX_1,
  },
  {
    file: "alex-tan-2025-05-20.json",
    patient: ALEX,
    lab: "northside",
    date: "2025-05-20",
    age: "40Y",
    notes: [],
    values: ALEX_2,
  },
  {
    file: "alex-tan-2025-10-03.json",
    patient: ALEX,
    lab: "harbour",
    date: "2025-10-03",
    age: "40 Years",
    notes: ["Specimen Comment: Haemolysis +"],
    values: ALEX_3,
  },
  {
    file: "alex-tan-2026-03-18.json",
    patient: ALEX,
    lab: "harbour",
    date: "2026-03-18",
    age: "41 Years",
    notes: ["Specimen type Fasting"],
    values: ALEX_4,
  },
  {
    file: "sam-rivera-2026-08-07.json",
    patient: SAM,
    lab: "northside",
    date: "2026-08-07",
    age: "36Y",
    notes: ["Comment: Fasting"],
    values: {
      hb: 14.8,
      wbc: "7.9",
      plt: "212",
      neutPct: "62",
      neutAbs: "5.1",
      tc: "4.6",
      ldl: "2.7",
      hdl: "1.1",
      tg: "2.1",
    },
  },
];

function printedDate(iso: string, lab: Lab, time: string): string {
  const [y, m, d] = iso.split("-");
  return lab === "northside"
    ? `${d}/${m}/${y} ${time}:00`
    : `${d}/${m}/${y.slice(2)} ${time}`;
}

function dayAfter(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

for (const sample of SAMPLES) {
  const { lab, patient, date } = sample;
  const n = lab === "northside";
  const { page1, page2 } = tests(lab, sample.values);
  const pages = page2.length ? [page1, page2] : [page1];

  const extractions: PageExtraction[] = pages.map((tests, i) => ({
    page: i + 1,
    pageCount: pages.length,
    provider: PROVIDERS[lab],
    patient: {
      name: patient.name,
      idNumber: patient.idNumber,
      dateOfBirth: n ? patient.dobNorthside : patient.dobHarbour,
      sex: patient.sex[n ? 0 : 1],
      age: sample.age,
    },
    doctor: n
      ? { name: "DR PRIYA NAIR", clinic: "RIVERSIDE FAMILY CLINIC" }
      : { name: "Dr Priya Nair", clinic: "Riverside Family Clinic" },
    dates: {
      collected: n ? null : printedDate(date, lab, "08:40"),
      received: n ? printedDate(date, lab, "08:40") : null,
      requested: null,
      reported: printedDate(dayAfter(date), lab, "16:05"),
    },
    headerFields: n
      ? [{ label: "R/N", value: "0000112" }, {
        label: "VN/AN",
        value: `NP${date.replaceAll("-", "").slice(2)}`,
      }]
      : [{
        label: "Lab No.",
        value: `${date.slice(2, 4)}-0000${date.slice(5, 7)}${date.slice(8)}-H`,
      }],
    tests,
    continuationText: null,
    interpretation: i === 1 && !n
      ? [
        "Diagnostic values of HbA1c: Normal < 5.7% (< 39 mmol/mol); Prediabetes 5.7 - 6.2% (39 - 44 mmol/mol); Diabetes >= 6.3% (>= 45 mmol/mol)",
      ]
      : [],
    specimenNotes: i === 0 ? sample.notes : [],
    warnings: [],
  }));

  const report = ReportSchema.parse(buildReport(
    extractions.map((extraction) => ({
      image: `${sample.file.replace(".json", "")}-${extraction.page}.jpg`,
      model: "sample-data",
      promptHash: "sample-data",
      extractedAt: `${dayAfter(date)}T21:14:00.000Z`,
      extraction,
    })),
    {
      report: sample.file.replace(".json", ""),
      catalogHash: catalog.hash,
      mergedAt: `${dayAfter(date)}T21:20:00.000Z`,
    },
    catalog,
  ));

  if (report.unmapped.length) {
    throw new Error(
      `${sample.file}: unmapped tests ${
        report.unmapped.map((u) => u.name).join(", ")
      }`,
    );
  }
  await Deno.writeTextFile(
    join(OUT, sample.file),
    JSON.stringify(report, null, 2) + "\n",
  );
  const flagged = report.tests.filter((t) => t.flag).length;
  console.log(
    `${sample.file}: ${report.tests.length} results, ${flagged} flagged, charted by ${report.collectedAtSource} date`,
  );
}
