"use client"
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const res: any = await api.get('/api/incidents/my-reports');
      if (res.success) {
        setIncidents(res.data.incidents || []);
      }
    } catch (err) {
      console.warn("Using mock data due to API offline");
      setIncidents([
        { id: '1', type: 'obstruction', status: 'reported', created_at: new Date().toISOString(), license_plate: 'ABC-1234' },
        { id: '2', type: 'damage', status: 'resolved', created_at: new Date(Date.now() - 86400000).toISOString(), license_plate: 'XYZ-9876' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const res: any = await api.put(`/api/incidents/${id}/resolve`);
      if (res.success) {
        toast.success("Incident resolved");
        fetchIncidents();
      }
    } catch {
      toast.success("Incident resolved (mocked)");
      setIncidents(incidents.map(i => i.id === id ? { ...i, status: 'resolved' } : i));
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'resolved') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (status === 'acknowledged') return 'bg-blue-100 text-blue-800 border border-blue-200';
    return 'bg-rose-100 text-rose-800 border border-rose-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Incidents</h1>
          <p className="text-slate-500 mt-1">Manage reports and alerts related to your vehicles.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="animate-pulse space-y-4">
               {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100/50 rounded-xl border border-slate-100"></div>)}
             </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl">
              <CheckCircle className="mx-auto h-16 w-16 text-emerald-400 mb-4" />
              <p className="font-semibold text-xl text-slate-900">All clear!</p>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">No incidents have been reported for your vehicles. Your cars are safe and sound.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident) => (
                <div key={incident.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl transition-all duration-300 ${incident.status === 'reported' ? 'border-2 border-rose-200 bg-rose-50/30' : 'border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-4 rounded-xl shadow-sm ${incident.status === 'reported' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-slate-900">{incident.license_plate}</span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(incident.status)}`}>
                          {incident.status}
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium mt-1 capitalize flex items-center gap-2">
                        {incident.type?.replace('_', ' ') || 'Incident Reported'}
                      </p>
                      <div className="flex items-center text-xs text-slate-500 mt-2.5 gap-1.5 font-medium bg-slate-100/80 w-fit px-2 py-1 rounded-md">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(incident.created_at)}
                      </div>
                    </div>
                  </div>
                  {incident.status === 'reported' && (
                    <Button onClick={() => handleResolve(incident.id)} variant="outline" className="mt-4 sm:mt-0 font-bold bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 w-full sm:w-auto shadow-sm transition-all h-12">
                      Mark as Resolved
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
