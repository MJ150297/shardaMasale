'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Lock, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StockReport } from '@/modules/reports/stock-report';
import { TransactionReport } from '@/modules/reports/transaction-report';
import { ProfitLossReport } from '@/modules/reports/profit-loss-report';
import { SnapshotReport } from '@/modules/reports/snapshot-report';
import { InvoiceReport } from '@/modules/reports/invoice-report';
import { PartyReport } from '@/modules/reports/party-report';
import { BalanceSheetReport } from '@/modules/reports/balance-sheet-report';
import { CashFlowReport } from '@/modules/reports/cash-flow-report';
import { TaxReport } from '@/modules/reports/tax-report';
import { SalesByItemReport } from '@/modules/reports/sales-by-item-report';
import { SalesReturnsReport } from '@/modules/reports/sales-returns-report';
import { DailySalesReport } from '@/modules/reports/daily-sales-report';
import { StockAgingReport } from '@/modules/reports/stock-aging-report';
import { WastageReport } from '@/modules/reports/wastage-report';
import { PurchaseOrdersReport } from '@/modules/reports/purchase-orders-report';
import { PayablesAgingReport } from '@/modules/reports/payables-aging-report';
import { SupplierPerformanceReport } from '@/modules/reports/supplier-performance-report';
import { ReceivablesAgingReport } from '@/modules/reports/receivables-aging-report';
import { CustomerLedgerReport } from '@/modules/reports/customer-ledger-report';
import { TopSpendersReport } from '@/modules/reports/top-spenders-report';
import { getPlanFeatures, isAdvancedReport } from '@/lib/subscription-features';
import { cn } from '@/lib/utils';

const REPORT_TABS: Array<{
  value: string;
  label: string;
  Component: React.ComponentType;
}> = [
  { value: 'snapshot', label: 'Dashboard', Component: SnapshotReport },
  { value: 'balance-sheet', label: 'Balance Sheet', Component: BalanceSheetReport },
  { value: 'cash-flow', label: 'Cash Flow', Component: CashFlowReport },
  { value: 'profit-loss', label: 'P&L', Component: ProfitLossReport },
  { value: 'tax', label: 'Tax/GST', Component: TaxReport },
  { value: 'invoices', label: 'Invoices', Component: InvoiceReport },
  { value: 'daily-sales', label: 'Daily Sales', Component: DailySalesReport },
  { value: 'sales-by-item', label: 'Sales by Item', Component: SalesByItemReport },
  { value: 'sales-returns', label: 'Returns', Component: SalesReturnsReport },
  { value: 'stock', label: 'Stock', Component: StockReport },
  { value: 'stock-aging', label: 'Stock Aging', Component: StockAgingReport },
  { value: 'wastage', label: 'Wastage', Component: WastageReport },
  { value: 'purchase-orders', label: 'PO History', Component: PurchaseOrdersReport },
  { value: 'payables-aging', label: 'Payables', Component: PayablesAgingReport },
  { value: 'supplier-performance', label: 'Suppliers', Component: SupplierPerformanceReport },
  { value: 'parties', label: 'Parties', Component: PartyReport },
  { value: 'transactions', label: 'Transactions', Component: TransactionReport },
  { value: 'receivables-aging', label: 'Receivables', Component: ReceivablesAgingReport },
  { value: 'customer-ledger', label: 'Ledger', Component: CustomerLedgerReport },
  { value: 'top-spenders', label: 'Top Spenders', Component: TopSpendersReport },
];

function UpgradePrompt({ reportName }: { reportName: string }) {
  return (
    <Card className="overflow-hidden border-l-4 border-l-amber-500">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-2">
            <Lock className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          </div>
          <CardTitle className="text-lg">{reportName} — Advanced Report</CardTitle>
        </div>
        <CardDescription>
          This report is included on the <strong>Paid</strong> and <strong>Enterprise</strong> plans. Upgrade to
          unlock advanced analytics, multi-currency support, and more.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Profit & Loss, Balance Sheet, Cash Flow</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Tax/GST summary and exports</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Receivables & Payables aging</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Sales by Item, Top Spenders, Supplier Performance</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard/settings">
              <Crown className="mr-2 h-4 w-4" /> Upgrade Plan
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="https://example.com/pricing" target="_blank">
              View Plans <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConsolidatedReportsPage() {
  const [activeTab, setActiveTab] = useState('snapshot');
  const { data: session } = useSession();

  const plan = (session?.user?.subscription?.plan as string | undefined) ?? 'free';
  const features = useMemo(() => getPlanFeatures(plan), [plan]);
  const canAccessAdvanced = features.advancedReports;
  const isSuperOwner = (session?.user?.role ?? '') === 'superOwner';

  const accessibleSet = useMemo(() => {
    const allowed = new Set<string>();
    for (const tab of REPORT_TABS) {
      if (isSuperOwner) {
        allowed.add(tab.value);
      } else if (!isAdvancedReport(tab.value)) {
        allowed.add(tab.value);
      } else if (canAccessAdvanced) {
        allowed.add(tab.value);
      }
    }
    return allowed;
  }, [canAccessAdvanced, isSuperOwner]);

  const orderedTabs = useMemo(() => {
    const unlockedTabs: typeof REPORT_TABS = [];
    const lockedTabs: typeof REPORT_TABS = [];

    for (const tab of REPORT_TABS) {
      if (accessibleSet.has(tab.value)) {
        unlockedTabs.push(tab);
      } else {
        lockedTabs.push(tab);
      }
    }

    return [...unlockedTabs, ...lockedTabs];
  }, [accessibleSet]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          View and export business reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0 space-y-4">
        <TabsList variant="segmented" className="w-full max-w-full overflow-x-auto flex-nowrap justify-start">
          {orderedTabs.map((tab) => {
            const isLocked = !accessibleSet.has(tab.value);
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={isLocked}
                className={cn(
                  'gap-1',
                  isLocked && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isLocked && <Lock className="h-3 w-3" />}
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {orderedTabs.map(({ value, label, Component }) => {
          const isLocked = !accessibleSet.has(value);
          return (
            <TabsContent key={value} value={value} className="w-full min-w-0 space-y-4">
              {isLocked ? (
                <UpgradePrompt reportName={label} />
              ) : (
                <Component />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
