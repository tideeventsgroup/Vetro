import { PrismaClient } from "@prisma/client";
import { deriveStatus } from "../src/lib/status.js";

const db = new PrismaClient();

async function seedContractor(name: string, slug: string, officers: OfficerSeed[]) {
  const contractor = await db.contractor.create({ data: { name, slug } });

  for (const [index, o] of officers.entries()) {
    const officer = await db.officer.create({
      data: { contractorId: contractor.id, firstName: o.firstName, lastName: o.lastName },
    });

    await db.siaLicence.create({
      data: {
        officerId: officer.id,
        licenceNumber: `${slug.toUpperCase()}-${1000 + index}`,
        sector: o.sector,
        issueDate: daysFromNow(-700),
        expiryDate: o.licenceExpiry,
        status: deriveStatus(o.licenceExpiry),
        lastCheckedAt: new Date(),
      },
    });

    await db.vettingRecord.create({
      data: {
        officerId: officer.id,
        standard: "BS7858",
        completedDate: daysFromNow(-365),
        expiryDate: o.vettingExpiry,
        status: deriveStatus(o.vettingExpiry),
      },
    });
  }

  console.log(`Seeded ${officers.length} officers for ${name} (${slug}.vetro.co.uk).`);
}

interface OfficerSeed {
  firstName: string;
  lastName: string;
  sector: string;
  licenceExpiry: Date;
  vettingExpiry: Date;
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function main() {
  await seedContractor("Clyde Coast Security Ltd", "clyde-coast", [
    { firstName: "A.", lastName: "Mackenzie", sector: "Door Supervisor", licenceExpiry: daysFromNow(600), vettingExpiry: daysFromNow(500) },
    { firstName: "J.", lastName: "Smith", sector: "Door Supervisor", licenceExpiry: daysFromNow(14), vettingExpiry: daysFromNow(400) },
    { firstName: "R.", lastName: "Campbell", sector: "Security Guard", licenceExpiry: daysFromNow(-15), vettingExpiry: daysFromNow(300) },
    { firstName: "F.", lastName: "Adeyemi", sector: "CCTV Operator", licenceExpiry: daysFromNow(120), vettingExpiry: daysFromNow(90) },
  ]);

  // A second tenant, distinct from the first — proves the roster you see
  // depends on which subdomain you're on, not just who's logged in.
  await seedContractor("Highland Guard Services", "highland-guard", [
    { firstName: "M.", lastName: "Fraser", sector: "Door Supervisor", licenceExpiry: daysFromNow(300), vettingExpiry: daysFromNow(250) },
    { firstName: "S.", lastName: "Grant", sector: "Security Guard", licenceExpiry: daysFromNow(20), vettingExpiry: daysFromNow(200) },
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
