import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Loader2, ListPlus } from "lucide-react";
import { useSaveProspect, getGetSavedProspectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface SaveProspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospectId: number;
  prospectName: string;
}

export function SaveProspectModal({ isOpen, onClose, prospectId, prospectName }: SaveProspectModalProps) {
  const [listName, setListName] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const { mutate, isPending } = useSaveProspect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSavedProspectsQueryKey() });
        setListName("");
        setNotes("");
        onClose();
      }
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      data: {
        prospectId,
        listName: listName.trim() || undefined,
        notes: notes.trim() || undefined
      }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/10 border border-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ListPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">Guardar Prospecto</h2>
                    <p className="text-sm text-slate-500">{prospectName}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900">Nombre de la lista (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej. Campaña Q4, VIPs de Madrid..."
                      value={listName}
                      onChange={(e) => setListName(e.target.value)}
                      className="w-full rounded-xl border-2 border-slate-200 bg-transparent px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900">Notas adicionales (Opcional)</label>
                    <textarea
                      placeholder="Contexto sobre por qué este prospecto es relevante..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-xl border-2 border-slate-200 bg-transparent px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
                        <span>Guardar</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
