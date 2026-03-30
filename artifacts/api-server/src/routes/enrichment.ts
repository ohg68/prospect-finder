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
import { getAIClient, getModel } from "../config/ai-config.js";

const router = Router();


function buildSearchLinks(name: string, company: string, position?: string | null): Array<{ platform: string; label: string; url: string; color: string }> {
  const q = encodeURIComponent(`"${name}" "${company}"`);
  const qNews = encodeURIComponent(`${name} ${company}`);
  const qLi = encodeURIComponent(`${name} ${company}${position ? " " + position : ""}`);

  return [
    {
      platform: "LinkedIn",
      label: "Search on LinkedIn",
      url: `https://www.linkedin.com/search/results/people/?keywords=${qLi}`,
      color: "#0077b5",
    },
    {
      platform: "Twitter/X",
      label: "Search on Twitter/X",
      url: `https://twitter.com/search?q=${q}&f=user`,
      color: "#1da1f2",
    },
    {
      platform: "Google News",
      label: "Search on Google News",
      url: `https://news.google.com/search?q=${qNews}&hl=es`,
      color: "#4285f4",
    },
    {
      platform: "Google",
      label: "Search on Google",
      url: `https://www.google.com/search?q=${q}`,
      color: "#34a853",
    },
    {
      platform: "Bing News",
      label: "Search on Bing News",
      url: `https://www.bing.com/news/search?q=${qNews}`,
      color: "#008272",
    },
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
  const prompt = `Busca señales de compra (trigger events) recientes para el contacto comercial con alguien de la empresa "${company}"${loc}.

Busca noticias de los últimos 6 meses sobre:
1. Cambios de dirección o nuevos ejecutivos en ${company}
2. Rondas de financiación, fusiones, adquisiciones o expansión de ${company}
3. Nuevos productos, servicios o mercados de ${company}
4. Problemas, desafíos o cambios del sector que afecten a ${company}
5. "${name}" — cambio de trabajo, nuevas responsabilidades o apariciones públicas recientes

Si no hay noticias reales específicas, responde con lista vacía. NO inventes eventos.

Responde SOLO con JSON (sin markdown):
{"events":[{"type":"funding|expansion|leadership_change|new_product|industry_change|personal_change","title":"Título del evento","description":"1-2 frases explicando por qué es relevante para contactarles ahora","date":"mes año si se conoce","source":"fuente si se conoce","impact":"high|medium|low"}]}`;

  const hash = crypto.createHash("md5").update(`triggers:${name}:${company}:${loc}`).digest("hex");

  try {
    // Check cache (24h TTL for triggers)
    const cached = await db
      .select()
      .from(searchCacheTable)
      .where(eq(searchCacheTable.key, hash))
      .limit(1);

    if (cached.length > 0) {
      const entry = cached[0];
      const isExpired = Date.now() - new Date(entry.createdAt).getTime() > 1000 * 60 * 60 * 24;
      if (!isExpired) {
        return entry.value as TriggerEvent[];
      }
    }

    const client = await getAIClient();
    const model = await getModel();

    const aiRes = await client.chat.completions.create({
      model,
      max_completion_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = aiRes.choices[0]?.message?.content ?? "";
    const jsonMatch = rawText.match(/\{[\s\S]+\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as { events?: TriggerEvent[] };
    const events = Array.isArray(parsed.events) ? parsed.events.slice(0, 5) : [];

    if (events.length > 0) {
      await db.insert(searchCacheTable).values({
        key: hash,
        value: events,
        engine: "ai_triggers",
      }).onConflictDoUpdate({
        target: searchCacheTable.key,
        set: { value: events, createdAt: new Date() }
      });
    }

    return events;
  } catch { return []; }
}

function generateSalesApproach(position: string | null | undefined, department: string | null | undefined, seniority: string | null | undefined): string {
  const pos = (position ?? "").toLowerCase();
  const dept = (department ?? "").toLowerCase();

  if (seniority === "C-Level" || pos.includes("ceo") || pos.includes("founder") || pos.includes("fundador") || pos.includes("presidente") || pos.includes("president")) {
    return "Abordaje ejecutivo: conecta con la visión estratégica de la empresa. Presenta el impacto en crecimiento, ventaja competitiva y ROI a largo plazo. Solicita una reunión de 20 min para explorar sinergias. Evita detalles técnicos en el primer contacto.";
  }
  if (pos.includes("cto") || pos.includes("cio") || pos.includes("chief technology") || pos.includes("chief information") || dept.includes("tecnolog") || dept.includes("it ") || dept === "it" || pos.includes("technology director") || pos.includes("director de tecnolog")) {
    return "Abordaje técnico-estratégico: destaca capacidades de integración, seguridad y escalabilidad. Ofrece una demo técnica o prueba de concepto. Comparte casos de uso relevantes del sector y métricas de rendimiento. Enfoca la reducción de deuda técnica y la eficiencia operativa.";
  }
  if (pos.includes("cfo") || pos.includes("chief financial") || pos.includes("director financiero") || pos.includes("finance director") || dept.includes("finanz")) {
    return "Abordaje financiero: cuantifica el ahorro de costes y el retorno de inversión con datos concretos. Presenta el TCO (coste total de propiedad) y el período de amortización. Ofrece análisis comparativo y referencias de empresas similares. La eficiencia presupuestaria es la clave.";
  }
  if (pos.includes("venta") || pos.includes("sales") || pos.includes("comercial") || dept.includes("venta") || dept.includes("comercial")) {
    return "Abordaje orientado a resultados: enfoca el impacto directo en el pipeline, conversión y cuota de ventas. Muestra cómo tu solución acelera el ciclo de venta o mejora la productividad del equipo. Usa lenguaje de negocio: más leads, mayor ticket medio, menos tiempo en tareas administrativas.";
  }
  if (pos.includes("marketing") || dept.includes("marketing") || pos.includes("cmo") || pos.includes("chief marketing")) {
    return "Abordaje de demanda y marca: centra el mensaje en generación de leads, visibilidad de marca y mejora de conversión. Presenta datos de impacto en métricas de marketing (CAC, LTV, engagement). Ofrece casos de éxito del sector y cómo tu solución complementa su stack actual.";
  }
  if (pos.includes("hr") || pos.includes("rrhh") || pos.includes("recursos humanos") || pos.includes("people") || pos.includes("talent") || dept.includes("rrhh") || dept.includes("personas")) {
    return "Abordaje de talento y cultura: enfoca la mejora de la experiencia del empleado, retención y employer branding. Presenta el impacto en productividad y bienestar del equipo. Comparte métricas de engagement y reducción de rotación de personal. El lenguaje clave: cultura, talento y eficiencia.";
  }
  if (pos.includes("operaciones") || pos.includes("operations") || pos.includes("coo") || pos.includes("chief operating")) {
    return "Abordaje operacional: presenta eficiencia de procesos, automatización y reducción de fricción operativa. Cuantifica el ahorro de tiempo y recursos. Enfoca la escalabilidad de operaciones sin aumento proporcional de costes. Propón un piloto con métricas claras de éxito.";
  }
  if (pos.includes("director") || pos.includes("vp ") || pos.includes("vice president") || seniority === "Director" || seniority === "VP") {
    return "Abordaje de valor: presenta casos de éxito comparables y el impacto medible en su área de responsabilidad. Adapta el mensaje a sus KPIs y objetivos del área. Solicita una reunión de diagnóstico para entender sus retos actuales antes de presentar la propuesta.";
  }
  if (pos.includes("manager") || pos.includes("head of") || pos.includes("responsable") || seniority === "Manager" || seniority === "Head") {
    return "Abordaje práctico: muestra cómo tu solución resuelve problemas concretos del día a día de su equipo. Destaca facilidad de implementación, soporte y formación. Ofrece una demo específica para su caso de uso. El enfoque debe ser en ahorro de tiempo y simplificación de tareas.";
  }
  return "Abordaje consultivo: comienza con preguntas de diagnóstico para entender sus retos. Adapta la propuesta de valor a su área y nivel de influencia en la decisión de compra. Identifica si es decisor, influenciador o usuario final y personaliza el mensaje en consecuencia.";
}

async function enrichWithWebSearch(prospect: {
  name: string;
  company: string;
  position?: string | null;
  department?: string | null;
  country?: string | null;
  city?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  seniority?: string | null;
}): Promise<{
  email?: string;
  alternativeEmails: string[];
  phone?: string;
  companyPhone?: string;
  linkedinUrl?: string;
  socialProfiles: Array<{ platform: string; url: string; username?: string }>;
  pressItems: Array<{ title: string; url: string; source?: string; date?: string; snippet?: string }>;
  summary: string;
  salesApproach: string;
  confidence: "high" | "medium" | "low";
  sources: string[];
}> {
  // Compute email patterns (always available as fallback)
  const companySlug = prospect.company
    .toLowerCase()
    .replace(/\s+(s\.a\.b?\.|s\.a\.|s\.l\.|s\.l\.u\.|ltda\.?|inc\.?|corp\.?|group|grupo|banco|financiero)\s*/gi, "")
    .replace(/[^a-z0-9]+/g, "")
    .substring(0, 20);

  const nameParts = prospect.name.split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
  const firstInitial = firstName.charAt(0).toLowerCase();
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const fName = norm(firstName);
  const lName = norm(lastName);
  const emailPatterns = [
    lName ? `${fName}.${lName}@${companySlug}.com` : null,
    lName ? `${firstInitial}.${lName}@${companySlug}.com` : null,
    `${fName}@${companySlug}.com`,
  ].filter((e): e is string => !!e && !e.startsWith(".") && !e.includes("..") && !e.includes(".@"));

  const fallbackSummary = `${prospect.name} ocupa el cargo de ${prospect.position ?? "ejecutivo"} en ${prospect.company}${prospect.country ? ", " + prospect.country : ""}. Su perfil profesional lo sitúa como un contacto clave para decisiones de negocio en su sector.`;

  const fallbackApproach = generateSalesApproach(prospect.position, prospect.department, prospect.seniority);

  // Single-shot: web search + structured JSON output in ONE API call
  const locationHint = prospect.country ? ` (${prospect.country})` : "";
  const prompt = `Investiga al profesional "${prospect.name}", ${prospect.position ?? "ejecutivo"} en ${prospect.company}${locationHint}.

Busca: perfil de LinkedIn, Twitter/X, email de contacto, TELÉFONO DIRECTO o móvil (si existe), TELÉFONO de la empresa ${prospect.company}, menciones en prensa reciente (2023-2025) y contexto profesional.

Para el teléfono: busca primero el número directo o móvil de "${prospect.name}". Si no lo encuentras, busca el número de centralita o contacto general de ${prospect.company}.

Responde SOLO con este JSON (sin markdown, sin texto adicional):
{"linkedinUrl":null,"email":null,"alternativeEmails":["${fName}.${lName}@${companySlug}.com","${firstInitial}.${lName}@${companySlug}.com","${fName}@${companySlug}.com"],"phone":null,"companyPhone":null,"socialProfiles":[],"pressItems":[],"summary":"","salesApproach":"","confidence":"low","sources":[]}

Reemplaza los valores con datos reales encontrados. Para alternativeEmails conserva siempre los 3 patrones de arriba. El resumen (summary) debe ser 2-3 frases en español describiendo su trayectoria y rol actual. salesApproach: estrategia personalizada de abordaje comercial en 2-3 frases en español basada en su cargo y perfil real. Confianza: high=LinkedIn encontrado, medium=noticias/social encontrado, low=nada encontrado.`;

  const hash = crypto.createHash("md5").update(`enrich:${prospect.name}:${prospect.company}:${locationHint}`).digest("hex");

  let parsed: Record<string, unknown> = {};
  let rawText = "";

  try {
    // Check cache (48h TTL)
    const cached = await db
      .select()
      .from(searchCacheTable)
      .where(eq(searchCacheTable.key, hash))
      .limit(1);

    if (cached.length > 0) {
      const entry = cached[0];
      const isExpired = Date.now() - new Date(entry.createdAt).getTime() > 1000 * 60 * 60 * 48;
      if (!isExpired) {
        parsed = entry.value as Record<string, unknown>;
        rawText = (parsed as any)._rawText ?? "";
      }
    }

    if (!parsed || Object.keys(parsed).length === 0) {
      const client = await getAIClient();
      const model = await getModel();

      const aiRes = await client.chat.completions.create({
        model,
        max_completion_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      rawText = aiRes.choices[0]?.message?.content ?? "";

      // Extract JSON from response (may have text before/after)
      const jsonMatch = rawText.match(/\{[\s\S]+\}/);
      if (jsonMatch) {
        try { 
          parsed = JSON.parse(jsonMatch[0]); 
          // Save to cache with rawText for future extraction
          await db.insert(searchCacheTable).values({
            key: hash,
            value: { ...parsed, _rawText: rawText },
            engine: "ai_enrich",
          }).onConflictDoUpdate({
            target: searchCacheTable.key,
            set: { value: { ...parsed, _rawText: rawText }, createdAt: new Date() }
          });
        } catch { /* ignore */ }
      }
    }
  } catch { /* timeout or network error — use fallback */ }

  // Fallback: try to extract LinkedIn URL from raw text even if JSON parse failed
  let linkedinUrl = typeof parsed.linkedinUrl === "string" && parsed.linkedinUrl.includes("linkedin.com/in/")
    ? parsed.linkedinUrl
    : extractLinkedInUrl(rawText);

  if (!linkedinUrl && prospect.linkedinUrl) linkedinUrl = prospect.linkedinUrl;

  const aiSalesApproach = typeof parsed.salesApproach === "string" && parsed.salesApproach.trim().length > 20
    ? parsed.salesApproach
    : null;

  return {
    email: typeof parsed.email === "string" ? parsed.email : undefined,
    alternativeEmails: Array.isArray(parsed.alternativeEmails) && (parsed.alternativeEmails as string[]).length > 0
      ? parsed.alternativeEmails as string[]
      : emailPatterns,
    phone: typeof parsed.phone === "string" ? parsed.phone : undefined,
    companyPhone: typeof parsed.companyPhone === "string" ? parsed.companyPhone : undefined,
    linkedinUrl: linkedinUrl ?? undefined,
    socialProfiles: Array.isArray(parsed.socialProfiles) ? parsed.socialProfiles as Array<{ platform: string; url: string; username?: string }> : [],
    pressItems: Array.isArray(parsed.pressItems) ? parsed.pressItems as Array<{ title: string; url: string; source?: string; date?: string; snippet?: string }> : [],
    summary: typeof parsed.summary === "string" && parsed.summary.trim().length > 10
      ? parsed.summary
      : fallbackSummary,
    salesApproach: aiSalesApproach ?? fallbackApproach,
    confidence: ["high", "medium", "low"].includes(parsed.confidence as string)
      ? parsed.confidence as "high" | "medium" | "low"
      : "low",
    sources: Array.isArray(parsed.sources) && (parsed.sources as string[]).length > 0
      ? parsed.sources as string[]
      : extractUrls(rawText).slice(0, 5),
  };
}

// POST /prospects/:id/enrich — run enrichment
router.post("/prospects/:id/enrich", async (req: any, res: any) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id));
  if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }

  try {
    // Run main enrichment + trigger events search in parallel
    const [enriched, triggerEvents] = await Promise.all([
      enrichWithWebSearch({
        name: prospect.name,
        company: prospect.company,
        position: prospect.position,
        department: prospect.department,
        seniority: prospect.seniority,
        country: prospect.country,
        city: prospect.city,
        email: prospect.email,
        linkedinUrl: prospect.linkedinUrl,
      }),
      findTriggerEvents(prospect.name, prospect.company, prospect.country),
    ]);

    const searchLinks = buildSearchLinks(prospect.name, prospect.company, prospect.position);

    // Upsert into DB
    const existing = await db.select().from(prospectEnrichmentsTable).where(eq(prospectEnrichmentsTable.prospectId, id));

    let saved;
    if (existing.length > 0) {
      [saved] = await db
        .update(prospectEnrichmentsTable)
        .set({
          email: enriched.email ?? null,
          alternativeEmails: enriched.alternativeEmails,
          phone: enriched.phone ?? null,
          companyPhone: enriched.companyPhone ?? null,
          linkedinUrl: enriched.linkedinUrl ?? null,
          socialProfiles: enriched.socialProfiles,
          pressItems: enriched.pressItems,
          summary: enriched.summary,
          salesApproach: enriched.salesApproach,
          confidence: enriched.confidence,
          sources: enriched.sources,
          triggerEvents: triggerEvents.length > 0 ? triggerEvents : (existing[0]?.triggerEvents ?? []),
          enrichedAt: new Date(),
        })
        .where(eq(prospectEnrichmentsTable.prospectId, id))
        .returning();
    } else {
      [saved] = await db
        .insert(prospectEnrichmentsTable)
        .values({
          prospectId: id,
          email: enriched.email ?? null,
          alternativeEmails: enriched.alternativeEmails,
          phone: enriched.phone ?? null,
          companyPhone: enriched.companyPhone ?? null,
          linkedinUrl: enriched.linkedinUrl ?? null,
          socialProfiles: enriched.socialProfiles,
          pressItems: enriched.pressItems,
          summary: enriched.summary,
          salesApproach: enriched.salesApproach,
          confidence: enriched.confidence,
          sources: enriched.sources,
          triggerEvents: triggerEvents,
        })
        .returning();
    }

    // Update main prospect record if we found better contact data
    if (enriched.email && !prospect.email) {
      await db.update(prospectsTable).set({ email: enriched.email }).where(eq(prospectsTable.id, id));
    }
    if (enriched.linkedinUrl && !prospect.linkedinUrl) {
      await db.update(prospectsTable).set({ linkedinUrl: enriched.linkedinUrl }).where(eq(prospectsTable.id, id));
    }
    if (enriched.phone && !prospect.phone) {
      await db.update(prospectsTable).set({ phone: enriched.phone }).where(eq(prospectsTable.id, id));
    }

    res.json({
      prospectId: id,
      email: saved.email ?? undefined,
      alternativeEmails: saved.alternativeEmails ?? [],
      phone: saved.phone ?? undefined,
      companyPhone: saved.companyPhone ?? undefined,
      linkedinUrl: saved.linkedinUrl ?? undefined,
      socialProfiles: saved.socialProfiles ?? [],
      pressItems: saved.pressItems ?? [],
      summary: saved.summary ?? undefined,
      salesApproach: saved.salesApproach ?? enriched.salesApproach,
      triggerEvents: saved.triggerEvents ?? [],
      confidence: saved.confidence ?? undefined,
      enrichedAt: saved.enrichedAt.toISOString(),
      sources: saved.sources ?? [],
      searchLinks,
    });
  } catch (error) {
    console.error("Enrichment error:", error);
    res.status(500).json({ error: "Error enriching prospect: " + String(error) });
  }
});

// GET /prospects/:id/enrichment — get stored enrichment
router.get("/prospects/:id/enrichment", async (req: any, res: any) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id));
  const [enrichment] = await db
    .select()
    .from(prospectEnrichmentsTable)
    .where(eq(prospectEnrichmentsTable.prospectId, id));

  if (!enrichment) {
    res.status(404).json({ error: "No enrichment data found" });
    return;
  }

  const searchLinks = prospect
    ? buildSearchLinks(prospect.name, prospect.company, prospect.position)
    : [];

  res.json({
    prospectId: id,
    email: enrichment.email ?? undefined,
    alternativeEmails: enrichment.alternativeEmails ?? [],
    phone: enrichment.phone ?? undefined,
    companyPhone: enrichment.companyPhone ?? undefined,
    linkedinUrl: enrichment.linkedinUrl ?? undefined,
    socialProfiles: enrichment.socialProfiles ?? [],
    pressItems: enrichment.pressItems ?? [],
    summary: enrichment.summary ?? undefined,
    salesApproach: enrichment.salesApproach ?? undefined,
    triggerEvents: enrichment.triggerEvents ?? [],
    confidence: enrichment.confidence ?? undefined,
    enrichedAt: enrichment.enrichedAt.toISOString(),
    sources: enrichment.sources ?? [],
    searchLinks,
  });
});

export default router;
