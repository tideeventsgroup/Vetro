import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

interface CandidateSeed {
  firstName: string;
  lastName: string;
  email: string;
  siaExpiry?: Date;
  siaStatus?: "NOT_STARTED" | "PENDING" | "VERIFIED" | "EXPIRED" | "REJECTED";
}

async function seedOrganisation(name: string, slug: string, candidates: CandidateSeed[]) {
  const organisation = await db.organisation.create({ data: { name, slug } });

  const roleType = await db.roleType.create({
    data: {
      organisationId: organisation.id,
      name: "Door Supervisor",
      requiredCheckTypes: ["SIA_LICENCE", "FIRST_AID", "RIGHT_TO_WORK"],
    },
  });

  for (const [index, c] of candidates.entries()) {
    const candidate = await db.candidate.create({
      data: {
        organisationId: organisation.id,
        roleTypeId: roleType.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        inviteToken: generateInviteToken(),
        invitedByEmail: "dev@local",
      },
    });

    await db.check.create({
      data: {
        candidateId: candidate.id,
        checkType: "SIA_LICENCE",
        status: c.siaStatus ?? "NOT_STARTED",
        licenceNumber: c.siaStatus ? `${slug.toUpperCase()}-${1000 + index}` : undefined,
        expiryDate: c.siaExpiry,
        verifiedAt: c.siaStatus === "VERIFIED" ? new Date() : undefined,
        verifiedBy: c.siaStatus === "VERIFIED" ? "dev@local" : undefined,
      },
    });
    await db.check.create({ data: { candidateId: candidate.id, checkType: "FIRST_AID" } });
    await db.check.create({ data: { candidateId: candidate.id, checkType: "RIGHT_TO_WORK" } });
  }

  console.log(`Seeded ${candidates.length} candidates for ${name} (${slug}.lunarascreening.co.uk).`);
}

async function main() {
  await seedOrganisation("Acme Vetting Ltd", "acme-vetting", [
    { firstName: "A.", lastName: "Mackenzie", email: "a.mackenzie@example.com", siaStatus: "VERIFIED", siaExpiry: daysFromNow(600) },
    { firstName: "J.", lastName: "Smith", email: "j.smith@example.com", siaStatus: "VERIFIED", siaExpiry: daysFromNow(14) },
    { firstName: "R.", lastName: "Campbell", email: "r.campbell@example.com", siaStatus: "EXPIRED", siaExpiry: daysFromNow(-15) },
    { firstName: "F.", lastName: "Adeyemi", email: "f.adeyemi@example.com" },
  ]);

  // A second tenant, distinct from the first — proves the roster you see
  // depends on which subdomain you're on, not just who's logged in.
  await seedOrganisation("Northgate Compliance", "northgate", [
    { firstName: "M.", lastName: "Fraser", email: "m.fraser@example.com", siaStatus: "VERIFIED", siaExpiry: daysFromNow(300) },
    { firstName: "S.", lastName: "Grant", email: "s.grant@example.com" },
  ]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
