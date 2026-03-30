import { Router } from "express";
import { AI_MODELS_BY_PROVIDER, AI_MODELS } from "../config/ai-config.js";
import { db as dbInstance, searchCacheTable as sCT, eq as dEq, sql as dSql } from "@workspace/db";
import crypto from "crypto";
import OpenAI from "openai";

const db: any = dbInstance;
const searchCacheTable: any = sCT;
const eq: any = dEq;
const sql: any = dSql;

const router = Router();

// Helper: get active AI client from DB config
async function getAIClient(): Promise<{ client: OpenAI; model: string }> {
    try {
          const result = await db.execute(sql`SELECT api_key, base_url, provider FROM ai_configurations WHERE is_active = true LIMIT 1`);
          const row = result.rows?.[0];
          if (row?.api_key) {
                  const provider = row.provider || "openai";
                  const model = (AI_MODELS_BY_PROVIDER as any)[provider] || AI_MODELS.GENERAL;
                  return {
                            client: new OpenAI({ apiKey: row.api_key, baseURL: row.base_url || "https://api.openai.com/v1" }),
                            model,
                  };
          }
    } catch (e) {
          console.error("Error reading AI config from DB:", e);
    }
    return {
          client: new OpenAI({
                  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "missing-key",
                  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
          }),
          model: AI_MODELS.GENERAL,
    };
}

interface DdgInfoItem { label: string; value: unknown; }
interface DdgResponse {
    Type: string; AbstractText: string; AbstractURL: string; AbstractSource: string;
    Infobox?: { content: DdgInfoItem[] };
}

function getString(items: DdgInfoItem[], ...labels: string[]): string | null {
    for (const label of labels) {
          const item = items.find(i => typeof i.label === "string" && i.label.toLowerCase() === label.toLowerCase() && typeof i.value === "string" && (i.value as string).trim().length > 0);
          if (item) return (item.value as string).trim();
    }
    return null;
}

const MONTH_NAMES = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i;

function parseFoundedLocation(raw: string | null): { year: string | null; location: string | null } {
    if (!raw) return { year: null, location: null };
    const yearMatch = raw.match(/\b(1[89]\d{2}|20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : null;
    let location: string | null = raw
      .replace(/\(.*?\)/g, "").replace(/\b(1[89]\d{2}|20\d{2})\b/, "").replace(MONTH_NAMES, "")
      .replace(/\b\d{1,2}\b/g, "").replace(/,\s*,/g, ",").replace(/^[,\s]+|[,\s]+$/g, "").trim();
    if (!location || location.length < 2) location = null;
    return { year, location: location || null };
}

function cleanWebsite(raw: string | null): string | null {
    if (!raw) return null;
    let url = raw.replace(/^\[(.+)\]$/, "$1").trim();
    if (!url) return null;
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
    return url;
}

function parseKeyPeople(raw: string | null): Array<{ name: string; position: string }> {
    if (!raw) return [];
    const results: Array<{ name: string; position: string }> = [];
    const regex = /([^(,]+?)\s*\(([^)]+)\)/g;
    let m;
    while ((m = regex.exec(raw)) !== null && results.length < 5) {
          const name = m[1].trim(); const pos = m[2].trim();
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
          const cached = await db.select().from(searchCacheTable).where(eq(searchCacheTable.key, hash)).limit(1);
          if (cached.length > 0) {
                  const entry = cached[0];
                  const isExpired = Date.now() - new Date(entry.createdAt).getTime() > 1000 * 60 * 60 * 48;
                  if (!isExpired) return entry.value as DdgResponse;
          }
          const encoded = encodeURIComponent(companyName);
          const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`;
          const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ProspectBot/1.0)" }, signal: AbortSignal.timeout(8000) }) as any;
          if (!res.ok) return null;
          const data = await res.json() as DdgResponse;
          const result = data.Type === "A" ? data : null;
          if (result) {
                  await db.insert(searchCacheTable).values({ key: hash, value: result, engine: "duckduckgo" })
                    .onConflictDoUpdate({ target: searchCacheTable.key, set: { value: result, createdAt: new Date() } });
          }
          return result;
    } catch (err) {
          console.error("DDG search error:", err);
          return null;
    }
}

router.post("/companies/research", async (req: any, res: any) => {
    const { company, country } = req.body as { company?: string; country?: string };
    if (!company || company.trim().length < 2) {
          res.status(400).json({ error: "Nombre de empresa requerido (minimo 2 caracteres)" });
          return;
    }
    const companyName = company.trim();
    const countryHint = country?.trim() ?? "";
    try {
          const ddg = await queryDuckDuckGo(companyName);
          const items: DdgInfoItem[] = ddg?.Infobox?.content ?? [];
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

      const ddgContext = ddg ? [
              ddg.AbstractText ? `Descripcion: ${ddg.AbstractText}` : "",
              website ? `Sitio web: ${website}` : "",
              industry ? `Industria: ${industry}` : "",
              employeeCount ? `Empleados: ${employeeCount}` : "",
              revenue ? `Facturacion: ${revenue}` : "",
              headquarters ? `Sede: ${headquarters}` : "",
              foundedYear ? `Fundada: ${foundedYear}` : "",
              rawKeyPeople ? `Directivos: ${rawKeyPeople}` : "",
            ].filter(Boolean).join("\n") : "";

      const aiPrompt = `Eres un analista de inteligencia B2B experto en empresas espanolas y latinoamericanas. Responde SIEMPRE en espanol.

      EMPRESA OBJETIVO: "${companyName}"${countryHint ? ` - Pais: ${countryHint}` : ""}

      DATOS DISPONIBLES:
      ${ddgContext || "No hay datos previos. Usa tu conocimiento entrenado sobre esta empresa."}

      GENERA el siguiente JSON completando TODOS los campos obligatorios:
      {
        "description": "OBLIGATORIO: Descripcion en espanol de 2-3 frases.",
          "linkedinUrl": "URL de LinkedIn o null.",
            "website": "URL del sitio web oficial o null.",
              "industry": "OBLIGATORIO: Sector en espanol.",
                "headquarters": "OBLIGATORIO: Ciudad y pais de la sede.",
                  "summary": "OBLIGATORIO: Resumen ejecutivo B2B en espanol de 2-3 frases.",
                    "recentNews": [],
                      "additionalSocial": []
                      }
                      IMPORTANTE: description, industry, headquarters y summary son OBLIGATORIOS.`;

      const { client: aiClient, model: aiModel } = await getAIClient();
          const aiRes = await aiClient.chat.completions.create({
                  model: aiModel,
                  max_completion_tokens: 2000,
                  messages: [{ role: "user", content: aiPrompt }],
                  response_format: { type: "json_object" },
          });

      let aiData: Record<string, unknown> = {};
          try { aiData = JSON.parse(aiRes.choices[0]?.message?.content ?? "{}"); } catch { aiData = {}; }

      const aiLinkedIn = typeof aiData.linkedinUrl === "string" ? aiData.linkedinUrl : null;
          const aiWebsite = typeof aiData.website === "string" ? cleanWebsite(aiData.website) : null;
          const aiDescription = typeof aiData.description === "string" ? aiData.description : null;
          const aiIndustry = typeof aiData.industry === "string" ? aiData.industry : null;
          const aiHq = typeof aiData.headquarters === "string" ? aiData.headquarters : null;
          const rawAiSummary = typeof aiData.summary === "string" ? aiData.summary.trim() : "";
          const aiSummary = rawAiSummary || (aiDescription ?? ddg?.AbstractText?.substring(0, 300) ?? "");
          const aiNews = Array.isArray(aiData.recentNews) ? aiData.recentNews as Array<{ title: string; url: string; source?: string; date?: string; snippet?: string }> : [];
          const aiExtraSocial = Array.isArray(aiData.additionalSocial) ? aiData.additionalSocial as Array<{ platform: string; url: string }> : [];

      const allSocial = [...socialProfiles, ...aiExtraSocial.filter(s => !socialProfiles.some(p => p.platform === s.platform))];
          const sources: string[] = [];
          if (ddg?.AbstractURL) sources.push(ddg.AbstractURL);
          if (website && !sources.includes(website)) sources.push(website);
          if (aiLinkedIn && !sources.includes(aiLinkedIn)) sources.push(aiLinkedIn);
          const hasGoodData = !!(ddg && (website || industry || employeeCount));

      res.json({
              company: companyName, name: companyName,
              description: aiDescription ?? (ddg?.AbstractText ?? null),
              website: website ?? aiWebsite ?? null,
              linkedinUrl: aiLinkedIn, industry: industry ?? aiIndustry,
              employeeCount: employeeCount ?? null, headquarters: headquarters ?? aiHq,
              foundedYear: foundedYear ?? null, revenue: revenue ?? null,
              keyExecutives: keyExecutives.length > 0 ? keyExecutives : [],
              socialProfiles: allSocial, recentNews: aiNews, summary: aiSummary,
              confidence: hasGoodData ? "high" : (ddg ? "medium" : "low"),
              sources: [...new Set(sources)], researchedAt: new Date().toISOString(),
      });
    } catch (error) {
          console.error("Company research error:", error);
          res.status(500).json({ error: "Error al investigar empresa: " + String(error) });
    }
});

export default router;
