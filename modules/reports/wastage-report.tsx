'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Flame, Trash2, Search, DollarSign } from 'lucide-react';
import { DateRangeFilter } from './date-range-filter';

export function WastageReport({ shopId }: { shopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (shopId) params.append('shopId', shopId);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      const res = await fetch(`/api/reports/wastage?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [shopId, startDate, endDate]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-48" /></div>;
  if (!data) return <div>Failed to load wastage report</div>;

  const { summary } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card className="border-red-200"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><DollarSign className="h-4 w-4 text-red-500" />Total Loss Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">₹{summary.totalLossValue.toLocaleString()}</div></CardContent></Card>
        <Card className="border-amber-200"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Flame className="h-4 w-4 text-amber-500" />Wastage</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-amber-500">{summary.wastage.totalQty} units</div><div className="text-xs">₹{summary.wastage.totalValue.toLocaleString()}</div></CardContent></Card>
        <Card className="border-orange-200"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-orange-500" />Damage</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-orange-500">{summary.damage.totalQty} units</div><div className="text-xs">₹{summary.damage.totalValue.toLocaleString()}</div></CardContent></Card>
        <Card className="border-purple-200"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Search className="h-4 w-4 text-purple-500" />Shrinkage</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-purple-500">{summary.shrinkage.totalQty} units</div><div className="text-xs">₹{summary.shrinkage.totalValue.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Trash2 className="h-4 w-4" />Stock Take</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{summary.stockTake.totalQty} units</div><div className="text-xs">₹{summary.stockTake.totalValue.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="flex items-center">
        <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Wastage Items</CardTitle></CardHeader>
          <CardContent>
            {summary.wastage.items.length === 0 ? <p className="text-sm text-muted-foreground">No wastage recorded</p> : (
              <div className="space-y-1 text-sm">
                {summary.wastage.items.slice(0, 10).map((i: any) => (
                  <div key={i._id.toString()} className="flex justify-between py-1 border-b last:border-0">
                    <span>{(i.item as any)?.name || 'Unknown'}</span>
                    <span className="text-red-500">-{i.quantity} (₹{i.value})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Damaged Items</CardTitle></CardHeader>
          <CardContent>
            {summary.damage.items.length === 0 ? <p className="text-sm text-muted-foreground">No damage recorded</p> : (
              <div className="space-y-1 text-sm">
                {summary.damage.items.slice(0, 10).map((i: any) => (
                  <div key={i._id.toString()} className="flex justify-between py-1 border-b last:border-0">
                    <span>{(i.item as any)?.name || 'Unknown'}</span>
                    <span className="text-red-500">-{i.quantity} (₹{i.value})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}