import { Router } from "express";
import { db as dbInstance, prospectsTable as pT, prospectEnrichmentsTable as pET, searchCacheTable as sCT, eq as dEq, and as dAnd, sql as dSql, desc as dDesc, count as dCount } from "@workspace/db";
import crypto from "crypto";

const db: any = dbInstance;
const prospectsTable: any = pT;
const prospectEnrichmentsTable: any = pET;
const searchCacheTable: any = sCT;
const eq: any = dEq;
const and: any = dAnd;
const sql: any = dSql;
const desc: any = dDesc;
const count: any = dCount;

import { AI_MODELS } from "../config/ai-config.js";

const router = Router();

// Helper: get active AI config from DB (with env var fallback)
async function getAIConfig(): Promise<{ baseUrl: string; apiKey: string; model: string }> {
    try {
          const result = await db.execute(sql`SELECT api_key, base_url FROM ai_configurations WHERE is_active = true LIMIT 1`);
          const row = result.rows?.[0];
          if (row?.api_key) {
                  return {
                            apiKey: row.api_key,
                            baseUrl: row.base_url || "https://api.openai.com/v1",
                            model: AI_MODELS.WEB_SEARCH,
                  };
          }
    } catch (e) {
          console.error("Error reading AI config from DB:", e);
    }
    return {
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "",
          baseUrl: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
          model: AI_MODELS.WEB_SEARCH,
    };
}

interface ResponseOutput {
    type: string;
    content?: Array<{ type: string; text?: string; annotations?: unknown[] }>;
    action?: { type: string; queries?: string[] };
}

function buildSearchLinks(name: string, company: string, position?: string | null): Array<{ platform: string; label: string; url: string; color: string }> {
    const q = encodeURIComponent(`"${name}" "${company}"`);
    const qNews = encodeURIComponent(`${name} ${company}`);
    const qLi = encodeURIComponent(`${name} ${company}${position ? " " + position : ""}`);
    return [
      { platform: "LinkedIn", label: "Search on LinkedIn", url: `https://www.linkedin.com/search/results/people/?keywords=${qLi}`, color: "#0077b5" },
      { platform: "Twitter/X", label: "Search on Twitter/X", url: `https://twitter.com/search?q=${q}&f=user`, color: "#1da1f2" },
      { platform: "Google News", label: "Search on Google News", url: `https://news.google.com/search?q=${qNews}&hl=es`, color: "#4285f4" },
      { platform: "Google", label: "Search on Google", url: `https://www.google.com/search?q=${q}`, color: "#34a853" },
      { platform: "Bing News", label: "Search on Bing News", url: `https://www.bing.com/news/search?q=${qNews}`, color: "#008272" },
        ];
}

function extractLinkedInUrl(text: string): string | null {
    const match = text.match(/https?:\/\/(www\.|[a-z]{2}\.)?linkedin\.com\/in\/[^\s"',<>)]+/i);
    if (!match) return null;
    return match[0].replace(/[.,;:)]+$/, "");
}

function extractUrls(text: string): string[] {
    const matches = text.match(/https?:\/\/[^\s"',<>)]+/g) ?? [];
    return [...new Set(matches.map(u => u.replace(/[.,;:)]+$/, "")))];
}

type TriggerEvent = { type: string; title: string; description: string; date?: string; source?: string; impact: "high" | "medium" | "low" };

async function findTriggerEvents(name: string, company: string, country?: string | null): Promise<TriggerEvent[]> {
    const loc = country ? ` ${country}` : "";
    const prompt = `Busca senales de compra (trigger events) recientes para el contacto comercial con alguien de la empresa "${company}"${loc}. Busca noticias de los ultimos 6 meses sobre cambios de direccion, financiacion, fusiones, nuevos productos o cambios del sector. Si no hay noticias reales, responde con lista vacia. NO inventes eventos. Responde SOLO con JSON: {"events":[{"type":"funding|expansion|leadership_change|new_product|industry_change|personal_change","title":"Titulo","description":"1-2 frases","date":"mes ano","source":"fuente","impact":"high|medium|low"}]}`;
    const hash = crypto.createHash("md5").update(`triggers:${name}:${company}:${loc}`).digest("hex");
    try {
          const cached = await db.select().from(searchCacheTable).where(eq(searchCacheTable.key, hash)).limit(1);
          if (cached.length > 0) {
                  const entry = cached[0];
                  const isExpired = Date.now() - new Date(entry.createdAt).getTime() > 1000 * 60 * 60 * 24;
                  if (!isExpired) return entry.value as TriggerEvent[];
          }
          const config = await getAIConfig();
          const res = await fetch(`${config.baseUrl}/responses`, {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ model: config.model, tools: [{ type: "web_search_preview" }], input: prompt }),
                  signal: AbortSignal.timeout(40000),
          }) as any;
          if (!res.ok) return [];
          const data = await res.json() as { output?: ResponseOutput[] };
          let rawText = "";
          for (const o of (data.output ?? [])) {
                  if (o.type === "message") { rawText = o.content?.find(c => c.type === "output_text")?.text ?? ""; if (rawText.trim()) break; }
          }
          const jsonMatch = rawText.match(/\{[\s\S]+\}/);
          if (!jsonMatch) return [];
          const parsed = JSON.parse(jsonMatch[0]) as { events?: TriggerEvent[] };
          const events = Array.isArray(parsed.events) ? parsed.events.slice(0, 5) : [];
          if (events.length > 0) {
                  await db.insert(searchCacheTable).values({ key: hash, value: events, engine: "openai_triggers" })
                    .onConflictDoUpdate({ target: searchCacheTable.key, set: { value: events, createdAt: new Date() } });
          }
          return events;
    } catch { return []; }
}

function generateSalesApproach(position: string | null | undefined, department: string | null | undefined, seniority: string | null | undefined): string {
    const pos = (position ?? "").toLowerCase();
    const dept = (department ?? "").toLowerCase();
    if (seniority === "C-Level" || pos.includes("ceo") || pos.includes("founder") || pos.includes("fundador") || pos.includes("presidente") || pos.includes("president")) {
          return "Abordaje ejecutivo: conecta con la vision estrategica. Presenta el impacto en crecimiento, ventaja competitiva y ROI. Solicita una reunion de 20 min. Evita detalles tecnicos en el primer contacto.";
    }
    if (pos.includes("cto") || pos.includes("cio") || dept.includes("tecnolog") || dept.includes("it")) {
          return "Abordaje tecnico-estrategico: destaca capacidades de integracion, seguridad y escalabilidad. Ofrece una demo tecnica. Comparte casos de uso relevantes del sector.";
    }
    if (pos.includes("cfo") || pos.includes("director financiero") || dept.includes("finanz")) {
          return "Abordaje financiero: cuantifica el ahorro de costes y el ROI con datos concretos. Presenta el TCO y el periodo de amortizacion.";
    }
    if (pos.includes("venta") || pos.includes("sales") || pos.includes("comercial")) {
          return "Abordaje orientado a resultados: muestra el impacto en pipeline, conversion y cuota. Usa lenguaje de negocio: mas leads, mayor ticket, menos tiempo administrativo.";
    }
    if (pos.includes("marketing") || pos.includes("cmo")) {
          return "Abordaje de demanda y marca: centra el mensaje en generacion de leads y mejora de conversion. Presenta metricas de impacto (CAC, LTV, engagement).";
    }
    return "Abordaje consultivo: comienza con preguntas de diagnostico. Adapta la propuesta de valor a su area y nivel de influencia en la decision de compra.";
}

async function enrichWithWebSearch(prospect: {
    name: string; company: string; position?: string | null; department?: string | null;
    country?: string | null; city?: string | null; email?: string | null; linkedinUrl?: string | null; seniority?: string | null;
}): Promise<{
    email?: string; alternativeEmails: string[]; phone?: string; companyPhone?: string; linkedinUrl?: string;
    socialProfiles: Array<{ platform: string; url: string; username?: string }>;
    pressItems: Array<{ title: string; url: string; source?: string; date?: string; snippet?: string }>;
    summary: string; salesApproach: string; confidence: "high" | "medium" | "low"; sources: string[];
}> {
    const companySlug = prospect.company.toLowerCase().replace(/\s+(s\.a\.b?\.|s\.a\.|s\.l\.|ltda\.?|inc\.?|corp\.?|group|grupo|banco)\s*/gi, "").replace(/[^a-z0-9]+/g, "").substring(0, 20);
    const nameParts = prospect.name.split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const firstInitial = firstName.charAt(0).toLowerCase();
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const fName = norm(firstName); const lName = norm(lastName);
    const emailPatterns = [
          lName ? `${fName}.${lName}@${companySlug}.com` : null,
          lName ? `${firstInitial}.${lName}@${companySlug}.com` : null,
          `${fName}@${companySlug}.com`,
        ].filter((e): e is string => !!e && !e.startsWith(".") && !e.includes("..") && !e.includes(".@"));
    const fallbackSummary = `${prospect.name} ocupa el cargo de ${prospect.position ?? "ejecutivo"} en ${prospect.company}${prospect.country ? ", " + prospect.country : ""}. Su perfil profesional lo situa como un contacto clave para decisiones de negocio en su sector.`;
    const fallbackApproach = generateSalesApproach(prospect.position, prospect.department, prospect.seniority);
    const locationHint = prospect.country ? ` (${prospect.country})` : "";
    const prompt = `Investiga al profesional "${prospect.name}", ${prospect.position ?? "ejecutivo"} en ${prospect.company}${locationHint}. Busca: perfil de LinkedIn, Twitter/X, email de contacto, telefono directo o movil, telefono de la empresa, menciones en prensa reciente (2023-2025). Responde SOLO con este JSON: {"linkedinUrl":null,"email":null,"alternativeEmails":["${fName}.${lName}@${companySlug}.com","${firstInitial}.${lName}@${companySlug}.com","${fName}@${companySlug}.com"],"phone":null,"companyPhone":null,"socialProfiles":[],"pressItems":[],"summary":"","salesApproach":"","confidence":"low","sources":[]}`;
    const hash = crypto.createHash("md5").update(`enrich:${prospect.name}:${prospect.company}:${locationHint}`).digest("hex");
    let parsed: Record<string, unknown> = {};
    let rawText = "";
    try {
          const cached = await db.select().from(searchCacheTable).where(eq(searchCacheTable.key, hash)).limit(1);
          if (cached.length > 0) {
                  const entry = cached[0];
                  const isExpired = Date.now() - new Date(entry.createdAt).getTime() > 1000 * 60 * 60 * 48;
                  if (!isExpired) { parsed = entry.value as Record<string, unknown>; rawText = (parsed as any)._rawText ?? ""; }
          }
          if (!parsed || Object.keys(parsed).length === 0) {
                  const config = await getAIConfig();
                  const res = await fetch(`${config.baseUrl}/responses`, {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ model: config.model, tools: [{ type: "web_search_preview" }], input: prompt }),
                            signal: AbortSignal.timeout(50000),
                  }) as any;
                  if (res.ok) {
                            const data = await res.json() as { output?: ResponseOutput[] };
                            for (const o of (data.output ?? [])) {
                                        if (o.type === "message") { rawText = o.content?.find(c => c.type === "output_text")?.text ?? ""; if (rawText.trim()) break; }
                            }
                            const jsonMatch = rawText.match(/\{[\s\S]+\}/);
                            if (jsonMatch) {
                                        try {
                                                      parsed = JSON.parse(jsonMatch[0]);
                                                      await db.insert(searchCacheTable).values({ key: hash, value: { ...parsed, _rawText: rawText }, engine: "openai_enrich" })
                                                        .onConflictDoUpdate({ target: searchCacheTable.key, set: { value: { ...parsed, _rawText: rawText }, createdAt: new Date() } });
                                        } catch { /* ignore */ }
                            }
                  }
          }
    } catch { /* timeout or network error */ }

  let linkedinUrl = typeof parsed.linkedinUrl === "string" && parsed.linkedinUrl.includes("linkedin.com/in/") ? parsed.linkedinUrl : extractLinkedInUrl(rawText);
    if (!linkedinUrl && prospect.linkedinUrl) linkedinUrl = prospect.linkedinUrl;
    const aiSalesApproach = typeof parsed.salesApproach === "string" && parsed.salesApproach.trim().length > 20 ? parsed.salesApproach : null;
    return {
          email: typeof parsed.email === "string" ? parsed.email : undefined,
          alternativeEmails: Array.isArray(parsed.alternativeEmails) && (parsed.alternativeEmails as string[]).length > 0 ? parsed.alternativeEmails as string[] : emailPatterns,
          phone: typeof parsed.phone === "string" ? parsed.phone : undefined,
          companyPhone: typeof parsed.companyPhone === "string" ? parsed.companyPhone : undefined,
          linkedinUrl: linkedinUrl ?? undefined,
          socialProfiles: Array.isArray(parsed.socialProfiles) ? parsed.socialProfiles as Array<{ platform: string; url: string; username?: string }> : [],
          pressItems: Array.isArray(parsed.pressItems) ? parsed.pressItems as Array<{ title: string; url: string; source?: string; date?: string; snippet?: string }> : [],
          summary: typeof parsed.summary === "string" && parsed.summary.trim().length > 10 ? parsed.summary : fallbackSummary,
          salesApproach: aiSalesApproach ?? fallbackApproach,
          confidence: ["high", "medium", "low"].includes(parsed.confidence as string) ? parsed.confidence as "high" | "medium" | "low" : "low",
          sources: Array.isArray(parsed.sources) && (parsed.sources as string[]).length > 0 ? parsed.sources as string[] : extractUrls(rawText).slice(0, 5),
    };
}

router.post("/prospects/:id/enrich", async (req: any, res: any) => {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id));
    if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }
    try {
          const [enriched, triggerEvents] = await Promise.all([
                  enrichWithWebSearch({ name: prospect.name, company: prospect.company, position: prospect.position, department: prospect.department, seniority: prospect.seniority, country: prospect.country, city: prospect.city, email: prospect.email, linkedinUrl: prospect.linkedinUrl }),
                  findTriggerEvents(prospect.name, prospect.company, prospect.country),
                ]);
          const searchLinks = buildSearchLinks(prospect.name, prospect.company, prospect.position);
          const existing = await db.select().from(prospectEnrichmentsTable).where(eq(prospectEnrichmentsTable.prospectId, id));
          let saved;
          if (existing.length > 0) {
                  [saved] = await db.update(prospectEnrichmentsTable).set({
                            email: enriched.email ?? null, alternativeEmails: enriched.alternativeEmails,
                            phone: enriched.phone ?? null, companyPhone: enriched.companyPhone ?? null,
                            linkedinUrl: enriched.linkedinUrl ?? null, socialProfiles: enriched.socialProfiles,
                            pressItems: enriched.pressItems, summary: enriched.summary, salesApproach: enriched.salesApproach,
                            confidence: enriched.confidence, sources: enriched.sources,
                            triggerEvents: triggerEvents.length > 0 ? triggerEvents : (existing[0]?.triggerEvents ?? []),
                            enrichedAt: new Date(),
                  }).where(eq(prospectEnrichmentsTable.prospectId, id)).returning();
          } else {
                  [saved] = await db.insert(prospectEnrichmentsTable).values({
                            prospectId: id, email: enriched.email ?? null, alternativeEmails: enriched.alternativeEmails,
                            phone: enriched.phone ?? null, companyPhone: enriched.companyPhone ?? null,
                            linkedinUrl: enriched.linkedinUrl ?? null, socialProfiles: enriched.socialProfiles,
                            pressItems: enriched.pressItems, summary: enriched.summary, salesApproach: enriched.salesApproach,
                            confidence: enriched.confidence, sources: enriched.sources, triggerEvents: triggerEvents,
                  }).returning();
          }
          if (enriched.email && !prospect.email) await db.update(prospectsTable).set({ email: enriched.email }).where(eq(prospectsTable.id, id));
          if (enriched.linkedinUrl && !prospect.linkedinUrl) await db.update(prospectsTable).set({ linkedinUrl: enriched.linkedinUrl }).where(eq(prospectsTable.id, id));
          if (enriched.phone && !prospect.phone) await db.update(prospectsTable).set({ phone: enriched.phone }).where(eq(prospectsTable.id, id));
          res.json({
                  prospectId: id, email: saved.email ?? undefined, alternativeEmails: saved.alternativeEmails ?? [],
                  phone: saved.phone ?? undefined, companyPhone: saved.companyPhone ?? undefined,
                  linkedinUrl: saved.linkedinUrl ?? undefined, socialProfiles: saved.socialProfiles ?? [],
                  pressItems: saved.pressItems ?? [], summary: saved.summary ?? undefined,
                  salesApproach: saved.salesApproach ?? enriched.salesApproach, triggerEvents: saved.triggerEvents ?? [],
                  confidence: saved.confidence ?? undefined, enrichedAt: saved.enrichedAt.toISOString(),
                  sources: saved.sources ?? [], searchLinks,
          });
    } catch (error) {
          console.error("Enrichment error:", error);
          res.status(500).json({ error: "Error enriching prospect: " + String(error) });
    }
});

router.get("/prospects/:id/enrichment", async (req: any, res: any) => {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id));
    const [enrichment] = await db.select().from(prospectEnrichmentsTable).where(eq(prospectEnrichmentsTable.prospectId, id));
    if (!enrichment) { res.status(404).json({ error: "No enrichment data found" }); return; }
    const searchLinks = prospect ? buildSearchLinks(prospect.name, prospect.company, prospect.position) : [];
    res.json({
          prospectId: id, email: enrichment.email ?? undefined, alternativeEmails: enrichment.alternativeEmails ?? [],
          phone: enrichment.phone ?? undefined, companyPhone: enrichment.companyPhone ?? undefined,
          linkedinUrl: enrichment.linkedinUrl ?? undefined, socialProfiles: enrichment.socialProfiles ?? [],
          pressItems: enrichment.pressItems ?? [], summary: enrichment.summary ?? undefined,
          salesApproach: enrichment.salesApproach ?? undefined, triggerEvents: enrichment.triggerEvents ?? [],
          confidence: enrichment.confidence ?? undefined, enrichedAt: enrichment.enrichedAt.toISOString(),
          sources: enrichment.sources ?? [], searchLinks,
    });
});

export default router;
