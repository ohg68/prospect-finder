import { Router } from "express";
import { snakeToCamel, mapRawRow } from "../utils/db-utils.js";
import { db as dbInstance, prospectsTable as pT, savedProspectsTable as sPT, eq as dEq, ilike as dILike, and as dAnd, sql as dSql, count as dCount, desc as dDesc } from "@workspace/db";
const db: any = dbInstance;
const prospectsTable: any = pT;
const savedProspectsTable: any = sPT;
const eq: any = dEq;
const ilike: any = dILike;
const and: any = dAnd;
const sql: any = dSql;
const count: any = dCount;
const desc: any = dDesc;
import {
  SearchProspectsQueryParams,
  SaveProspectBody,
  GetProspectParams,
  DeleteSavedProspectParams,
} from "@workspace/api-zod";

const router = Router();

// Search prospects
router.get("/prospects/search", async (req: any, res: any) => {
  try {
    const query = SearchProspectsQueryParams.parse(req.query);
    const { mode, company, country, city, position, department, name, page = 1, pageSize = 20 } = query;

    const conditions: any[] = [];

    if (mode === "key_people") {
      if (company) conditions.push(ilike(prospectsTable.company as any, `%${company}%`) as any);
      if (country) conditions.push(ilike(prospectsTable.country as any, `%${country}%`) as any);
      if (city) conditions.push(ilike(prospectsTable.city as any, `%${city}%`) as any);
      if (position) conditions.push(ilike(prospectsTable.position as any, `%${position}%`) as any);
    } else if (mode === "by_company") {
      if (company) conditions.push(ilike(prospectsTable.company as any, `%${company}%`) as any);
      if (position) conditions.push(ilike(prospectsTable.position as any, `%${position}%`) as any);
      if (department) conditions.push(ilike(prospectsTable.department as any, `%${department}%`) as any);
    } else if (mode === "specific_person") {
      if (name) conditions.push(ilike(prospectsTable.name as any, `%${name}%`) as any);
      if (company) conditions.push(ilike(prospectsTable.company as any, `%${company}%`) as any);
    }

    let querySql = dSql`SELECT * FROM prospects`;
    let countSql = dSql`SELECT count(*) as total FROM prospects`;
    
    if (conditions.length > 0) {
      const sqlConditions: any[] = [];
      if (mode === "key_people") {
        if (company) sqlConditions.push(dSql`company ILIKE ${`%${company}%`}`);
        if (country) sqlConditions.push(dSql`country ILIKE ${`%${country}%`}`);
        if (city) sqlConditions.push(dSql`city ILIKE ${`%${city}%`}`);
        if (position) sqlConditions.push(dSql`position ILIKE ${`%${position}%`}`);
      } else if (mode === "by_company") {
        if (company) sqlConditions.push(dSql`company ILIKE ${`%${company}%`}`);
        if (position) sqlConditions.push(dSql`position ILIKE ${`%${position}%`}`);
        if (department) sqlConditions.push(dSql`department ILIKE ${`%${department}%`}`);
      } else if (mode === "specific_person") {
        if (name) sqlConditions.push(dSql`name ILIKE ${`%${name}%`}`);
        if (company) sqlConditions.push(dSql`company ILIKE ${`%${company}%`}`);
      }

      if (sqlConditions.length > 0) {
        const whereClause = dSql` WHERE ${dSql.join(sqlConditions, dSql` AND `)}`;
        querySql = dSql`${querySql} ${whereClause}`;
        countSql = dSql`${countSql} ${whereClause}`;
      }
    }

    const orderSql = dSql` ORDER BY name ASC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    const fullQuerySql = dSql`${querySql} ${orderSql}`;

    const [countResult, prospectsResult]: any = await Promise.all([
      db.execute(countSql),
      db.execute(fullQuerySql)
    ]);

    const total = parseInt(countResult.rows[0]?.total || "0", 10);
    const prospects = prospectsResult.rows || [];
    const totalPages = Math.ceil(total / pageSize);

    res.json({
      prospects: snakeToCamel(prospects),
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Get prospect by id
router.get("/prospects/:id", async (req: any, res: any) => {
  try {
    const { id } = GetProspectParams.parse({ id: Number(req.params.id) });
    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id as any) as any);
    if (!prospect) {
      res.status(404).json({ error: "Prospect not found" });
      return;
    }
    res.json({ ...prospect, createdAt: prospect.createdAt.toISOString() });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Update prospect
router.patch("/prospects/:id", async (req: any, res: any) => {
  try {
    const { id } = GetProspectParams.parse({ id: Number(req.params.id) });
    const { phone } = req.body;
    const [updated] = await db
      .update(prospectsTable)
      .set({ phone: phone ?? null })
      .where(eq(prospectsTable.id as any, id as any) as any)
      .returning();
    
    if (!updated) {
      res.status(404).json({ error: "Prospect not found" });
      return;
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Get saved prospects
router.get("/saved-prospects", async (req: any, res: any) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        sp.id, sp.list_name, sp.notes, sp.pipeline_stage, sp.last_contacted_at, sp.next_action_at, 
        sp.pipeline_notes, sp.cadence_step, sp.saved_at, sp.prospect_id,
        p.name as p_name, p.company as p_company, p.position as p_position, p.created_at as p_created_at
      FROM saved_prospects sp
      INNER JOIN prospects p ON sp.prospect_id = p.id
      ORDER BY sp.saved_at DESC
    `);
    const saved = result.rows as any[];

    res.json(saved.map((s: any) => mapRawRow(s, { p: "prospect" })));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Save a prospect
router.post("/saved-prospects", async (req: any, res: any) => {
  try {
    const body = SaveProspectBody.parse(req.body);
    const [saved] = await db
      .insert(savedProspectsTable)
      .values({
        prospectId: body.prospectId,
        listName: body.listName ?? "default",
        notes: body.notes ?? null,
      })
      .returning();

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id as any, saved.prospectId as any) as any);

    res.status(201).json({
      ...saved,
      savedAt: saved.savedAt.toISOString(),
      prospect: { ...prospect, createdAt: prospect.createdAt.toISOString() },
    });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Delete saved prospect
router.delete("/saved-prospects/:id", async (req: any, res: any) => {
  try {
    const { id } = DeleteSavedProspectParams.parse({ id: Number(req.params.id) });
    await db.delete(savedProspectsTable).where(eq(savedProspectsTable.id as any, id as any) as any);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Get stats
router.get("/stats", async (req: any, res: any) => {
  try {
    const [
      totalProspectsResult,
      totalCompaniesResult,
      totalCountriesResult,
      topCountriesResult,
      topIndustriesResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(prospectsTable),
      db.select({ count: sql<number>`count(distinct ${prospectsTable.company as any})` }).from(prospectsTable),
      db.select({ count: sql<number>`count(distinct ${prospectsTable.country as any})` }).from(prospectsTable),
      db
        .select({ country: prospectsTable.country, count: count() })
        .from(prospectsTable)
        .where(sql`${prospectsTable.country as any} is not null`)
        .groupBy(prospectsTable.country)
        .orderBy(desc(count()))
        .limit(5),
      db
        .select({ industry: prospectsTable.industry, count: count() })
        .from(prospectsTable)
        .where(sql`${prospectsTable.industry as any} is not null`)
        .groupBy(prospectsTable.industry)
        .orderBy(desc(count()))
        .limit(5),
    ]);

    res.json({
      totalProspects: totalProspectsResult[0]?.count ?? 0,
      totalCompanies: totalCompaniesResult[0]?.count ?? 0,
      totalCountries: totalCountriesResult[0]?.count ?? 0,
      topCountries: topCountriesResult.map((r: any) => ({ country: r.country ?? "", count: r.count })),
      topIndustries: topIndustriesResult.map((r: any) => ({ industry: r.industry ?? "", count: r.count })),
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
