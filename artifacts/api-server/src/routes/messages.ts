import { Router } from "express";
import { getAIClient, getModel } from "../config/ai-config.js";
import { db as dbInstance, prospectsTable as pT, prospectEnrichmentsTable as pET, eq as dEq } from "@workspace/db";
const db: any = dbInstance;
const prospectsTable: any = pT;
const prospectEnrichmentsTable: any = pET;
const eq: any = dEq;

const router = Router();

interface CadenceStep {
  day: number;
  channel: "email" | "linkedin" | "telefono" | "whatsapp";
  action: string;
  template: string;
  objective: string;
}

interface GeneratedMessages {
  email: { subject: string; body: string };
  linkedin: { message: string };
  whatsapp: { message: string };
  cadence: CadenceStep[];
  icebreaker: string;
}

async function generateColdMessages(prospect: {
  name: string;
  position: string | null;
  company: string;
  department: string | null;
  country: string | null;
  seniority: string | null;
  industry: string | null;
  email: string | null;
  linkedinUrl: string | null;
}, enrichment: {
  summary?: string | null;
  salesApproach?: string | null;
  pressItems?: Array<{ title: string; snippet?: string; date?: string }>;
  triggerEvents?: Array<{ type: string; title: string; description: string }>;
} | null): Promise<GeneratedMessages> {
  const firstName = prospect.name.split(" ")[0] ?? prospect.name;
  const pressContext = (enrichment?.pressItems ?? []).slice(0, 2)
    .map(p => `- ${p.title}${p.snippet ? ": " + p.snippet : ""}`)
    .join("\n");
  const triggerContext = (enrichment?.triggerEvents ?? []).slice(0, 2)
    .map(t => `- ${t.type}: ${t.title} — ${t.description}`)
    .join("\n");

  const prompt = `Eres un experto en prospección en frío B2B. Genera mensajes de primer contacto altamente personalizados para este prospecto:

PROSPECTO:
- Nombre: ${prospect.name} (llámale ${firstName})
- Cargo: ${prospect.position ?? "Directivo"} en ${prospect.company}
- Departamento: ${prospect.department ?? "N/A"}
- Seniority: ${prospect.seniority ?? "Senior"}
- País: ${prospect.country ?? "España"}
- Sector: ${prospect.industry ?? "B2B"}
${enrichment?.summary ? `- Resumen: ${enrichment.summary}` : ""}
${enrichment?.salesApproach ? `- Estrategia recomendada: ${enrichment.salesApproach}` : ""}
${pressContext ? `\nNOTICIAS RECIENTES:\n${pressContext}` : ""}
${triggerContext ? `\nSEÑALES DE COMPRA:\n${triggerContext}` : ""}

INSTRUCCIONES:
- Tono: profesional pero cercano, evita sonar a plantilla genérica
- Referencia algo específico de su empresa o sector para mostrar que investigaste
- NO menciones el nombre de tu empresa ni tu producto/servicio en el primer contacto
- El objetivo es despertar curiosidad y conseguir una respuesta, no vender
- Email: máximo 120 palabras en el body
- LinkedIn: máximo 60 palabras, tono más informal
- WhatsApp: máximo 40 palabras, muy directo y breve
- Icebreaker: 1 pregunta o comentario de apertura de conversación (15-20 palabras)
- Cadencia: 6 pasos con el día exacto, canal, acción concreta y template corto

Responde SOLO con este JSON válido (sin markdown):
{
  "email": {
    "subject": "Asunto del email (max 8 palabras, sin signos de interrogación)",
    "body": "Cuerpo del email (120 palabras max, párrafos cortos, termina con pregunta concreta o CTA suave)"
  },
  "linkedin": {
    "message": "Mensaje de LinkedIn (60 palabras max, directo, referencia algo específico)"
  },
  "whatsapp": {
    "message": "Mensaje de WhatsApp (40 palabras max, casual, termina con pregunta sí/no)"
  },
  "icebreaker": "Pregunta o comentario de apertura (15-20 palabras)",
  "cadence": [
    {"day":1,"channel":"email","action":"Primer contacto por email","template":"Enviar email frío personalizado con asunto generado","objective":"Despertar interés"},
    {"day":3,"channel":"linkedin","action":"Solicitud de conexión en LinkedIn","template":"Hola ${firstName}, vi tu trabajo en ${prospect.company}. Me encantaría conectar — trabajo con empresas similares en [sector].","objective":"Establecer presencia"},
    {"day":5,"channel":"linkedin","action":"Mensaje LinkedIn post-conexión","template":"Gracias por conectar, ${firstName}. Te envié un email el [día]. ¿Lo viste? Me encantaría mostrarte algo que podría interesarte.","objective":"Recordatorio suave"},
    {"day":8,"channel":"email","action":"Follow-up con ángulo diferente","template":"Asunto: Re: [algo específico del sector]. Body: referencia un problema concreto que tienen empresas como ${prospect.company} y propón una conversación de 15 min.","objective":"Segundo intento con nuevo valor"},
    {"day":12,"channel":"telefono","action":"Llamada corta (max 2 min)","template":"Buenos días, soy [nombre]. Le escribí sobre [tema]. ¿Tiene 2 minutos? Tengo algo relevante para [área específica de ${prospect.company}].","objective":"Contacto directo"},
    {"day":16,"channel":"email","action":"Email de ruptura (break-up)","template":"Asunto: ¿Lo dejo aquí? Body: Entiendo que esté ocupado. Si no es el momento, sin problema. Solo dígame y no le molesto más. Si le interesa saber cómo [resultado concreto], estoy disponible.","objective":"Decisión final — cerrar o reactivar"}
  ]
}`;

  try {
    const client = await getAIClient();
    const model = await getModel();

    const aiRes = await client.chat.completions.create({
      model,
      max_completion_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = aiRes.choices[0]?.message?.content ?? "";

    const jsonMatch = raw.match(/\{[\s\S]+\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedMessages;
    return parsed;
  } catch (err) {
    // Fallback basic template
    return {
      email: {
        subject: `Una idea para ${prospect.company}`,
        body: `Hola ${firstName},\n\nVi que lideras ${prospect.position ?? "el área"} en ${prospect.company} y quería contactarte directamente.\n\nTrabajos con empresas similares en ${prospect.industry ?? "tu sector"} y he visto que la mayoría se enfrenta a [problema concreto del área].\n\n¿Tendría sentido hablar 15 minutos para ver si lo que hacemos puede ser relevante para vosotros?\n\nQuedo a tu disposición.\n\nSaludos`,
      },
      linkedin: {
        message: `Hola ${firstName}, trabajo con empresas como ${prospect.company} en [resultado concreto]. ¿Tendría sentido conectar para compartir algo que podría interesarte?`,
      },
      whatsapp: {
        message: `Hola ${firstName}, trabajo con directivos de ${prospect.company}. ¿Te viene bien hablar 10 minutos esta semana?`,
      },
      icebreaker: `¿Cuál es el mayor reto que tiene ${prospect.company} en ${prospect.department ?? "su área"} este año?`,
      cadence: [
        { day: 1, channel: "email", action: "Email frío personalizado", template: "Enviar email con asunto generado", objective: "Primer contacto" },
        { day: 3, channel: "linkedin", action: "Solicitud de conexión", template: `Hola ${firstName}, vi tu perfil y me gustaría conectar.`, objective: "Presencia digital" },
        { day: 6, channel: "linkedin", action: "Mensaje post-conexión", template: `Gracias por conectar, ${firstName}. Te envié un email el lunes. ¿Lo viste?`, objective: "Recordatorio" },
        { day: 9, channel: "email", action: "Follow-up ángulo diferente", template: "Re: [tema específico sector] — nuevo enfoque del problema", objective: "Segundo intento" },
        { day: 13, channel: "telefono", action: "Llamada corta", template: `Buenos días, soy [nombre]. Le escribí sobre [tema]. ¿Tiene 2 minutos?`, objective: "Contacto directo" },
        { day: 17, channel: "email", action: "Email de cierre", template: "¿Lo dejamos aquí? — respuesta final pedida", objective: "Decisión final" },
      ],
    };
  }
}

// POST /prospects/:id/messages — generate cold outreach messages
router.post("/prospects/:id/messages", async (req: any, res: any) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id));
  if (!prospect) { res.status(404).json({ error: "Prospecto no encontrado" }); return; }

  const [enrichment] = await db
    .select()
    .from(prospectEnrichmentsTable)
    .where(eq(prospectEnrichmentsTable.prospectId, id));

  try {
    const messages = await generateColdMessages(prospect, enrichment ? {
      summary: enrichment.summary,
      salesApproach: enrichment.salesApproach,
      pressItems: enrichment.pressItems ?? [],
      triggerEvents: (enrichment.triggerEvents ?? []) as Array<{ type: string; title: string; description: string }>,
    } : null);

    res.json(messages);
  } catch (error) {
    console.error("Messages generation error:", error);
    res.status(500).json({ error: "Error al generar mensajes: " + String(error) });
  }
});

export default router;
