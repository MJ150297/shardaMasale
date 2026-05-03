'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockReport } from "@/modules/reports/stock-report";
import { TransactionReport } from "@/modules/reports/transaction-report";
import { ProfitLossReport } from "@/modules/reports/profit-loss-report";

export default function ConsolidatedReportsPage() {
  const [activeTab, setActiveTab] = useState('stock');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          View and export business reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Stock Report</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
        </TabsList>
        
        <TabsContent value="stock" className="space-y-4">
          <StockReport />
        </TabsContent>
        
        <TabsContent value="transactions" className="space-y-4">
          <TransactionReport />
        </TabsContent>
        
        <TabsContent value="profit-loss" className="space-y-4">
          <ProfitLossReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
