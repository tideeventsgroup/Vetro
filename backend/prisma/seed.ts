import { PrismaClient } from "@prisma/client";
import { deriveStatus } from "../src/lib/status.js";

const db = new PrismaClient();

async function main() {
  const contractor = await db.contractor.create({
    data: { name: "Clyde Coast Security Ltd" },
  });

  const officers = [
    {
      firstName: "A.",
      lastName: "Mackenzie",
      sector: "Door Supervisor",
      licenceExpiry: daysFromNow(600),
      vettingExpiry: daysFromNow(500),
    },
    {
      firstName: "J.",
      lastName: "Smith",
      sector: "Door Supervisor",
      licenceExpiry: daysFromNow(14),
      vettingExpiry: daysFromNow(400),
    },
    {
      firstName: "R.",
      lastName: "Campbell",
      sector: "Security Guard",
      licenceExpiry: daysFromNow(-15),
      vettingExpiry: daysFromNow(300),
    },
    {
      firstName: "F.",
      lastName: "Adeyemi",
      sector: "CCTV Operator",
      licenceExpiry: daysFromNow(120),
      vettingExpiry: daysFromNow(90),
    },
  ];

  for (const [index, o] of officers.entries()) {
    const officer = await db.officer.create({
      data: {
        contractorId: contractor.id,
        firstName: o.firstName,
        lastName: o.lastName,
      },
    });

    await db.siaLicence.create({
      data: {
        officerId: officer.id,
        licenceNumber: `SIA-${1000 + index}`,
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

  console.log(`Seeded ${officers.length} officers for ${contractor.name}.`);
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
