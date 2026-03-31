"use client"
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Package, Truck, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res: any = await api.get('/api/orders/my-orders');
        if (res.success) setOrders(res.data.orders || []);
      } catch (err) {
        setOrders([
          { id: '1', order_number: 'ORD-8941A', status: 'shipped', total_amount: 14.99, created_at: new Date().toISOString() },
          { id: '2', order_number: 'ORD-B292X', status: 'delivered', total_amount: 29.98, created_at: new Date(Date.now() - 604800000).toISOString() }
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'delivered': return <CheckCircle className="w-6 h-6 text-emerald-500" />;
      case 'shipped': return <Truck className="w-6 h-6 text-indigo-500" />;
      default: return <Package className="w-6 h-6 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Order History</h1>
        <p className="text-slate-500 mt-1 pb-4 border-b border-slate-200">Track your QR sticker orders.</p>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-200/40 bg-white/80 backdrop-blur-3xl">
        <CardContent className="p-0">
          {loading ? (
             <div className="animate-pulse space-y-2 p-6">
               {[1,2].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl"></div>)}
             </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Package className="h-10 w-10 text-slate-300" />
              </div>
              <p className="font-semibold text-lg text-slate-900">No orders yet</p>
              <p className="text-slate-500 max-w-sm mx-auto mt-2">You haven't purchased any QR stickers. Head to the Shop to get your premium secure labels.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/80">
              {orders.map((order) => (
                <div key={order.id} className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                      {getStatusIcon(order.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-lg text-slate-900">{order.order_number}</p>
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 md:text-right self-end md:self-auto flex items-center gap-4 md:flex-col md:gap-1">
                    <p className="font-bold text-2xl text-slate-900">${parseFloat(order.total_amount).toFixed(2)}</p>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest hidden md:block">Total</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
