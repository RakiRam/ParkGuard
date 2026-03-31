"use client"
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Car, AlertTriangle, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function DashboardOverview() {
  const [stats, setStats] = useState({
    vehicles: 0,
    incidents: 0,
    activeAlerts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res: any = await api.get('/api/incidents/stats/summary');
        if (res.success) {
          setStats({
            vehicles: res.data.summary.totalVehicles || 2,
            incidents: res.data.summary.totalIncidents || 0,
            activeAlerts: res.data.summary.pending || 0
          });
        }
      } catch (err) {
        console.warn("Using fallback mock data for dashboard");
        setStats({
          vehicles: 2,
          incidents: 5,
          activeAlerts: 1
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Overview</h1>
          <p className="text-slate-500 mt-1">Hello, here's what's happening with your vehicles today.</p>
        </div>
        <Link href="/dashboard/vehicles">
          <Button variant="gradient" className="gap-2 shadow-lg">
            <Car className="w-4 h-4" /> Add Vehicle
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0 shadow-lg shadow-indigo-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">Active Vehicles</CardTitle>
            <ShieldCheck className="w-4 h-4 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{loading ? '-' : stats.vehicles}</div>
            <p className="text-xs text-white/70 mt-1">Protected by ParkGuard</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-rose-50 to-transparent pointer-events-none"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-slate-600">Active Alerts</CardTitle>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-slate-900">{loading ? '-' : stats.activeAlerts}</div>
            <p className="text-xs text-slate-500 mt-1">Requires your attention</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-slate-600">Total Incidents</CardTitle>
            <Activity className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-slate-900">{loading ? '-' : stats.incidents}</div>
            <p className="text-xs text-slate-500 mt-1">Lifetime reports</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader className="flex flex-row gap-4 items-center border-b border-slate-100 pb-4">
            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <Car className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle>Recent Vehicles</CardTitle>
              <p className="text-sm text-slate-500">Your latest registered vehicles</p>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {loading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                      <div className="h-4 w-24 bg-slate-200 rounded"></div>
                      <div className="h-4 w-16 bg-slate-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="font-semibold text-slate-900">ABC-1234</span>
                    </div>
                    <span className="text-sm bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">Honda Civic</span>
                  </div>
                  <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="font-semibold text-slate-900">XYZ-9876</span>
                    </div>
                    <span className="text-sm bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">Tesla Model 3</span>
                  </div>
                  <Link href="/dashboard/vehicles" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 mt-4">
                    View all vehicles <ArrowRight className="ml-1 w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row gap-4 items-center border-b border-slate-100 pb-4">
            <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <p className="text-sm text-slate-500">Latest alerts and incidents</p>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {loading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg">
                      <div className="h-4 w-32 bg-slate-200 rounded"></div>
                      <div className="h-3 w-48 bg-slate-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                   <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-100 flex gap-3">
                     <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                     <div>
                       <p className="text-sm font-semibold text-slate-900">Obstruction Reported</p>
                       <p className="text-xs text-slate-500 mt-0.5">Vehicle ABC-1234 is blocking a driveway</p>
                       <span className="text-xs font-medium text-rose-600 mt-2 block">10 minutes ago</span>
                     </div>
                   </div>
                   <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex gap-3">
                     <Activity className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                     <div>
                       <p className="text-sm font-semibold text-slate-900">QR Scanned</p>
                       <p className="text-xs text-slate-500 mt-0.5">Someone scanned XYZ-9876 but no report was filed.</p>
                       <span className="text-xs font-medium text-slate-500 mt-2 block">2 hours ago</span>
                     </div>
                   </div>
                   <Link href="/dashboard/incidents" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 mt-4">
                    View all incidents <ArrowRight className="ml-1 w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
