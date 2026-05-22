'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockReport } from "@/modules/reports/stock-report";
import { TransactionReport } from "@/modules/reports/transaction-report";
import { ProfitLossReport } from "@/modules/reports/profit-loss-report";
import { SnapshotReport } from "@/modules/reports/snapshot-report";
import { InvoiceReport } from "@/modules/reports/invoice-report";
import { PartyReport } from "@/modules/reports/party-report";

export default function ConsolidatedReportsPage() {
  const [activeTab, setActiveTab] = useState('snapshot');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          View and export business reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="snapshot">Dashboard</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="stock">Stock Report</TabsTrigger>
          <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
        </TabsList>

        <TabsContent value="snapshot" className="space-y-4">
          <SnapshotReport />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <InvoiceReport />
        </TabsContent>

        <TabsContent value="parties" className="space-y-4">
          <PartyReport />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <TransactionReport />
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <StockReport />
        </TabsContent>

        <TabsContent value="profit-loss" className="space-y-4">
          <ProfitLossReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}