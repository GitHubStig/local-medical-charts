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
    hb: 12.5,
    wbc: "6.5",
    plt: "233",
    neutPct: "54",
    neutAbs: "3.5",
    tc: "5.7",
    ldl: "3.4",
    hdl: "1.2",
    tg: "1.4",
    creat: "75",
    egfr: ">=60",
    k: "4.0",
    urea: "5.0",
    hba1c: "5.5",
    glucose: "5.4",
    alt: "<7",
    ggt: "19",
    tsh: "2.0",
    ft4: "13.0",
  },
  {
    hb: 12.2,
    wbc: "4.9",
    plt: "267",
    neutPct: "55",
    neutAbs: "2.7",
    tc: "4.8",
    ldl: "3.0",
    hdl: "1.5",
    tg: "1.3",
    creat: "71",
    egfr: "94",
    k: "4.8",
    urea: "5.4",
    hba1c: "5.5",
    glucose: "5.5",
    alt: "17",
    ggt: "23",
    tsh: "2.0",
    ft4: "14.4",
  },
  {
    hb: 11.7,
    wbc: "7.0",
    plt: "217",
    neutPct: "67",
    neutAbs: "4.7",
    tc: "5.1",
    ldl: "2.7",
    hdl: "1.7",
    tg: "1.4",
    creat: "75",
    egfr: "93",
    k: "5.5",
    urea: "4.4",
    hba1c: "6.0",
    hba1cIfcc: "42",
    glucose: "5.9",
    alt: "33",
    ggt: "20",
    tsh: "2.3",
    ft4: "13.3",
    clarity: "Slightly Cloudy",
    blood: "Trace",
  },
  {
    hb: 12.5,
    wbc: "7.0",
    plt: "261",
    neutPct: "56",
    neutAbs: "3.9",
    tc: "5.2",
    ldl: "3.2",
    hdl: "1.5",
    tg: "1.3",
    creat: "75",
    egfr: "91",
    k: "4.6",
    urea: "4.7",
    hba1c: "6.0",
    hba1cIfcc: "42",
    glucose: "5.4",
    alt: "48",
    ggt: "20",
    tsh: "2.7",
    ft4: "13.8",
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
      hb: 15.2,
      wbc: "7.7",
      plt: "205",
      neutPct: "63",
      neutAbs: "4.9",
      tc: "4.4",
      ldl: "2.9",
      hdl: "1.2",
      tg: "2.3",
    },
  },
];

/**
 * What each lab prints under "Interpretation", by page. Like real reports, a
 * page can carry several separate blocks, which the dashboard groups under one
 * page heading. A block's lines are joined with "; ", as the OCR returns them.
 */
function printedInterpretation(sample: Sample, page: number): string[] {
  const northside = sample.lab === "northside";
  if (page === 1) {
    return [
      ...(northside && sample.values.egfr
        ? ["eGFR is calculated with the CKD-EPI 2021 equation"]
        : []),
      ...(sample.notes.some((note) => /haemolysis/i.test(note))
        ? [
          "Haemolysed sample: potassium may be falsely raised; repeat if clinically indicated",
        ]
        : []),
    ];
  }
  return northside
    ? [
      "HbA1c is reported in NGSP units",
      "Glucose and lipids are best interpreted on a fasting sample",
    ]
    : [
      "Diagnostic values of HbA1c: Normal < 5.7% (< 39 mmol/mol); Prediabetes 5.7 - 6.2% (39 - 44 mmol/mol); Diabetes >= 6.3% (>= 45 mmol/mol)",
      "Interpret HbA1c together with fasting glucose",
    ];
}

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
    interpretation: printedInterpretation(sample, i + 1),
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
