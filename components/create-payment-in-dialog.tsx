'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import CommandCreateButton from '@/components/command-create-button';
import CreatePartyDialog, { type CreatedParty } from '@/components/create-party-dialog';
import { cn, roundCurrency } from '@/lib/utils';
import { allocateInvoiceSettlements } from '@/lib/payment-settlement';

const requiredPartySchema = z.preprocess(
  (value) => (value === undefined || value === null ? '' : value),
  z.string().trim().min(1, 'Customer is required'),
);

const paymentFormSchema = z.object({
  party: requiredPartySchema,
  transactionDate: z.coerce.date().default(() => new Date()),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  settlementDiscount: z.coerce.number().min(0, 'Discount cannot be negative').default(0),
  appliedInvoiceIds: z.array(z.string()).default([]),
  payment: z.object({
    method: z.enum(['cash', 'card', 'upi', 'bank-transfer', 'cheque', 'other']).optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).default(() => ({
    method: null,
    referenceNumber: null,
    notes: null,
  })),
  notes: z.string().optional().nullable(),
});

type PaymentMethod =
  | 'cash'
  | 'card'
  | 'upi'
  | 'bank-transfer'
  | 'cheque'
  | 'other';

interface PaymentFormValues {
  party: string;
  transactionDate: Date;
  amount: number;
  settlementDiscount: number;
  appliedInvoiceIds: string[];
  payment: {
    method?: PaymentMethod | null;
    referenceNumber?: string | null;
    notes?: string | null;
  };
  notes?: string | null;
}

interface PartyOption {
  _id: string;
  displayName?: string | null;
  name?: string | null;
  fullName?: string | null;
  partyName?: string | null;
  phoneNumber?: string | null;
  alternatePhoneNumber?: string | null;
  mobile?: string | null;
  phone?: string | null;
  partyType?: 'customer' | 'supplier' | 'both';
}

interface OpenInvoiceOption {
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
  } | null;
}

interface CreatePaymentInDialogProps {
  onCreated?: () => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialPartyId?: string | null;
  initialPartyName?: string | null;
  initialPartyPhone?: string | null;
  initialSelectedInvoiceIds?: string[];
  editingTransactionId?: string | null;
  initialValues?: {
    party: string;
    transactionDate: Date;
    amount: number;
    settlementDiscount: number;
    payment: {
      method?: string | null;
      referenceNumber?: string | null;
      notes?: string | null;
    } | null;
    notes?: string | null;
  } | null;
}

function getDefaultPaymentValues(
  initialPartyId?: string | null,
  initialSelectedInvoiceIds: string[] = [],
): PaymentFormValues {
  return {
    party: initialPartyId ?? '',
    transactionDate: new Date(),
    amount: 0,
    settlementDiscount: 0,
    appliedInvoiceIds: initialSelectedInvoiceIds,
    payment: {
      method: null,
      referenceNumber: null,
      notes: null,
    },
    notes: null,
  };
}

function getInvoiceBadgeVariant(status: OpenInvoiceOption['status']) {
  if (status === 'paid') return 'default';
  if (status === 'overdue') return 'destructive';
  return 'secondary';
}

export default function CreatePaymentInDialog({
  onCreated,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialPartyId,
  initialPartyName,
  initialPartyPhone,
  initialSelectedInvoiceIds,
  editingTransactionId,
  initialValues,
}: CreatePaymentInDialogProps) {
  const initialPartyIdRef = useRef(initialPartyId);
  const initialPartyNameRef = useRef(initialPartyName);
  const initialPartyPhoneRef = useRef(initialPartyPhone);
  const initialSelectedInvoiceIdsRef = useRef(initialSelectedInvoiceIds ?? []);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'draft' | 'confirmed' | null>(null);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [createPartyOpen, setCreatePartyOpen] = useState(false);
  const [partyPopoverOpen, setPartyPopoverOpen] = useState(false);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceOption[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema) as never,
    defaultValues: getDefaultPaymentValues(
      initialPartyIdRef.current,
      initialSelectedInvoiceIdsRef.current,
    ),
  });

  const handleOpenChange = useCallback((value: boolean) => {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(value);
    } else {
      setInternalOpen(value);
    }

    if (!value) {
      onCreated?.();
    }
  }, [controlledOnOpenChange, onCreated]);

  const isEditing = !!editingTransactionId;

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.reset({
          party: initialValues.party,
          transactionDate: initialValues.transactionDate,
          amount: initialValues.amount,
          settlementDiscount: initialValues.settlementDiscount,
          appliedInvoiceIds: [],
          payment: {
            method: (initialValues.payment?.method as PaymentMethod) || null,
            referenceNumber: initialValues.payment?.referenceNumber || null,
            notes: initialValues.payment?.notes || null,
          },
          notes: initialValues.notes || null,
        });
      } else {
        form.reset(
          getDefaultPaymentValues(
            initialPartyIdRef.current,
            initialSelectedInvoiceIdsRef.current,
          ),
        );
      }
      setPartySearchQuery('');
      setOpenInvoices([]);
    }
  }, [open, form, initialValues]);

  const selectedPartyId = form.watch('party');
  const enteredAmount = Number(form.watch('amount') || 0);
  const settlementDiscount = Number(form.watch('settlementDiscount') || 0);
  const watchedAppliedInvoiceIds = form.watch('appliedInvoiceIds');
  const selectedInvoiceIds = useMemo(
    () => watchedAppliedInvoiceIds ?? [],
    [watchedAppliedInvoiceIds],
  );

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

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!selectedPartyId) {
      setOpenInvoices([]);
      return;
    }

    async function loadOpenInvoices() {
      try {
        setLoadingInvoices(true);
        const res = await fetch(
          `/api/invoices?party=${selectedPartyId}&settlement=open&limit=100`,
        );
        const data: { data?: OpenInvoiceOption[] } = await res.json();

        if (!res.ok) {
          throw new Error(data ? 'Failed to load invoices' : 'Failed to load invoices');
        }

        const invoices = [...(data.data || [])].sort((left, right) => {
          const leftTime = new Date(
            left.dueDate || left.transactionId?.transactionDate || 0,
          ).getTime();
          const rightTime = new Date(
            right.dueDate || right.transactionId?.transactionDate || 0,
          ).getTime();

          return leftTime - rightTime;
        });

        setOpenInvoices(invoices);

        const currentSelectedIds = form.getValues('appliedInvoiceIds') || [];
        const validSelectedIds = currentSelectedIds.filter((invoiceId) =>
          invoices.some((invoice) => invoice._id === invoiceId),
        );

        if (
          validSelectedIds.length === 0 &&
          selectedPartyId === initialPartyIdRef.current &&
          initialSelectedInvoiceIdsRef.current.length > 0
        ) {
          form.setValue(
            'appliedInvoiceIds',
            initialSelectedInvoiceIdsRef.current.filter((invoiceId) =>
              invoices.some((invoice) => invoice._id === invoiceId),
            ),
          );
          return;
        }

        if (validSelectedIds.length !== currentSelectedIds.length) {
          form.setValue('appliedInvoiceIds', validSelectedIds);
        }
      } catch (error) {
        console.error('Failed to load open invoices', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to load invoices',
        );
        setOpenInvoices([]);
      } finally {
        setLoadingInvoices(false);
      }
    }

    void loadOpenInvoices();
  }, [form, open, selectedPartyId]);

  const selectedInvoices = useMemo(() => {
    return openInvoices.filter((invoice) =>
      selectedInvoiceIds.includes(invoice._id),
    );
  }, [openInvoices, selectedInvoiceIds]);

  const settlementPreview = useMemo(() => {
    return allocateInvoiceSettlements(
      selectedInvoices.map((invoice) => ({
        invoiceId: invoice._id,
        dueAmount: roundCurrency(
          invoice.transactionId?.summary?.dueAmount || 0,
        ),
      })),
      enteredAmount,
      settlementDiscount,
    );
  }, [enteredAmount, selectedInvoices, settlementDiscount]);

  const selectedSettlementDueTotal = useMemo(() => {
    return roundCurrency(
      selectedInvoices.reduce(
        (total, invoice) => total + (invoice.transactionId?.summary?.dueAmount || 0),
        0,
      ),
    );
  }, [selectedInvoices]);

  const settlementPreviewByInvoiceId = useMemo(() => {
    return new Map(
      settlementPreview.allocations.map((allocation) => [
        allocation.invoiceId,
        allocation,
      ]),
    );
  }, [settlementPreview.allocations]);

  const totalRemainingDueAfterSettlement = useMemo(() => {
    return roundCurrency(
      settlementPreview.allocations.reduce(
        (total, allocation) => total + allocation.remainingDueAmount,
        0,
      ),
    );
  }, [settlementPreview.allocations]);

  const disableDraftForSettlements =
    selectedInvoiceIds.length > 0 || settlementDiscount > 0;

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
    form.setValue('party', createdParty._id, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setPartySearchQuery('');
    setCreatePartyOpen(false);
  }

  async function submitPayment(status: 'draft' | 'confirmed') {
    const values = form.getValues();
    const amount = roundCurrency(Number(values.amount || 0));
    const discount = roundCurrency(Number(values.settlementDiscount || 0));

    if (amount <= 0 && discount <= 0) {
      form.setError('amount', {
        type: 'manual',
        message: 'Enter a payment amount or discount',
      });
      return;
    }

    if (discount > 0 && values.appliedInvoiceIds.length === 0) {
      toast.error('Select at least one invoice before applying a discount');
      return;
    }

    if (status === 'draft' && disableDraftForSettlements) {
      toast.error('Invoice-linked payments must be confirmed directly');
      return;
    }

    setLoading(true);
    setSubmitStatus(status);

    try {
      const payload = {
        type: 'payment-in',
        party: values.party,
        transactionDate: values.transactionDate,
        lineItems: [],
        summary: {
          roundOff: 0,
          grandTotal: amount,
          paidAmount: amount,
        },
        payment: values.payment,
        appliedInvoiceIds: values.appliedInvoiceIds,
        appliedTransactionIds: [],
        paymentDiscountAmount: discount,
        notes: values.notes,
        tags: [],
        status,
      };

      const url = isEditing
        ? `/api/transactions/${editingTransactionId}`
        : '/api/transactions';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Failed to save payment transaction');
      }

      toast.success(
        isEditing
          ? 'Payment in updated successfully'
          : status === 'draft'
            ? 'Payment in saved as draft'
            : 'Payment in recorded successfully',
      );
      form.reset(
        getDefaultPaymentValues(
          initialPartyIdRef.current,
          initialSelectedInvoiceIdsRef.current,
        ),
      );
      handleOpenChange(false);
      onCreated?.();
    } catch (error) {
      console.error('Failed to save payment transaction:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save payment transaction',
      );
    } finally {
      setLoading(false);
      setSubmitStatus(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          {children || (
            <Button variant="default">
              + Payment In
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl bg-background dark:bg-gray-900 rounded-none sm:rounded-lg p-4 sm:p-6">
        <CreatePartyDialog
          defaultPartyType="customer"
          onPartyCreated={handleCreatedParty}
          open={createPartyOpen}
          onOpenChange={setCreatePartyOpen}
          showTrigger={false}
        />
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Payment In' : 'Record Payment In'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the draft payment details.' : 'Record money received from a customer or party.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(() => submitPayment('confirmed'))(event);
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="party"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Customer *</FormLabel>
                    <Popover open={partyPopoverOpen} onOpenChange={setPartyPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full justify-between bg-background dark:bg-background',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            {field.value
                              ? (() => {
                                  const party = parties.find((entry) => entry._id === field.value);
                                  if (!party) {
                                    if (!initialPartyNameRef.current || field.value !== initialPartyIdRef.current) {
                                      return 'Select customer';
                                    }

                                    return initialPartyPhoneRef.current
                                      ? `${initialPartyNameRef.current} (${initialPartyPhoneRef.current})`
                                      : initialPartyNameRef.current;
                                  }

                                  return party.displayName || party.name;
                                })()
                              : 'Select customer'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 bg-background dark:bg-background">
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

                                if (search === '') {
                                  return parties;
                                }

                                return parties.filter((party) => {
                                  const partyName =
                                    party.displayName || party.name || party.fullName || party.partyName || '';
                                  const phone =
                                    party.phoneNumber ||
                                    party.alternatePhoneNumber ||
                                    party.mobile ||
                                    party.phone ||
                                    '';

                                  return (
                                    partyName.toLowerCase().includes(search) ||
                                    phone.toLowerCase().includes(search)
                                  );
                                });
                              })().map((party) => (
                                <CommandItem
                                  value={party._id}
                                  key={party._id}
                                  onSelect={() => {
                                    field.onChange(party._id);
                                    setPartyPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      party._id === field.value ? 'opacity-100' : 'opacity-0',
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {party.displayName || party.name}
                                    </span>
                                    {(party.phoneNumber ||
                                      party.alternatePhoneNumber ||
                                      party.mobile ||
                                      party.phone) && (
                                      <span className="text-xs text-muted-foreground">
                                        {party.phoneNumber ||
                                          party.alternatePhoneNumber ||
                                          party.mobile ||
                                          party.phone}
                                      </span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={new Date(field.value).toISOString().split('T')[0]}
                        onChange={(event) => field.onChange(new Date(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="settlementDiscount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Discount</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      This discount will also settle the selected invoice dues.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Open Invoices</h3>
                  <p className="text-xs text-muted-foreground">
                    Select unpaid or partial invoices for this customer. Payments are applied oldest first.
                  </p>
                </div>
                <Badge variant="outline">
                  {selectedInvoices.length} selected
                </Badge>
              </div>

              {!selectedPartyId ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Select a customer to load open invoices.
                </div>
              ) : loadingInvoices ? (
                <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading open invoices...
                </div>
              ) : openInvoices.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No unpaid or partial invoices found for this customer.
                </div>
              ) : (
                <div className="space-y-2">
                  {openInvoices.map((invoice) => {
                    const checked = selectedInvoiceIds.includes(invoice._id);
                    const preview = settlementPreviewByInvoiceId.get(invoice._id);

                    return (
                      <label
                        key={invoice._id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                          checked
                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/40'
                            : 'border-border hover:bg-muted/40',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(isChecked) => {
                            const nextValue = isChecked
                              ? [...selectedInvoiceIds, invoice._id]
                              : selectedInvoiceIds.filter((invoiceId) => invoiceId !== invoice._id);

                            form.setValue('appliedInvoiceIds', nextValue, {
                              shouldDirty: true,
                              shouldTouch: true,
                            });
                          }}
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-medium text-sm">
                                {invoice.invoiceNumber}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Transaction: {invoice.transactionId?.transactionNumber || '-'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Due Date: {new Date(invoice.dueDate).toLocaleDateString('en-IN')}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <Badge variant={getInvoiceBadgeVariant(invoice.status)}>
                                {invoice.status}
                              </Badge>
                              <p className="mt-2 text-sm font-medium">
                                Due: ₹{(invoice.transactionId?.summary?.dueAmount || 0).toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Paid: ₹{(invoice.transactionId?.summary?.paidAmount || 0).toFixed(2)} / ₹{(invoice.transactionId?.summary?.grandTotal || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {checked && preview && preview.settledAmount > 0 && (
                            <div className="rounded-md bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                Will settle:
                              </span>{' '}
                              ₹{preview.appliedAmount.toFixed(2)}
                              {preview.discountAmount > 0 && (
                                <> + discount ₹{preview.discountAmount.toFixed(2)}</>
                              )}
                              {preview.remainingDueAmount > 0 && (
                                <> | Remaining due ₹{preview.remainingDueAmount.toFixed(2)}</>
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {(selectedInvoices.length > 0 || enteredAmount > 0 || settlementDiscount > 0) && (
                <div className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Selected invoice dues</span>
                    <span>₹{selectedSettlementDueTotal.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Cash to apply</span>
                    <span>₹{settlementPreview.totalAppliedAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Discount to apply</span>
                    <span>₹{settlementPreview.totalDiscountAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between font-medium">
                    <span>Total settlement</span>
                    <span>₹{settlementPreview.totalSettledAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Remaining dues</span>
                    <span>₹{totalRemainingDueAfterSettlement.toFixed(2)}</span>
                  </div>
                  {(settlementPreview.remainingCashAmount > 0 ||
                    settlementPreview.remainingDiscountAmount > 0) && (
                    <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                      Unapplied balance:
                      {settlementPreview.remainingCashAmount > 0 && (
                        <> cash ₹{settlementPreview.remainingCashAmount.toFixed(2)}</>
                      )}
                      {settlementPreview.remainingCashAmount > 0 &&
                        settlementPreview.remainingDiscountAmount > 0 && (
                          <>, </>
                        )}
                      {settlementPreview.remainingDiscountAmount > 0 && (
                        <>discount ₹{settlementPreview.remainingDiscountAmount.toFixed(2)}</>
                      )}
                    </div>
                  )}
                </div>
              )}

              <FormField
                control={form.control}
                name="appliedInvoiceIds"
                render={() => (
                  <FormItem>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="payment.method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value || 'none'}>
                      <FormControl>
                        <SelectTrigger className="bg-background dark:bg-background">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment.referenceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Number</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="Transaction / cheque number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payment.notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ''}
                      placeholder="Notes about this payment method"
                      className="min-h-20"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ''}
                      placeholder="Additional notes for this transaction"
                      className="min-h-20"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading || disableDraftForSettlements}
                onClick={() => void form.handleSubmit(() => submitPayment('draft'))()}
              >
                {loading && submitStatus === 'draft' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Draft...
                  </>
                ) : (
                  'Save as Draft'
                )}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && submitStatus === 'confirmed' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Confirm Payment In'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
