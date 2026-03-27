import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  X, Loader2, Mail, MessageSquare, Phone, Calendar, 
  Copy, Check, RefreshCw, MessageCircle, Zap, ChevronRight
} from "lucide-react";

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

interface MessagesPanelProps {
  prospectId: number;
  prospectName: string;
  prospectPosition?: string;
  prospectCompany?: string;
  isOpen: boolean;
  onClose: () => void;
}

const CHANNEL_ICONS = {
  email: Mail,
  linkedin: MessageSquare,
  telefono: Phone,
  whatsapp: MessageCircle,
};

const CHANNEL_COLORS = {
  email: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "#2563eb" },
  linkedin: { bg: "bg-[#0077b5]/10", border: "border-[#0077b5]/30", text: "text-[#0077b5]", icon: "#0077b5" },
  telefono: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: "#15803d" },
  whatsapp: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: "#25d366" },
};

const CHANNEL_LABELS = {
  email: "Email", linkedin: "LinkedIn", telefono: "Teléfono", whatsapp: "WhatsApp",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
    >
      {copied ? <><Check className="h-3.5 w-3.5 text-green-600" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
    </button>
  );
}

type Tab = "email" | "linkedin" | "whatsapp" | "cadence";

export function MessagesPanel({
  prospectId,
  prospectName,
  prospectPosition,
  prospectCompany,
  isOpen,
  onClose,
}: MessagesPanelProps) {
  const [data, setData] = useState<GeneratedMessages | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [activeTab, setActiveTab] = useState<Tab>("email");

  useEffect(() => {
    if (isOpen && status === "idle") generateMessages();
    if (!isOpen) { setTimeout(() => { setData(null); setStatus("idle"); }, 300); }
  }, [isOpen]);

  const generateMessages = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/prospects/${prospectId}/messages`, { method: "POST" });
      if (!res.ok) throw new Error("Error");
      const json = await res.json() as GeneratedMessages;
      setData(json);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "email", label: "Email Frío", icon: Mail },
    { id: "linkedin", label: "LinkedIn", icon: MessageSquare },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "cadence", label: "Cadencia (6 pasos)", icon: Calendar },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative flex flex-col w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50">
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-indigo-600" />
              Mensajes de Prospección en Frío
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Para <span className="font-semibold text-slate-700">{prospectName}</span>
              {prospectPosition && <span className="text-slate-400"> · {prospectPosition}</span>}
              {prospectCompany && <span className="text-slate-400"> · {prospectCompany}</span>}
            </p>
          </div>
          <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full blur-xl bg-indigo-500/20 animate-pulse" />
                <Loader2 className="h-12 w-12 text-indigo-600 animate-spin relative z-10" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Generando mensajes personalizados...</h3>
              <p className="mt-2 text-slate-500 max-w-sm text-sm">La IA está analizando el perfil y creando email frío, mensajes de LinkedIn, WhatsApp y secuencia de cadencia.</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <p className="text-slate-500 mb-4">Error al generar los mensajes.</p>
              <button onClick={generateMessages} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">
                <RefreshCw className="h-4 w-4" /> Reintentar
              </button>
            </div>
          )}

          {status === "success" && data && (
            <div className="flex flex-col h-full">
              {/* Icebreaker Banner */}
              {data.icebreaker && (
                <div className="mx-6 mt-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <Zap className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Icebreaker</p>
                    <p className="text-sm text-amber-900 italic">"{data.icebreaker}"</p>
                  </div>
                  <CopyButton text={data.icebreaker} />
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 px-6 mt-4 border-b border-slate-100">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-t-xl transition-all border-b-2 ${
                      activeTab === t.id 
                        ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 p-6 space-y-4">
                {/* Email Tab */}
                {activeTab === "email" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Asunto</span>
                        </div>
                        <CopyButton text={data.email.subject} />
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-slate-900 font-semibold">{data.email.subject}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cuerpo del Email</span>
                        <CopyButton text={data.email.body} />
                      </div>
                      <div className="px-4 py-4">
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{data.email.body}</pre>
                      </div>
                    </div>
                    <CopyButton text={`Asunto: ${data.email.subject}\n\n${data.email.body}`} />
                  </div>
                )}

                {/* LinkedIn Tab */}
                {activeTab === "linkedin" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[#0077b5]/30 overflow-hidden shadow-sm bg-[#0077b5]/5">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-[#0077b5]/20">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-[#0077b5]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                          <span className="text-xs font-bold text-[#0077b5] uppercase tracking-wider">Mensaje de LinkedIn</span>
                        </div>
                        <CopyButton text={data.linkedin.message} />
                      </div>
                      <div className="px-4 py-4">
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{data.linkedin.message}</pre>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 italic">💡 Envía primero la solicitud de conexión y usa este mensaje como primer mensaje post-conexión.</p>
                  </div>
                )}

                {/* WhatsApp Tab */}
                {activeTab === "whatsapp" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-200 overflow-hidden shadow-sm bg-emerald-50">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-200">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Mensaje de WhatsApp</span>
                        </div>
                        <CopyButton text={data.whatsapp.message} />
                      </div>
                      <div className="px-4 py-4">
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{data.whatsapp.message}</pre>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 italic">💡 Úsalo solo si tienes su número y cierta relación previa, o tras contacto por email.</p>
                  </div>
                )}

                {/* Cadence Tab */}
                {activeTab === "cadence" && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500 mb-4">Secuencia de 6 toques distribuidos en 17 días para maximizar la respuesta sin ser invasivo.</p>
                    {data.cadence.map((step, idx) => {
                      const colors = CHANNEL_COLORS[step.channel] ?? CHANNEL_COLORS.email;
                      const Icon = CHANNEL_ICONS[step.channel] ?? Mail;
                      return (
                        <div key={idx} className="flex gap-4 group">
                          <div className="flex flex-col items-center">
                            <div className={`h-9 w-9 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center shrink-0 font-bold text-sm ${colors.text}`}>
                              {step.day}
                            </div>
                            {idx < data.cadence.length - 1 && (
                              <div className="flex-1 w-0.5 bg-slate-200 my-1" />
                            )}
                          </div>
                          <div className={`flex-1 rounded-2xl ${colors.bg} border ${colors.border} p-4 mb-1`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${colors.text}`} />
                                <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                                  Día {step.day} · {CHANNEL_LABELS[step.channel]}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 italic">{step.objective}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-800 mb-1">{step.action}</p>
                            <div className="flex items-start justify-between gap-2 mt-2 bg-white/70 rounded-xl p-3 border border-white">
                              <p className="text-xs text-slate-600 leading-relaxed flex-1">{step.template}</p>
                              <CopyButton text={step.template} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === "success" && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-400">Mensajes generados por IA. Personaliza antes de enviar.</p>
            <button onClick={() => { setData(null); setStatus("idle"); generateMessages(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors shadow-sm">
              <RefreshCw className="h-4 w-4" /> Regenerar
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
