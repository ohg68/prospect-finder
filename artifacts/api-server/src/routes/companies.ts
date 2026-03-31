import { Router } from "express";
import { aiChat } from "../config/ai-config.js";
import { db as dbInstance, searchCacheTable as sCT, eq as dEq } from "@workspace/db";
import crypto from "crypto";
const db: any = dbInstance;
const searchCacheTable: any = sCT;
const eq: any = dEq;

const router = Router();

interface DdgInfoItem {
  label: string;
  value: unknown;
}

interface DdgResponse {
  Type: string;
  AbstractText: string;
  AbstractURL: string;
  AbstractSource: string;
  Infobox?: { content: DdgInfoItem[] };
}

function getString(items: DdgInfoItem[], ...labels: string[]): string | null {
  for (const label of labels) {
    const item = items.find(i =>
      typeof i.label === "string" &&
      i.label.toLowerCase() === label.toLowerCase() &&
      typeof i.value === "string" &&
      (i.value as string).trim().length > 0
    );
    if (item) return (item.value as string).trim();
  }
  return null;
}

const MONTH_NAMES = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i;

function parseFoundedLocation(raw: string | null): { year: string | null; location: string | null } {
  if (!raw) return { year: null, location: null };
  // e.g. "A Coruña, Galicia, Spain, (June 12, 1985)" or "May 15, 1857"
  const yearMatch = raw.match(/\b(1[89]\d{2}|20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : null;
  // Remove year and date fragments to isolate the city/country
  let location: string | null = raw
    .replace(/\(.*?\)/g, "")           // remove parentheses
    .replace(/\b(1[89]\d{2}|20\d{2})\b/, "") // remove year
    .replace(MONTH_NAMES, "")         // remove month names
    .replace(/\b\d{1,2}\b/g, "")      // remove day numbers
    .replace(/,\s*,/g, ",")           // fix double commas
    .replace(/^[,\s]+|[,\s]+$/g, "")  // trim commas and spaces
    .trim();
  // If only date-like fragments remain (or empty), return null
  if (!location || location.length < 2) location = null;
  return { year, location: location || null };
}

function cleanWebsite(raw: string | null): string | null {
  if (!raw) return null;
  // Remove brackets: "[santander.com]" → "santander.com"
  let url = raw.replace(/^\[(.+)\]$/, "$1").trim();
  if (!url) return null;
  // Ensure protocol
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
}

function parseKeyPeople(raw: string | null): Array<{ name: string; position: string }> {
  if (!raw) return [];
  const results: Array<{ name: string; position: string }> = [];
  const regex = /([^(,]+?)\s*\(([^)]+)\)/g;
  let m;
  while ((m = regex.exec(raw)) !== null && results.length < 5) {
    const name = m[1].trim();
    const pos = m[2].trim();
    if (name.length > 1 && pos.length > 1) results.push({ name, position: pos });
  }
  return results;
}

function parseEmployeeCount(raw: string | null): string | null {
  if (!raw) return null;
  const numMatch = raw.match(/^([\d,]+)/);
  if (!numMatch) return raw;
  const n = parseInt(numMatch[1].replace(/,/g, ""), 10);
  if (isNaN(n)) return raw;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k+`;
  return numMatch[1];
}

async function queryDuckDuckGo(companyName: string): Promise<DdgResponse | null> {
  const hash = crypto.createHash("md5").update(`ddg:${companyName}`).digest("hex");
  
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
        return entry.value as DdgResponse;
      }
    }

    const encoded = encodeURIComponent(companyName);
    const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProspectBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    }) as any;
    
    if (!res.ok) return null;
    const data = await res.json() as DdgResponse;
    const result = data.Type === "A" ? data : null;

    if (result) {
      // Save to cache
      await db
        .insert(searchCacheTable)
        .values({
          key: hash,
          value: result,
          engine: "duckduckgo",
        })
        .onConflictDoUpdate({
          target: searchCacheTable.key,
          set: { value: result, createdAt: new Date() }
        });
    }

    return result;
  } catch (err) {
    console.error("DDG search error:", err);
    return null;
  }
}

// POST /companies/research — research a company using DDG API + AI
router.post("/companies/research", async (req: any, res: any) => {
  const { company, country } = req.body as { company?: string; country?: string };

  if (!company || company.trim().length < 2) {
    res.status(400).json({ error: "Nombre de empresa requerido (mínimo 2 caracteres)" });
    return;
  }

  const companyName = company.trim();
  const countryHint = country?.trim() ?? "";

  try {
    // Query DDG with company name only (no country — it confuses DDG)
    const ddg = await queryDuckDuckGo(companyName);

    const items: DdgInfoItem[] = ddg?.Infobox?.content ?? [];

    // Extract structured data from DDG infobox using correct field names
    const websiteRaw = getString(items, "Official Website", "Website", "Official website");
    const website = cleanWebsite(websiteRaw);
    const industry = getString(items, "Industry", "Sector");
    const rawEmployees = getString(items, "Number of employees", "Employees");
    const employeeCount = parseEmployeeCount(rawEmployees);
    const revenue = getString(items, "Revenue", "Total revenue");
    const rawFounded = getString(items, "Founded");
    const { year: foundedYear, location: foundedLocation } = parseFoundedLocation(rawFounded);
    const headquarters = getString(items, "Headquarters", "Location") ?? foundedLocation;
    const rawKeyPeople = getString(items, "Key people", "Key employees");
    const keyExecutives = parseKeyPeople(rawKeyPeople);

    const twitterHandle = getString(items, "Twitter profile", "Twitter username");
    const instagramHandle = getString(items, "Instagram profile");
    const facebookHandle = getString(items, "Facebook profile");

    const socialProfiles: Array<{ platform: string; url: string }> = [];
    if (twitterHandle) socialProfiles.push({ platform: "Twitter/X", url: `https://twitter.com/${twitterHandle}` });
    if (instagramHandle) socialProfiles.push({ platform: "Instagram", url: `https://instagram.com/${instagramHandle}` });
    if (facebookHandle) socialProfiles.push({ platform: "Facebook", url: `https://facebook.com/${facebookHandle}` });

    // Build context string for AI
    const ddgContext = ddg ? [
      ddg.AbstractText ? `Descripción: ${ddg.AbstractText}` : "",
      website ? `Sitio web: ${website}` : "",
      industry ? `Industria: ${industry}` : "",
      employeeCount ? `Empleados: ${employeeCount}` : "",
      revenue ? `Facturación: ${revenue}` : "",
      headquarters ? `Sede: ${headquarters}` : "",
      foundedYear ? `Fundada: ${foundedYear}` : "",
      rawKeyPeople ? `Directivos: ${rawKeyPeople}` : "",
    ].filter(Boolean).join("\n") : "";

    // AI: translate to Spanish, fill gaps, add LinkedIn, generate summary, find news
    const aiPrompt = `Eres un analista de inteligencia B2B experto en empresas españolas y latinoamericanas. Responde SIEMPRE en español.

EMPRESA OBJETIVO: "${companyName}"${countryHint ? ` — País: ${countryHint}` : ""}

DATOS DISPONIBLES:
${ddgContext || "No hay datos previos. Usa tu conocimiento entrenado sobre esta empresa."}

GENERA el siguiente JSON completando TODOS los campos obligatorios:
{
  "description": "OBLIGATORIO: Descripción en español de 2-3 frases de qué hace la empresa, sector y mercado al que sirve.",
  "linkedinUrl": "URL de LinkedIn de empresa: https://linkedin.com/company/[slug]. Si no sabes con certeza, pon null.",
  "website": "URL del sitio web oficial si lo conoces (ej: https://www.empresa.com). Si no lo sabes con certeza, pon null.",
  "industry": "OBLIGATORIO: Sector o industria en español (ej: 'Telecomunicaciones', 'Banca', 'Energía', 'Retail').",
  "headquarters": "OBLIGATORIO: Ciudad y país de la sede principal en español.",
  "summary": "OBLIGATORIO: Resumen ejecutivo B2B en español de 2-3 frases. Incluye: qué hace, tamaño aproximado y posición en el mercado.",
  "recentNews": [
    { "title": "Título de noticia reciente de 2024-2025 si la conoces", "url": "https://...", "source": "Nombre del medio", "date": "2025-01", "snippet": "Extracto breve..." }
  ],
  "additionalSocial": [
    { "platform": "YouTube", "url": "https://youtube.com/..." }
  ]
}

IMPORTANTE: Los campos "description", "industry", "headquarters" y "summary" son OBLIGATORIOS. Nunca los dejes vacíos o null.`;

    const aiContent = await aiChat({
      messages: [{ role: "user", content: aiPrompt }],
      maxTokens: 2000,
    });

    let aiData: Record<string, unknown> = {};
    try {
      aiData = JSON.parse(aiContent);
    } catch {
      aiData = {};
    }

    const aiLinkedIn = typeof aiData.linkedinUrl === "string" ? aiData.linkedinUrl : null;
    const aiWebsite = typeof aiData.website === "string" ? cleanWebsite(aiData.website) : null;
    const aiDescription = typeof aiData.description === "string" ? aiData.description : null;
    const aiIndustry = typeof aiData.industry === "string" ? aiData.industry : null;
    const aiHq = typeof aiData.headquarters === "string" ? aiData.headquarters : null;
    const rawAiSummary = typeof aiData.summary === "string" ? aiData.summary.trim() : "";
    const aiSummary = rawAiSummary || (aiDescription ?? ddg?.AbstractText?.substring(0, 300) ?? "");
    const aiNews = Array.isArray(aiData.recentNews) ? aiData.recentNews as Array<{ title: string; url: string; source?: string; date?: string; snippet?: string }> : [];
    const aiExtraSocial = Array.isArray(aiData.additionalSocial) ? aiData.additionalSocial as Array<{ platform: string; url: string }> : [];

    // Merge social profiles
    const allSocial = [
      ...socialProfiles,
      ...aiExtraSocial.filter(s => !socialProfiles.some(p => p.platform === s.platform)),
    ];

    const sources: string[] = [];
    if (ddg?.AbstractURL) sources.push(ddg.AbstractURL);
    if (website && !sources.includes(website)) sources.push(website);
    if (aiLinkedIn && !sources.includes(aiLinkedIn)) sources.push(aiLinkedIn);

    const hasGoodData = !!(ddg && (website || industry || employeeCount));

    res.json({
      company: companyName,
      name: companyName,
      description: aiDescription ?? (ddg?.AbstractText ?? null),
      website: website ?? aiWebsite ?? null,
      linkedinUrl: aiLinkedIn,
      industry: industry ?? aiIndustry,
      employeeCount: employeeCount ?? null,
      headquarters: headquarters ?? aiHq,
      foundedYear: foundedYear ?? null,
      revenue: revenue ?? null,
      keyExecutives: keyExecutives.length > 0 ? keyExecutives : [],
      socialProfiles: allSocial,
      recentNews: aiNews,
      summary: aiSummary,
      confidence: hasGoodData ? "high" : (ddg ? "medium" : "low"),
      sources: [...new Set(sources)],
      researchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Company research error:", error);
    res.status(500).json({ error: "Error al investigar empresa: " + String(error) });
  }
});

export default router;
