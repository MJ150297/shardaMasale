'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BookOpen, DollarSign, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { DateRangeFilter } from './date-range-filter';
import { ExportButton } from './export-button';
import { PaginationControls } from '@/components/ui/pagination-controls';

export function CustomerLedgerReport({ shopId }: { shopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [partyId, setPartyId] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const fetchParties = async () => {
      const params = new URLSearchParams();
      if (shopId) params.append('shopId', shopId);
      const res = await fetch(`/api/reports/customer-ledger?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchParties();
  }, [shopId]);

  useEffect(() => {
    if (!partyId) return;
    setPage(1);
    const fetchLedger = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (shopId) params.append('shopId', shopId);
      params.append('partyId', partyId);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      const res = await fetch(`/api/reports/customer-ledger?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchLedger();
  }, [partyId, shopId, startDate, endDate]);

  // Client-side pagination for ledger entries
  const ledger = data?.ledger || [];
  const totalPages = Math.ceil(ledger.length / limit);
  const paginatedLedger = ledger.slice((page - 1) * limit, page * limit);

  const ledgerColumns = [
    { key: 'date', label: 'Date' },
    { key: 'transactionNumber', label: 'Voucher #' },
    { key: 'type', label: 'Type' },
    { key: 'debit', label: 'Debit' },
    { key: 'credit', label: 'Credit' },
    { key: 'balance', label: 'Balance' },
  ];

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load customer ledger</div>;

  // Party selection mode
  if (!data.selectedParty) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Select value={partyId} onValueChange={setPartyId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a party to view ledger" />
            </SelectTrigger>
            <SelectContent>
              {data.parties?.map((p: any) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.displayName} ({p.partyType}) — ₹{p.currentBalance.toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-sm">
          Select a customer or supplier to view their detailed ledger with running balance.
        </p>
      </div>
    );
  }

  const { selectedParty, summary } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">{selectedParty.displayName}</h3>
          <p className="text-sm text-muted-foreground">
            {selectedParty.partyType} · {selectedParty.phoneNumber || ''} {selectedParty.email ? `· ${selectedParty.email}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={partyId} onValueChange={setPartyId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Switch party" />
            </SelectTrigger>
            <SelectContent>
              {data.parties?.map((p: any) => (
                <SelectItem key={p._id} value={p._id}>{p.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Opening Balance</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">₹{summary.openingBalance.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Debit</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-red-500">₹{summary.totalDebit.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Credit</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-500">₹{summary.totalCredit.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Closing Balance</CardTitle></CardHeader><CardContent><div className={`text-xl font-bold ${summary.closingBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>₹{summary.closingBalance.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="flex justify-end">
        <ExportButton data={ledger} filename={`ledger-${selectedParty.displayName}`} columns={ledgerColumns} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Voucher #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLedger.map((entry: any) => (
                <TableRow key={entry._id}>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell className="font-medium">{entry.transactionNumber}</TableCell>
                  <TableCell><Badge variant="outline">{entry.type}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{entry.items}</TableCell>
                  <TableCell className="text-right text-red-500">{entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}</TableCell>
                  <TableCell className="text-right text-green-500">{entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}</TableCell>
                  <TableCell className={`text-right font-bold ${entry.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ₹{entry.balance.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {paginatedLedger.length === 0 && (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">No transactions found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={ledger.length}
            limit={limit}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}