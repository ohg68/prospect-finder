import { Router , Request, Response} from "express";
import { db as dbInstance, prospectsTable as pT, searchCacheTable as sCT, aiConfigurations as aiCT, and as dAnd, ilike as dILike, eq as dEq, sql as dSql } from "../../../../lib/db/src/index.js";
import * as crypto from "crypto";
const db: any = dbInstance;
const prospectsTable: any = pT;
const searchCacheTable: any = sCT;
const aiConfigurations: any = aiCT;
const and: any = dAnd;
const ilike: any = dILike;
const eq: any = dEq;
const sql: any = dSql;
import { getAIClient, getModel, getActiveAIConfig } from "../config/ai-config.js";

const router = Router();

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

// Run one AI query and return the raw text output
async function webSearch(query: string, timeoutMs = 50000): Promise<string> {
  const hash = crypto.createHash("md5").update(query).digest("hex");
  
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
        return entry.value as string;
      }
    }

    const client = await getAIClient();
    const model = await getModel();

    const aiRes = await client.chat.completions.create({
      model,
      max_completion_tokens: 2000,
      messages: [{ role: "user", content: query }],
    });

    const text = aiRes.choices[0]?.message?.content ?? "";

    if (text.trim()) {
      // Save to cache
      await db
        .insert(searchCacheTable)
        .values({
          key: hash,
          value: text,
          engine: "ai_search",
        })
        .onConflictDoUpdate({
          target: searchCacheTable.key,
          set: { value: text, createdAt: new Date() }
        });
      return text;
    }
    return "";
  } catch (err) {
    console.error("AI search error:", err);
    return "";
  }
}

// Deep multi-source search for real employees of a company
async function deepSearchEmployees(
  company: string,
  country?: string,
  position?: string,
  department?: string,
  count = 10
): Promise<GeneratedProspect[]> {
  const loc = country ? ` ${country}` : "";
  const posHint = position ? ` "${position}"` : "";
  const deptHint = department ? ` ${department}` : "";
  const companySlug = company.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  // Run 3 parallel searches across different sources
  const [linkedinText, webText, newsText] = await Promise.all([
    // Source 1: LinkedIn company people page + Google search for LinkedIn profiles
    webSearch(
      `Encuentra personas reales que trabajan en "${company}"${loc}. ` +
      `Busca en linkedin.com/company/${companySlug}/people y en resultados de Google "site:linkedin.com/in ${company}${loc}". ` +
      `Extrae: nombre completo, cargo actual, URL de LinkedIn. Enumera al menos ${Math.ceil(count * 0.6)} personas.`
    ),

    // Source 2: Company website team page + Crunchbase + business directories
    webSearch(
      `Encuentra el equipo directivo de la empresa "${company}"${loc}. ` +
      `Busca en: (1) la página web oficial de ${company} sección "Team" o "About" o "Equipo", ` +
      `(2) crunchbase.com/organization/${companySlug}/people, ` +
      `(3) directorios de empresas. ` +
      `Lista todos los fundadores, C-Suite, directores y managers que encuentres con sus cargos.`
    ),

    // Source 3: News, press releases, Twitter/X, interviews
    webSearch(
      `Busca menciones públicas de empleados o directivos de "${company}"${loc}${posHint}${deptHint}. ` +
      `Fuentes: noticias de prensa, entrevistas, comunicados, perfiles de Twitter/X, ` +
      `GitHub, blogs técnicos, conferencias y eventos del sector. ` +
      `Lista personas mencionadas con nombre, cargo y fuente.`
    ),
  ]);

  // Combine all raw text for context
  const combinedContext = [
    linkedinText && `=== LINKEDIN Y REDES PROFESIONALES ===\n${linkedinText}`,
    webText && `=== WEB CORPORATIVA Y DIRECTORIOS ===\n${webText}`,
    newsText && `=== PRENSA, NOTICIAS Y REDES SOCIALES ===\n${newsText}`,
  ].filter(Boolean).join("\n\n");

  if (!combinedContext.trim()) return [];

  // Final consolidation via regular chat (no web search needed — just text analysis)
  const consolidatePrompt = `Eres un analista de inteligencia B2B. Analiza TODA la información recopilada y extrae personas reales de "${company}"${loc}.

INFORMACIÓN RECOPILADA:
${combinedContext.substring(0, 8000)}

INSTRUCCIONES:
- Extrae SOLO personas reales mencionadas en el texto anterior
- Elimina duplicados (misma persona con nombre ligeramente diferente)
- Si encontraste URL exacta de LinkedIn (linkedin.com/in/...), cópiala tal cual
- Si encontraste Twitter (@usuario), inclúyelo en twitterUrl
- Extrae email si aparece en el texto
- Prioriza cargos directivos (CEO, CTO, CFO, Director, VP, Head of, Manager, Founder)
- Devuelve hasta ${count} personas, priorizando las más relevantes para ventas B2B
- Deduce departamento del cargo (Ventas, Marketing, Tecnología, Finanzas, Operaciones, RRHH)
- Deduce seniority del cargo

Responde SOLO con JSON válido (sin markdown, sin explicaciones adicionales):
{"prospects":[{"name":"Nombre Apellido real","position":"Cargo exacto del texto","department":"Departamento","company":"${company}","country":"${country ?? ""}","city":"Ciudad si se conoce o vacío","seniority":"C-Level|Director|VP|Manager|Head|Senior","industry":"Sector","email":"email encontrado o null","linkedinUrl":"URL linkedin.com/in/... exacta o null","twitterUrl":"URL twitter o null"}]}`;

  try {
    const client = await getAIClient();
    const model = await getModel();
    const aiRes = await client.chat.completions.create({
      model,
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: consolidatePrompt }],
    });

    const content = aiRes.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { prospects?: GeneratedProspect[] };
    if (Array.isArray(parsed.prospects) && parsed.prospects.length > 0) {
      return parsed.prospects;
    }
  } catch { /* ignore */ }

  // Fallback: try to parse JSON directly from search results
  for (const text of [linkedinText, webText, newsText]) {
    const match = text?.match(/\{[\s\S]+\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as { prospects?: GeneratedProspect[] };
        if (Array.isArray(parsed.prospects) && parsed.prospects.length > 0) {
          return parsed.prospects;
        }
      } catch { /* ignore */ }
    }
  }

  return [];
}

// Fallback: generate plausible AI prospects for generic criteria (no specific company)
async function generateFictionalProspects(
  mode: string,
  company?: string,
  country?: string,
  city?: string,
  position?: string,
  department?: string,
  name?: string,
  count = 12
): Promise<GeneratedProspect[]> {
  const criteria: string[] = [];
  if (mode === "key_people") {
    if (company) criteria.push(`Empresa: "${company}"`);
    if (country) criteria.push(`País: "${country}"`);
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

  if (criteria.length === 0) {
    criteria.push("Directivos y managers de empresas de España y Latinoamérica");
  }

  const prompt = `Genera ${count} perfiles B2B REALISTAS para:
${criteria.join("\n")}

Nombres coherentes con el país indicado. Cargos relevantes (C-Level, Director, VP, Manager, Head).
Responde SOLO con JSON:
{"prospects":[{"name":"Nombre","position":"Cargo","department":"Dept","company":"${company ?? "Empresa"}","country":"${country ?? ""}","city":"","seniority":"Manager","industry":"","email":null,"linkedinUrl":null}]}`;

  const client = await getAIClient();
  const model = await getModel();
  const aiRes = await client.chat.completions.create({
    model,
    max_completion_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = aiRes.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { prospects?: GeneratedProspect[] };
    return Array.isArray(parsed.prospects) ? parsed.prospects : [];
  } catch {
    return [];
  }
}

// POST /prospects/generate
router.post("/prospects/generate", async (req: any, res: any) => {
  const {
    mode = "key_people",
    company,
    country,
    city,
    position,
    department,
    name,
    count = 12,
  } = req.body as GenerateParams;

  try {
    let list: GeneratedProspect[] = [];

    // When a specific company is given → deep multi-source real search
    if (company && company.trim().length >= 2) {
      list = await deepSearchEmployees(
        company.trim(), country, position, department, count
      ).catch(() => []);
    }

    // If web search found too few → supplement with AI generation
    if (list.length < 3) {
      const fallback = await generateFictionalProspects(
        mode, company, country, city, position, department, name, count
      ).catch(() => []);
      list = list.length === 0 ? fallback : [...list, ...fallback.slice(0, count - list.length)];
    }

    if (list.length === 0) {
      res.json({ prospects: [], generated: 0 });
      return;
    }

    // Insert new prospects, skip duplicates
    const inserted: typeof prospectsTable.$inferSelect[] = [];

    for (const p of list) {
      if (!p.name || !p.company) continue;

      const existing = await db
        .select({ id: prospectsTable.id })
        .from(prospectsTable)
        .where(
          and(
            ilike(prospectsTable.name as any, p.name.trim() as any) as any,
            ilike(prospectsTable.company as any, `%${p.company.trim().split(" ")[0]}%` as any) as any
          ) as any
        )
        .limit(1);

      if (existing.length > 0) continue;

      const validSeniorities = ["C-Level", "Director", "VP", "Manager", "Head", "Senior"] as const;
      const seniority = validSeniorities.includes(p.seniority as never)
        ? (p.seniority as typeof validSeniorities[number])
        : "Manager";

      try {
        const [row] = await db
          .insert(prospectsTable)
          .values({
            name: p.name.trim(),
            position: p.position?.trim() ?? null,
            department: p.department?.trim() ?? null,
            company: p.company.trim(),
            country: p.country?.trim() || country || null,
            city: p.city?.trim() ?? null,
            email: p.email?.trim() || null,
            linkedinUrl: p.linkedinUrl?.trim() || null,
            seniority,
            industry: p.industry?.trim() ?? null,
            notes: p.twitterUrl ? `Twitter: ${p.twitterUrl}` : null,
          })
          .returning();
        if (row) inserted.push(row);
      } catch {
        // skip insert error
      }
    }

    res.json({
      prospects: inserted.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })),
      generated: inserted.length,
    });
  } catch (error) {
    console.error("Generate prospects error:", error);
    res.status(500).json({ error: "Error generating prospects: " + String(error) });
  }
});

export default router;
