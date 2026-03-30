import { Router } from "express";
import { db as dbInstance, conversations as cT, messages as mT, whatsappConfigurations as waCT, eq as dEq, and as dAnd, sql as dSql } from "../../../../lib/db/src/index.js";
const db: any = dbInstance;
const conversations: any = cT;
const messages: any = mT;
const whatsappConfigurations: any = waCT;
const eq: any = dEq;
const and: any = dAnd;
const sql: any = dSql;
import { getAIClient, getModel } from "../config/ai-config.js";

const router = Router();

// Helper to get active WhatsApp config or fallback to env
async function getActiveWhatsAppConfig() {
  const result = await db.execute(sql`SELECT * FROM whatsapp_configurations WHERE is_active = true LIMIT 1`);
  const dbConfig = result.rows[0];
  return {
    apiToken: dbConfig?.api_token || process.env.WHATSAPP_API_TOKEN || "",
    phoneNumberId: dbConfig?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    verifyToken: dbConfig?.verify_token || process.env.WHATSAPP_VERIFY_TOKEN || "prospect-finder-token",
  };
}

// Meta Webhook Validation
router.get("/webhook", async (req: any, res: any) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const config = await getActiveWhatsAppConfig();
  const VERIFY_TOKEN = config.verifyToken;

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Meta Webhook - Receive Messages
router.post("/webhook", async (req: any, res: any) => {
  const body = req.body;

  if (body.object === "whatsapp_business_account") {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.value.messages) {
          for (const msg of change.value.messages) {
            const from = msg.from; // Sender phone number
            const text = msg.text?.body;
            const messageId = msg.id;

            if (text) {
              await handleIncomingMessage(from, text, messageId);
            }
          }
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

async function handleIncomingMessage(from: string, text: string, externalId: string) {
  // 1. Find or create conversation
  let [conversation] = (await db.select().from(conversations).where(eq(conversations.externalId, from))) as any[];

  if (!conversation) {
    const results = (await db.insert(conversations).values({
      title: `WhatsApp: ${from}`,
      externalId: from,
      status: "active",
      isAutoAgentEnabled: "true", // Enable by default for new conversations
    }).returning()) as any[];
    conversation = results[0];
  }

  // 2. Save message
  await db.insert(messages).values({
    conversationId: conversation.id,
    role: "user",
    content: text,
  });

  // 3. Trigger Agent if enabled
  if (conversation.isAutoAgentEnabled === "true") {
    await triggerAgent(conversation.id, from);
  }
}

async function triggerAgent(conversationId: number, to: string) {
  // 1. Get history
  const history: any[] = await db.select().from(messages).where(eq(messages.conversationId as any, conversationId as any) as any).orderBy(messages.createdAt as any);

  const aiMessages = history.map((m: any) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  // 2. Add system prompt
  const systemPrompt = {
    role: "system" as const,
    content: "Eres un agente de ventas automatizado para Prospect Finder. Tu objetivo es calificar prospectos y agendar reuniones. Sé breve, amable y profesional. Responde siempre en el idioma del usuario.",
  };

  // 3. Call AI
  const client = await getAIClient();
  const model = await getModel();
  const completion = await client.chat.completions.create({
    model,
    messages: [systemPrompt, ...aiMessages],
  });

  const responseText = completion.choices[0]?.message?.content;

  if (responseText) {
    // 4. Save AI Response
    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: responseText,
    });

    // 5. Send back to WhatsApp
    await sendWhatsAppMessage(to, responseText);
  }
}

async function sendWhatsAppMessage(to: string, text: string) {
  const config = await getActiveWhatsAppConfig();
  const token = config.apiToken;
  const phoneId = config.phoneNumberId;

  if (!token || !phoneId) {
    console.log(`[WhatsApp Mock] Sending to ${to}: ${text}`);
    return;
  }

  try {
    const res = (await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: text },
      }),
    })) as any;

    if (!res.ok) {
      const errData = await res.json();
      console.error("WhatsApp API Error:", errData);
    }
  } catch (err) {
    console.error("WhatsApp Send Error:", err);
  }
}

// GET /conversations - List all
router.get("/conversations", async (req: any, res: any) => {
  try {
    const list = await db.select().from(conversations).orderBy(conversations.createdAt);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /conversations/:id/messages - Get history
router.get("/conversations/:id/messages", async (req: any, res: any) => {
  const id = Number(req.params.id);
  try {
    const history = await db.select().from(messages).where(eq(messages.conversationId, id) as any).orderBy(messages.createdAt);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /conversations/:id/toggle-agent - Enable/disable AI
router.post("/conversations/:id/toggle-agent", async (req: any, res: any) => {
  const id = Number(req.params.id);
  const { enabled } = req.body;
  try {
    await db.update(conversations).set({ isAutoAgentEnabled: enabled ? "true" : "false" }).where(eq(conversations.id, id) as any);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /send - Send manual message
router.post("/send", async (req: any, res: any) => {
  const { to, text } = req.body;
  if (!to || !text) {
    res.status(400).json({ error: "Missing to or text" });
    return;
  }

  await sendWhatsAppMessage(to, text);
  res.json({ status: "sent" });
});

export default router;
