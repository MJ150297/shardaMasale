'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockReport } from "@/modules/reports/stock-report";
import { TransactionReport } from "@/modules/reports/transaction-report";
import { ProfitLossReport } from "@/modules/reports/profit-loss-report";
import { SnapshotReport } from "@/modules/reports/snapshot-report";
import { InvoiceReport } from "@/modules/reports/invoice-report";
import { PartyReport } from "@/modules/reports/party-report";
import { BalanceSheetReport } from "@/modules/reports/balance-sheet-report";
import { CashFlowReport } from "@/modules/reports/cash-flow-report";
import { TaxReport } from "@/modules/reports/tax-report";
import { SalesByItemReport } from "@/modules/reports/sales-by-item-report";
import { SalesReturnsReport } from "@/modules/reports/sales-returns-report";
import { DailySalesReport } from "@/modules/reports/daily-sales-report";
import { StockAgingReport } from "@/modules/reports/stock-aging-report";
import { WastageReport } from "@/modules/reports/wastage-report";
import { PurchaseOrdersReport } from "@/modules/reports/purchase-orders-report";
import { PayablesAgingReport } from "@/modules/reports/payables-aging-report";
import { SupplierPerformanceReport } from "@/modules/reports/supplier-performance-report";
import { ReceivablesAgingReport } from "@/modules/reports/receivables-aging-report";
import { CustomerLedgerReport } from "@/modules/reports/customer-ledger-report";
import { TopSpendersReport } from "@/modules/reports/top-spenders-report";

export default function ConsolidatedReportsPage() {
  const [activeTab, setActiveTab] = useState('snapshot');

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          View and export business reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0 space-y-4">
        <TabsList className="w-full max-w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="snapshot">Dashboard</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
          <TabsTrigger value="profit-loss">P&L</TabsTrigger>
          <TabsTrigger value="tax">Tax/GST</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="daily-sales">Daily Sales</TabsTrigger>
          <TabsTrigger value="sales-by-item">Sales by Item</TabsTrigger>
          <TabsTrigger value="sales-returns">Returns</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="stock-aging">Stock Aging</TabsTrigger>
          <TabsTrigger value="wastage">Wastage</TabsTrigger>
          <TabsTrigger value="purchase-orders">PO History</TabsTrigger>
          <TabsTrigger value="party-aging-payable">Payables</TabsTrigger>
          <TabsTrigger value="supplier-performance">Suppliers</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="receivables-aging">Receivables</TabsTrigger>
          <TabsTrigger value="customer-ledger">Ledger</TabsTrigger>
          <TabsTrigger value="top-spenders">Top Spenders</TabsTrigger>
        </TabsList>

        <TabsContent value="snapshot" className="w-full min-w-0 space-y-4">
          <SnapshotReport />
        </TabsContent>

        <TabsContent value="balance-sheet" className="w-full min-w-0 space-y-4">
          <BalanceSheetReport />
        </TabsContent>

        <TabsContent value="cash-flow" className="w-full min-w-0 space-y-4">
          <CashFlowReport />
        </TabsContent>

        <TabsContent value="profit-loss" className="w-full min-w-0 space-y-4">
          <ProfitLossReport />
        </TabsContent>

        <TabsContent value="tax" className="w-full min-w-0 space-y-4">
          <TaxReport />
        </TabsContent>

        <TabsContent value="invoices" className="w-full min-w-0 space-y-4">
          <InvoiceReport />
        </TabsContent>

        <TabsContent value="daily-sales" className="w-full min-w-0 space-y-4">
          <DailySalesReport />
        </TabsContent>

        <TabsContent value="sales-by-item" className="w-full min-w-0 space-y-4">
          <SalesByItemReport />
        </TabsContent>

        <TabsContent value="sales-returns" className="w-full min-w-0 space-y-4">
          <SalesReturnsReport />
        </TabsContent>

        <TabsContent value="stock" className="w-full min-w-0 space-y-4">
          <StockReport />
        </TabsContent>

        <TabsContent value="stock-aging" className="w-full min-w-0 space-y-4">
          <StockAgingReport />
        </TabsContent>

        <TabsContent value="wastage" className="w-full min-w-0 space-y-4">
          <WastageReport />
        </TabsContent>

        <TabsContent value="purchase-orders" className="w-full min-w-0 space-y-4">
          <PurchaseOrdersReport />
        </TabsContent>

        <TabsContent value="party-aging-payable" className="w-full min-w-0 space-y-4">
          <PayablesAgingReport />
        </TabsContent>

        <TabsContent value="supplier-performance" className="w-full min-w-0 space-y-4">
          <SupplierPerformanceReport />
        </TabsContent>

        <TabsContent value="parties" className="w-full min-w-0 space-y-4">
          <PartyReport />
        </TabsContent>

        <TabsContent value="transactions" className="w-full min-w-0 space-y-4">
          <TransactionReport />
        </TabsContent>

        <TabsContent value="receivables-aging" className="w-full min-w-0 space-y-4">
          <ReceivablesAgingReport />
        </TabsContent>

        <TabsContent value="customer-ledger" className="w-full min-w-0 space-y-4">
          <CustomerLedgerReport />
        </TabsContent>

        <TabsContent value="top-spenders" className="w-full min-w-0 space-y-4">
          <TopSpendersReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
