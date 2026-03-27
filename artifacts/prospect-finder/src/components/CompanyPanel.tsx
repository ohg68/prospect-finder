import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Loader2, Globe, Newspaper, Building2,
  CheckCircle, AlertTriangle, AlertOctagon, RefreshCw, X,
  ExternalLink, Users, MapPin, Calendar, TrendingUp, Link2,
  Briefcase
} from "lucide-react";

interface CompanyInfo {
  company: string;
  name: string;
  description: string | null;
  website: string | null;
  linkedinUrl: string | null;
  industry: string | null;
  employeeCount: string | null;
  headquarters: string | null;
  foundedYear: string | null;
  revenue: string | null;
  keyExecutives: Array<{ name: string; position: string }>;
  socialProfiles: Array<{ platform: string; url: string }>;
  recentNews: Array<{ title: string; url: string; source?: string; date?: string; snippet?: string }>;
  summary: string;
  confidence: "high" | "medium" | "low";
  sources: string[];
  researchedAt: string;
}

interface CompanyPanelProps {
  companyName: string;
  country?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CompanyPanel({ companyName, country, isOpen, onClose }: CompanyPanelProps) {
  const [data, setData] = useState<CompanyInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [loadingStep, setLoadingStep] = useState(0);

  const steps = [
    "Consultando fuentes públicas...",
    "Buscando datos en DuckDuckGo...",
    "Extrayendo información corporativa...",
    "Analizando perfiles sociales...",
    "Buscando noticias relevantes (2024-2025)...",
    "Generando resumen estratégico con IA..."
  ];

  useEffect(() => {
    let interval: any;
    if (status === "loading") {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (isOpen) {
      runResearch();
    } else {
      setTimeout(() => {
        setData(null);
        setStatus("idle");
        setLoadingStep(0);
      }, 300);
    }
  }, [isOpen, companyName]);

  const runResearch = async () => {
    setStatus("loading");
    setData(null);
    try {
      const res = await fetch("/api/companies/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: companyName, country }),
      });
      if (!res.ok) throw new Error("Error al investigar empresa");
      const json = await res.json();
      setData(json);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const getConfidenceColor = (c?: string) => {
    if (c === "high") return "bg-green-100 text-green-800 border-green-200";
    if (c === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-red-100 text-red-800 border-red-200";
  };
  const getConfidenceIcon = (c?: string) => {
    if (c === "high") return <CheckCircle className="h-4 w-4" />;
    if (c === "medium") return <AlertTriangle className="h-4 w-4" />;
    return <AlertOctagon className="h-4 w-4" />;
  };
  const getConfidenceLabel = (c?: string) => {
    if (c === "high") return "Alta Confianza";
    if (c === "medium") return "Confianza Media";
    return "Baja Confianza";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Perfil de Empresa
            </h2>
            <p className="text-sm text-slate-600 mt-1 font-semibold">{companyName}</p>
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
                <div className="absolute inset-0 rounded-full blur-2xl bg-blue-500/20 animate-pulse"></div>
                <Loader2 className="h-14 w-14 text-blue-600 animate-spin relative z-10" />
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">Investigando empresa</h3>
              <p className="text-slate-500 text-sm max-w-xs mb-8">
                Estamos recopilando toda la información pública disponible sobre <span className="font-semibold">{companyName}</span>.
              </p>

              <div className="w-full max-w-sm space-y-3 bg-slate-50 rounded-2xl p-6 border border-slate-100 mx-auto">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full transition-all duration-500 ${
                      idx < loadingStep ? "bg-green-500" : 
                      idx === loadingStep ? "bg-blue-600 animate-pulse scale-125" : 
                      "bg-slate-200"
                    }`} />
                    <span className={`text-xs font-medium transition-all duration-500 text-left ${
                      idx < loadingStep ? "text-slate-400 line-through" : 
                      idx === loadingStep ? "text-blue-700 font-bold" : 
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
              <h3 className="text-lg font-semibold text-slate-900">Error al investigar empresa</h3>
              <p className="mt-2 text-slate-500 max-w-sm">
                No se pudo obtener información. Puede ser temporal.
              </p>
              <button
                onClick={runResearch}
                className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Reintentar
              </button>
            </div>
          )}

          {status === "success" && data && (
            <div className="space-y-6">

              {/* Summary banner */}
              <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h3 className="font-bold text-slate-900 text-base">{data.name}</h3>
                  {data.confidence && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getConfidenceColor(data.confidence)}`}>
                      {getConfidenceIcon(data.confidence)}
                      {getConfidenceLabel(data.confidence)}
                    </span>
                  )}
                </div>
                {data.description && (
                  <p className="text-sm text-blue-900 leading-relaxed mb-3">{data.description}</p>
                )}
                {data.summary && data.summary !== data.description && (
                  <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
                )}
              </div>

              {/* Key facts grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.industry && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">
                      <Briefcase className="h-3.5 w-3.5" /> Industria
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{data.industry}</p>
                  </div>
                )}
                {data.employeeCount && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">
                      <Users className="h-3.5 w-3.5" /> Empleados
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{data.employeeCount}</p>
                  </div>
                )}
                {data.headquarters && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">
                      <MapPin className="h-3.5 w-3.5" /> Sede
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{data.headquarters}</p>
                  </div>
                )}
                {data.foundedYear && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">
                      <Calendar className="h-3.5 w-3.5" /> Fundación
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{data.foundedYear}</p>
                  </div>
                )}
                {data.revenue && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">
                      <TrendingUp className="h-3.5 w-3.5" /> Facturación
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{data.revenue}</p>
                  </div>
                )}
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-2">
                {data.website && (
                  <a
                    href={data.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-sm transition-colors border border-slate-200"
                  >
                    <Globe className="h-4 w-4" /> Sitio Web
                  </a>
                )}
                {data.linkedinUrl && (
                  <a
                    href={data.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20 font-medium text-sm transition-colors border border-[#0077b5]/20"
                  >
                    <Link2 className="h-4 w-4" /> LinkedIn
                  </a>
                )}
                {data.socialProfiles?.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-sm transition-colors border border-slate-200 capitalize"
                  >
                    <Globe className="h-4 w-4" /> {s.platform}
                  </a>
                ))}
              </div>

              {/* Key executives */}
              {data.keyExecutives?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                    <Users className="h-4 w-4" /> Directivos Clave
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.keyExecutives.map((exec, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3">
                        <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {exec.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{exec.name}</p>
                          <p className="text-xs text-slate-500">{exec.position}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent news */}
              {data.recentNews?.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                    <Newspaper className="h-4 w-4" /> Noticias Recientes
                  </h4>
                  <div className="grid gap-3">
                    {data.recentNews.map((item, i) => (
                      <a
                        key={i}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <h5 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 text-sm">
                            {item.title}
                          </h5>
                          <ExternalLink className="h-4 w-4 text-slate-400 shrink-0 group-hover:text-blue-500" />
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
              Datos obtenidos por IA. Verifica antes de usar.
            </p>
            <button
              onClick={runResearch}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-blue-600 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
