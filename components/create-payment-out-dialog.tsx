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
  z.string().trim().min(1, 'Supplier is required'),
);

const paymentFormSchema = z.object({
  party: requiredPartySchema,
  transactionDate: z.coerce.date().default(() => new Date()),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  appliedTransactionIds: z.array(z.string()).default([]),
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
  appliedTransactionIds: string[];
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

interface OpenPurchaseTransactionOption {
  _id: string;
  transactionNumber: string;
  transactionDate: string | Date;
  dueDate?: string | Date | null;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'void' | 'not-applicable';
  summary: {
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
  };
}

interface CreatePaymentOutDialogProps {
  onCreated?: () => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialPartyId?: string | null;
  initialPartyName?: string | null;
  initialPartyPhone?: string | null;
  initialSelectedTransactionIds?: string[];
  editingTransactionId?: string | null;
  initialValues?: {
    party: string;
    transactionDate: Date;
    amount: number;
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
  initialSelectedTransactionIds: string[] = [],
): PaymentFormValues {
  return {
    party: initialPartyId ?? '',
    transactionDate: new Date(),
    amount: 0,
    appliedTransactionIds: initialSelectedTransactionIds,
    payment: {
      method: null,
      referenceNumber: null,
      notes: null,
    },
    notes: null,
  };
}

export default function CreatePaymentOutDialog({
  onCreated,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialPartyId,
  initialPartyName,
  initialPartyPhone,
  initialSelectedTransactionIds,
  editingTransactionId,
  initialValues,
}: CreatePaymentOutDialogProps) {
  const initialPartyIdRef = useRef(initialPartyId);
  const initialPartyNameRef = useRef(initialPartyName);
  const initialPartyPhoneRef = useRef(initialPartyPhone);
  const initialSelectedTransactionIdsRef = useRef(initialSelectedTransactionIds ?? []);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'draft' | 'confirmed' | null>(null);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [createPartyOpen, setCreatePartyOpen] = useState(false);
  const [partyPopoverOpen, setPartyPopoverOpen] = useState(false);
  const [openPurchaseTransactions, setOpenPurchaseTransactions] = useState<
    OpenPurchaseTransactionOption[]
  >([]);
  const [loadingPurchaseTransactions, setLoadingPurchaseTransactions] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema) as never,
    defaultValues: getDefaultPaymentValues(
      initialPartyIdRef.current,
      initialSelectedTransactionIdsRef.current,
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
          appliedTransactionIds: [],
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
            initialSelectedTransactionIdsRef.current,
          ),
        );
      }
      setPartySearchQuery('');
      setOpenPurchaseTransactions([]);
    }
  }, [open, form, initialValues]);

  const selectedPartyId = form.watch('party');
  const enteredAmount = Number(form.watch('amount') || 0);
  const watchedAppliedTransactionIds = form.watch('appliedTransactionIds');
  const selectedTransactionIds = useMemo(
    () => watchedAppliedTransactionIds ?? [],
    [watchedAppliedTransactionIds],
  );

  useEffect(() => {
    if (!open) return;

    async function loadParties() {
      try {
        const res = await fetch('/api/parties?limit=1000');
        const data: { parties?: PartyOption[] } = await res.json();

        if (res.ok) {
          const filtered = (data.parties || []).filter((party) => {
            return party.partyType === undefined || ['supplier', 'both'].includes(party.partyType);
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
      setOpenPurchaseTransactions([]);
      return;
    }

    async function loadOpenPurchaseTransactions() {
      try {
        setLoadingPurchaseTransactions(true);
        const res = await fetch(
          `/api/transactions?party=${selectedPartyId}&type=purchase&settlement=open&limit=100`,
        );
        const data: { data?: OpenPurchaseTransactionOption[] } = await res.json();

        if (!res.ok) {
          throw new Error(
            data ? 'Failed to load open purchases' : 'Failed to load open purchases',
          );
        }

        const transactions = [...(data.data || [])].sort((left, right) => {
          const leftTime = new Date(
            left.dueDate || left.transactionDate || 0,
          ).getTime();
          const rightTime = new Date(
            right.dueDate || right.transactionDate || 0,
          ).getTime();

          return leftTime - rightTime;
        });

        setOpenPurchaseTransactions(transactions);

        const currentSelectedIds = form.getValues('appliedTransactionIds') || [];
        const validSelectedIds = currentSelectedIds.filter((transactionId) =>
          transactions.some((transaction) => transaction._id === transactionId),
        );

        if (
          validSelectedIds.length === 0 &&
          selectedPartyId === initialPartyIdRef.current &&
          initialSelectedTransactionIdsRef.current.length > 0
        ) {
          form.setValue(
            'appliedTransactionIds',
            initialSelectedTransactionIdsRef.current.filter((transactionId) =>
              transactions.some((transaction) => transaction._id === transactionId),
            ),
          );
          return;
        }

        if (validSelectedIds.length !== currentSelectedIds.length) {
          form.setValue('appliedTransactionIds', validSelectedIds);
        }
      } catch (error) {
        console.error('Failed to load open purchases', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to load open purchases',
        );
        setOpenPurchaseTransactions([]);
      } finally {
        setLoadingPurchaseTransactions(false);
      }
    }

    void loadOpenPurchaseTransactions();
  }, [form, open, selectedPartyId]);

  const selectedPurchaseTransactions = useMemo(() => {
    return openPurchaseTransactions.filter((transaction) =>
      selectedTransactionIds.includes(transaction._id),
    );
  }, [openPurchaseTransactions, selectedTransactionIds]);

  const settlementPreview = useMemo(() => {
    return allocateInvoiceSettlements(
      selectedPurchaseTransactions.map((transaction) => ({
        invoiceId: transaction._id,
        dueAmount: roundCurrency(transaction.summary?.dueAmount || 0),
      })),
      enteredAmount,
      0,
    );
  }, [enteredAmount, selectedPurchaseTransactions]);

  const selectedSettlementDueTotal = useMemo(() => {
    return roundCurrency(
      selectedPurchaseTransactions.reduce(
        (total, transaction) => total + (transaction.summary?.dueAmount || 0),
        0,
      ),
    );
  }, [selectedPurchaseTransactions]);

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

  const disableDraftForSettlements = selectedTransactionIds.length > 0;

  function handleCreatedParty(createdParty: CreatedParty) {
    if (
      createdParty.partyType !== undefined &&
      !['supplier', 'both'].includes(createdParty.partyType)
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

    if (amount <= 0) {
      form.setError('amount', {
        type: 'manual',
        message: 'Amount must be greater than 0',
      });
      return;
    }

    if (values.appliedTransactionIds.length > 0 && !values.party) {
      toast.error('Select a supplier before applying payment to purchases');
      return;
    }

    if (status === 'draft' && disableDraftForSettlements) {
      toast.error('Purchase-linked payments must be confirmed directly');
      return;
    }

    setLoading(true);
    setSubmitStatus(status);

    try {
      const payload = {
        type: 'payment-out',
        party: values.party,
        transactionDate: values.transactionDate,
        lineItems: [],
        summary: {
          roundOff: 0,
          grandTotal: amount,
          paidAmount: amount,
        },
        payment: values.payment,
        appliedInvoiceIds: [],
        appliedTransactionIds: values.appliedTransactionIds,
        paymentDiscountAmount: 0,
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
          ? 'Payment out updated successfully'
          : status === 'draft'
            ? 'Payment out saved as draft'
            : 'Payment out recorded successfully',
      );
      form.reset(
        getDefaultPaymentValues(
          initialPartyIdRef.current,
          initialSelectedTransactionIdsRef.current,
        ),
      );
      handleOpenChange(false);
      onCreated?.();
    } catch (error) {
      console.error('Failed to create payment transaction:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to create payment transaction',
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
              + Payment Out
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl bg-background dark:bg-gray-900 rounded-none sm:rounded-lg p-4 sm:p-6">
        <CreatePartyDialog
          defaultPartyType="supplier"
          onPartyCreated={handleCreatedParty}
          open={createPartyOpen}
          onOpenChange={setCreatePartyOpen}
          showTrigger={false}
        />
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Payment Out' : 'Record Payment Out'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the draft payment details.' : 'Record money paid to a supplier or party.'}
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
                    <FormLabel>Supplier *</FormLabel>
                    <Popover open={partyPopoverOpen} onOpenChange={setPartyPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full justify-between',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            {field.value
                              ? (() => {
                                  const party = parties.find((entry) => entry._id === field.value);
                                  if (!party) {
                                    if (!initialPartyNameRef.current || field.value !== initialPartyIdRef.current) {
                                      return 'Select supplier';
                                    }

                                    return initialPartyPhoneRef.current
                                      ? `${initialPartyNameRef.current} (${initialPartyPhoneRef.current})`
                                      : initialPartyNameRef.current;
                                  }

                                  return party.displayName || party.name;
                                })()
                              : 'Select supplier'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search supplier by name or phone..."
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
                              Create supplier
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
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Open Purchases</h3>
                  <p className="text-xs text-muted-foreground">
                    Select unpaid or partial purchases for this supplier. Payments are applied oldest first.
                  </p>
                </div>
                <Badge variant="outline">
                  {selectedPurchaseTransactions.length} selected
                </Badge>
              </div>

              {!selectedPartyId ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Select a supplier to load open purchases.
                </div>
              ) : loadingPurchaseTransactions ? (
                <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading open purchases...
                </div>
              ) : openPurchaseTransactions.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No unpaid or partial purchases found for this supplier.
                </div>
              ) : (
                <div className="space-y-2">
                  {openPurchaseTransactions.map((purchaseTransaction) => {
                    const checked = selectedTransactionIds.includes(purchaseTransaction._id);
                    const preview = settlementPreviewByInvoiceId.get(
                      purchaseTransaction._id,
                    );

                    return (
                      <label
                        key={purchaseTransaction._id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                          checked
                            ? 'border-rose-300 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/40'
                            : 'border-border hover:bg-muted/40',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(isChecked) => {
                            const nextValue = isChecked
                              ? [...selectedTransactionIds, purchaseTransaction._id]
                              : selectedTransactionIds.filter(
                                  (transactionId) =>
                                    transactionId !== purchaseTransaction._id,
                                );

                            form.setValue('appliedTransactionIds', nextValue, {
                              shouldDirty: true,
                              shouldTouch: true,
                            });
                          }}
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-medium text-sm">
                                {purchaseTransaction.transactionNumber}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Date:{' '}
                                {new Date(
                                  purchaseTransaction.transactionDate,
                                ).toLocaleDateString('en-IN')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Due Date:{' '}
                                {purchaseTransaction.dueDate
                                  ? new Date(
                                      purchaseTransaction.dueDate,
                                    ).toLocaleDateString('en-IN')
                                  : '-'}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <Badge variant="secondary">
                                {purchaseTransaction.paymentStatus}
                              </Badge>
                              <p className="mt-2 text-sm font-medium">
                                Due: ₹{purchaseTransaction.summary.dueAmount.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Paid: ₹{purchaseTransaction.summary.paidAmount.toFixed(2)} / ₹{purchaseTransaction.summary.grandTotal.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {checked && preview && preview.settledAmount > 0 && (
                            <div className="rounded-md bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                Will settle:
                              </span>{' '}
                              ₹{preview.appliedAmount.toFixed(2)}
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

              {(selectedPurchaseTransactions.length > 0 || enteredAmount > 0) && (
                <div className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Selected purchase dues</span>
                    <span>₹{selectedSettlementDueTotal.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Cash to apply</span>
                    <span>₹{settlementPreview.totalAppliedAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between font-medium">
                    <span>Total settlement</span>
                    <span>₹{settlementPreview.totalSettledAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Remaining dues</span>
                    <span>₹{totalRemainingDueAfterSettlement.toFixed(2)}</span>
                  </div>
                  {settlementPreview.remainingCashAmount > 0 && (
                    <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                      Unapplied balance: cash ₹{settlementPreview.remainingCashAmount.toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              <FormField
                control={form.control}
                name="appliedTransactionIds"
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
                        <SelectTrigger>
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
                  'Confirm Payment Out'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
