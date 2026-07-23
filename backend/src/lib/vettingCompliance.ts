// Encodes the concrete, numeric requirements BS7858:2019 (private security
// screening) and BPSS (the UK government's Baseline Personnel Security
// Standard) actually set out, so a candidate's submitted address/employment
// history can be checked against them automatically instead of an admin
// eyeballing a wall of text for gaps. Figures:
//   BS7858 — 5 years address + employment history; gaps of 31+ days in
//   employment must be explained.
//   BPSS   — 3 years employment history; gaps of 6+ months must be evidenced.
// (BS7858's 2019 revision dropped the fixed personal-reference-count
// requirement in favour of documentary verification, so this doesn't check
// reference count — only that references were captured at all.)

export interface HistoryRow {
  from: string; // "YYYY-MM" — <input type="month"> format
  to: string; // "YYYY-MM", or "" for ongoing/present
}

// addressHistory/employmentHistory are stored as Prisma Json — this
// narrows the unknown shape down to just the two fields the compliance
// check actually needs, tolerating whatever else (address, employer, role)
// each row also carries.
export function asHistoryRows(value: unknown): HistoryRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({ from: typeof row.from === "string" ? row.from : "", to: typeof row.to === "string" ? row.to : "" }));
}

export interface GapFinding {
  standard: "BS7858" | "BPSS";
  severity: "warning" | "critical";
  message: string;
}

const BS7858_HISTORY_YEARS = 5;
const BS7858_GAP_DAYS = 31;
const BPSS_HISTORY_YEARS = 3;
const BPSS_GAP_DAYS = 183; // ~6 months

function monthToDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}-01T00:00:00Z`);
}

function sortedPeriods(rows: HistoryRow[]): { from: Date; to: Date }[] {
  const now = new Date();
  return rows
    .map((r) => ({ from: monthToDate(r.from), to: r.to ? monthToDate(r.to) : now }))
    .filter((r): r is { from: Date; to: Date } => Boolean(r.from && r.to))
    .sort((a, b) => a.from.getTime() - b.from.getTime());
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function checkHistoryCoverage(
  standard: "BS7858" | "BPSS",
  label: string,
  rows: HistoryRow[],
  requiredYears: number,
  gapDays: number
): GapFinding[] {
  const findings: GapFinding[] = [];
  const periods = sortedPeriods(rows);

  if (periods.length === 0) {
    findings.push({ standard, severity: "critical", message: `No ${label} history provided at all.` });
    return findings;
  }

  const earliest = periods[0].from;
  const now = new Date();
  const yearsCovered = daysBetween(earliest, now) / 365;
  if (yearsCovered < requiredYears) {
    findings.push({
      standard,
      severity: "critical",
      message: `${label} history only goes back ${yearsCovered.toFixed(1)} years — ${standard} requires ${requiredYears}.`,
    });
  }

  for (let i = 1; i < periods.length; i++) {
    const gap = daysBetween(periods[i - 1].to, periods[i].from);
    if (gap >= gapDays) {
      findings.push({
        standard,
        severity: "warning",
        message: `${gap}-day gap in ${label} history between ${periods[i - 1].to.toISOString().slice(0, 7)} and ${periods[i].from.toISOString().slice(0, 7)} — ${standard} requires gaps of ${gapDays}+ days to be explained.`,
      });
    }
  }

  return findings;
}

export interface ComplianceCheckInput {
  addressHistory: HistoryRow[];
  employmentHistory: HistoryRow[];
  hasReferences: boolean;
  hasDbsCheck: boolean;
  rightToWorkConfirmed: boolean;
  hasIdentityDocument: boolean;
}

export function checkVettingCompliance(input: ComplianceCheckInput): GapFinding[] {
  const findings: GapFinding[] = [
    ...checkHistoryCoverage("BS7858", "address", input.addressHistory, BS7858_HISTORY_YEARS, BS7858_GAP_DAYS),
    ...checkHistoryCoverage("BS7858", "employment", input.employmentHistory, BS7858_HISTORY_YEARS, BS7858_GAP_DAYS),
    ...checkHistoryCoverage("BPSS", "employment", input.employmentHistory, BPSS_HISTORY_YEARS, BPSS_GAP_DAYS),
  ];

  if (!input.hasReferences) {
    findings.push({ standard: "BS7858", severity: "warning", message: "No references captured to corroborate employment history." });
  }
  if (!input.hasDbsCheck) {
    findings.push({ standard: "BPSS", severity: "critical", message: "No DBS/criminal record check on file." });
  }
  if (!input.rightToWorkConfirmed) {
    findings.push({ standard: "BPSS", severity: "critical", message: "Right to work has not been confirmed." });
  }
  if (!input.hasIdentityDocument) {
    findings.push({ standard: "BPSS", severity: "critical", message: "No identity document on file." });
  }

  return findings;
}
