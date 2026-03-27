import { Switch, Route, Router as WouterRouter } from "wouter";
import SettingsPage from "@/pages/SettingsPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SearchPage from "@/pages/SearchPage";
import SavedPage from "@/pages/SavedPage";
import StatsPage from "@/pages/StatsPage";
import WhatsAppPage from "@/pages/WhatsAppPage";
import ProspectDetail from "@/pages/ProspectDetail";
import { Navbar } from "@/components/Navbar";
import { ChatPanel } from "@/components/ChatPanel";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-slate-50 text-center px-4">
      <h1 className="text-6xl font-display font-bold text-slate-900">404</h1>
      <p className="mt-4 text-xl text-slate-600 max-w-md">La página que buscas no existe o ha sido movida.</p>
      <a href="/" className="mt-8 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 transition-all">
        Volver al inicio
      </a>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={SearchPage} />
      <Route path="/guardados" component={SavedPage} />
      <Route path="/estadisticas" component={StatsPage} />
      <Route path="/whatsapp" component={WhatsAppPage} />
      <Route path="/configuracion" component={SettingsPage} />
      <Route path="/prospecto/:id" component={ProspectDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <div className="flex min-h-screen flex-col bg-background">
          <Navbar />
          <main className="flex-1">
            <Router />
          </main>
          <ChatPanel />
        </div>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
