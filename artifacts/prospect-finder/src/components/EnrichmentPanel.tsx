import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Loader2, Mail, Phone, Globe, Newspaper, 
  CheckCircle, AlertTriangle, AlertOctagon, RefreshCw, X, Sparkles,
  ExternalLink, Link2, Search, Target, Building2, Zap, TrendingUp,
  DollarSign, Users, Package, AlertCircle, UserCheck, ChevronRight
} from "lucide-react";
import type { EnrichmentResult } from "@workspace/api-client-react";

interface SearchLink {
  platform: string;
  label: string;
  url: string;
  color: string;
}

interface TriggerEvent {
  type: string;
  title: string;
  description: string;
  date?: string;
  source?: string;
  impact: "high" | "medium" | "low";
}

type EnrichmentData = EnrichmentResult & { 
  searchLinks?: SearchLink[];
  salesApproach?: string;
  companyPhone?: string;
  triggerEvents?: TriggerEvent[];
};

interface EnrichmentPanelProps {
  prospectId: number;
  prospectName: string;
  prospectCompany?: string;
  prospectPosition?: string;
  prospectDepartment?: string;
  prospectSeniority?: string;
  isOpen: boolean;
  onClose: () => void;
  defaultAction?: "enrich" | "view";
}

export function EnrichmentPanel({
  prospectId,
  prospectName,
  prospectCompany,
  prospectPosition,
  prospectDepartment,
  prospectSeniority,
  isOpen,
  onClose,
  defaultAction = "enrich"
}: EnrichmentPanelProps) {
  const [data, setData] = useState<EnrichmentData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "not_found">("idle");
  const [loadingStep, setLoadingStep] = useState(0);

  const steps = [
    "Iniciando proceso de enriquecimiento...",
    "Buscando correos electrónicos y teléfonos...",
    "Identificando perfiles en redes sociales...",
    "Escaneando prensa y noticias recientes...",
    "Detectando señales de compra (Triggers)...",
    "Generando estrategia de abordaje con IA..."
  ];

  useEffect(() => {
    let interval: any;
    if (status === "loading") {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (isOpen) {
      if (defaultAction === "enrich") {
        runEnrichment();
      } else {
        loadEnrichmentData();
      }
    } else {
      setTimeout(() => {
        setData(null);
        setStatus("idle");
        setLoadingStep(0);
      }, 300);
    }
  }, [isOpen, prospectId, defaultAction]);

  const runEnrichment = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/prospects/${prospectId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error("Error enriching data");
      const json = await res.json() as EnrichmentData;
      setData(json);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const loadEnrichmentData = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/prospects/${prospectId}/enrichment`);
      if (res.status === 404) { setStatus("not_found"); return; }
      if (!res.ok) throw new Error("Error loading enrichment data");
      const json = await res.json() as EnrichmentData;
      setData(json);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const getConfidenceColor = (confidence?: string) => {
    if (confidence === "high") return "bg-green-100 text-green-800 border-green-200";
    if (confidence === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
    if (confidence === "low") return "bg-red-100 text-red-800 border-red-200";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  const getConfidenceIcon = (confidence?: string) => {
    if (confidence === "high") return <CheckCircle className="h-4 w-4" />;
    if (confidence === "medium") return <AlertTriangle className="h-4 w-4" />;
    if (confidence === "low") return <AlertOctagon className="h-4 w-4" />;
    return null;
  };

  const getConfidenceLabel = (confidence?: string) => {
    if (confidence === "high") return "Alta Confianza";
    if (confidence === "medium") return "Confianza Media";
    if (confidence === "low") return "Baja Confianza";
    return "No evaluado";
  };

  const platformIcon = (platform: string) => {
    if (platform === "LinkedIn") return (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    );
    if (platform === "Twitter/X") return (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    );
    return <Globe className="h-4 w-4" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              Análisis de Prospecto
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Perfil de <span className="font-semibold text-slate-700">{prospectName}</span>
              {prospectCompany && <span className="text-slate-400"> · {prospectCompany}</span>}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 rounded-full blur-2xl bg-indigo-500/20 animate-pulse"></div>
                <Loader2 className="h-14 w-14 text-indigo-600 animate-spin relative z-10" />
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">Enriqueciendo prospecto</h3>
              <p className="text-slate-500 text-sm max-w-xs mb-8">
                Nuestra IA está investigando a <span className="font-semibold text-slate-700">{prospectName}</span> para encontrar datos clave.
              </p>

              <div className="w-full max-w-sm space-y-3 bg-slate-50 rounded-2xl p-6 border border-slate-100 mx-auto">
                {steps.map((step: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full transition-all duration-500 ${
                      idx < loadingStep ? "bg-green-500" : 
                      idx === loadingStep ? "bg-indigo-600 animate-pulse scale-125" : 
                      "bg-slate-200"
                    }`} />
                    <span className={`text-xs font-medium transition-all duration-500 text-left ${
                      idx < loadingStep ? "text-slate-400 line-through" : 
                      idx === loadingStep ? "text-indigo-700 font-bold" : 
                      "text-slate-400"
                    }`}>
                      {step}
                    </span>
                    {idx < loadingStep && <CheckCircle className="h-3 w-3 text-green-500 ml-auto shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Error al enriquecer datos</h3>
              <p className="mt-2 text-slate-500 max-w-sm">Hubo un problema al intentar buscar información. Puede ser temporal.</p>
              <button 
                onClick={runEnrichment}
                className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Re-buscar
              </button>
            </div>
          )}

          {status === "not_found" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
                <Globe className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Sin datos enriquecidos</h3>
              <p className="mt-2 text-slate-500 max-w-sm">Aún no hemos analizado la información pública de este prospecto.</p>
              <button 
                onClick={runEnrichment}
                className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all"
              >
                <Sparkles className="h-4 w-4" /> Enriquecer ahora
              </button>
            </div>
          )}

          {status === "success" && data && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* === SALES APPROACH — TOP PRIORITY === */}
              {data.salesApproach && (
                <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                      <Target className="h-4 w-4 text-white" />
                    </div>
                    <h4 className="font-bold text-indigo-900 text-base">Estrategia de Abordaje Comercial</h4>
                  </div>
                  <p className="text-indigo-800 leading-relaxed text-sm">{data.salesApproach}</p>
                </div>
              )}

              {/* === CONTACT INFO === */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Phone */}
                <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3 shadow-sm">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Phone className="h-3.5 w-3.5" /> Teléfono de Contacto
                  </h4>
                  {data.phone ? (
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                        <Phone className="h-4 w-4 text-green-700" />
                      </div>
                      <div>
                        <a href={`tel:${data.phone}`} className="font-semibold text-slate-900 hover:text-green-700 transition-colors">
                          {data.phone}
                        </a>
                        <p className="text-[11px] text-green-600 font-medium mt-0.5">Directo / Personal</p>
                      </div>
                    </div>
                  ) : data.companyPhone ? (
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-blue-700" />
                      </div>
                      <div>
                        <a href={`tel:${data.companyPhone}`} className="font-semibold text-slate-900 hover:text-blue-700 transition-colors">
                          {data.companyPhone}
                        </a>
                        <p className="text-[11px] text-blue-600 font-medium mt-0.5">Centralita / Empresa</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No se encontró teléfono público</p>
                  )}
                  {/* Show company phone as secondary if personal was found */}
                  {data.phone && data.companyPhone && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-2">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <a href={`tel:${data.companyPhone}`} className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
                        {data.companyPhone}
                      </a>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Empresa</span>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3 shadow-sm">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Mail className="h-3.5 w-3.5" /> Correo Electrónico
                  </h4>
                  {data.email ? (
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-green-700" />
                      </div>
                      <div>
                        <a href={`mailto:${data.email}`} className="font-semibold text-slate-900 hover:text-green-700 transition-colors text-sm break-all">
                          {data.email}
                        </a>
                        <p className="text-[11px] text-green-600 font-medium mt-0.5">Email verificado</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Email directo no encontrado</p>
                  )}
                  {data.alternativeEmails && data.alternativeEmails.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 mt-2 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Patrones probables:</p>
                      {data.alternativeEmails.map((email: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></div>
                          <a href={`mailto:${email}`} className="text-xs text-slate-600 hover:text-amber-700 italic transition-colors break-all">
                            {email}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Search Links */}
              {data.searchLinks && data.searchLinks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Search className="h-3.5 w-3.5" /> Buscar en plataformas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {data.searchLinks.map((link: any) => (
                      <a
                        key={link.platform}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-sm"
                        style={{
                          backgroundColor: link.color + "12",
                          borderColor: link.color + "30",
                          color: link.color,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = link.color + "22")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = link.color + "12")}
                      >
                        {platformIcon(link.platform)}
                        {link.label}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Profile Summary */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <h3 className="font-display font-bold text-slate-900">Resumen del Perfil</h3>
                  {data.confidence && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getConfidenceColor(data.confidence)}`}>
                      {getConfidenceIcon(data.confidence)}
                      {getConfidenceLabel(data.confidence)}
                    </span>
                  )}
                </div>
                {data.summary ? (
                  <p className="text-slate-700 leading-relaxed text-sm">{data.summary}</p>
                ) : (
                  <p className="text-slate-400 italic text-sm">No hay resumen disponible.</p>
                )}
              </div>

              {/* Social Profiles */}
              {(data.linkedinUrl || (data.socialProfiles && data.socialProfiles.length > 0)) && (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Globe className="h-3.5 w-3.5" /> Perfiles Sociales
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {data.linkedinUrl && (
                      <a 
                        href={data.linkedinUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20 font-medium text-sm transition-colors border border-[#0077b5]/20"
                      >
                        <Link2 className="h-4 w-4" /> LinkedIn
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    )}
                    {data.socialProfiles && data.socialProfiles.map((social: any, idx: number) => (
                      <a
                        key={idx}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-sm transition-colors border border-slate-200 capitalize"
                      >
                        <Globe className="h-4 w-4 text-slate-500" /> {social.platform}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Trigger Events / Buy Signals */}
              {data.triggerEvents && data.triggerEvents.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Zap className="h-3.5 w-3.5 text-amber-500" /> Señales de Compra · Trigger Events
                  </h4>
                  <div className="grid gap-2.5">
                    {data.triggerEvents.map((ev: any, idx: number) => {
                      const impactMap = {
                        high:   { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    badge: "bg-red-100 text-red-700",    label: "Alto impacto" },
                        medium: { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  badge: "bg-amber-100 text-amber-700",  label: "Impacto medio" },
                        low:    { bg: "bg-slate-50",  border: "border-slate-200",  text: "text-slate-600",  badge: "bg-slate-100 text-slate-600",  label: "Bajo impacto" },
                      };
                      const typeIconMap: Record<string, React.ElementType> = {
                        funding: DollarSign,
                        expansion: TrendingUp,
                        leadership_change: UserCheck,
                        new_product: Package,
                        industry_change: AlertCircle,
                        personal_change: Users,
                      };
                      const c = (impactMap as any)[ev.impact] ?? impactMap.low;
                      const Icon = typeIconMap[ev.type] ?? Zap;
                      return (
                        <div key={idx} className={`rounded-xl border p-3.5 ${c.bg} ${c.border}`}>
                          <div className="flex items-start gap-3">
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${c.badge}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className={`text-sm font-semibold leading-snug ${c.text}`}>{ev.title}</p>
                                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${c.badge}`}>{c.label}</span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">{ev.description}</p>
                              {(ev.date || ev.source) && (
                                <div className="flex items-center gap-3 mt-1.5">
                                  {ev.date && <span className="text-[11px] text-slate-400">{ev.date}</span>}
                                  {ev.source && <span className="text-[11px] text-slate-400 italic">{ev.source}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Press & Mentions */}
              {data.pressItems && data.pressItems.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Newspaper className="h-3.5 w-3.5" /> Notas de Prensa y Menciones
                  </h4>
                  <div className="grid gap-3">
                    {data.pressItems.map((item: any, idx: number) => (
                      <a 
                        key={idx}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <h5 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 text-sm">
                            {item.title}
                          </h5>
                          <ExternalLink className="h-4 w-4 text-slate-400 shrink-0 group-hover:text-indigo-500" />
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 font-medium">
                          {item.source && <span className="bg-slate-100 px-2 py-0.5 rounded">{item.source}</span>}
                          {item.date && <span>{item.date}</span>}
                        </div>
                        {item.snippet && (
                          <p className="mt-2 text-xs text-slate-600 line-clamp-2">{item.snippet}</p>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              
            </div>
          )}
        </div>

        {/* Footer */}
        {status === "success" && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Datos obtenidos mediante IA. Verificar antes de usar.
            </p>
            <button
              onClick={runEnrichment}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-indigo-600 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
