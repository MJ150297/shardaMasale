'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const paymentFormSchema = z.object({
  party: z.string().optional().nullable(),
  transactionDate: z.coerce.date().default(() => new Date()),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
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

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

type PaymentDialogType = 'payment-in' | 'payment-out';

interface CreatePaymentDialogProps {
  type: PaymentDialogType;
  onCreated?: () => void;
  children?: React.ReactNode;
}

function getDialogCopy(type: PaymentDialogType) {
  if (type === 'payment-in') {
    return {
      title: 'Record Payment In',
      description: 'Record money received from a customer or party.',
      buttonLabel: '+ Payment In',
      partyLabel: 'Customer',
      partyPlaceholder: 'customer',
      successLabel: 'Payment in',
      buttonClassName: 'bg-teal-600 hover:bg-teal-700 text-white',
    };
  }

  return {
    title: 'Record Payment Out',
    description: 'Record money paid to a supplier or party.',
    buttonLabel: '+ Payment Out',
    partyLabel: 'Supplier',
    partyPlaceholder: 'supplier',
    successLabel: 'Payment out',
    buttonClassName: 'bg-rose-600 hover:bg-rose-700 text-white',
  };
}

export default function CreatePaymentDialog({ type, onCreated, children }: CreatePaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'draft' | 'confirmed' | null>(null);
  const [parties, setParties] = useState<any[]>([]);
  const [partySearchQuery, setPartySearchQuery] = useState('');

  const copy = getDialogCopy(type);
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema) as any,
    defaultValues: {
      party: null,
      transactionDate: new Date(),
      amount: 0,
      payment: {
        method: null,
        referenceNumber: null,
        notes: null,
      },
      notes: null,
    },
  });

  useEffect(() => {
    if (!open) return;

    async function loadParties() {
      try {
        const allowedTypes =
          type === 'payment-in' ? ['customer', 'both'] : ['supplier', 'both'];

        const res = await fetch('/api/parties?limit=1000');
        const data = await res.json();

        if (res.ok) {
          const filtered = (data.parties || []).filter((party: any) => {
            return party.partyType === undefined || allowedTypes.includes(party.partyType);
          });

          setParties(filtered);
        }
      } catch (error) {
        console.error('Failed to load parties', error);
      }
    }

    void loadParties();
  }, [open, type]);

  async function submitPayment(status: 'draft' | 'confirmed') {
    const values = form.getValues();

    setLoading(true);
    setSubmitStatus(status);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          party: values.party,
          transactionDate: values.transactionDate,
          lineItems: [],
          summary: {
            roundOff: 0,
            grandTotal: values.amount,
            paidAmount: values.amount,
          },
          payment: values.payment,
          notes: values.notes,
          tags: [],
          status,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Failed to create payment transaction');
      }

      toast.success(
        status === 'draft'
          ? `${copy.successLabel} saved as draft`
          : `${copy.successLabel} recorded successfully`,
      );
      form.reset();
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className={copy.buttonClassName}>
            {copy.buttonLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl bg-white">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
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
                    <FormLabel>{copy.partyLabel}</FormLabel>
                    <Popover>
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
                                  if (!party) return `Select ${copy.partyPlaceholder}`;

                                  return party.phoneNumber
                                    ? `${party.displayName || party.name} (${party.phoneNumber})`
                                    : party.displayName || party.name;
                                })()
                              : `Select ${copy.partyPlaceholder}`}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder={`Search ${copy.partyPlaceholder} by name or phone...`}
                            className="h-9"
                            value={partySearchQuery}
                            onValueChange={setPartySearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>No party found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  field.onChange(null);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    field.value === null ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                None
                              </CommandItem>
                              {(() => {
                                const search = partySearchQuery.toLowerCase();

                                if (search === '') {
                                  return parties;
                                }

                                return parties.filter((party) => {
                                  const partyName =
                                    party.displayName || party.name || party.fullName || party.partyName || '';
                                  const phone = party.phoneNumber || party.mobile || party.phone || '';

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
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      party._id === field.value ? 'opacity-100' : 'opacity-0',
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{party.displayName || party.name}</span>
                                    {party.phoneNumber && (
                                      <span className="text-xs text-muted-foreground">{party.phoneNumber}</span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
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

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
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
                  type === 'payment-in' ? 'Confirm Payment In' : 'Confirm Payment Out'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
