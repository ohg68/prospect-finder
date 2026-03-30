import { Router } from "express";
import { AI_MODELS_BY_PROVIDER, AI_MODELS } from "../config/ai-config.js";
import { db as dbInstance, sql as dSql } from "@workspace/db";
import OpenAI from "openai";

const db: any = dbInstance;
const sql: any = dSql;

const router = Router();

async function getAIClient(): Promise<{ client: OpenAI; model: string }> {
    try {
          const result = await db.execute(sql`SELECT api_key, base_url, provider FROM ai_configurations WHERE is_active = true LIMIT 1`);
          const row = result.rows?.[0];
          if (row?.api_key) {
                  const provider = row.provider || "openai";
                  const model = (AI_MODELS_BY_PROVIDER as any)[provider] || AI_MODELS.CHAT;
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
          model: AI_MODELS.CHAT,
    };
}

interface ChatMessage { role: "user" | "assistant"; content: string; }
interface ChatRequestBody {
    messages: ChatMessage[];
    context?: { searchMode?: string; searchQuery?: string; totalProspects?: number; };
}

const SYSTEM_PROMPT = `Eres un asistente B2B especializado en inteligencia de ventas y prospeccion de clientes para el mercado hispanohablante (Espana y Latinoamerica). Estas integrado en ProspectFinder, una plataforma B2B que ayuda a equipos de ventas a:
- Encontrar prospectos clave en empresas objetivo
- Investigar empresas (sector, directivos, ingresos, sede)
- Enriquecer perfiles con datos de contacto e IA
- Guardar y gestionar listas de prospectos

TU ROL:
- Ayuda con estrategias de prospeccion B2B y outreach en mercados hispanohablantes
- Sugiere mensajes de contacto personalizados (LinkedIn, email, llamadas en frio)
- Explica como filtrar y segmentar prospectos segun el sector, cargo o empresa
- Aconseja sobre el timing y el approach para cada tipo de prospecto
- Analiza empresas y sectores para encontrar el mejor angulo de venta
- Responde preguntas sobre industrias en Espana, Mexico, Colombia, Argentina, Chile, etc.

REGLAS:
- Siempre responde en espanol
- Se conciso y accionable - los usuarios son profesionales de ventas
- Usa bullet points para listas de acciones o consejos
- Se directo, profesional y orientado a resultados`;

router.post("/chat", async (req: any, res: any) => {
    const { messages, context } = req.body as ChatRequestBody;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
          res.status(400).json({ error: "Chat messages are required" });
          return;
    }
    const validMessages = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .filter(m => typeof m.content === "string" && m.content.trim().length > 0)
      .slice(-20);
    if (validMessages.length === 0) {
          res.status(400).json({ error: "No valid messages found" });
          return;
    }
    let contextNote = "";
    if (context?.searchMode) {
          const modeLabels: Record<string, string> = { key_people: "Key People", by_company: "By Company/Position", specific_person: "Specific Person" };
          contextNote += `\n[Contexto: El usuario esta usando el modo "${modeLabels[context.searchMode] ?? context.searchMode}"]`;
    }
    if (context?.searchQuery) contextNote += `\n[Contexto: Busqueda actual: "${context.searchQuery}"]`;
    if (context?.totalProspects !== undefined) contextNote += `\n[Contexto: ${context.totalProspects} prospectos disponibles]`;
    const systemContent = SYSTEM_PROMPT + (contextNote ? `\n\n${contextNote}` : "");
    try {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("X-Accel-Buffering", "no");
          res.flushHeaders();
          const { client: aiClient, model: aiModel } = await getAIClient();
          const stream = await aiClient.chat.completions.create({
                  model: aiModel,
                  max_completion_tokens: 800,
                  messages: [{ role: "system", content: systemContent }, ...validMessages],
                  stream: true,
          });
          for await (const chunk of stream) {
                  const delta = chunk.choices[0]?.delta?.content;
                  if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
          res.write("data: [DONE]\n\n");
          res.end();
    } catch (error) {
          console.error("Chat error:", error);
          if (!res.headersSent) {
                  res.status(500).json({ error: "AI chat error" });
          } else {
                  res.write(`data: ${JSON.stringify({ error: "Error generating response" })}\n\n`);
                  res.end();
          }
    }
});

export default router;
