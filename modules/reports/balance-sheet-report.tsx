'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Wallet, Building, TrendingUp } from 'lucide-react';

interface BalanceSheetReportProps {
  shopId?: string;
}

export function BalanceSheetReport({ shopId }: BalanceSheetReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (shopId) params.append('shopId', shopId);
        const res = await fetch(`/api/reports/balance-sheet?${params}`);
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error('Failed to load balance sheet', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [shopId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (!data) return <div>Failed to load balance sheet</div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        As of: {new Date(data.asOn).toLocaleDateString()}
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Building className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              ₹{data.summary.totalAssets.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              ₹{data.summary.totalLiabilities.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className={data.equity >= 0 ? 'border-blue-200 dark:border-blue-800' : 'border-red-200 dark:border-red-800'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equity</CardTitle>
            <Wallet className={`h-4 w-4 ${data.equity >= 0 ? 'text-blue-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.equity >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
              ₹{data.equity.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-green-600">Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between py-1">
              <span>Cash & Bank</span>
              <span className="font-medium">₹{data.assets.cashAndBank.toLocaleString()}</span>
            </div>
            <div className="border-t" />
            <div className="flex justify-between py-1">
              <span>Accounts Receivable</span>
              <span className="font-medium">₹{data.assets.accountsReceivable.toLocaleString()}</span>
            </div>
            <div className="border-t" />
            <div className="flex justify-between py-1">
              <span>Inventory (at cost)</span>
              <span className="font-medium">₹{data.assets.inventory.costValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 text-sm text-muted-foreground pl-4">
              <span>Inventory (at selling price)</span>
              <span>₹{data.assets.inventory.sellValue.toLocaleString()}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-bold text-green-600">
                <span>Total Assets</span>
                <span>₹{data.assets.totalAssets.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liabilities Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-red-600">Liabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between py-1">
              <span>Accounts Payable</span>
              <span className="font-medium">₹{data.liabilities.accountsPayable.toLocaleString()}</span>
            </div>
            <div className="border-t" />
            <div className="flex justify-between py-1">
              <span>Unpaid Purchases</span>
              <span className="font-medium">₹{data.liabilities.unpaidPurchases.toLocaleString()}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-bold text-red-600">
                <span>Total Liabilities</span>
                <span>₹{data.liabilities.totalLiabilities.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equity + Ratios */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-blue-600">Equity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              ₹{data.equity.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Assets - Liabilities (Accounting Equation)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Financial Ratios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Debt-to-Equity</span>
                <span className="font-medium">{data.summary.debtToEquity}</span>
              </div>
              <div className="flex justify-between">
                <span>Current Ratio</span>
                <span className="font-medium">{data.summary.currentRatio}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}