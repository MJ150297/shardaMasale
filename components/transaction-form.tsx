'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2, ChevronDown, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import CommandCreateButton from '@/components/command-create-button';
import CreateItemDialog, { type CreatedItem } from '@/components/create-item-dialog';
import CreatePartyDialog, { type CreatedParty } from '@/components/create-party-dialog';

import { roundCurrency } from '@/lib/utils';

const requiredPartySchema = z.preprocess(
  (value) => (value === undefined || value === null ? '' : value),
  z.string().trim().min(1, 'Party is required'),
);

// Transaction Types
const transactionFormSchema = z.object({
  type: z.enum(["sale", "purchase", "sale-return", "purchase-return"]),
  party: requiredPartySchema,
  transactionDate: z.coerce.date().default(() => new Date()),
  dueDate: z.coerce.date().optional().nullable(),
  lineItems: z.array(z.object({
    item: z.string().optional().nullable(),
    itemName: z.string().min(1).max(200),
    sku: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    unit: z.string().min(1).max(20).default("pcs"),
    quantity: z.coerce.number().min(0),
    unitPrice: z.coerce.number().min(0),
    discountAmount: z.coerce.number().min(0).default(0),
    taxRate: z.coerce.number().min(0).max(100).default(0),
    costPrice: z.coerce.number().optional().nullable(),
  })).default([]),
  additionalCharges: z.array(z.object({
    name: z.string().min(1, "Charge name is required"),
    amount: z.coerce.number().min(0, "Amount must be positive"),
  })).default([]),
  summary: z.object({
    roundOff: z.coerce.number().default(0),
    paidAmount: z.coerce.number().min(0).default(0),
    totalDiscountType: z.enum(["percentage", "fixed"]).optional().nullable(),
    totalDiscountValue: z.coerce.number().min(0).optional().nullable(),
  }).default(() => ({ roundOff: 0, paidAmount: 0 })),
  payment: z.object({
    method: z.enum(["cash", "card", "upi", "bank-transfer", "cheque", "other"]).optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["draft", "confirmed", "cancelled"]).default("confirmed"),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

type InventoryTransactionMode =
  | 'sale'
  | 'purchase'
  | 'sale-return'
  | 'purchase-return';

function isSaleFlow(mode: InventoryTransactionMode) {
  return mode === 'sale' || mode === 'sale-return';
}

function getModeLabel(mode: InventoryTransactionMode) {
  switch (mode) {
    case 'sale':
      return 'Sale';
    case 'purchase':
      return 'Purchase';
    case 'sale-return':
      return 'Sale Return';
    case 'purchase-return':
      return 'Purchase Return';
  }
}

function getPartyRole(mode: InventoryTransactionMode) {
  return isSaleFlow(mode) ? 'customer' : 'supplier';
}

function getAllowedPartyTypes(mode: InventoryTransactionMode) {
  return isSaleFlow(mode) ? ['customer', 'both'] : ['supplier', 'both'];
}

function isReturnFlow(mode: InventoryTransactionMode) {
  return mode === 'sale-return' || mode === 'purchase-return';
}

function getItemSellingPrice(item: any) {
  return item.pricing?.sellingPrice ?? item.sellingPrice ?? item.price ?? 0;
}

function getItemPurchasePrice(item: any) {
  return item.pricing?.purchasePrice ?? item.purchasePrice ?? item.pricing?.costPrice ?? item.costPrice ?? 0;
}

function getItemCostPrice(item: any) {
  return item.pricing?.costPrice ?? item.costPrice ?? item.pricing?.purchasePrice ?? item.purchasePrice ?? 0;
}

function getDefaultUnitPrice(item: any, mode: InventoryTransactionMode) {
  return isSaleFlow(mode) ? getItemSellingPrice(item) : getItemPurchasePrice(item);
}

function getDefaultTaxRate(item: any, mode: InventoryTransactionMode) {
  if (!isSaleFlow(mode)) {
    return item.purchaseTaxRate ?? item.taxRate ?? item.saleTaxRate ?? 0;
  }

  return item.saleTaxRate ?? item.taxRate ?? item.purchaseTaxRate ?? 0;
}

function getItemUnit(item: any) {
  return item.unitOfMeasure ?? item.unit ?? 'pcs';
}

interface TransactionFormProps {
  mode: InventoryTransactionMode;
  isOpen: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  editingTransactionId?: string | null;
  initialValues?: Partial<TransactionFormValues> | null;
  initialLineItems?: Array<{
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
  initialParty?: string | null;
  disablePartySelection?: boolean;
  sourceLabel?: string;
}

export default function TransactionForm({
  mode,
  isOpen,
  onSuccess,
  onCancel,
  editingTransactionId,
  initialValues,
  initialLineItems,
  initialParty,
  disablePartySelection,
  sourceLabel,
}: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'draft' | 'confirmed' | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingParties, setLoadingParties] = useState(false);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [createPartyOpen, setCreatePartyOpen] = useState(false);
  const [createItemIndex, setCreateItemIndex] = useState<number | null>(null);
  const [itemSearchQueryByIndex, setItemSearchQueryByIndex] = useState<Record<number, string>>({});
  const [openItemPopoverIndex, setOpenItemPopoverIndex] = useState<number | null>(null);
  const [selectedPartyInfo, setSelectedPartyInfo] = useState<{
    currentBalance: number;
    creditLimit: number;
  } | null>(null);
  const [originalPrices, setOriginalPrices] = useState<Record<string, number>>({});
  const [priceUpdateItems, setPriceUpdateItems] = useState<Record<string, boolean>>({});
  const [additionalChargesExpanded, setAdditionalChargesExpanded] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema) as any,
    defaultValues: {
      type: mode,
      transactionDate: new Date(),
      lineItems: [],
      summary: {
        roundOff: 0,
        paidAmount: 0,
      },
      status: 'confirmed',
    }
  });

  const isEditing = Boolean(editingTransactionId);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems"
  });

  const {
    fields: chargeFields,
    append: appendCharge,
    remove: removeCharge,
  } = useFieldArray({
    control: form.control,
    name: 'additionalCharges',
  });

  // Calculate summary totals - FULL REACTIVITY FOR ALL OPERATIONS
  const lineItems = form.watch('lineItems') || [];
  const lineItemsCount = fields.length;
  // form.watch('lineItems') on the line above provides full reactivity
  const roundOff = roundCurrency(form.watch('summary.roundOff') || 0);
  const paidAmount = roundCurrency(form.watch('summary.paidAmount') || 0);
  const totalDiscountType = form.watch('summary.totalDiscountType');
  const totalDiscountValue = Number(form.watch('summary.totalDiscountValue') || 0);
  const additionalCharges = form.watch('additionalCharges') || [];
  
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  lineItems.forEach(item => {
    const lineSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
    subtotal += lineSubtotal;
    discountTotal += Number(item.discountAmount || 0);
    
    const taxableAmount = lineSubtotal - Number(item.discountAmount || 0);
    taxTotal += taxableAmount * (Number(item.taxRate || 0) / 100);
  });

  // Compute total discount (percentage or fixed)
  let totalDiscount = 0;
  if (totalDiscountType === 'percentage') {
    const baseAmount = subtotal - discountTotal;
    totalDiscount = roundCurrency(baseAmount * (Math.min(totalDiscountValue, 100) / 100));
  } else if (totalDiscountType === 'fixed') {
    totalDiscount = roundCurrency(Math.min(totalDiscountValue, Math.max(subtotal - discountTotal, 0)));
  }

  // Additional charges total
  const additionalChargesTotal = roundCurrency(
    additionalCharges.reduce((total, charge) => total + (Number(charge.amount) || 0), 0)
  );

  const grandTotal = roundCurrency(subtotal - discountTotal - totalDiscount + taxTotal + roundOff + additionalChargesTotal);
  const dueAmount = Math.max(roundCurrency(grandTotal - paidAmount), 0);

  const summary = {
    subtotal: roundCurrency(subtotal),
    discountTotal: roundCurrency(discountTotal),
    taxTotal: roundCurrency(taxTotal),
    totalDiscount: roundCurrency(totalDiscount),
    additionalChargesTotal,
    roundOff,
    grandTotal,
    paidAmount,
    dueAmount
  };

  // Load items for selection
  useEffect(() => {
    async function loadItems() {
      setLoadingItems(true);
      try {
        const res = await fetch('/api/items?limit=5000');
        const data = await res.json();
        
        if (res.ok) {
          const itemsList = data.items || data.data || [];
          setItems(itemsList);
        }
      } catch (e) {
        console.error('Failed to load items', e);
      } finally {
        setLoadingItems(false);
      }
    }
    loadItems();
  }, []);

  // Load parties for selection
  useEffect(() => {
    async function loadParties() {
      setLoadingParties(true);
      try {
        const res = await fetch('/api/parties?limit=5000');
        const data = await res.json();
        
        if (res.ok) {
          // Filter parties by allowed types
          const filtered = (data.parties || []).filter((party: any) => {
            return party.partyType === undefined || getAllowedPartyTypes(mode).includes(party.partyType);
          });
          
          setParties(filtered);
        }
      } catch (e) {
        console.error('Failed to load parties');
      } finally {
        setLoadingParties(false);
      }
    }
    loadParties();
  }, [mode, isOpen]);

  // Watch for party selection changes and fetch balance info
  const selectedPartyId = form.watch('party');
  useEffect(() => {
    if (!selectedPartyId) {
      setSelectedPartyInfo(null);
      return;
    }

    async function fetchPartyBalance() {
      try {
        const res = await fetch(`/api/parties?limit=1&search=`);
        // We already have parties loaded, just find it in the list
        const party = parties.find(p => p._id === selectedPartyId);
        if (party) {
          setSelectedPartyInfo({
            currentBalance: party.currentBalance || 0,
            creditLimit: party.creditLimit || 0,
          });
        }
      } catch (e) {
        console.error('Failed to fetch party balance info');
      }
    }

    fetchPartyBalance();
  }, [selectedPartyId, parties]);

  // Populate initial line items and party when provided
  useEffect(() => {
    if (!isOpen) return;

    if (initialValues) {
      form.reset({
        type: mode,
        party: initialValues.party ?? initialParty ?? '',
        transactionDate: initialValues.transactionDate ? new Date(initialValues.transactionDate as Date | string) : new Date(),
        dueDate: initialValues.dueDate ?? null,
        lineItems: (initialValues.lineItems || initialLineItems || []).map((item) => ({
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
        additionalCharges: initialValues.additionalCharges || [],
        summary: {
          roundOff: initialValues.summary?.roundOff ?? 0,
          paidAmount: initialValues.summary?.paidAmount ?? 0,
          totalDiscountType: initialValues.summary?.totalDiscountType ?? null,
          totalDiscountValue: initialValues.summary?.totalDiscountValue ?? null,
        },
        payment: initialValues.payment ?? null,
        notes: initialValues.notes ?? null,
        tags: initialValues.tags ?? [],
        status: initialValues.status ?? 'draft',
      });
      setOriginalPrices({});
      setPriceUpdateItems({});
      return;
    }

    const lineItemsToSet = (initialLineItems || []).map((item) => ({
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
    }));

    form.reset({
      type: mode,
      party: initialParty ?? '',
      transactionDate: new Date(),
      dueDate: null,
      lineItems: lineItemsToSet,
      additionalCharges: [],
      summary: {
        roundOff: 0,
        paidAmount: 0,
        totalDiscountType: null,
        totalDiscountValue: null,
      },
      payment: null,
      notes: null,
      tags: [],
      status: 'confirmed',
    });
    setOriginalPrices({});
    setPriceUpdateItems({});
  }, [isOpen, initialValues, initialLineItems, initialParty, form, mode]);

  // After parties load, re-assert the party field value to ensure Select shows it
  useEffect(() => {
    if (!editingTransactionId || !initialValues?.party) return;

    const partyId = initialValues.party;

    if (parties.length > 0) {
      const partyExists = parties.some((p: any) => p._id === partyId);
      
      if (!partyExists) {
        // Fetch the missing party by ID directly
        fetch(`/api/parties/${partyId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            const missingParty = data?.data ?? data?.party ?? data ?? null;
            if (missingParty && missingParty._id) {
              setParties((current: any[]) => {
                if (current.some((p: any) => p._id === partyId)) return current;
                return [missingParty, ...current];
              });
            }
          })
          .catch(() => {});
      }

      // Re-assert the form value after parties are available to sync Select
      form.setValue('party', partyId, { shouldDirty: true });
    }
  }, [parties, editingTransactionId, initialValues?.party, form, isOpen]);

  // After items load, ensure line item Select values sync with loaded items
  useEffect(() => {
    if (!editingTransactionId || !initialValues?.lineItems || items.length === 0) return;
    
    const currentLineItems = form.getValues('lineItems') || [];
    let needsUpdate = false;
    
    const updated = currentLineItems.map((li: any) => {
      if (li.item && !items.some((i: any) => i._id === li.item)) {
        // Try to find item by name as fallback
        const matchedItem = items.find((i: any) => 
          i.name?.toLowerCase() === li.itemName?.toLowerCase()
        );
        if (matchedItem) {
          needsUpdate = true;
          return {
            ...li,
            item: matchedItem._id,
            unitPrice: getDefaultUnitPrice(matchedItem, mode),
            taxRate: getDefaultTaxRate(matchedItem, mode),
            unit: getItemUnit(matchedItem),
          };
        }
      }
      return li;
    });
    
    if (needsUpdate) {
      form.setValue('lineItems', updated, { shouldDirty: true });
    }
  }, [items, editingTransactionId, initialValues?.lineItems, form, mode, isOpen]);

  // Only load data when dialog is actually open
  if (!isOpen) return null;

  const updateItemPrices = async (data: TransactionFormValues) => {
    const updatePromises: Promise<any>[] = [];

    data.lineItems.forEach(item => {
      const itemId = item.item;
      if (itemId && priceUpdateItems[itemId]) {
        const newPrice = Number(item.unitPrice) || 0;
        const payload: any = {
          id: itemId,
        };
        // Determine which price field to update based on transaction mode
        if (isSaleFlow(mode)) {
          payload.pricing = { sellingPrice: newPrice };
        } else {
          payload.pricing = { purchasePrice: newPrice };
        }
        updatePromises.push(
          fetch('/api/items', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        );
      }
    });

    if (updatePromises.length === 0) return;

    const results = await Promise.allSettled(updatePromises);
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
    if (failed.length > 0) {
      toast.error(`${failed.length} item(s) price update failed`);
    }
  };

  async function submitTransaction(status: 'draft' | 'confirmed') {
    const values = form.getValues();
    setLoading(true);
    setSubmitStatus(status);
    try {
      const res = await fetch(editingTransactionId ? `/api/transactions/${editingTransactionId}` : '/api/transactions', {
        method: editingTransactionId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          status,
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Failed to create transaction');
      }

      // Update item prices for checked items — only on confirmation
      if (status === 'confirmed') {
        await updateItemPrices(values);
      }

      toast.success(
        editingTransactionId
          ? status === 'draft'
            ? `${getModeLabel(mode)} draft updated`
            : `${getModeLabel(mode)} draft confirmed`
          : status === 'draft'
            ? `${getModeLabel(mode)} saved as draft`
            : `${getModeLabel(mode)} created successfully`,
      );
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to create transaction');
    } finally {
      setLoading(false);
      setSubmitStatus(null);
    }
  }

  function addEmptyLineItem() {
    append({
      itemName: '',
      unit: 'pcs',
      quantity: 1,
      unitPrice: 0,
      discountAmount: 0,
      taxRate: 0,
    });
  }

  function handleItemSelect(index: number, item: any) {
    // Update the entire lineItems array entry to ensure RHF picks up the change
    const current = form.getValues('lineItems') || [];
    const updated = [...current];
    updated[index] = {
      ...(updated[index] || {}),
      item: item._id,
      itemName: item.name,
      sku: item.sku || null,
      unitPrice: getDefaultUnitPrice(item, mode),
      costPrice: getItemCostPrice(item),
      unit: getItemUnit(item),
      taxRate: getDefaultTaxRate(item, mode),
    };

    form.setValue('lineItems', updated, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    // Save original price for the "Update price" checkbox
    setOriginalPrices((prev) => ({ ...prev, [item._id]: getDefaultUnitPrice(item, mode) }));
    setPriceUpdateItems((prev) => ({ ...prev, [item._id]: false }));

    // Visible feedback for debugging: toast + console
    console.log('Item selected:', item);
    try {
      toast.success(`Selected item: ${item.name}`);
    } catch (e) {
      // ignore toast errors in non-browser environments
    }
  }

  function handleCreatedParty(createdParty: CreatedParty) {
    if (
      createdParty.partyType !== undefined &&
      !getAllowedPartyTypes(mode).includes(createdParty.partyType)
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
    setSelectedPartyInfo({
      currentBalance: createdParty.currentBalance || 0,
      creditLimit: createdParty.creditLimit || 0,
    });
    setCreatePartyOpen(false);
  }

  function handleCreatedItem(index: number, item: CreatedItem) {
    setItems((current) => {
      if (current.some((entry) => entry._id === item._id)) {
        return current;
      }

      return [item, ...current];
    });
    handleItemSelect(index, item);
    setCreateItemIndex(null);
  }

  return (
    <Form {...form}>
      <CreatePartyDialog
        defaultPartyType={isSaleFlow(mode) ? 'customer' : 'supplier'}
        onPartyCreated={handleCreatedParty}
        open={createPartyOpen}
        onOpenChange={setCreatePartyOpen}
        showTrigger={false}
      />
      <CreateItemDialog
        onItemCreated={(item) => {
          if (createItemIndex !== null) {
            handleCreatedItem(createItemIndex, item);
          }
        }}
        open={createItemIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateItemIndex(null);
          }
        }}
        showTrigger={false}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit(() => submitTransaction('confirmed'))(event);
        }}
        className="space-y-6"
      >
        {sourceLabel && (
          <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            {sourceLabel}
          </div>
        )}

        {/* Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!disablePartySelection ? (
            <FormField
              control={form.control}
              name="party"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{isSaleFlow(mode) ? 'Customer *' : 'Supplier *'}</FormLabel>
                  <Select value={field.value || ''} onValueChange={(value) => field.onChange(value)}>
                    <SelectTrigger className={cn(
                      "w-full justify-between",
                      !field.value && "text-muted-foreground"
                    )}>
                      <SelectValue placeholder={`Select ${getPartyRole(mode)}`} className="truncate" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <div className="px-3 py-2 bg-white">
                        <Input
                          value={partySearchQuery}
                          onChange={(event) => setPartySearchQuery(event.target.value)}
                          placeholder="Search party by name or phone..."
                          className="h-9 w-full"
                        />
                      </div>
                      {(() => {
                        const search = partySearchQuery.toLowerCase();
                        const filteredParties = search === ''
                          ? parties
                          : parties.filter((party) => {
                              const partyName = (party.displayName || party.name || party.fullName || party.partyName || '').toLowerCase();
                              const phone = (party.phoneNumber || party.mobile || party.phone || '').toLowerCase();
                              return partyName.includes(search) || phone.includes(search);
                            });
                        if (filteredParties.length === 0) {
                          return (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No party found.
                            </div>
                          );
                        }
                        return filteredParties.map((party) => (
                          <SelectItem
                            value={party._id}
                            key={party._id}
                            textValue={party.displayName || party.name}
                            className='bg-white'
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{party.displayName || party.name}</span>
                              {(party.phoneNumber || party.mobile || party.phone) && (
                                <span className="text-xs text-muted-foreground">{party.phoneNumber || party.mobile || party.phone}</span>
                              )}
                            </div>
                          </SelectItem>
                        ));
                      })()}
                      <SelectSeparator className="my-1" />
                      <div className="border-t p-1 bg-white">
                        <CommandCreateButton onClick={() => setCreatePartyOpen(true)}>
                          Create {getPartyRole(mode)}
                        </CommandCreateButton>
                      </div>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  
                  {/* Available Credit Display */}
                  {isSaleFlow(mode) && selectedPartyInfo && selectedPartyInfo.creditLimit > 0 && (
                    <div className="mt-2 rounded-md border p-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Current Balance:</span>
                        <span className={`font-semibold ${selectedPartyInfo.currentBalance > selectedPartyInfo.creditLimit ? 'text-red-600' : ''}`}>
                          ₹{selectedPartyInfo.currentBalance.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-muted-foreground">Credit Limit:</span>
                        <span className="font-semibold">₹{selectedPartyInfo.creditLimit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-1 border-t">
                        <span className="text-muted-foreground">Available Credit:</span>
                        <span className={`font-semibold ${(selectedPartyInfo.creditLimit - selectedPartyInfo.currentBalance) <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ₹{Math.max(0, selectedPartyInfo.creditLimit - selectedPartyInfo.currentBalance).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="party"
              render={({ field }) => {
                const party = parties.find(p => p._id === field.value);
                return (
                  <FormItem>
                    <FormLabel>{isSaleFlow(mode) ? 'Customer *' : 'Supplier *'}</FormLabel>
                    <FormControl>
                      <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                        {party
                          ? (party.phoneNumber
                            ? `${party.displayName || party.name} (${party.phoneNumber})`
                            : party.displayName || party.name)
                          : field.value || `Selected ${getPartyRole(mode)}`}
                      </div>
                    </FormControl>
                  </FormItem>
                );
              }}
            />
          )}

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
                    onChange={(e) => field.onChange(new Date(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Line Items Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">{isReturnFlow(mode) ? 'Returned Items' : 'Items'}</h3>
            <Button type="button" variant="secondary" size="sm" onClick={addEmptyLineItem}>
              <Plus className="mr-1 h-4 w-4" /> Add Item
            </Button>
          </div>


          <div className="border rounded-md">
            {/* Desktop Header */}
            <div className="hidden md:grid grid-cols-12 gap-2 p-3 bg-muted/50 font-medium text-sm border-b">
              <div className="col-span-4">Item</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-center">{isSaleFlow(mode) ? 'Selling Price' : 'Purchase Price'}</div>
              <div className="col-span-1 text-center">Disc</div>
              <div className="col-span-1 text-center">Tax</div>
              <div className="col-span-1 text-center">Total</div>
              <div className="col-span-1"></div>
            </div>

            {fields.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No items added. Click Add Item to start.
              </div>
            )}

            {fields.map((field, index) => (
              <div key={field.id}>
                {/* Desktop Line Item Row */}
                <div className="hidden md:grid grid-cols-12 gap-2 p-3 border-b items-center">
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.itemName`}
                      render={({ field: itemField }) => {
                        const selectedItemId = form.watch(`lineItems.${index}.item`);

                        return (
                          <FormItem className="m-0">
                            <Select
                              value={selectedItemId || ''}
                              onValueChange={(value) => {
                                const item = items.find((item) => item._id === value);
                                if (item) {
                                  handleItemSelect(index, item);
                                }
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select item" className="truncate" />
                              </SelectTrigger>
                               <SelectContent className="bg-white">
                                <div key="item-search" className="px-3 py-2">
                                  <Input
                                    value={itemSearchQueryByIndex[index] ?? ''}
                                    onChange={(event) => setItemSearchQueryByIndex(prev => ({
                                      ...prev,
                                      [index]: event.target.value,
                                    }))}
                                    placeholder="Search item by name or sku..."
                                    className="h-9 w-full"
                                  />
                                </div>
                                {(() => {
                                  const query = (itemSearchQueryByIndex[index] ?? '').toLowerCase();
                                  const filteredItems = query === ''
                                    ? items
                                    : items.filter((item) => {
                                        const name = item.name?.toLowerCase() || '';
                                        const sku = item.sku?.toLowerCase() || '';
                                        return name.includes(query) || sku.includes(query);
                                      });

                                  if (filteredItems.length === 0) {
                                    return (
                                      <div key="item-empty" className="px-3 py-2 text-sm text-muted-foreground">
                                        No item found.
                                      </div>
                                    );
                                  }

                                  return filteredItems.map((item) => (
                                    <SelectItem value={item._id} key={item._id} textValue={item.name}>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{item.name}</span>
                                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                          {item.sku && <span>SKU: {item.sku}</span>}
                                          <span>{isSaleFlow(mode) ? 'Sell' : 'Buy'}: ₹{getDefaultUnitPrice(item, mode).toFixed(2)}</span>
                                          <span>Stock: {typeof item.stock === 'object' ? item.stock?.currentQuantity || 0 : (item.stockQuantity || item.stock || 0)}</span>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ));
                                })()}
                                <SelectSeparator key="item-separator" className="my-1" />
                                <div key="item-create" className="border-t p-1">
                                  <CommandCreateButton onClick={() => setCreateItemIndex(index)}>
                                    Create item
                                  </CommandCreateButton>
                                </div>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.quantity`}
                      render={({ field: qtyField }) => (
                        <FormItem className="m-0">
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              step="0.01" 
                              {...qtyField}
                              className="text-center"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.unitPrice`}
                      render={({ field: priceField }) => (
                        <FormItem className="m-0">
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              step="0.01" 
                              {...priceField}
                              className="text-center"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {(() => {
                      const itemId = form.watch(`lineItems.${index}.item`);
                      const currentPrice = Number(form.watch(`lineItems.${index}.unitPrice`) || 0);
                      const originalPrice = itemId ? originalPrices[itemId] : undefined;
                      const isDifferent = itemId && originalPrice !== undefined && Math.abs(currentPrice - originalPrice) > 0.001;
                      return isDifferent ? (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer mt-0.5 whitespace-nowrap justify-center">
                          <input
                            type="checkbox"
                            checked={!!(itemId && priceUpdateItems[itemId])}
                            onChange={(e) => {
                              if (itemId) {
                                setPriceUpdateItems(prev => ({ ...prev, [itemId]: e.target.checked }));
                              }
                            }}
                            className="h-3 w-3"
                          />
                          Update {isSaleFlow(mode) ? 'selling' : 'purchase'} price
                        </label>
                      ) : null;
                    })()}
                  </div>

                  <div className="col-span-1">
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.discountAmount`}
                      render={({ field: discField }) => (
                        <FormItem className="m-0">
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              step="0.01" 
                              {...discField}
                              className="text-center w-full"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-1">
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.taxRate`}
                      render={({ field: taxField }) => (
                        <FormItem className="m-0">
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              max="100"
                              step="0.01" 
                              {...taxField}
                              className="text-center w-full"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-1 text-center font-medium">
                    ₹{roundCurrency(
                      Number(form.watch(`lineItems.${index}.quantity`) || 0) * 
                      Number(form.watch(`lineItems.${index}.unitPrice`) || 0) - 
                      Number(form.watch(`lineItems.${index}.discountAmount`) || 0) + 
                      ((
                        Number(form.watch(`lineItems.${index}.quantity`) || 0) * 
                        Number(form.watch(`lineItems.${index}.unitPrice`) || 0) - 
                        Number(form.watch(`lineItems.${index}.discountAmount`) || 0)
                      ) * Number(form.watch(`lineItems.${index}.taxRate`) || 0) / 100)
                    ).toFixed(2)}
                  </div>

                  <div className="col-span-1 text-right">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-red-500"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Mobile Line Item Card */}
                <div className="md:hidden space-y-3 p-3 border-b">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.itemName`}
                        render={({ field: itemField }) => {
                          const selectedItemId = form.watch(`lineItems.${index}.item`);

                          return (
                            <FormItem className="m-0">
                              <Select
                                value={selectedItemId || ''}
                                onValueChange={(value) => {
                                  const item = items.find((item) => item._id === value);
                                  if (item) {
                                    handleItemSelect(index, item);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                  <div key="mob-item-search" className="px-3 py-2">
                                    <Input
                                      value={itemSearchQueryByIndex[index] ?? ''}
                                      onChange={(event) => setItemSearchQueryByIndex(prev => ({
                                        ...prev,
                                        [index]: event.target.value,
                                      }))}
                                      placeholder="Search item by name or sku..."
                                      className="h-9 w-full"
                                    />
                                  </div>
                                  {(() => {
                                    const query = (itemSearchQueryByIndex[index] ?? '').toLowerCase();
                                    const filteredItems = query === ''
                                      ? items
                                      : items.filter((item) => {
                                          const name = item.name?.toLowerCase() || '';
                                          const sku = item.sku?.toLowerCase() || '';
                                          return name.includes(query) || sku.includes(query);
                                        });

                                    if (filteredItems.length === 0) {
                                      return (
                                        <div key="mob-item-empty" className="px-3 py-2 text-sm text-muted-foreground">
                                          No item found.
                                        </div>
                                      );
                                    }

                                    return filteredItems.map((item) => (
                                      <SelectItem value={item._id} key={item._id} textValue={item.name}>
                                        <div className="flex flex-col">
                                          <span className="font-medium">{item.name}</span>
                                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                            {item.sku && <span>SKU: {item.sku}</span>}
                                            <span>{isSaleFlow(mode) ? 'Sell' : 'Buy'}: ₹{getDefaultUnitPrice(item, mode).toFixed(2)}</span>
                                            <span>Stock: {typeof item.stock === 'object' ? item.stock?.currentQuantity || 0 : (item.stockQuantity || item.stock || 0)}</span>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ));
                                  })()}
                                  <SelectSeparator key="mob-item-separator" className="my-1" />
                                  <div key="mob-item-create" className="border-t p-1">
                                    <CommandCreateButton onClick={() => setCreateItemIndex(index)}>
                                      Create item
                                    </CommandCreateButton>
                                  </div>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-red-500 shrink-0"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.quantity`}
                        render={({ field: qtyField }) => (
                          <FormItem className="m-0">
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                {...qtyField}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">{isSaleFlow(mode) ? 'Sell Price' : 'Buy Price'}</label>
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.unitPrice`}
                        render={({ field: priceField }) => (
                          <FormItem className="m-0">
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                {...priceField}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {(() => {
                        const itemId = form.watch(`lineItems.${index}.item`);
                        const currentPrice = Number(form.watch(`lineItems.${index}.unitPrice`) || 0);
                        const originalPrice = itemId ? originalPrices[itemId] : undefined;
                        const isDifferent = itemId && originalPrice !== undefined && Math.abs(currentPrice - originalPrice) > 0.001;
                        return isDifferent ? (
                          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer mt-0.5 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={!!(itemId && priceUpdateItems[itemId])}
                              onChange={(e) => {
                                if (itemId) {
                                  setPriceUpdateItems(prev => ({ ...prev, [itemId]: e.target.checked }));
                                }
                              }}
                              className="h-3 w-3"
                            />
                            Update {isSaleFlow(mode) ? 'selling' : 'purchase'} price
                          </label>
                        ) : null;
                      })()}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Disc</label>
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.discountAmount`}
                        render={({ field: discField }) => (
                          <FormItem className="m-0">
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                {...discField}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Tax %</label>
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.taxRate`}
                        render={({ field: taxField }) => (
                          <FormItem className="m-0">
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                max="100"
                                step="0.01" 
                                {...taxField}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t text-sm">
                    <span className="text-muted-foreground">Line Total</span>
                    <span className="font-semibold">₹{roundCurrency(
                      Number(form.watch(`lineItems.${index}.quantity`) || 0) * 
                      Number(form.watch(`lineItems.${index}.unitPrice`) || 0) - 
                      Number(form.watch(`lineItems.${index}.discountAmount`) || 0) + 
                      ((
                        Number(form.watch(`lineItems.${index}.quantity`) || 0) * 
                        Number(form.watch(`lineItems.${index}.unitPrice`) || 0) - 
                        Number(form.watch(`lineItems.${index}.discountAmount`) || 0)
                      ) * Number(form.watch(`lineItems.${index}.taxRate`) || 0) / 100)
                    ).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Section */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="py-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-medium">₹{summary.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Line Discount:</span>
              <span className="font-medium text-red-500">-₹{summary.discountTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax:</span>
              <span className="font-medium">+₹{summary.taxTotal.toFixed(2)}</span>
            </div>

            {/* Total Discount - Percentage or Fixed */}
            <div className="flex justify-between text-sm items-center gap-2">
              <span className="text-xs shrink-0">Total Discount</span>
              <div className="flex items-center gap-1">
                <FormField
                  control={form.control}
                  name="summary.totalDiscountType"
                  render={({ field }) => (
                    <FormItem className="m-0">
                      <FormControl>
                        <select
                          value={field.value || ''}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            field.onChange(val);
                            form.setValue('summary.totalDiscountValue', 0);
                          }}
                          className="h-7 w-10 text-xs border rounded px-1 bg-background"
                        >
                          <option value="">-</option>
                          <option value="percentage">%</option>
                          <option value="fixed">₹</option>
                        </select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="summary.totalDiscountValue"
                  render={({ field }) => (
                    <FormItem className="m-0">
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          disabled={!totalDiscountType}
                          placeholder="0"
                          className="w-16 h-7 text-right text-xs"
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            {totalDiscountType && summary.totalDiscount > 0 && (
              <div className="flex justify-between text-xs text-destructive">
                <span></span>
                <span>- ₹{summary.totalDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* Additional Charges Section */}
            <div className="border rounded-md">
              <button
                type="button"
                onClick={() => {
                  if (chargeFields.length === 0) {
                    setAdditionalChargesExpanded(!additionalChargesExpanded);
                  }
                }}
                className="flex items-center justify-between w-full px-2 py-1.5 text-sm hover:bg-muted/50 rounded-md"
              >
                <span className="flex items-center gap-1">
                  {additionalChargesExpanded || chargeFields.length > 0 ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  <span className={cn(
                    chargeFields.length > 0 ? "font-medium" : "text-muted-foreground"
                  )}>
                    {chargeFields.length > 0
                      ? `Additional Charges (${chargeFields.length})`
                      : "+ Additional charges"}
                  </span>
                </span>
                {chargeFields.length > 0 && (
                  <span className="font-medium">
                    ₹ {summary.additionalChargesTotal.toFixed(2)}
                  </span>
                )}
              </button>

              {(additionalChargesExpanded || chargeFields.length > 0) && (
                <div className="px-2 pb-2 space-y-2">
                  {chargeFields.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1">No additional charges added.</p>
                  )}
                  {chargeFields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-1.5">
                      <FormField
                        control={form.control}
                        name={`additionalCharges.${index}.name`}
                        render={({ field: chargeNameField }) => (
                          <FormItem className="m-0 flex-1">
                            <FormControl>
                              <Input
                                placeholder="Charge name"
                                className="h-7 text-xs"
                                {...chargeNameField}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`additionalCharges.${index}.amount`}
                        render={({ field: chargeAmountField }) => (
                          <FormItem className="m-0 w-20">
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="h-7 text-xs text-right"
                                {...chargeAmountField}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          removeCharge(index);
                          if (chargeFields.length === 1) {
                            setAdditionalChargesExpanded(false);
                          }
                        }}
                        className="h-7 w-7 text-destructive shrink-0"
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => appendCharge({ name: '', amount: 0 })}
                    type="button"
                    className="w-full h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Charge
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-between text-sm items-center">
              <span>Round Off</span>
              <FormField
                control={form.control}
                name="summary.roundOff"
                render={({ field }) => (
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24 h-7 text-right"
                      {...field}
                    />
                  </FormControl>
                )}
              />
            </div>

            <Separator />
            
            <div className="flex justify-between text-lg font-bold">
              <span>Grand Total:</span>
              <span>₹{summary.grandTotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-sm items-center pt-1">
              <span>Paid Amount</span>
              <FormField
                control={form.control}
                name="summary.paidAmount"
                render={({ field }) => (
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24 h-7 text-right"
                      {...field}
                    />
                  </FormControl>
                )}
              />
            </div>

            <Separator />

            <div className="flex justify-between font-medium">
              <span>Balance Due</span>
              <span className="text-destructive">₹{summary.dueAmount.toFixed(2)}</span>
            </div>

            <Separator className="mt-2" />

            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-sm items-center gap-2">
                <span className="text-xs shrink-0">Payment Method</span>
                <FormField
                  control={form.control}
                  name="payment.method"
                  render={({ field }) => (
                    <FormItem className="m-0">
                      <FormControl>
                        <select
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          className="h-7 text-xs border rounded px-1 bg-background w-28"
                        >
                          <option value="">Select</option>
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="upi">UPI</option>
                          <option value="bank-transfer">Bank Transfer</option>
                          <option value="cheque">Cheque</option>
                          <option value="other">Other</option>
                        </select>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="payment.referenceNumber"
                render={({ field }) => (
                  <FormItem className="m-0">
                    <FormControl>
                      <Input
                        placeholder="Reference / Transaction ID"
                        className="h-7 text-xs"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes for this transaction"
                  className="min-h-20"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => void form.handleSubmit(() => submitTransaction('draft'))()}
          >
            {loading && submitStatus === 'draft' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Draft...
              </>
            ) : (
              isEditing ? 'Update Draft' : 'Save as Draft'
            )}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && submitStatus === 'confirmed' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              `Confirm ${getModeLabel(mode)}`
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
