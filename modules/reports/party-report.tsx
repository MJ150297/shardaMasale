'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, DollarSign, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { ExportButton } from './export-button';
import { DateRangeFilter } from './date-range-filter';

interface PartyReportProps {
  shopId?: string;
}

export function PartyReport({ shopId }: PartyReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [partyTypeFilter, setPartyTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (shopId) params.append('shopId', shopId);
        if (partyTypeFilter) params.append('partyType', partyTypeFilter);
        if (startDate) params.append('startDate', startDate.toISOString());
        if (endDate) params.append('endDate', endDate.toISOString());

        const res = await fetch(`/api/reports/parties?${params}`);
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error('Failed to load party report', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [shopId, partyTypeFilter, startDate, endDate]);

  const partyColumns = [
    { key: 'displayName', label: 'Party Name' },
    { key: 'partyType', label: 'Type' },
    { key: 'currentBalance', label: 'Balance' },
    { key: 'creditLimit', label: 'Credit Limit' },
    { key: 'totalSales', label: 'Total Sales' },
    { key: 'totalPurchases', label: 'Total Purchases' },
    { key: 'transactionCount', label: 'Transactions' },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) return <div>Failed to load party report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parties</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalParties}</div>
            <p className="text-xs text-muted-foreground">{data.summary.customers} customers, {data.summary.suppliers} suppliers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receivables</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">₹{data.summary.totalReceivables.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payables</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">₹{data.summary.totalPayables.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Outstanding</CardTitle>
            <DollarSign className={`h-4 w-4 ${data.summary.totalReceivables - data.summary.totalPayables >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.totalReceivables - data.summary.totalPayables >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ₹{(data.summary.totalReceivables - data.summary.totalPayables).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <Select value={partyTypeFilter} onValueChange={setPartyTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Party Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parties</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
              <SelectItem value="supplier">Suppliers</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>

          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />
        </div>

        <ExportButton data={data.parties} filename="party-report" columns={partyColumns} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Party Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="text-right">Total Sales</TableHead>
                <TableHead className="text-right">Total Purchases</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.parties.map((party: any) => (
                <TableRow key={party._id}>
                  <TableCell className="font-medium">{party.displayName}</TableCell>
                  <TableCell>
                    <Badge variant={party.partyType === 'customer' ? 'default' : party.partyType === 'supplier' ? 'secondary' : 'outline'}>
                      {party.partyType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={party.currentBalance > 0 ? 'text-green-500 font-medium' : party.currentBalance < 0 ? 'text-red-500 font-medium' : ''}>
                      ₹{party.currentBalance.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">₹{party.creditLimit.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{party.totalSales.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{party.totalPurchases.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{party.transactionCount}</TableCell>
                </TableRow>
              ))}
              {data.parties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No parties found for the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}