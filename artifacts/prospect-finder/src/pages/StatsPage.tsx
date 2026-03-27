import { useGetStats } from "@workspace/api-client-react";
import { Users, Building2, Globe2, Briefcase } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatNumber } from "@/lib/utils";

export default function StatsPage() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-12 w-12 bg-slate-200 rounded-full mx-auto mb-4"></div>
          <div className="h-6 w-48 bg-slate-200 rounded mx-auto"></div>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total Prospectos", value: stats.totalProspects, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Empresas", value: stats.totalCompanies, icon: Building2, color: "text-indigo-600", bg: "bg-indigo-100" },
    { label: "Países", value: stats.totalCountries, icon: Globe2, color: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50/50 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            Resumen de Datos
          </h1>
          <p className="mt-2 text-slate-600">
            Vista general de la base de datos de prospectos disponibles.
          </p>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {statCards.map((stat, i) => (
            <div key={i} className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="font-display text-3xl font-bold text-slate-900 mt-1">{formatNumber(stat.value)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Top Countries Chart */}
          <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Globe2 className="h-5 w-5 text-slate-700" />
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900">Top Países</h3>
            </div>
            
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topCountries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#F1F5F9'}} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.topCountries.map((entry: any, index: any) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#2563EB' : '#93C5FD'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Industries Chart */}
          <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Briefcase className="h-5 w-5 text-slate-700" />
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900">Principales Industrias</h3>
            </div>
            
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topIndustries} layout="vertical" margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <YAxis type="category" dataKey="industry" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 500}} width={120} />
                  <Tooltip 
                    cursor={{fill: '#F1F5F9'}} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#4F46E5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
