import type { getDb } from "../db/client.js";
import { deriveStatus } from "./status.js";

// Whether an officer's live compliance state currently blocks them from
// booking on to a shift — checked fresh from expiryDate here rather than
// trusting the stored `status` column, since that's only recomputed once a
// day by jobs/checkExpiries.ts and could be up to 24h stale. This is the
// plan's core differentiator: a lapsed vet blocks booking on immediately,
// not whenever the nightly job next runs.
export async function getBookOnBlocker(
  db: Awaited<ReturnType<typeof getDb>>,
  officerId: string
): Promise<string | undefined> {
  const officer = await db.officer.findUnique({
    where: { id: officerId },
    include: { vettingRecords: true, licences: true, dbsChecks: true },
  });
  if (!officer) return "Officer not found";

  const now = new Date();
  const hasCurrentVetting = officer.vettingRecords.some(
    (v) => deriveStatus(v.expiryDate, now) !== "EXPIRED"
  );
  if (!hasCurrentVetting) {
    return "Vetting is not current — booking on is blocked until it's renewed";
  }

  // Soft check, same as licence/DBS below: only enforced once there's an
  // actual expiry date on file to check against. `rightToWorkConfirmed`
  // itself is deliberately NOT a hard gate here — every officer in this
  // system predates this field's workflow, so treating an unticked box as
  // a block would freeze booking-on for the entire existing roster the
  // moment this ships, not just catch a genuine lapse.
  if (officer.rightToWorkExpiryDate && officer.rightToWorkExpiryDate < now) {
    return "Right to work has expired — booking on is blocked until it's renewed";
  }

  const hasExpiredLicence = officer.licences.some(
    (l) => deriveStatus(l.expiryDate, now) === "EXPIRED"
  );
  if (hasExpiredLicence) {
    return "SIA licence has expired — booking on is blocked until it's renewed";
  }

  const hasExpiredDbs = officer.dbsChecks.some((d) => deriveStatus(d.expiryDate, now) === "EXPIRED");
  if (hasExpiredDbs) {
    return "DBS check has expired — booking on is blocked until it's renewed";
  }

  return undefined;
}

// Whether assigning this officer to a shift ending at `shiftEndTime` should
// be refused — the plan's "hard dependency, not bolt-on" requirement:
// rostering itself checks vetting/licence coverage, rather than only
// catching a lapse once the officer tries to book on. Vetting is a hard
// requirement (no record at all also blocks); licence coverage is a softer
// one only enforced when the officer actually has licence data to check —
// not every rostered role necessarily carries an SIA licence.
export async function getRosterBlocker(
  db: Awaited<ReturnType<typeof getDb>>,
  officerId: string,
  shiftEndTime: Date
): Promise<string | undefined> {
  const officer = await db.officer.findUnique({
    where: { id: officerId },
    include: { vettingRecords: true, licences: true, dbsChecks: true },
  });
  if (!officer) return "Officer not found";

  const hasCoveringVetting = officer.vettingRecords.some(
    (v) => !v.expiryDate || v.expiryDate >= shiftEndTime
  );
  if (!hasCoveringVetting) {
    return "This officer's vetting will have expired before this shift ends";
  }

  // Soft check — see getBookOnBlocker's comment on why rightToWorkConfirmed
  // itself isn't a hard gate.
  if (officer.rightToWorkExpiryDate && officer.rightToWorkExpiryDate < shiftEndTime) {
    return "This officer's right to work will have expired before this shift ends";
  }

  const hasCoveringLicence = officer.licences.some((l) => !l.expiryDate || l.expiryDate >= shiftEndTime);
  if (officer.licences.length > 0 && !hasCoveringLicence) {
    return "This officer's SIA licence will have expired before this shift ends";
  }

  const hasCoveringDbs = officer.dbsChecks.some((d) => !d.expiryDate || d.expiryDate >= shiftEndTime);
  if (officer.dbsChecks.length > 0 && !hasCoveringDbs) {
    return "This officer's DBS check will have expired before this shift ends";
  }

  return undefined;
}
