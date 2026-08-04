'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Check, ChevronsUpDown, ShoppingBag } from 'lucide-react';
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

interface PurchaseTransactionLineItem {
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

interface PurchaseTransactionOption {
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
  lineItems: PurchaseTransactionLineItem[];
}

interface CreatePurchaseReturnDialogProps {
  onPurchaseReturnCreated?: () => void;
  children?: React.ReactNode;
}

export default function CreatePurchaseReturnDialog({ onPurchaseReturnCreated, children }: CreatePurchaseReturnDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'form'>('select');

  // Party selection
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [createPartyOpen, setCreatePartyOpen] = useState(false);
  const [partyPopoverOpen, setPartyPopoverOpen] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedPartyName, setSelectedPartyName] = useState<string | null>(null);

  // Purchase transaction listing
  const [purchaseTransactions, setPurchaseTransactions] = useState<PurchaseTransactionOption[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [selectedTransactionNumber, setSelectedTransactionNumber] = useState<string | null>(null);
  const [selectedLineItems, setSelectedLineItems] = useState<PurchaseTransactionLineItem[]>([]);
  const [loadingTransactionDetails, setLoadingTransactionDetails] = useState(false);

  // Track if user wants manual entry
  const [manualEntry, setManualEntry] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('select');
      setSelectedPartyId(null);
      setSelectedPartyName(null);
      setSelectedTransactionId(null);
      setSelectedTransactionNumber(null);
      setSelectedLineItems([]);
      setPartySearchQuery('');
      setPurchaseTransactions([]);
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

  // Load purchase transactions when party is selected
  useEffect(() => {
    if (!open || !selectedPartyId || manualEntry) {
      setPurchaseTransactions([]);
      return;
    }

    async function loadPurchaseTransactions() {
      try {
        setLoadingTransactions(true);
        const res = await fetch(
          `/api/transactions?party=${selectedPartyId}&type=purchase&status=confirmed&limit=100`,
        );
        const data: { data?: PurchaseTransactionOption[] } = await res.json();

        if (!res.ok) {
          throw new Error('Failed to load purchase transactions');
        }

        // Defense-in-depth: only show confirmed transactions with active payment status
        // Exclude void paymentStatus as those are not valid for returns
        const returnableTransactions = (data.data || []).filter(
          (txn) => txn.paymentStatus !== 'void',
        );
        setPurchaseTransactions(returnableTransactions);
      } catch (error) {
        console.error('Failed to load purchase transactions', error);
        setPurchaseTransactions([]);
      } finally {
        setLoadingTransactions(false);
      }
    }

    void loadPurchaseTransactions();
  }, [open, selectedPartyId, manualEntry]);

  // Fetch full transaction details (with line items) when transaction selected
  useEffect(() => {
    if (!selectedTransactionId) {
      setSelectedLineItems([]);
      return;
    }

    async function loadTransactionDetails() {
      try {
        setLoadingTransactionDetails(true);
        const res = await fetch(`/api/transactions/${selectedTransactionId}`);
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
        toast.error('Failed to load purchase line items');
        setSelectedLineItems([]);
      } finally {
        setLoadingTransactionDetails(false);
      }
    }

    void loadTransactionDetails();
  }, [selectedTransactionId]);

  const selectedPartyDisplay = useMemo(() => {
    if (!selectedPartyId) return null;
    const party = parties.find((p) => p._id === selectedPartyId);
    if (!party) return null;
    return party.displayName || party.name;
  }, [selectedPartyId, parties]);

  function handleSelectTransaction(purchaseTransaction: PurchaseTransactionOption) {
    setSelectedTransactionId(purchaseTransaction._id);
    setSelectedTransactionNumber(purchaseTransaction.transactionNumber);
  }

  function handleProceedToForm() {
    if (!manualEntry && !selectedTransactionId && purchaseTransactions.length > 0) {
      toast.error('Select a purchase transaction or choose manual entry');
      return;
    }
    if (!selectedPartyId) {
      toast.error('Select a supplier');
      return;
    }
    setStep('form');
  }

  function handleFormSuccess() {
    setOpen(false);
    onPurchaseReturnCreated?.();
  }

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
    setSelectedPartyId(createdParty._id);
    setSelectedPartyName(
      createdParty.displayName ||
        createdParty.name ||
        createdParty.fullName ||
        createdParty.partyName ||
        null,
    );
    setSelectedTransactionId(null);
    setSelectedTransactionNumber(null);
    setSelectedLineItems([]);
    setManualEntry(false);
    setPartySearchQuery('');
    setCreatePartyOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="default">
            + Purchase Return
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={`bg-background dark:bg-gray-900 ${
          step === 'form' ? 'sm:max-w-5xl' : 'sm:max-w-2xl'
        } max-h-dvh overflow-y-auto p-4 sm:p-6`}
      >
        <CreatePartyDialog
          defaultPartyType="supplier"
          onPartyCreated={handleCreatedParty}
          open={createPartyOpen}
          onOpenChange={setCreatePartyOpen}
          showTrigger={false}
        />
        {step === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>Create Purchase Return</DialogTitle>
              <DialogDescription>
                Select a supplier and optionally pick a purchase transaction to return items from.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {/* Party Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Supplier</label>
                <Popover open={partyPopoverOpen} onOpenChange={setPartyPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        'w-full justify-between bg-background dark:bg-background',
                        !selectedPartyId && 'text-muted-foreground',
                      )}
                    >
                      {selectedPartyDisplay || 'Select supplier'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-background dark:bg-gray-900 border border-border" align="start" side="bottom" avoidCollisions={false}>
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
                                  setSelectedTransactionId(null);
                                  setSelectedTransactionNumber(null);
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
                          Create supplier
                        </CommandCreateButton>
                      </div>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Purchase Transaction Selection */}
              {selectedPartyId && !manualEntry && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Supplier Purchases</h3>
                      <p className="text-xs text-muted-foreground">
                        Select a purchase transaction to pre-fill returned items, or skip to enter manually.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setManualEntry(true);
                        setSelectedTransactionId(null);
                        setSelectedTransactionNumber(null);
                        setSelectedLineItems([]);
                      }}
                    >
                      Skip, enter manually
                    </Button>
                  </div>

                  {loadingTransactions ? (
                    <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading purchase transactions...
                    </div>
                  ) : purchaseTransactions.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No purchases found for this supplier. Click "Skip, enter manually" to create return without a purchase reference.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {purchaseTransactions.map((purchaseTransaction) => {
                        const checked = selectedTransactionId === purchaseTransaction._id;
                        return (
                          <label
                            key={purchaseTransaction._id}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                              checked
                                ? 'border-orange-300 dark:border-orange-700 bg-orange-50/60 dark:bg-orange-950/40'
                                : 'border-border hover:bg-muted/40',
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => {
                                handleSelectTransaction(purchaseTransaction);
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm flex items-center gap-1">
                                    <ShoppingBag className="h-3.5 w-3.5" />
                                    {purchaseTransaction.transactionNumber}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(purchaseTransaction.transactionDate).toLocaleDateString('en-IN')}
                                    {purchaseTransaction.dueDate && (
                                      <> · Due: {new Date(purchaseTransaction.dueDate).toLocaleDateString('en-IN')}</>
                                    )}
                                    <> · {purchaseTransaction.lineItems?.length || 0} items</>
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <Badge variant="secondary">
                                    {purchaseTransaction.paymentStatus}
                                  </Badge>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    ₹{purchaseTransaction.summary.grandTotal.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                                <span>Due: <span className="font-medium">₹{purchaseTransaction.summary.dueAmount.toFixed(2)}</span></span>
                                <span>Paid: ₹{purchaseTransaction.summary.paidAmount.toFixed(2)}</span>
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
                <div className="rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
                  You chose to enter items manually. Click proceed to add return items.
                </div>
              )}

              {loadingTransactionDetails && (
                <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading purchase items...
                </div>
              )}

              {selectedLineItems.length > 0 && (
                <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-200">
                  Loaded {selectedLineItems.length} item(s) from purchase {selectedTransactionNumber}. You can adjust quantities and prices before confirming.
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
              <DialogTitle>Create Purchase Return</DialogTitle>
              <DialogDescription>
                {selectedTransactionNumber
                  ? `Return from purchase ${selectedTransactionNumber}`
                  : 'Record supplier returns. Confirming this transaction removes stock.'}
              </DialogDescription>
            </DialogHeader>

            <TransactionForm
              mode="purchase-return"
              isOpen={open && step === 'form'}
              onSuccess={handleFormSuccess}
              onCancel={() => setOpen(false)}
              initialLineItems={selectedLineItems.length > 0 ? selectedLineItems : undefined}
              initialParty={selectedPartyId}
              disablePartySelection={true}
              sourceLabel={
                selectedTransactionNumber
                  ? `Return against purchase ${selectedTransactionNumber} — Items pre-filled from purchase. You can adjust quantities and prices.`
                  : `Return for ${selectedPartyDisplay || 'selected supplier'} — Enter items manually.`
              }
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
