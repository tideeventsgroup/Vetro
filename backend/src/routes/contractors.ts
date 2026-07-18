import { Hono } from "hono";
import { getDb } from "../db/client.js";
import type { AppEnv } from "../lib/hono-env.js";

export const contractors = new Hono<AppEnv>();

contractors.get("/", async (c) => {
  const db = await getDb();
  const rows = await db.contractor.findMany({ orderBy: { name: "asc" } });
  return c.json(rows);
});

contractors.post("/", async (c) => {
  const db = await getDb();
  const body = await c.req.json<{ name: string }>();
  const created = await db.contractor.create({ data: { name: body.name } });
  return c.json(created, 201);
});
