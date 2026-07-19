import type { getDb } from "../db/client.js";

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 10);
  return out;
}

// Excludes visually-ambiguous characters (0/O, 1/I) since this gets read off
// a screen or printed badge and typed back in on a shared kiosk device.
const SIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSin(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += SIN_ALPHABET[Math.floor(Math.random() * SIN_ALPHABET.length)];
  return out;
}

// A 4-digit PIN only needs to be unique within one contractor (routes/
// kiosk.ts already knows the tenant, from the Site.sin it was entered
// against, before it looks the PIN up) — see Officer's @@unique([contractorId, pin]).
export async function generateOfficerPin(
  db: Awaited<ReturnType<typeof getDb>>,
  contractorId: string
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pin = randomDigits(4);
    const existing = await db.officer.findFirst({ where: { contractorId, pin } });
    if (!existing) return pin;
  }
  throw new Error("Could not generate a unique PIN — try again");
}

// SINs are looked up before any tenant is known (the kiosk uses it to
// resolve which tenant + site a book-on is for), so this has to be globally
// unique rather than scoped to a contractor — see Site.sin's bare @unique.
export async function generateSiteSin(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const sin = randomSin();
    const existing = await db.site.findUnique({ where: { sin } });
    if (!existing) return sin;
  }
  throw new Error("Could not generate a unique SIN — try again");
}
