import type { EmploymentStatus, EmploymentType, PayRateType } from "@prisma/client";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { buildInviteClientMetadata, CognitoUserExistsError, createCognitoUser } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";

export const officers = new Hono<AppEnv>();

officers.get("/", async (c) => {
  const db = await getDb();
  const rows = await db.officer.findMany({
    where: { contractorId: c.get("contractorId") },
    include: { licences: true, vettingRecords: true },
    orderBy: { lastName: "asc" },
  });
  return c.json(rows);
});

officers.get("/:id", async (c) => {
  const db = await getDb();
  const row = await db.officer.findUnique({
    where: { id: c.req.param("id") },
    include: { licences: true, vettingRecords: true, qualifications: true, documents: true },
  });
  if (!row || row.contractorId !== c.get("contractorId")) return c.json({ error: "Officer not found" }, 404);
  return c.json(row);
});

// The full HR profile an officer create/update can carry — everything
// beyond first/last name is optional, since a new hire's full paperwork
// (NI number, address, emergency contact, pay rate) often trickles in over
// the first few days rather than arriving complete at the moment they're
// added.
interface OfficerHrFields {
  email?: string;
  phone?: string;
  dateOfBirth?: string | null;
  nationalInsuranceNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  employeeNumber?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  employmentStatus?: string;
  startDate?: string | null;
  leaveDate?: string | null;
  payRate?: number | null;
  payRateType?: string | null;
  rightToWorkConfirmed?: boolean;
  rightToWorkCheckedAt?: string | null;
}

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CASUAL", "ZERO_HOURS"] as const;
const EMPLOYMENT_STATUSES = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "LEFT"] as const;
const PAY_RATE_TYPES = ["HOURLY", "DAILY", "SALARY"] as const;

// Builds the Prisma `data` object from an HR-fields body, allowlisting each
// key explicitly (never `data: body`) and converting date strings to Date —
// shared by create and update so the two can't drift on which fields or
// enum values are actually accepted.
function buildOfficerHrData(body: OfficerHrFields) {
  if (body.employmentType && !EMPLOYMENT_TYPES.includes(body.employmentType as (typeof EMPLOYMENT_TYPES)[number])) {
    throw new Error(`employmentType must be one of: ${EMPLOYMENT_TYPES.join(", ")}`);
  }
  if (
    body.employmentStatus &&
    !EMPLOYMENT_STATUSES.includes(body.employmentStatus as (typeof EMPLOYMENT_STATUSES)[number])
  ) {
    throw new Error(`employmentStatus must be one of: ${EMPLOYMENT_STATUSES.join(", ")}`);
  }
  if (body.payRateType && !PAY_RATE_TYPES.includes(body.payRateType as (typeof PAY_RATE_TYPES)[number])) {
    throw new Error(`payRateType must be one of: ${PAY_RATE_TYPES.join(", ")}`);
  }

  const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

  return {
    ...(body.email !== undefined && { email: body.email }),
    ...(body.phone !== undefined && { phone: body.phone }),
    ...(body.dateOfBirth !== undefined && { dateOfBirth: toDate(body.dateOfBirth) }),
    ...(body.nationalInsuranceNumber !== undefined && { nationalInsuranceNumber: body.nationalInsuranceNumber }),
    ...(body.addressLine1 !== undefined && { addressLine1: body.addressLine1 }),
    ...(body.addressLine2 !== undefined && { addressLine2: body.addressLine2 }),
    ...(body.city !== undefined && { city: body.city }),
    ...(body.postcode !== undefined && { postcode: body.postcode }),
    ...(body.emergencyContactName !== undefined && { emergencyContactName: body.emergencyContactName }),
    ...(body.emergencyContactPhone !== undefined && { emergencyContactPhone: body.emergencyContactPhone }),
    ...(body.emergencyContactRelationship !== undefined && {
      emergencyContactRelationship: body.emergencyContactRelationship,
    }),
    ...(body.employeeNumber !== undefined && { employeeNumber: body.employeeNumber }),
    ...(body.jobTitle !== undefined && { jobTitle: body.jobTitle }),
    ...(body.employmentType !== undefined && { employmentType: body.employmentType as EmploymentType | null }),
    ...(body.employmentStatus !== undefined && { employmentStatus: body.employmentStatus as EmploymentStatus }),
    ...(body.startDate !== undefined && { startDate: toDate(body.startDate) }),
    ...(body.leaveDate !== undefined && { leaveDate: toDate(body.leaveDate) }),
    ...(body.payRate !== undefined && { payRate: body.payRate }),
    ...(body.payRateType !== undefined && { payRateType: body.payRateType as PayRateType | null }),
    ...(body.rightToWorkConfirmed !== undefined && { rightToWorkConfirmed: body.rightToWorkConfirmed }),
    ...(body.rightToWorkCheckedAt !== undefined && { rightToWorkCheckedAt: toDate(body.rightToWorkCheckedAt) }),
  };
}

officers.post("/", async (c) => {
  const db = await getDb();
  const body = await c.req.json<{ firstName: string; lastName: string } & OfficerHrFields>();
  if (!body.firstName?.trim() || !body.lastName?.trim()) {
    return c.json({ error: "firstName and lastName are required" }, 400);
  }

  let hrData;
  try {
    hrData = buildOfficerHrData(body);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Invalid officer fields" }, 400);
  }

  const created = await db.officer.create({
    data: {
      contractorId: c.get("contractorId")!,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      ...hrData,
    },
  });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.created",
    entityType: "Officer",
    entityId: created.id,
  });
  return c.json(created, 201);
});

officers.patch("/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.officer.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Officer not found" }, 404);
  }

  const body = await c.req.json<Partial<{ firstName: string; lastName: string }> & OfficerHrFields>();
  let hrData;
  try {
    hrData = buildOfficerHrData(body);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Invalid officer fields" }, 400);
  }

  const updated = await db.officer.update({
    where: { id },
    data: {
      ...(body.firstName !== undefined && { firstName: body.firstName }),
      ...(body.lastName !== undefined && { lastName: body.lastName }),
      ...hrData,
    },
  });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.updated",
    entityType: "Officer",
    entityId: id,
  });
  return c.json(updated);
});

// Gives an officer their own login to the self-service vetting portal.
// Vetro still never performs the BS7858 check itself — this just lets the
// officer submit their own details/documents for an admin to review (see
// VettingSubmission in prisma/schema.prisma and the /me/* routes it feeds).
officers.post("/:id/invite", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const officer = await db.officer.findUnique({ where: { id } });
  if (!officer || officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Officer not found" }, 404);
  }

  const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string });
  const email = body.email ?? officer.email;
  if (!email) {
    return c.json({ error: "Officer has no email on file — provide one to invite" }, 400);
  }
  if (email !== officer.email) {
    await db.officer.update({ where: { id }, data: { email } });
  }

  const contractor = await db.contractor.findUniqueOrThrow({ where: { id: officer.contractorId } });

  let temporaryPassword: string;
  try {
    ({ temporaryPassword } = await createCognitoUser({
      email,
      attributes: {
        "custom:contractor_id": officer.contractorId,
        "custom:role": "OFFICER",
        "custom:officer_id": officer.id,
      },
      clientMetadata: buildInviteClientMetadata(contractor),
    }));
  } catch (err) {
    if (err instanceof CognitoUserExistsError) return c.json({ error: err.message }, 409);
    throw err;
  }

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.invited",
    entityType: "Officer",
    entityId: id,
  });

  return c.json({ status: "invited", email, temporaryPassword }, 201);
});

officers.delete("/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.officer.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Officer not found" }, 404);
  }

  await db.officer.delete({ where: { id } });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.deleted",
    entityType: "Officer",
    entityId: id,
  });
  return c.body(null, 204);
});
