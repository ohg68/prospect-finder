import { Router } from "express";
import { db, savedProspectsTable, prospectsTable, prospectEnrichmentsTable, eq, sql } from "@workspace/db";
import { snakeToCamel } from "../utils/db-utils.js";

const router = Router();

const PIPELINE_STAGES = ["new", "contacted", "replied", "meeting", "negotiating", "closed", "discarded"] as const;
type PipelineStage = typeof PIPELINE_STAGES[number];

// PATCH /saved/:id/pipeline — update pipeline stage and tracking data
router.patch("/saved/:id/pipeline", async (req: any, res: any) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const {
    pipelineStage,
    pipelineNotes,
    lastContactedAt,
    nextActionAt,
    cadenceStep,
  } = req.body as {
    pipelineStage?: string;
    pipelineNotes?: string;
    lastContactedAt?: string;
    nextActionAt?: string;
    cadenceStep?: number;
  };

  if (pipelineStage && !PIPELINE_STAGES.includes(pipelineStage as PipelineStage)) {
    res.status(400).json({ error: "Invalid stage" });
    return;
  }

  const updateData: Record<string, any> = {};
  if (pipelineStage !== undefined) updateData.pipeline_stage = pipelineStage;
  if (pipelineNotes !== undefined) updateData.pipeline_notes = pipelineNotes;
  if (lastContactedAt !== undefined) updateData.last_contacted_at = lastContactedAt ? new Date(lastContactedAt) : null;
  if (nextActionAt !== undefined) updateData.next_action_at = nextActionAt ? new Date(nextActionAt) : null;
  if (cadenceStep !== undefined) updateData.cadence_step = cadenceStep;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  try {
    const result = await db.execute(sql`
      UPDATE saved_prospects 
      SET ${sql.join(
        Object.entries(updateData).map(([col, val]) => sql`${sql.identifier(col)} = ${val}`),
        sql`, `
      )}
      WHERE id = ${id}
      RETURNING *
    `);
    const [updated] = result.rows as any[];

    if (!updated) { res.status(404).json({ error: "Saved prospect not found" }); return; }
    const mapped = snakeToCamel(updated);
    res.json({ 
      ...mapped, 
      lastContactedAt: mapped.lastContactedAt ? new Date(mapped.lastContactedAt).toISOString() : null, 
      nextActionAt: mapped.nextActionAt ? new Date(mapped.nextActionAt).toISOString() : null 
    });
  } catch (error) {
    res.status(500).json({ error: "Error updating pipeline: " + String(error) });
  }
});

// GET /saved/export — export all saved prospects as CSV
router.get("/saved/export", async (req: any, res: any) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        sp.id, sp.list_name, sp.notes as sp_notes, sp.pipeline_stage, sp.last_contacted_at,
        p.name as p_name, p.position as p_position, p.company as p_company, p.department as p_department, 
        p.country as p_country, p.city as p_city, p.email as p_email, p.phone as p_phone, 
        p.industry as p_industry, p.seniority as p_seniority, p.linkedin_url as p_linkedin_url, p.created_at as p_created_at,
        e.email as e_email, e.alternative_emails as e_alternative_emails, e.phone as e_phone, 
        e.company_phone as e_company_phone, e.linkedin_url as e_linkedin_url, e.sales_approach as e_sales_approach
      FROM saved_prospects sp
      LEFT JOIN prospects p ON sp.prospect_id = p.id
      LEFT JOIN prospect_enrichments e ON p.id = e.prospect_id
    `);
    const saved = result.rows as any[];

    const STAGE_LABELS: Record<string, string> = {
      new: "New",
      contacted: "Contacted",
      replied: "Replied",
      meeting: "Meeting",
      negotiating: "Negotiating",
      closed: "Closed",
      discarded: "Discarded",
    };

    const headers = [
      "Name", "Position", "Company", "Department", "Country", "City",
      "Email", "Alternative Email 1", "Alternative Email 2",
      "Phone", "Company Phone", "LinkedIn",
      "Industry", "Seniority", "List", "Pipeline Stage",
      "Last Contacted", "Next Action", "Cadence Step",
      "List Notes", "Pipeline Notes", "Sales Approach",
      "Date Saved",
    ];

    const escapeCSV = (val: unknown): string => {
      if (val == null) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = saved.map((row: any) => [
      row.p_name ?? "",
      row.p_position ?? "",
      row.p_company ?? "",
      row.p_department ?? "",
      row.p_country ?? "",
      row.p_city ?? "",
      row.e_email ?? row.p_email ?? "",
      (row.e_alternative_emails as string[] | null)?.[0] ?? "",
      (row.e_alternative_emails as string[] | null)?.[1] ?? "",
      row.e_phone ?? row.p_phone ?? "",
      row.e_company_phone ?? "",
      row.e_linkedin_url ?? row.p_linkedin_url ?? "",
      row.p_industry ?? "",
      row.p_seniority ?? "",
      row.list_name ?? "",
      STAGE_LABELS[row.pipeline_stage ?? "new"] ?? row.pipeline_stage ?? "Nuevo",
      row.last_contacted_at ? new Date(row.last_contacted_at).toISOString().split("T")[0] : "",
      row.next_action_at ? new Date(row.next_action_at).toISOString().split("T")[0] : "",
      String(row.cadence_step ?? 0),
      row.notes ?? "",
      row.pipeline_notes ?? "",
      row.e_sales_approach ?? "",
      new Date(row.saved_at).toISOString().split("T")[0],
    ].map(escapeCSV).join(","));

    const csv = [headers.join(","), ...rows].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="prospects_${new Date().toISOString().split("T")[0]}.csv"`);
    res.send("\uFEFF" + csv); // BOM for Excel UTF-8 compatibility
  } catch (error) {
    res.status(500).json({ error: "Error exporting: " + String(error) });
  }
});

export default router;
