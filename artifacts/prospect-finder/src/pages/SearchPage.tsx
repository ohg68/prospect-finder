import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchProspects, getSearchProspectsQueryKey, SearchProspectsMode, Prospect } from "@workspace/api-client-react";
import { Link } from "wouter";
import { 
  Building2, Users, UserSquare, Search, 
  MapPin, Briefcase, Building, Globe2, Network,
  ArrowRight, Bookmark, Sparkles, ChevronRight, Loader2, Target
} from "lucide-react";
import { SaveProspectModal } from "@/components/SaveProspectModal";
import { EnrichmentPanel } from "@/components/EnrichmentPanel";
import { CompanyPanel } from "@/components/CompanyPanel";
import { MessagesPanel } from "@/components/MessagesPanel";
import { cn } from "@/lib/utils";

interface ApproachHint { label: string; color: string; bgColor: string; borderColor: string; }

function getApproachHint(position?: string | null, seniority?: string | null, department?: string | null): ApproachHint {
  const pos = (position ?? "").toLowerCase();
  const dept = (department ?? "").toLowerCase();
  if (seniority === "C-Level" || pos.includes("ceo") || pos.includes("founder") || pos.includes("fundador") || pos.includes("presidente") || pos.includes("president"))
    return { label: "Pitch ejecutivo: ROI y ventaja competitiva", color: "#6d28d9", bgColor: "#ede9fe", borderColor: "#c4b5fd" };
  if (pos.includes("cto") || pos.includes("cio") || pos.includes("chief tech") || dept === "it" || dept.includes("tecnolog") || pos.includes("tecnolog"))
    return { label: "Demo técnica: integración, seguridad y escala", color: "#1d4ed8", bgColor: "#dbeafe", borderColor: "#93c5fd" };
  if (pos.includes("cfo") || pos.includes("chief financial") || pos.includes("director financiero") || dept.includes("finanz"))
    return { label: "Pitch financiero: TCO, ahorro y amortización", color: "#047857", bgColor: "#d1fae5", borderColor: "#6ee7b7" };
  if (pos.includes("venta") || pos.includes("sales") || pos.includes("comercial") || dept.includes("venta") || dept.includes("comercial"))
    return { label: "Impacto en ventas: pipeline y conversión", color: "#065f46", bgColor: "#ecfdf5", borderColor: "#a7f3d0" };
  if (pos.includes("marketing") || dept.includes("marketing") || pos.includes("cmo"))
    return { label: "Demanda y marca: leads, CAC y conversión", color: "#be185d", bgColor: "#fce7f3", borderColor: "#f9a8d4" };
  if (pos.includes("hr") || pos.includes("rrhh") || pos.includes("recursos humanos") || pos.includes("people") || pos.includes("talent") || dept.includes("rrhh"))
    return { label: "Talento: retención, productividad y cultura", color: "#b45309", bgColor: "#fef3c7", borderColor: "#fcd34d" };
  if (pos.includes("director") || pos.includes("vp ") || pos.includes("vice president") || seniority === "Director" || seniority === "VP")
    return { label: "Propuesta de valor: métricas y casos de éxito", color: "#0369a1", bgColor: "#e0f2fe", borderColor: "#7dd3fc" };
  if (pos.includes("manager") || pos.includes("head of") || pos.includes("responsable") || seniority === "Manager" || seniority === "Head")
    return { label: "Solución práctica: ahorro de tiempo y automatización", color: "#0891b2", bgColor: "#cffafe", borderColor: "#67e8f9" };
  return { label: "Abordaje consultivo: diagnóstico y personalización", color: "#475569", bgColor: "#f1f5f9", borderColor: "#cbd5e1" };
}

const MODES = [
  { id: SearchProspectsMode.key_people, label: "Personas Clave", icon: Users },
  { id: SearchProspectsMode.by_company, label: "Por Empresa/Cargo", icon: Building2 },
  { id: SearchProspectsMode.specific_person, label: "Persona Concreta", icon: UserSquare },
] as const;

export default function SearchPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<typeof SearchProspectsMode[keyof typeof SearchProspectsMode]>(SearchProspectsMode.key_people);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [saveModal, setSaveModal] = useState<{ isOpen: boolean; prospect: Prospect | null }>({ isOpen: false, prospect: null });
  const [enrichModal, setEnrichModal] = useState<{ isOpen: boolean; prospect: Prospect | null }>({ isOpen: false, prospect: null });
  const [messagesModal, setMessagesModal] = useState<{ isOpen: boolean; prospect: Prospect | null }>({ isOpen: false, prospect: null });
  const [companyPanel, setCompanyPanel] = useState<{ isOpen: boolean; companyName: string; country?: string }>({ isOpen: false, companyName: "" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [newCount, setNewCount] = useState<number | null>(null);

  const [activeSearch, setActiveSearch] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useSearchProspects({
    mode,
    ...activeSearch,
    page,
    pageSize: 15
  });

  const generateProspects = async (currentMode: string, currentFilters: Record<string, string>) => {
    setIsGenerating(true);
    setNewCount(null);
    try {
      const res = await fetch("/api/prospects/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: currentMode, ...currentFilters, count: 12 }),
      });
      if (res.ok) {
        const json = await res.json();
        const generated: number = json.generated ?? 0;
        setNewCount(generated);
        if (generated > 0) {
          // Invalidate all prospect search queries so results refresh
          queryClient.invalidateQueries({ queryKey: getSearchProspectsQueryKey() });
        }
      }
    } catch {
      // silent fail — generation is a bonus feature
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setNewCount(null);
    const currentFilters = { ...filters };
    setActiveSearch(currentFilters);
    // Trigger AI generation in background
    generateProspects(mode, currentFilters);
  };

  const clearFilters = () => {
    setFilters({});
    setActiveSearch({});
    setPage(1);
    setNewCount(null);
  };

  const openCompanyPanel = (companyName: string, country?: string) => {
    setCompanyPanel({ isOpen: true, companyName, country });
  };

  const renderFilterInput = (name: string, label: string, Icon: React.ElementType, placeholder: string) => (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <Icon className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={filters[name] || ""}
          onChange={(e) => setFilters(prev => ({ ...prev, [name]: e.target.value }))}
          className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          placeholder={placeholder}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50/50 pb-20">
      {/* Save Modal */}
      {saveModal.prospect && (
        <SaveProspectModal
          isOpen={saveModal.isOpen}
          onClose={() => setSaveModal({ isOpen: false, prospect: null })}
          prospectId={saveModal.prospect.id}
          prospectName={saveModal.prospect.name}
        />
      )}

      {/* Enrich Modal */}
      {enrichModal.prospect && (
        <EnrichmentPanel
          isOpen={enrichModal.isOpen}
          onClose={() => setEnrichModal({ isOpen: false, prospect: null })}
          prospectId={enrichModal.prospect.id}
          prospectName={enrichModal.prospect.name}
          prospectCompany={enrichModal.prospect.company}
          prospectPosition={enrichModal.prospect.position ?? undefined}
          prospectDepartment={enrichModal.prospect.department ?? undefined}
          prospectSeniority={enrichModal.prospect.seniority ?? undefined}
          defaultAction="enrich"
        />
      )}

      {/* Messages Panel */}
      {messagesModal.prospect && (
        <MessagesPanel
          isOpen={messagesModal.isOpen}
          onClose={() => setMessagesModal({ isOpen: false, prospect: null })}
          prospectId={messagesModal.prospect.id}
          prospectName={messagesModal.prospect.name}
          prospectPosition={messagesModal.prospect.position ?? undefined}
          prospectCompany={messagesModal.prospect.company}
        />
      )}

      {/* Company Panel */}
      {companyPanel.isOpen && (
        <CompanyPanel
          isOpen={companyPanel.isOpen}
          onClose={() => setCompanyPanel({ isOpen: false, companyName: "" })}
          companyName={companyPanel.companyName}
          country={companyPanel.country}
        />
      )}

      {/* Header Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="max-w-3xl">
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
              Encuentra los prospectos <span className="text-primary">perfectos</span>.
            </h1>
            <p className="mt-3 text-lg text-slate-600">
              Busca y analiza perfiles B2B utilizando nuestro motor de segmentación avanzado.
            </p>
          </div>

          {/* Mode Selector */}
          <div className="mt-8 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5 w-fit">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  clearFilters();
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200",
                  mode === m.id 
                    ? "bg-white text-primary shadow-sm ring-1 ring-slate-900/5" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>

          {/* Filters Form */}
          <form onSubmit={handleSearch} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
              {mode === SearchProspectsMode.key_people && (
                <>
                  {renderFilterInput("company", "Empresa", Building, "Nombre de empresa")}
                  {renderFilterInput("country", "País", Globe2, "Ej. España, México")}
                  {renderFilterInput("city", "Ciudad", MapPin, "Ej. Madrid")}
                  {renderFilterInput("position", "Cargo", Briefcase, "Ej. CEO, Director")}
                </>
              )}
              {mode === SearchProspectsMode.by_company && (
                <>
                  {renderFilterInput("company", "Empresa", Building, "Nombre de empresa")}
                  {renderFilterInput("department", "Departamento", Network, "Ej. Ventas, IT")}
                  {renderFilterInput("position", "Cargo", Briefcase, "Ej. Manager")}
                </>
              )}
              {mode === SearchProspectsMode.specific_person && (
                <>
                  {renderFilterInput("name", "Nombre", Users, "Nombre del prospecto")}
                  {renderFilterInput("company", "Empresa", Building, "Empresa (opcional)")}
                </>
              )}
              
              <div className="flex gap-2 lg:col-span-full justify-end mt-2 flex-wrap items-center">
                {Object.keys(filters).filter(k => filters[k]).length > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Limpiar
                  </button>
                )}
                {/* Investigar empresa button — shown when a company name is typed */}
                {filters.company && filters.company.trim().length >= 2 && (
                  <button
                    type="button"
                    onClick={() => openCompanyPanel(filters.company, filters.country)}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all active:scale-[0.98]"
                  >
                    <Building2 className="h-4 w-4" />
                    Investigar Empresa
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-slate-800 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Buscando con IA...</>
                  ) : (
                    <><Search className="h-4 w-4" /> Buscar Prospectos</>
                  )}
                </button>
              </div>
              {/* AI generation status banner */}
              <AnimatePresence>
                {(isGenerating || newCount !== null) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="lg:col-span-full"
                  >
                    <div className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium mt-1",
                      isGenerating
                        ? "bg-blue-50 text-blue-700 border border-blue-100"
                        : newCount && newCount > 0
                          ? "bg-green-50 text-green-700 border border-green-100"
                          : "bg-slate-50 text-slate-600 border border-slate-100"
                    )}>
                      {isGenerating ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> La IA está generando prospectos adicionales según tus criterios...</>
                      ) : newCount && newCount > 0 ? (
                        <><Sparkles className="h-3.5 w-3.5 shrink-0" /> Se encontraron <strong>{newCount} nuevos prospectos</strong> con IA y se añadieron a los resultados.</>
                      ) : (
                        <><Search className="h-3.5 w-3.5 shrink-0" /> No se encontraron nuevos prospectos para estos criterios.</>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </div>
      </div>

      {/* Results Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {isLoading || (isGenerating && (!data || data.prospects.length === 0)) ? (
          <div className="space-y-6">
            {isGenerating && (
              <div className="flex items-center gap-3 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Buscando personas reales en LinkedIn y otras fuentes...</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-48 rounded-2xl bg-white border border-slate-100 p-6 shadow-sm animate-pulse">
                  <div className="h-12 w-12 bg-slate-200 rounded-full mb-4"></div>
                  <div className="h-4 w-3/4 bg-slate-200 rounded mb-2"></div>
                  <div className="h-3 w-1/2 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-red-50 p-8 text-center border border-red-100">
            <h3 className="text-lg font-semibold text-red-800">Error al buscar prospectos</h3>
            <p className="text-red-600 mt-2">Inténtalo de nuevo más tarde.</p>
          </div>
        ) : !data || data.prospects.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center border border-slate-100 shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 mb-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No se encontraron resultados</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">
              Prueba modificando los filtros de búsqueda o cambiando la modalidad para encontrar lo que buscas.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                {data.total} resultados encontrados
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {data.prospects.map((prospect: Prospect, idx: number) => (
                  <motion.div
                    key={prospect.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-lg">
                          {prospect.name.charAt(0)}
                        </div>
                        {prospect.seniority && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                            {prospect.seniority}
                          </span>
                        )}
                      </div>
                      
                      <h3 className="font-display text-xl font-bold text-slate-900 line-clamp-1">
                        {prospect.name}
                      </h3>
                      <p className="text-primary font-medium mt-1 line-clamp-1">
                        {prospect.position || "Cargo no especificado"}
                      </p>
                      
                      <div className="mt-4 space-y-2">
                        {/* Company name — clickable to research */}
                        <button
                          onClick={() => openCompanyPanel(prospect.company, prospect.country ?? undefined)}
                          className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors group/co w-full text-left"
                          title={`Investigar ${prospect.company}`}
                        >
                          <Building className="h-4 w-4 shrink-0 text-slate-400 group-hover/co:text-blue-400" />
                          <span className="line-clamp-1">{prospect.company}</span>
                          <ChevronRight className="h-3 w-3 shrink-0 text-slate-300 group-hover/co:text-blue-400 ml-auto" />
                        </button>
                        {(prospect.city || prospect.country) && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="line-clamp-1">
                              {[prospect.city, prospect.country].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                        {prospect.department && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Network className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="line-clamp-1">{prospect.department}</span>
                          </div>
                        )}
                      </div>

                      {/* Approach Hint */}
                      {(() => {
                        const hint = getApproachHint(prospect.position, prospect.seniority, prospect.department);
                        return (
                          <div 
                            className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 border text-xs font-medium"
                            style={{ backgroundColor: hint.bgColor, borderColor: hint.borderColor, color: hint.color }}
                          >
                            <Target className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-snug">{hint.label}</span>
                          </div>
                        );
                      })()}
                    </div>
                    
                    <div className="border-t border-slate-100 p-4 bg-slate-50/50 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setEnrichModal({ isOpen: true, prospect })}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-2 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Enriquecer
                      </button>
                      <button
                        onClick={() => setMessagesModal({ isOpen: true, prospect })}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-50 border border-violet-200 px-2 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" /> Mensajes
                      </button>
                      <button
                        onClick={() => openCompanyPanel(prospect.company, prospect.country ?? undefined)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-2 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                      >
                        <Building2 className="h-3.5 w-3.5" /> Empresa
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSaveModal({ isOpen: true, prospect })}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                        >
                          <Bookmark className="h-3.5 w-3.5" /> Guardar
                        </button>
                        <Link 
                          href={`/prospecto/${prospect.id}`}
                          className="flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-white hover:bg-slate-800 transition-colors"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="flex items-center px-4 text-sm font-medium text-slate-600">
                  Página {page} de {data.totalPages}
                </span>
                <button
                  disabled={page === data.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
