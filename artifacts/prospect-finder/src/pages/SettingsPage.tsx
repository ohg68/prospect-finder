import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Settings, Cpu, MessageSquare, Plus, Save, Trash2, Globe } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("ia");

  // AI Configurations Query
  const { data: aiConfigs = [], isLoading: loadingAi } = useQuery({
    queryKey: ["/api/settings/ai"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ai");
      if (!res.ok) throw new Error("Failed to fetch AI settings");
      return res.json();
    }
  });

  // WhatsApp Configurations Query
  const { data: whatsappConfigs = [], isLoading: loadingWa } = useQuery({
    queryKey: ["/api/settings/whatsapp"],
    queryFn: async () => {
      const res = await fetch("/api/settings/whatsapp");
      if (!res.ok) throw new Error("Failed to fetch WhatsApp settings");
      return res.json();
    }
  });

  // Mutations
  const saveAiMutation = useMutation({
    mutationFn: async (config: any) => {
      const res = await fetch("/api/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save AI config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ai"] });
      toast({ title: "Configuración guardada", description: "Los cambios se aplicaron correctamente." });
    },
    onError: (error) => {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  });

  const saveWaMutation = useMutation({
    mutationFn: async (config: any) => {
      const res = await fetch("/api/settings/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save WhatsApp config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/whatsapp"] });
      toast({ title: "Cuenta guardada", description: "La cuenta de WhatsApp ha sido configurada." });
    },
    onError: (error) => {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Configuración</h1>
          <p className="text-slate-600">Gestiona tus tokens de IA y cuentas de WhatsApp</p>
        </div>
      </div>

      <Tabs defaultValue="ia" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="ia" className="rounded-lg gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Cpu className="h-4 w-4" /> Inteligencia Artificial
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-lg gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <MessageSquare className="h-4 w-4" /> WhatsApp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ia" className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['openai', 'claude', 'gemini', 'deepseek'].map((provider) => {
              const config = aiConfigs.find((c: any) => c.provider === provider) || { provider, apiKey: "", baseUrl: "", isActive: false };
              return (
                <AiCard 
                  key={provider} 
                  config={config} 
                  onSave={(updated) => saveAiMutation.mutate(updated)}
                  isLoading={saveAiMutation.isPending}
                />
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4">
              <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400 mb-1 leading-none">Webhook URL para Meta Developers</p>
                  <code className="text-sm font-mono text-primary-foreground/90 break-all">
                    {window.location.origin}/api/whatsapp/webhook
                  </code>
                </div>
                <Button size="sm" variant="secondary" className="rounded-lg h-8 whitespace-nowrap" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`);
                  toast({ title: "Copiado", description: "URL del Webhook copiada al portapapeles." });
                }}>
                  Copiar URL
                </Button>
              </div>
              <div className="flex justify-end">
                <Button 
                  className="rounded-xl gap-2 shadow-lg shadow-primary/20"
                  onClick={() => {
                    const name = prompt("Nombre de la cuenta (ej. Principal):");
                    const token = prompt("API Token (Temporal o Permanente de Meta):");
                    const phoneId = prompt("Phone Number ID:");
                    const verifyToken = prompt("Verify Token (El que configures en Meta Developers):");
                    if (name && token && phoneId && verifyToken) {
                      saveWaMutation.mutate({ name, apiToken: token, phoneNumberId: phoneId, verifyToken, isActive: false });
                    }
                  }}
                >
                  <Plus className="h-4 w-4" /> Agregar Cuenta Meta
                </Button>
              </div>
            </div>
          
          <div className="grid grid-cols-1 gap-6">
            {loadingWa ? (
              <div className="py-20 text-center text-slate-400">Cargando...</div>
            ) : whatsappConfigs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <Globe className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">No hay cuentas de WhatsApp configuradas</p>
                <p className="text-slate-400 text-sm mt-1">Agrega una para empezar a recibir mensajes</p>
              </div>
            ) : (
              whatsappConfigs.map((config: any) => (
                <Card key={config.id} className="border-border/50 shadow-sm overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50">
                    <div>
                      <CardTitle>{config.name}</CardTitle>
                      <CardDescription>Phone ID: {config.phoneNumberId}</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end gap-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Activo</Label>
                        <Switch 
                          checked={config.isActive}
                          onCheckedChange={(val) => saveWaMutation.mutate({ ...config, isActive: val })}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => {
                        if (confirm("¿Estás seguro de eliminar esta cuenta?")) {
                          // TODO: implement delete
                          toast({ title: "Próximamente", description: "La eliminación estará disponible pronto." });
                        }
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}

            {/* Added: WhatsApp Web (Manual) Section */}
            <Card className="border-indigo-100 bg-indigo-50/30 overflow-hidden mt-8">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-indigo-600" />
                  <CardTitle className="text-lg text-indigo-900">WhatsApp Web (Manual)</CardTitle>
                </div>
                <CardDescription className="text-indigo-700/70">
                  Usa WhatsApp directamente en tu navegador sin necesidad de una plataforma de negocios o API.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Este conector está <strong>siempre activo</strong>. Cuando un prospecto tiene un número de teléfono, verás el botón verde de "WhatsApp Web" en su ficha. 
                    No requiere tokens ni configuraciones complejas.
                  </p>
                </div>
                <div className="flex items-center justify-between p-4 bg-indigo-100/50 rounded-xl border border-indigo-200">
                  <div>
                    <p className="text-sm font-bold text-indigo-900">Estado: Listo para usar</p>
                    <p className="text-xs text-indigo-700">Abriendo wa.me para comunicación directa.</p>
                  </div>
                  <Button variant="outline" size="sm" className="bg-white" onClick={() => window.open('https://web.whatsapp.com', '_blank')}>
                    Abrir WhatsApp Web
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AiCard({ config, onSave, isLoading }: { config: any, onSave: (u: any) => void, isLoading: boolean }) {
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || "");
  const [isActive, setIsActive] = useState(config.isActive || false);

  // Sync state when config prop changes (e.g. after a refresh or mutation)
  useEffect(() => {
    setApiKey(config.apiKey || "");
    setBaseUrl(config.baseUrl || "");
    setIsActive(config.isActive || false);
  }, [config.id, config.apiKey, config.baseUrl, config.isActive]);

  const hasChanges = apiKey !== (config.apiKey || "") || baseUrl !== (config.baseUrl || "") || isActive !== (config.isActive || false);

  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="capitalize flex items-center gap-2">
            {config.provider}
            {config.isActive && <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
          </CardTitle>
          <CardDescription>Configura tu API Key de {config.provider}</CardDescription>
        </div>
        <Switch 
          checked={isActive} 
          onCheckedChange={(val) => {
            setIsActive(val);
            if (val) onSave({ ...config, apiKey, baseUrl, isActive: true });
          }}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input 
            type="password" 
            placeholder="sk-..." 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
          <div className="space-y-2">
            <Label>Base URL (Opcional)</Label>
            <Input 
              placeholder={config.provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : 'https://api...'} 
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        <div className="flex justify-end pt-2">
          <Button 
            size="sm" 
            className="rounded-lg gap-2"
            disabled={!hasChanges || isLoading}
            onClick={() => onSave({ ...config, apiKey, baseUrl, isActive })}
          >
            <Save className="h-3 w-3" /> Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
