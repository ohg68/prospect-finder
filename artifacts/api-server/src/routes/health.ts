import { Router } from "express";
import * as apiZod from "@workspace/api-zod";
import { db as dbInstance, sql } from "../../../../lib/db/src/index.js";
const db: any = dbInstance;

const router = Router();

router.get("/healthz", (_req: any, res: any) => {
  const data = apiZod.HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health-db", async (_req: any, res: any) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok", message: "Database connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: String(err) });
  }
});

export default router;
