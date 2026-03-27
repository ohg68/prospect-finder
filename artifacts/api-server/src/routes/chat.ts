import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { AI_MODELS } from "../config/ai-config.js";

const router = Router();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  context?: {
    searchMode?: string;
    searchQuery?: string;
    totalProspects?: number;
  };
}

const SYSTEM_PROMPT = `Eres un asistente B2B especializado en inteligencia de ventas y prospección de clientes para el mercado hispanohablante (España y Latinoamérica).

Estás integrado en ProspectFinder, una plataforma B2B que ayuda a equipos de ventas a:
- Encontrar prospectos clave en empresas objetivo
- Investigar empresas (sector, directivos, ingresos, sede)
- Enriquecer perfiles con datos de contacto e IA
- Guardar y gestionar listas de prospectos

TU ROL:
- Ayuda con estrategias de prospección B2B y outreach en mercados hispanohablantes
- Sugiere mensajes de contacto personalizados (LinkedIn, email, llamadas en frío)
- Explica cómo filtrar y segmentar prospectos según el sector, cargo o empresa
- Aconseja sobre el timing y el approach para cada tipo de prospecto
- Analiza empresas y sectores para encontrar el mejor ángulo de venta
- Responde preguntas sobre industrias en España, México, Colombia, Argentina, Chile, etc.

REGLAS:
- Siempre responde en español
- Sé conciso y accionable — los usuarios son profesionales de ventas, no necesitan explicaciones largas
- Usa viñetas (bullet points) para listas de acciones o consejos
- Si el usuario pregunta algo muy específico de un prospecto/empresa, usa tu conocimiento entrenado
- Si no tienes información suficiente, sugiere cómo encontrarla usando las herramientas de la plataforma
- Sé directo, profesional y orientado a resultados`;

router.post("/chat", async (req: any, res: any) => {
  const { messages, context } = req.body as ChatRequestBody;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Chat messages are required" });
    return;
  }

  const validMessages = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .filter(m => typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-20); // max 20 messages for context window

  if (validMessages.length === 0) {
    res.status(400).json({ error: "No valid messages found" });
    return;
  }

  let contextNote = "";
  if (context?.searchMode) {
    const modeLabels: Record<string, string> = {
      key_people: "Key People",
      by_company: "By Company/Position",
      specific_person: "Specific Person",
    };
    contextNote += `\n[Contexto: El usuario está usando el modo de búsqueda "${modeLabels[context.searchMode] ?? context.searchMode}"]`;
  }
  if (context?.searchQuery) {
    contextNote += `\n[Context: User is searching for "${context.searchQuery}"]`;
  }
  if (context?.totalProspects !== undefined) {
    contextNote += `\n[Context: There are ${context.totalProspects} prospects available]`;
  }

  const systemContent = SYSTEM_PROMPT + (contextNote ? `\n\n${contextNote}` : "");

  try {
    // Use streaming for better UX
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const stream = await openai.chat.completions.create({
      model: AI_MODELS.CHAT,
      max_completion_tokens: 800,
      messages: [
        { role: "system", content: systemContent },
        ...validMessages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
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
