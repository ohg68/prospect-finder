import { Router } from "express";
import { db as dbInstance, prospectsTable as pT, searchCacheTable as sCT, and as dAnd, ilike as dILike, eq as dEq, sql as dSql } from "../../../../lib/db/src/index.js";
import * as crypto from "crypto";
const db: any = dbInstance;
const prospectsTable: any = pT;
const searchCacheTable: any = sCT;
const and: any = dAnd;
const ilike: any = dILike;
const eq: any = dEq;
const sql: any = dSql;
import { AI_MODELS, AI_MODELS_BY_PROVIDER } from "../config/ai-config.js";
const router = Router();
import OpenAI from "openai";

async function getAIClientAndModel(): Promise<{ client: OpenAI; model: string }> {
    const result = await db.execute(sql`SELECT * FROM ai_configurations WHERE is_active = true LIMIT 1`);
    const dbConfig = result.rows[0];
    const provider = (dbConfig?.provider || "openai").toLowerCase();
    const baseUrl = dbConfig?.base_url || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
    const apiKey = dbConfig?.api_key || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";
    const model = AI_MODELS_BY_PROVIDER[provider] || AI_MODELS.GENERATE;
    const client = new OpenAI({ apiKey, baseURL: baseUrl });
    return { client, model };
}

interface GenerateParams {
    mode: "key_people" | "by_company" | "specific_person";
    company?: string;
    country?: string;
    city?: string;
    position?: string;
    department?: string;
    name?: string;
    count?: number;
}

interface GeneratedProspect {
    name: string;
    position: string;
    department?: string;
    company: string;
    country?: string;
    city?: string;
    seniority?: string;
    industry?: string;
    email?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
    notes?: string;
}

async function webSearch(query: string): Promise<string> {
    const hash = crypto.createHash("md5").update(query).digest("hex");
    try {
          const cached = await db.select().from(searchCacheTable).where(eq(searchCacheTable.key, hash)).limit(1);
          if (cached.length > 0) {
                  const entry = cached[0];
                  const isExpired = Date.now() - new Date(entry.createdAt).getTime() > 1000 * 60 * 60 * 48;
                  if (!isExpired) return entry.value as string;
          }
          const { client, model } = await getAIClientAndModel();
          const res = await client.chat.completions.create({
                  model,
                  max_tokens: 2000,
                  messages: [
                    { role: "system", content: "Eres un investigador B2B experto con amplio conocimiento sobre empresas, directivos y profesionales del mundo empresarial. Proporciona informacion concreta y detallada basada en tu conocimiento." },
                    { role: "user", content: query },
                          ],
          });
          const text = res.choices[0]?.message?.content ?? "";
          if (text.trim()) {
                  await db.insert(searchCacheTable).values({ key: hash, value: text, engine: "chat_completions" })
                    .onConflictDoUpdate({ target: searchCacheTable.key, set: { value: text, createdAt: new Date() } });
                  return text;
          }
          return "";
    } catch (err) {
          console.error("webSearch error:", err);
          return "";
    }
}

async function deepSearchEmployees(company: string, country?: string, position?: string, department?: string, count = 10): Promise<GeneratedProspect[]> {
    const loc = country ? ` ${country}` : "";
    const posHint = position ? ` "${position}"` : "";
    const deptHint = department ? ` ${department}` : "";
    const [peopleText, teamText] = await Promise.all([
          webSearch(`Lista las personas clave que trabajan o han trabajado en "${company}"${loc}. Incluye CEO, CTO, CFO, directores, VPs, managers y fundadores. Para cada persona: nombre completo, cargo, departamento, URL LinkedIn si la conoces. Enumera al menos ${Math.ceil(count * 0.6)} personas reales.`),
          webSearch(`Equipo directivo y empleados destacados de "${company}"${loc}${posHint}${deptHint}. Busca en web oficial, Crunchbase, LinkedIn, noticias y directorios empresariales. Lista nombres, cargos, departamentos y URLs LinkedIn.`),
        ]);
    const combinedContext = [
          peopleText && `=== PERSONAS Y DIRECTIVOS ===\n${peopleText}`,
          teamText && `=== EQUIPO Y DIRECTORIOS ===\n${teamText}`,
        ].filter(Boolean).join("\n\n");
    if (!combinedContext.trim()) return [];
    const { client, model } = await getAIClientAndModel();
    const prompt = `Eres un analista B2B. Extrae personas reales de "${company}"${loc} de esta informacion:\n\n${combinedContext.substring(0, 6000)}\n\nInstrucciones: extrae solo personas reales mencionadas, elimina duplicados, copia URLs exactas de LinkedIn si aparecen, prioriza cargos directivos, devuelve hasta ${count} personas.\n\nResponde SOLO con JSON valido:\n{"prospects":[{"name":"Nombre Apellido","position":"Cargo","department":"Depto","company":"${company}","country":"${country ?? ""}","city":"","seniority":"C-Level","industry":"Sector","email":null,"linkedinUrl":null,"twitterUrl":null}]}`;
    try {
          const aiRes = await client.chat.completions.create({ model, max_tokens: 3000, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
          const content = aiRes.choices[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(content) as { prospects?: GeneratedProspect[] };
          if (Array.isArray(parsed.prospects) && parsed.prospects.length > 0) return parsed.prospects;
    } catch (err) { console.error("deepSearch error:", err); }
    return [];
}

async function generateFictionalProspects(mode: string, company?: string, country?: string, city?: string, position?: string, department?: string, name?: string, count = 12): Promise<GeneratedProspect[]> {
    const criteria: string[] = [];
    if (mode === "key_people") {
          if (company) criteria.push(`Empresa: "${company}"`);
          if (country) criteria.push(`Pais: "${country}"`);
          if (city) criteria.push(`Ciudad: "${city}"`);
          if (position) criteria.push(`Cargo similar a: "${position}"`);
    } else if (mode === "by_company") {
          if (company) criteria.push(`Empresa: "${company}"`);
          if (department) criteria.push(`Departamento: "${department}"`);
          if (position) criteria.push(`Cargo: "${position}"`);
    } else if (mode === "specific_person") {
          if (name) criteria.push(`Nombre similar a: "${name}"`);
          if (company) criteria.push(`Empresa: "${company}"`);
    }
    if (criteria.length === 0) criteria.push("Directivos y managers de empresas de Espana y Latinoamerica");
    const prompt = `Genera ${count} perfiles B2B REALISTAS para prospectos con estos criterios:\n${criteria.join("\n")}\n\nCaracteristicas: nombres coherentes con el pais, cargos relevantes B2B (C-Level, Director, VP, Manager, Head of), empresas reales del sector.\n\nResponde SOLO con JSON valido:\n{"prospects":[{"name":"Nombre Completo","position":"Cargo","department":"Depto","company":"${company ?? "Empresa SA"}","country":"${country ?? "Espana"}","city":"${city ?? ""}","seniority":"Manager","industry":"Tecnologia","email":null,"linkedinUrl":null}]}`;
    const { client, model } = await getAIClientAndModel();
    const aiRes = await client.chat.completions.create({ model, max_tokens: 2000, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
    const raw = aiRes.choices[0]?.message?.content ?? "{}";
    try {
          const parsed = JSON.parse(raw) as { prospects?: GeneratedProspect[] };
          return Array.isArray(parsed.prospects) ? parsed.prospects : [];
    } catch { return []; }
}

router.post("/prospects/generate", async (req: any, res: any) => {
    const { mode = "key_people", company, country, city, position, department, name, count = 12 } = req.body as GenerateParams;
    try {
          let list: GeneratedProspect[] = [];
          if (company && company.trim().length >= 2) {
                  list = await deepSearchEmployees(company.trim(), country, position, department, count).catch(() => []);
          }
          if (list.length < 3) {
                  const fallback = await generateFictionalProspects(mode, company, country, city, position, department, name, count).catch(() => []);
                  list = list.length === 0 ? fallback : [...list, ...fallback.slice(0, count - list.length)];
          }
          if (list.length === 0) { res.json({ prospects: [], generated: 0 }); return; }
          const inserted: typeof prospectsTable.$inferSelect[] = [];
          for (const p of list) {
                  if (!p.name || !p.company) continue;
                  const existing = await db.select({ id: prospectsTable.id }).from(prospectsTable)
                    .where(and(ilike(prospectsTable.name as any, p.name.trim() as any) as any, ilike(prospectsTable.company as any, `%${p.company.trim().split(" ")[0]}%` as any) as any) as any).limit(1);
                  if (existing.length > 0) continue;
                  const validSeniorities = ["C-Level", "Director", "VP", "Manager", "Head", "Senior"] as const;
                  const seniority = validSeniorities.includes(p.seniority as never) ? (p.seniority as typeof validSeniorities[number]) : "Manager";
                  try {
                            const [row] = await db.insert(prospectsTable).values({
                                        name: p.name.trim(), position: p.position?.trim() ?? null, department: p.department?.trim() ?? null,
                                        company: p.company.trim(), country: p.country?.trim() || country || null, city: p.city?.trim() ?? null,
                                        email: p.email?.trim() || null, linkedinUrl: p.linkedinUrl?.trim() || null, seniority,
                                        industry: p.industry?.trim() ?? null, notes: p.twitterUrl ? `Twitter: ${p.twitterUrl}` : null,
                            }).returning();
                            if (row) inserted.push(row);
                  } catch { /* skip */ }
          }
          res.json({ prospects: inserted.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })), generated: inserted.length });
    } catch (error) {
          console.error("Generate prospects error:", error);
          res.status(500).json({ error: "Error generating prospects: " + String(error) });
    }
});

export default router;
