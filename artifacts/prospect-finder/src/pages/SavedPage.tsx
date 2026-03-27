import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetSavedProspects, useDeleteSavedProspect, getGetSavedProspectsQueryKey, SavedProspect } from "@workspace/api-client-react";
import { Link } from "wouter";
import { 
  Bookmark, Building, MapPin, Trash2, ArrowRight, FolderOpen, 
  Loader2, Download, ChevronDown, Calendar, MessageSquare,
  CheckCircle2, Phone, Mail, Circle, XCircle, Clock, Users
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { MessagesPanel } from "@/components/MessagesPanel";

type PipelineStage = "new" | "contacted" | "replied" | "meeting" | "negotiating" | "closed" | "discarded";

const PIPELINE_STAGES: { id: PipelineStage; label: string; color: string; bg: string; border: string; icon: React.ElementType }[] = [
  { id: "new",         label: "Nuevo",       color: "text-slate-600",  bg: "bg-slate-100",   border: "border-slate-200",  icon: Circle },
  { id: "contacted",   label: "Contactado",  color: "text-blue-700",   bg: "bg-blue-50",     border: "border-blue-200",   icon: Mail },
  { id: "replied",     label: "Respondió",   color: "text-indigo-700", bg: "bg-indigo-50",   border: "border-indigo-200", icon: MessageSquare },
  { id: "meeting",     label: "Reunión",     color: "text-violet-700", bg: "bg-violet-50",   border: "border-violet-200", icon: Calendar },
  { id: "negotiating", label: "Negociando",  color: "text-amber-700",  bg: "bg-amber-50",    border: "border-amber-200",  icon: Clock },
  { id: "closed",      label: "Cerrado",     color: "text-green-700",  bg: "bg-green-50",    border: "border-green-200",  icon: CheckCircle2 },
  { id: "discarded",   label: "Descartado",  color: "text-red-600",    bg: "bg-red-50",      border: "border-red-200",    icon: XCircle },
];

function getStage(id: string | null | undefined) {
  return PIPELINE_STAGES.find(s => s.id === id) ?? PIPELINE_STAGES[0];
}

function StageSelector({ savedId, current, onChange }: { savedId: number; current: string | null; onChange: (stage: PipelineStage) => void }) {
  const [open, setOpen] = useState(false);
  const stage = getStage(current);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors", stage.bg, stage.border, stage.color)}
      >
        <stage.icon className="h-3.5 w-3.5" />
        {stage.label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-44">
            {PIPELINE_STAGES.map(s => (
              <button
                key={s.id}
                onClick={() => { onChange(s.id); setOpen(false); }}
                className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors", stage.id === s.id ? cn(s.bg, s.color) : "text-slate-700")}
              >
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function SavedPage() {
  const { data: savedProspects, isLoading, refetch } = useGetSavedProspects();
  const queryClient = useQueryClient();
  const [messagesModal, setMessagesModal] = useState<{ isOpen: boolean; prospect: SavedProspect | null }>({ isOpen: false, prospect: null });
  const [viewMode, setViewMode] = useState<"list" | "pipeline">("list");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { mutate: deleteSaved, isPending: isDeleting } = useDeleteSavedProspect({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSavedProspectsQueryKey() })
    }
  });

  const groupedByList = useMemo(() => {
    if (!savedProspects) return {};
    return (savedProspects as any[]).reduce((acc: any, s: any) => {
      const k = s.listName || "Sin Lista";
      if (!acc[k]) acc[k] = [];
      acc[k].push(s);
      return acc;
    }, {} as Record<string, SavedProspect[]>);
  }, [savedProspects]);

  const groupedByStage = useMemo(() => {
    if (!savedProspects) return {} as Record<PipelineStage, SavedProspect[]>;
    return PIPELINE_STAGES.reduce((acc, s) => {
      acc[s.id] = (savedProspects as any[]).filter((p: any) => (p.pipelineStage ?? "new") === s.id);
      return acc;
    }, {} as Record<PipelineStage, SavedProspect[]>);
  }, [savedProspects]);

  const updatePipelineStage = async (savedId: number, stage: PipelineStage) => {
    setUpdatingId(savedId);
    try {
      await fetch(`/api/saved/${savedId}/pipeline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage: stage, lastContactedAt: stage !== "new" ? new Date().toISOString() : undefined }),
      });
      await refetch();
    } catch { /* silent */ } finally { setUpdatingId(null); }
  };

  const handleExport = () => {
    window.open("/api/saved/export", "_blank");
  };

  const totalProspects = savedProspects?.length ?? 0;
  const contacted = (savedProspects as any[])?.filter((p: any) => p.pipelineStage && p.pipelineStage !== "new" && p.pipelineStage !== "discarded").length ?? 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50/50 pb-20">
      {messagesModal.prospect && (
        <MessagesPanel
          isOpen={messagesModal.isOpen}
          onClose={() => setMessagesModal({ isOpen: false, prospect: null })}
          prospectId={messagesModal.prospect.prospectId}
          prospectName={messagesModal.prospect.prospect.name}
          prospectPosition={messagesModal.prospect.prospect.position ?? undefined}
          prospectCompany={messagesModal.prospect.prospect.company}
        />
      )}

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30">
                <Bookmark className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold">Prospectos Guardados</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  {totalProspects} prospectos · {contacted} en proceso
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* View mode toggle */}
              <div className="flex rounded-xl border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn("px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5", viewMode === "list" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white")}
                >
                  <Users className="h-3.5 w-3.5" /> Listas
                </button>
                <button
                  onClick={() => setViewMode("pipeline")}
                  className={cn("px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5", viewMode === "pipeline" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Pipeline
                </button>
              </div>
              <button
                onClick={handleExport}
                disabled={totalProspects === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> Exportar CSV
              </button>
            </div>
          </div>

          {/* Pipeline stats bar */}
          {totalProspects > 0 && (
            <div className="mt-6 flex gap-2 flex-wrap">
              {PIPELINE_STAGES.filter(s => s.id !== "discarded").map(s => {
                const count = groupedByStage[s.id]?.length ?? 0;
                if (count === 0) return null;
                return (
                  <div key={s.id} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border", s.bg, s.border, s.color)}>
                    <s.icon className="h-3.5 w-3.5" />
                    {s.label}: {count}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !savedProspects || savedProspects.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center border border-slate-200 shadow-sm max-w-2xl mx-auto mt-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 mb-6">
              <FolderOpen className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="font-display text-2xl font-bold text-slate-900">No tienes prospectos guardados</h3>
            <p className="text-slate-500 mt-3">Explora la búsqueda y guarda los perfiles que te interesen.</p>
            <Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 transition-all">
              <ArrowRight className="h-4 w-4" /> Ir a buscar prospectos
            </Link>
          </div>
        ) : viewMode === "pipeline" ? (
          /* PIPELINE VIEW */
          <div className="space-y-6">
            {PIPELINE_STAGES.map(stage => {
              const items = groupedByStage[stage.id] ?? [];
              return (
                <div key={stage.id} className={cn("rounded-2xl border overflow-hidden", items.length > 0 ? stage.border : "border-slate-100")}>
                  <div className={cn("flex items-center gap-3 px-5 py-3 border-b", items.length > 0 ? cn(stage.bg, stage.border) : "bg-slate-50 border-slate-100")}>
                    <stage.icon className={cn("h-4 w-4", items.length > 0 ? stage.color : "text-slate-400")} />
                    <h3 className={cn("font-semibold text-sm", items.length > 0 ? stage.color : "text-slate-400")}>
                      {stage.label}
                    </h3>
                    <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-bold", items.length > 0 ? cn(stage.bg, stage.color) : "bg-slate-100 text-slate-400")}>
                      {(items as any[]).length}
                    </span>
                  </div>
                  {items.length > 0 && (
                    <div className="divide-y divide-slate-100 bg-white">
                      {(items as any[]).map((saved: any) => (
                        <div key={saved.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 shrink-0 text-sm">
                            {saved.prospect.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={`/prospecto/${saved.prospectId}`} className="font-semibold text-slate-900 hover:text-primary transition-colors text-sm line-clamp-1">
                              {saved.prospect.name}
                            </Link>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {saved.prospect.position} · {saved.prospect.company}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setMessagesModal({ isOpen: true, prospect: saved })}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
                            >
                              <MessageSquare className="h-3.5 w-3.5" /> Mensajes
                            </button>
                            <StageSelector
                              savedId={saved.id}
                              current={saved.pipelineStage ?? "new"}
                              onChange={(s) => updatePipelineStage(saved.id, s)}
                            />
                            {updatingId === saved.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="space-y-12">
            {Object.entries(groupedByList).map(([listName, items]) => (
              <div key={listName} className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                  <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-3">
                    {listName}
                    <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-600">
                      {(items as any[]).length}
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <AnimatePresence>
                    {(items as any[]).map((saved: any) => {
                      const stage = getStage(saved.pipelineStage);
                      return (
                        <motion.div
                          key={saved.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-all"
                        >
                          <div className="p-4 flex-1 space-y-3">
                            <div className="flex justify-between items-start">
                              <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-base">
                                {saved.prospect.name.charAt(0)}
                              </div>
                              <button
                                onClick={() => deleteSaved({ id: saved.id })}
                                disabled={isDeleting}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div>
                              <Link href={`/prospecto/${saved.prospectId}`} className="font-bold text-slate-900 hover:text-primary transition-colors line-clamp-1 text-sm">
                                {saved.prospect.name}
                              </Link>
                              <p className="text-primary text-xs font-medium mt-0.5 line-clamp-1">{saved.prospect.position}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                <Building className="h-3 w-3 text-slate-400" />
                                <span className="line-clamp-1">{saved.prospect.company}</span>
                              </div>
                              {(saved.prospect.city || saved.prospect.country) && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                  <MapPin className="h-3 w-3 text-slate-400" />
                                  <span className="line-clamp-1">{[saved.prospect.city, saved.prospect.country].filter(Boolean).join(", ")}</span>
                                </div>
                              )}
                            </div>
                            {/* Pipeline Stage */}
                            <div className="flex items-center gap-2">
                              <StageSelector
                                savedId={saved.id}
                                current={saved.pipelineStage ?? "new"}
                                onChange={(s) => updatePipelineStage(saved.id, s)}
                              />
                              {updatingId === saved.id && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                            </div>
                          </div>
                          <div className="border-t border-slate-100 p-3 bg-slate-50/50 flex gap-2">
                            <button
                              onClick={() => setMessagesModal({ isOpen: true, prospect: saved })}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-2 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                            >
                              <MessageSquare className="h-3.5 w-3.5" /> Mensajes
                            </button>
                            <Link
                              href={`/prospecto/${saved.prospectId}`}
                              className="flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-white hover:bg-slate-800 transition-colors"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
