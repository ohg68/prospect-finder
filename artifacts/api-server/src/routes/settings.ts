import { Router } from "express";
import { db as dbInstance, sql as dSql } from "../../../../lib/db/src/index.js";
const db: any = dbInstance;
const sql: any = dSql;

const router = Router();

// --- AI CONFIGURATIONS ---

// GET /api/settings/ai - List all
router.get("/ai", async (req: any, res: any) => {
  console.log("[SETTINGS] GET /ai started");
  try {
    const result = await db.execute(sql`SELECT * FROM ai_configurations ORDER BY created_at ASC`);
    console.log(`[SETTINGS] Found ${result.rows.length} records`);
    const rows = result.rows.map((r: any) => ({
      id: r.id,
      provider: r.provider,
      apiKey: r.api_key,
      baseUrl: r.base_url,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
    res.json(rows);
  } catch (err) {
    console.error(`[SETTINGS] GET /ai error: ${err}`);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/settings/ai - Upsert
router.post("/ai", async (req: any, res: any) => {
  const { provider, apiKey, baseUrl, isActive, id } = req.body;
  console.log(`[SETTINGS] POST /ai: provider=${provider}, isActive=${isActive}, id=${id}`);
  try {
    if (isActive) {
      console.log("[SETTINGS] Deactivating all others");
      await db.execute(sql`UPDATE ai_configurations SET is_active = false`);
    }

    let targetId = id;
    if (!targetId && provider) {
      console.log(`[SETTINGS] Finding existing by provider: ${provider}`);
      const existingResult = await db.execute(sql`SELECT id FROM ai_configurations WHERE provider = ${provider} LIMIT 1`);
      if (existingResult.rows.length > 0) targetId = existingResult.rows[0].id;
    }

    if (targetId) {
      console.log(`[SETTINGS] Updating record ${targetId}`);
      const result = await db.execute(sql`
        UPDATE ai_configurations 
        SET provider = ${provider}, api_key = ${apiKey}, base_url = ${baseUrl}, is_active = ${isActive}, updated_at = NOW() 
        WHERE id = ${targetId}
        RETURNING *
      `);
      const row = result.rows[0];
      res.json(row ? {
        id: row.id,
        provider: row.provider,
        apiKey: row.api_key,
        baseUrl: row.base_url,
        isActive: row.is_active
      } : null);
    } else {
      console.log("[SETTINGS] Inserting new record");
      const result = await db.execute(sql`
        INSERT INTO ai_configurations (provider, api_key, base_url, is_active)
        VALUES (${provider}, ${apiKey}, ${baseUrl}, ${isActive})
        RETURNING *
      `);
      const row = result.rows[0];
      res.json(row ? {
        id: row.id,
        provider: row.provider,
        apiKey: row.api_key,
        baseUrl: row.base_url,
        isActive: row.is_active
      } : null);
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- WHATSAPP CONFIGURATIONS ---

// GET /api/settings/whatsapp - List all
router.get("/whatsapp", async (req: any, res: any) => {
  try {
    const result = await db.execute(sql`SELECT * FROM whatsapp_configurations ORDER BY created_at ASC`);
    const rows = result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      apiToken: r.api_token,
      phoneNumberId: r.phone_number_id,
      verifyToken: r.verify_token,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/settings/whatsapp - Upsert
router.post("/whatsapp", async (req: any, res: any) => {
  const { name, apiToken, phoneNumberId, verifyToken, isActive, id } = req.body;
  try {
    if (isActive) {
      await db.execute(sql`UPDATE whatsapp_configurations SET is_active = false`);
    }

    if (id) {
      const result = await db.execute(sql`
        UPDATE whatsapp_configurations 
        SET name = ${name}, api_token = ${apiToken}, phone_number_id = ${phoneNumberId}, verify_token = ${verifyToken}, is_active = ${isActive}, updated_at = NOW() 
        WHERE id = ${id}
        RETURNING *
      `);
      const row = result.rows[0];
      res.json(row ? {
        id: row.id,
        name: row.name,
        apiToken: row.api_token,
        phoneNumberId: row.phone_number_id,
        verifyToken: row.verify_token,
        isActive: row.is_active
      } : null);
    } else {
      const result = await db.execute(sql`
        INSERT INTO whatsapp_configurations (name, api_token, phone_number_id, verify_token, is_active)
        VALUES (${name}, ${apiToken}, ${phoneNumberId}, ${verifyToken}, ${isActive})
        RETURNING *
      `);
      const row = result.rows[0];
      res.json(row ? {
        id: row.id,
        name: row.name,
        apiToken: row.api_token,
        phoneNumberId: row.phone_number_id,
        verifyToken: row.verify_token,
        isActive: row.is_active
      } : null);
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
