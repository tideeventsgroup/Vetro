import type { getDb } from "../db/client.js";

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 10);
  return out;
}

// A 6-digit PIN only needs to be unique within one contractor (routes/
// pinAccess.ts already knows the tenant, from its own URL, before it looks
// the PIN up) — see Officer's @@unique([contractorId, pin]).
export async function generateOfficerPin(
  db: Awaited<ReturnType<typeof getDb>>,
  contractorId: string
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pin = randomDigits(6);
    const existing = await db.officer.findFirst({ where: { contractorId, pin } });
    if (!existing) return pin;
  }
  throw new Error("Could not generate a unique PIN — try again");
}
