import { Link, useRoute } from "wouter";
import { Users, Search, BarChart3, Bookmark, Layers, MessageSquare, Settings } from "lucide-react";
import { useGetSavedProspects } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [isHome] = useRoute("/");
  const [isSaved] = useRoute("/guardados");
  const [isStats] = useRoute("/estadisticas");
  const [isWhatsApp] = useRoute("/whatsapp");
  const [isSettings] = useRoute("/configuracion");

  const { data: savedProspects } = useGetSavedProspects();
  const savedCount = savedProspects?.length || 0;

  const navItems = [
    { href: "/", label: "Buscar", icon: Search, active: isHome },
    { href: "/guardados", label: "Guardados", icon: Bookmark, active: isSaved, badge: savedCount },
    { href: "/estadisticas", label: "Estadísticas", icon: BarChart3, active: isStats },
    { href: "/whatsapp", label: "WhatsApp", icon: MessageSquare, active: isWhatsApp },
    { href: "/configuracion", label: "Configuración", icon: Settings, active: isSettings },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
              <Layers className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-slate-900">
              Prospect<span className="text-primary">Finder</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2">
            {navItems.map((item: any) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                  item.active 
                    ? "bg-primary/10 text-primary" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className={cn("h-4 w-4", item.active && "text-primary")} />
                <span className="hidden sm:inline-block">{item.label}</span>
                
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={cn(
                    "ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                    item.active ? "bg-primary text-white" : "bg-slate-200 text-slate-700"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
