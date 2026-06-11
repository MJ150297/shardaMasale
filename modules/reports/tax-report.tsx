'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { DateRangeFilter } from './date-range-filter';
import { ExportButton } from './export-button';

interface TaxReportProps {
  shopId?: string;
}

export function TaxReport({ shopId }: TaxReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (shopId) params.append('shopId', shopId);
        if (startDate) params.append('startDate', startDate.toISOString());
        if (endDate) params.append('endDate', endDate.toISOString());
        const res = await fetch(`/api/reports/tax?${params}`);
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error('Failed to load tax report', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [shopId, startDate, endDate]);

  const taxColumns = [
    { key: 'taxRate', label: 'Tax Rate' },
    { key: 'outputTaxable', label: 'Output Taxable' },
    { key: 'outputTax', label: 'Output Tax' },
    { key: 'inputTaxable', label: 'Input Taxable' },
    { key: 'inputTax', label: 'Input Tax' },
    { key: 'netTax', label: 'Net Tax' },
  ];

  if (loading) return <div className="space-y-4">{['1','2','3','4'].map(i => <Skeleton key={i} className="h-24" />)}<Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load tax report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{data.summary.totalSales.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{data.summary.totalPurchases.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Output Tax</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">₹{data.summary.totalOutputTax.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Collected on sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Input Tax</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">₹{data.summary.totalInputTax.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Paid on purchases</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className={data.summary.isPayable ? 'border-red-200 dark:border-red-800' : 'border-green-200 dark:border-green-800'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Tax Liability</CardTitle>
            <Percent className={`h-4 w-4 ${data.summary.isPayable ? 'text-red-500' : 'text-green-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${data.summary.isPayable ? 'text-red-500' : 'text-green-500'}`}>
              ₹{data.summary.netTaxLiability.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.summary.isPayable ? 'Payable to tax authorities' : 'Refundable / Credit'}
            </p>
          </CardContent>
        </Card>

        <div className="flex items-start">
          <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        </div>
      </div>

      <Tabs defaultValue="slabs">
        <TabsList variant="segmented">
          <TabsTrigger value="slabs">Tax Rate Slabs</TabsTrigger>
          <TabsTrigger value="output">Output Tax Detail</TabsTrigger>
          <TabsTrigger value="input">Input Tax Detail</TabsTrigger>
        </TabsList>

        <TabsContent value="slabs">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tax Rate</TableHead>
                    <TableHead className="text-right">Output Taxable</TableHead>
                    <TableHead className="text-right">Output Tax</TableHead>
                    <TableHead className="text-right">Input Taxable</TableHead>
                    <TableHead className="text-right">Input Tax</TableHead>
                    <TableHead className="text-right">Net Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.taxSlabs.map((slab: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{slab.rate}%</TableCell>
                      <TableCell className="text-right">₹{slab.outputTaxable.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-500">₹{slab.outputTax.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{slab.inputTaxable.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-500">₹{slab.inputTax.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-bold ${slab.netTax >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        ₹{slab.netTax.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="output">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tax Rate</TableHead>
                    <TableHead>HSN/SAC</TableHead>
                    <TableHead className="text-right">Taxable Amount</TableHead>
                    <TableHead className="text-right">Tax Amount</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.outputTaxBreakdown.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell><Badge variant="outline">{item.taxRate}%</Badge></TableCell>
                      <TableCell>{item.hsnCode}</TableCell>
                      <TableCell className="text-right">₹{item.taxableAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-500">₹{item.taxAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="input">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tax Rate</TableHead>
                    <TableHead>HSN/SAC</TableHead>
                    <TableHead className="text-right">Taxable Amount</TableHead>
                    <TableHead className="text-right">Tax Amount</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.inputTaxBreakdown.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell><Badge variant="outline">{item.taxRate}%</Badge></TableCell>
                      <TableCell>{item.hsnCode}</TableCell>
                      <TableCell className="text-right">₹{item.taxableAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-500">₹{item.taxAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}