'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Check, ChevronsUpDown, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, roundCurrency } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import CommandCreateButton from '@/components/command-create-button';
import CreatePartyDialog, { type CreatedParty } from '@/components/create-party-dialog';

import TransactionForm from '@/components/transaction-form';

interface PartyOption {
  _id: string;
  displayName?: string | null;
  name?: string | null;
  phoneNumber?: string | null;
  partyType?: 'customer' | 'supplier' | 'both';
}

interface InvoiceOption {
  _id: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string | Date;
  transactionId?: {
    _id: string;
    transactionNumber: string;
    transactionDate: string | Date;
    paymentStatus: 'unpaid' | 'partial' | 'paid' | 'void' | 'not-applicable';
    summary: {
      grandTotal: number;
      paidAmount: number;
      dueAmount: number;
    };
    lineItems: Array<{
      item?: string | null;
      itemName: string;
      sku?: string | null;
      description?: string | null;
      unit: string;
      quantity: number;
      unitPrice: number;
      discountAmount?: number;
      taxRate?: number;
      costPrice?: number | null;
    }>;
  } | null;
}

interface CreateSaleReturnDialogProps {
  onSaleReturnCreated?: () => void;
  children?: React.ReactNode;
}

export default function CreateSaleReturnDialog({ onSaleReturnCreated, children }: CreateSaleReturnDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'form'>('select');

  // Party selection
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [createPartyOpen, setCreatePartyOpen] = useState(false);
  const [partyPopoverOpen, setPartyPopoverOpen] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedPartyName, setSelectedPartyName] = useState<string | null>(null);

  interface TransactionLineItem {
    item?: string | null;
    itemName: string;
    sku?: string | null;
    description?: string | null;
    unit: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxRate?: number;
    costPrice?: number | null;
  }

  // Invoice listing
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string | null>(null);
  const [selectedLineItems, setSelectedLineItems] = useState<TransactionLineItem[]>([]);
  const [loadingTransaction, setLoadingTransaction] = useState(false);

  // Track if user wants manual entry
  const [manualEntry, setManualEntry] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('select');
      setSelectedPartyId(null);
      setSelectedPartyName(null);
      setSelectedInvoiceId(null);
      setSelectedInvoiceNumber(null);
      setSelectedLineItems([]);
      setPartySearchQuery('');
      setInvoices([]);
      setManualEntry(false);
    }
  }, [open]);

  // Load parties
  useEffect(() => {
    if (!open) return;

    async function loadParties() {
      try {
        const res = await fetch('/api/parties?limit=1000');
        const data: { parties?: PartyOption[] } = await res.json();

        if (res.ok) {
          const filtered = (data.parties || []).filter((party) => {
            return party.partyType === undefined || ['customer', 'both'].includes(party.partyType);
          });
          setParties(filtered);
        }
      } catch (error) {
        console.error('Failed to load parties', error);
      }
    }

    void loadParties();
  }, [open]);

  // Load invoices when party is selected
  useEffect(() => {
    if (!open || !selectedPartyId || manualEntry) {
      setInvoices([]);
      return;
    }

    async function loadInvoices() {
      try {
        setLoadingInvoices(true);
        const res = await fetch(
          `/api/invoices?party=${selectedPartyId}&limit=100`,
        );
        const data: { data?: InvoiceOption[] } = await res.json();

        if (!res.ok) {
          throw new Error('Failed to load invoices');
        }

        setInvoices(data.data || []);
      } catch (error) {
        console.error('Failed to load invoices', error);
        setInvoices([]);
      } finally {
        setLoadingInvoices(false);
      }
    }

    void loadInvoices();
  }, [open, selectedPartyId, manualEntry]);

  // Fetch full transaction details (with line items) when invoice selected
  useEffect(() => {
    if (!selectedInvoiceId) {
      setSelectedLineItems([]);
      return;
    }

    async function loadTransactionDetails() {
      try {
        setLoadingTransaction(true);
        const res = await fetch(`/api/transactions/${selectedInvoiceId}`);
        const data = await res.json();

        if (res.ok && data.data) {
          const transaction = data.data;
          setSelectedLineItems(
            (transaction.lineItems || []).map((item: any) => ({
              item: item.item || null,
              itemName: item.itemName,
              sku: item.sku || null,
              description: item.description || null,
              unit: item.unit || 'pcs',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount || 0,
              taxRate: item.taxRate || 0,
              costPrice: item.costPrice || null,
            })),
          );
        }
      } catch (error) {
        console.error('Failed to load transaction details', error);
        toast.error('Failed to load invoice line items');
        setSelectedLineItems([]);
      } finally {
        setLoadingTransaction(false);
      }
    }

    // Note: The selectedInvoiceId here is the TRANSACTION id (from invoice.transactionId._id)
    void loadTransactionDetails();
  }, [selectedInvoiceId]);

  const selectedPartyDisplay = useMemo(() => {
    if (!selectedPartyId) return null;
    const party = parties.find((p) => p._id === selectedPartyId);
    if (!party) return null;
    return party.displayName || party.name;
  }, [selectedPartyId, parties]);

  function handleSelectInvoice(invoice: InvoiceOption) {
    if (!invoice.transactionId) {
      toast.error('This invoice has no linked transaction');
      return;
    }
    setSelectedInvoiceId(invoice.transactionId._id);
    setSelectedInvoiceNumber(invoice.invoiceNumber);
  }

  function handleProceedToForm() {
    if (!manualEntry && !selectedInvoiceId && invoices.length > 0) {
      toast.error('Select an invoice or choose manual entry');
      return;
    }
    if (!selectedPartyId) {
      toast.error('Select a customer');
      return;
    }
    setStep('form');
  }

  function handleFormSuccess() {
    setOpen(false);
    onSaleReturnCreated?.();
  }

  function handleCreatedParty(createdParty: CreatedParty) {
    if (
      createdParty.partyType !== undefined &&
      !['customer', 'both'].includes(createdParty.partyType)
    ) {
      return;
    }

    setParties((current) => {
      if (current.some((party) => party._id === createdParty._id)) {
        return current;
      }

      return [createdParty, ...current];
    });
    setSelectedPartyId(createdParty._id);
    setSelectedPartyName(
      createdParty.displayName ||
        createdParty.name ||
        createdParty.fullName ||
        createdParty.partyName ||
        null,
    );
    setSelectedInvoiceId(null);
    setSelectedInvoiceNumber(null);
    setSelectedLineItems([]);
    setManualEntry(false);
    setPartySearchQuery('');
    setCreatePartyOpen(false);
  }

  function getInvoiceBadgeVariant(status: InvoiceOption['status']) {
    if (status === 'paid') return 'default' as const;
    if (status === 'overdue') return 'destructive' as const;
    return 'secondary' as const;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="default">
            + Sale Return
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={`bg-white ${
          step === 'form' ? 'sm:max-w-5xl' : 'sm:max-w-2xl'
        } max-h-dvh overflow-y-auto p-4 sm:p-6`}
      >
        <CreatePartyDialog
          defaultPartyType="customer"
          onPartyCreated={handleCreatedParty}
          open={createPartyOpen}
          onOpenChange={setCreatePartyOpen}
          showTrigger={false}
        />
        {step === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>Create Sale Return</DialogTitle>
              <DialogDescription>
                Select a customer and optionally pick an invoice to return items from.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {/* Party Selector */}
              <div className="space-y-2 bg-white">
                <label className="text-sm font-medium">Customer</label>
                <Popover open={partyPopoverOpen} onOpenChange={setPartyPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        'w-full justify-between',
                        !selectedPartyId && 'text-muted-foreground',
                      )}
                    >
                      {selectedPartyDisplay || 'Select customer'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-white">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search customer by name or phone..."
                        className="h-9"
                        value={partySearchQuery}
                        onValueChange={setPartySearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No party found.</CommandEmpty>
                        <CommandGroup>
                          {(() => {
                            const search = partySearchQuery.toLowerCase();
                            const filtered = search === ''
                              ? parties
                              : parties.filter((party) => {
                                  const partyName = party.displayName || party.name || '';
                                  const phone = party.phoneNumber || '';
                                  return partyName.toLowerCase().includes(search) || phone.toLowerCase().includes(search);
                                });
                            return filtered.map((party) => (
                              <CommandItem
                                value={party._id}
                                key={party._id}
                                onSelect={() => {
                                  setPartyPopoverOpen(false);
                                  setSelectedPartyId(party._id);
                                  setSelectedPartyName(party.displayName || party.name || null);
                                  setSelectedInvoiceId(null);
                                  setSelectedInvoiceNumber(null);
                                  setSelectedLineItems([]);
                                  setManualEntry(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    party._id === selectedPartyId ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{party.displayName || party.name}</span>
                                  {party.phoneNumber && (
                                    <span className="text-xs text-muted-foreground">{party.phoneNumber}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ));
                          })()}
                        </CommandGroup>
                      </CommandList>
                      <div className="border-t p-1">
                        <CommandCreateButton onClick={() => setCreatePartyOpen(true)}>
                          Create customer
                        </CommandCreateButton>
                      </div>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Invoice Selection */}
              {selectedPartyId && !manualEntry && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Customer Invoices</h3>
                      <p className="text-xs text-muted-foreground">
                        Select an invoice to pre-fill returned items, or skip to enter manually.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setManualEntry(true);
                        setSelectedInvoiceId(null);
                        setSelectedInvoiceNumber(null);
                        setSelectedLineItems([]);
                      }}
                    >
                      Skip, enter manually
                    </Button>
                  </div>

                  {loadingInvoices ? (
                    <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading invoices...
                    </div>
                  ) : invoices.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No invoices found for this customer. Click "Skip, enter manually" to create return without an invoice reference.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {invoices.map((invoice) => {
                        const checked = selectedInvoiceId === invoice.transactionId?._id;
                        return (
                          <label
                            key={invoice._id}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                              checked
                                ? 'border-emerald-300 bg-emerald-50/60'
                                : 'border-border hover:bg-muted/40',
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={!invoice.transactionId}
                              onCheckedChange={() => {
                                if (invoice.transactionId) {
                                  handleSelectInvoice(invoice);
                                }
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" />
                                    {invoice.invoiceNumber}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {invoice.transactionId
                                      ? new Date(invoice.transactionId.transactionDate).toLocaleDateString('en-IN')
                                      : new Date(invoice.dueDate).toLocaleDateString('en-IN')}
                                    {invoice.transactionId && (
                                      <> · {invoice.transactionId.lineItems?.length || 0} items</>
                                    )}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <Badge variant={getInvoiceBadgeVariant(invoice.status)}>
                                    {invoice.status}
                                  </Badge>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    ₹{(invoice.transactionId?.summary?.grandTotal || 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {manualEntry && (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
                  You chose to enter items manually. Click proceed to add return items.
                </div>
              )}

              {loadingTransaction && (
                <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading invoice items...
                </div>
              )}

              {selectedLineItems.length > 0 && (
                <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                  Loaded {selectedLineItems.length} item(s) from invoice {selectedInvoiceNumber}. You can adjust quantities and prices before confirming.
                </div>
              )}

              <div className="flex justify-end gap-3 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleProceedToForm} disabled={!selectedPartyId}>
                  Proceed to Return Form
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>Create Sale Return</DialogTitle>
              <DialogDescription>
                {selectedInvoiceNumber
                  ? `Return from invoice ${selectedInvoiceNumber}`
                  : 'Record customer returns. Confirming this transaction adds stock back.'}
              </DialogDescription>
            </DialogHeader>

            <TransactionForm
              mode="sale-return"
              isOpen={open && step === 'form'}
              onSuccess={handleFormSuccess}
              onCancel={() => setOpen(false)}
              initialLineItems={selectedLineItems.length > 0 ? selectedLineItems : undefined}
              initialParty={selectedPartyId}
              disablePartySelection={true}
              sourceLabel={
                selectedInvoiceNumber
                  ? `Return against invoice ${selectedInvoiceNumber} — Items pre-filled from invoice. You can adjust quantities and prices.`
                  : `Return for ${selectedPartyDisplay || 'selected customer'} — Enter items manually.`
              }
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
