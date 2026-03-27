import { useParams } from "wouter";
import { useGetProspect } from "@workspace/api-client-react";
import { Building2, MapPin, Mail, Phone, Linkedin, ArrowLeft, Briefcase, Calendar, CheckCircle2, Sparkles, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { SaveProspectModal } from "@/components/SaveProspectModal";
import { EnrichmentPanel } from "@/components/EnrichmentPanel";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, X, Edit2 } from "lucide-react";

export default function ProspectDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { data: prospect, isLoading, error } = useGetProspect(id);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isEnrichModalOpen, setIsEnrichModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState("");

  const updatePhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) throw new Error("Error al actualizar teléfono");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects", id] });
      setIsEditingPhone(false);
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse space-y-6 text-center w-full max-w-md">
          <div className="h-24 w-24 bg-slate-200 rounded-full mx-auto mb-6"></div>
          <div className="h-8 w-3/4 bg-slate-200 rounded mx-auto"></div>
          <div className="h-4 w-1/2 bg-slate-200 rounded mx-auto"></div>
          <div className="mt-10 h-64 w-full bg-white rounded-3xl border border-slate-100"></div>
        </div>
      </div>
    );
  }

  if (error || !prospect) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold text-slate-900">Prospecto no encontrado</h2>
        <Link href="/" className="mt-4 text-primary hover:underline flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver a buscar
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50/50 pb-20">
      
      {/* Background Header Block */}
      <div className="h-48 w-full bg-slate-900 border-b border-slate-800 absolute top-16 left-0 -z-10 overflow-hidden">
        {/* Subtle mesh/gradient decoration */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-primary/20 blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-20 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl opacity-30"></div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Volver a resultados
        </Link>

        {/* Main Card */}
        <div className="rounded-3xl bg-white shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          
          {/* Header */}
          <div className="p-8 md:p-10 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-start gap-6">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-3xl font-bold text-white shadow-lg shadow-primary/30">
                  {prospect.name.charAt(0)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className="font-display text-3xl font-bold text-slate-900">
                      {prospect.name}
                    </h1>
                    {prospect.seniority && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                        <CheckCircle2 className="h-3 w-3" />
                        {prospect.seniority}
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-medium text-slate-600">{prospect.position}</p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium text-slate-500">
                    <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                      <Building2 className="h-4 w-4" /> {prospect.company}
                    </span>
                    {(prospect.city || prospect.country) && (
                      <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                        <MapPin className="h-4 w-4" /> {[prospect.city, prospect.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {prospect.department && (
                      <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                        <Briefcase className="h-4 w-4" /> {prospect.department}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-[140px]">
                <button
                  onClick={() => setIsEnrichModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100 transition-all active:scale-95"
                >
                  <Sparkles className="h-4 w-4" /> Ver más datos
                </button>
                <button
                  onClick={() => setIsSaveModalOpen(true)}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95"
                >
                  Guardar a lista
                </button>
                {prospect.linkedinUrl && (
                  <a 
                    href={prospect.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0077b5] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0077b5]/25 hover:bg-[#0077b5]/90 transition-all active:scale-95"
                  >
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </a>
                )}
                {prospect.phone && (
                  <a 
                    href={`https://wa.me/${prospect.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${prospect.name}, te contacto desde ProspectFinder porque vi tu perfil en ${prospect.company}...`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#25D366]/25 hover:bg-[#128C7E] transition-all active:scale-95"
                  >
                    <MessageSquare className="h-4 w-4" /> WhatsApp Web
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50/50">
            
            <div className="p-8 md:p-10 space-y-6">
              <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Información de Contacto</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 shadow-sm">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Correo Electrónico</p>
                    {prospect.email ? (
                      <a href={`mailto:${prospect.email}`} className="text-base font-medium text-slate-900 hover:text-primary transition-colors">
                        {prospect.email}
                      </a>
                    ) : (
                      <p className="text-base text-slate-400 italic">No disponible</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 shadow-sm">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Teléfono</p>
                    {isEditingPhone ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input 
                          size={1}
                          className="h-8 text-sm"
                          value={newPhone}
                          placeholder="Ej: +34..."
                          onChange={(e) => setNewPhone(e.target.value)}
                          autoFocus
                        />
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-green-600"
                          onClick={() => updatePhoneMutation.mutate(newPhone)}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-slate-400"
                          onClick={() => setIsEditingPhone(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {prospect.phone ? (
                          <a href={`tel:${prospect.phone}`} className="text-base font-medium text-slate-900 hover:text-primary transition-colors">
                            {prospect.phone}
                          </a>
                        ) : (
                          <p className="text-base text-slate-400 italic">No disponible</p>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-slate-300 hover:text-primary"
                          onClick={() => {
                            setNewPhone(prospect.phone || "");
                            setIsEditingPhone(true);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 md:p-10 space-y-6">
              <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Detalles Adicionales</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 shadow-sm">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Industria</p>
                    <p className="text-base font-medium text-slate-900">
                      {prospect.industry || <span className="text-slate-400 italic">No especificada</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 shadow-sm">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Añadido a BD</p>
                    <p className="text-base font-medium text-slate-900">
                      {prospect.createdAt ? new Date(prospect.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Notes Section (if available) */}
          {prospect.notes && (
            <div className="p-8 md:p-10 border-t border-slate-100 bg-white">
              <h3 className="font-display text-lg font-bold text-slate-900 mb-3">Notas Internas</h3>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 p-6 rounded-2xl border border-slate-100">
                {prospect.notes}
              </p>
            </div>
          )}

        </div>
      </div>

      <SaveProspectModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        prospectId={prospect.id}
        prospectName={prospect.name}
      />

      <EnrichmentPanel
        isOpen={isEnrichModalOpen}
        onClose={() => setIsEnrichModalOpen(false)}
        prospectId={prospect.id}
        prospectName={prospect.name}
        defaultAction="view"
      />
    </div>
  );
}
