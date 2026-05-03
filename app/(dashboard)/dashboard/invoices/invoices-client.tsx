'use client';

import { useState, useEffect } from 'react';
import { Download, Eye, FileText, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DataTableToolbar from '@/components/data-table-toolbar';
import CreateInvoice from '@/modules/billing/create-invoice';

interface Invoice {
  id?: string;
  _id?: string;
  invoiceNumber: string;
  transactionId: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string | Date;
  totalAmount?: number;
  party?: {
    id: string;
    displayName?: string;
    name?: string;
  } | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function getInvoiceId(invoice: Invoice) {
  return invoice.id || invoice._id || invoice.invoiceNumber;
}

function getPartyName(party?: Invoice['party']) {
  return party?.displayName || party?.name || '-';
}

export default function InvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ status: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, [pagination.page, filters]);

  async function loadInvoices() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status && { status: filters.status }),
      });

      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      
      if (res.ok) {
        setInvoices(
          (data.data || []).map((invoice: Invoice) => ({
            ...invoice,
            id: invoice.id || invoice._id || invoice.invoiceNumber,
          }))
        );
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  function viewInvoice(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setViewDialogOpen(true);
  }

  function downloadInvoice(invoice: Invoice) {
    toast.info('Downloading invoice...');
    window.open(`/api/invoices/${getInvoiceId(invoice)}/pdf`, '_blank');
  }

  function printInvoice(invoice: Invoice) {
    toast.info('Preparing invoice for print...');
    const printWindow = window.open(`/api/invoices/${getInvoiceId(invoice)}/pdf#toolbar=0`, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    if (searchQuery === '') return true;
    const query = searchQuery.toLowerCase();
    return (
      invoice.invoiceNumber.toLowerCase().includes(query) ||
      getPartyName(invoice.party).toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">View and manage all invoices</p>
        </div>
         <Button onClick={() => setCreateDialogOpen(true)}>
           <FileText className="mr-2 h-4 w-4" />
           New Invoice
         </Button>
      </div>

      <Tabs defaultValue="" value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTableToolbar
        onSearch={setSearchQuery}
        searchPlaceholder="Search invoices by number, party name..."
      />

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium">Party</th>
                <th className="px-4 py-3 text-left font-medium">Due Date</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                      <FileText className="h-6 w-6 opacity-50" />
                    </div>
                    <h3 className="text-lg font-medium">No invoices found</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first invoice to get started</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={getInvoiceId(invoice)} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getPartyName(invoice.party)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={getStatusBadgeClass(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      ₹{(invoice.totalAmount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => viewInvoice(invoice)} className="mr-1">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => downloadInvoice(invoice)}>
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Invoice Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">{selectedInvoice.status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Party</p>
                  <p className="font-medium">{getPartyName(selectedInvoice.party)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => downloadInvoice(selectedInvoice)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
       </Dialog>

       {/* Create Invoice Dialog */}
       <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
         <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <div className="flex justify-between items-center">
               <DialogTitle>Create New Invoice</DialogTitle>
               <Button variant="ghost" size="icon" onClick={() => setCreateDialogOpen(false)}>
                 <X className="h-4 w-4" />
               </Button>
             </div>
           </DialogHeader>
           <CreateInvoice 
             onSuccess={() => {
               setCreateDialogOpen(false);
               loadInvoices();
               toast.success('Invoice created successfully');
             }}
             onCancel={() => setCreateDialogOpen(false)}
           />
         </DialogContent>
       </Dialog>

     </div>
   );
 }
