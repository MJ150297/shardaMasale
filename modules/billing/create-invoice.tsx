'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Trash2,
  Save,
  Send,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { roundCurrency, calculateLineTotal } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import CommandCreateButton from '@/components/command-create-button';
import CreateItemDialog, { type CreatedItem } from '@/components/create-item-dialog';
import CreatePartyDialog, { type CreatedParty } from '@/components/create-party-dialog';
import { useActiveShop } from '@/components/providers/shop-provider';

const lineItemSchema = z.object({
  item: z.string().optional().nullable(),
  itemName: z.string().min(1, "Item name is required"),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unit: z.string().default("pcs"),
  quantity: z.coerce.number().min(0, "Quantity must be positive"),
  unitPrice: z.coerce.number().min(0, "Price must be positive"),
  discountAmount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

const additionalChargeSchema = z.object({
  name: z.string().min(1, "Charge name is required"),
  amount: z.coerce.number().min(0, "Amount must be positive"),
});

const createInvoiceSchema = z.object({
  party: z.preprocess(
    (val) => (val === undefined || val === null ? '' : val),
    z.string().min(1, "*Party is required")
  ),
  transactionDate: z.coerce.date().default(() => new Date()),
  dueDate: z.coerce.date(),
  lineItems: z.array(lineItemSchema).min(1, "At least one item is required"),
  additionalCharges: z.array(additionalChargeSchema).default([]),
  summary: z.object({
    roundOff: z.coerce.number().default(0),
    paidAmount: z.coerce.number().min(0).default(0),
    totalDiscountType: z.enum(["percentage", "fixed"]).optional().nullable(),
    totalDiscountValue: z.coerce.number().min(0).optional().nullable(),
  }),
  payment: z.object({
    method: z.enum(["cash", "card", "upi", "bank-transfer", "cheque", "other"]).optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).optional().nullable(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  status: z.enum(["draft", "confirmed"]).default("draft"),
});

export type InvoiceFormValues = z.infer<typeof createInvoiceSchema>;

interface Item {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  sku: string;
  unit: string;
  price: number;
  pricing?: {
    sellingPrice?: number;
    purchasePrice?: number;
    costPrice?: number;
  };
  sellingPrice?: number;
  purchasePrice?: number;
  costPrice?: number;
  saleTaxRate?: number;
  purchaseTaxRate?: number;
  taxRate?: number;
  unitOfMeasure?: string;
  stockQuantity?: number;
  stock: {
    currentQuantity: number;
  };
}

interface Party extends CreatedParty {
  id?: string;
  email?: string | null;
}

function getItemSellingPrice(item: Item | CreatedItem) {
  return item.pricing?.sellingPrice ?? item.sellingPrice ?? item.price ?? 0;
}

function getItemUnit(item: Item | CreatedItem) {
  return item.unitOfMeasure ?? item.unit ?? 'pcs';
}

function getDefaultTaxRate(item: Item | CreatedItem) {
  return item.saleTaxRate ?? item.taxRate ?? item.purchaseTaxRate ?? 0;
}

interface CreateInvoiceProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editingInvoiceId?: string | null;
  initialValues?: Partial<InvoiceFormValues> | null;
}

export default function CreateInvoice({ onSuccess, onCancel, editingInvoiceId, initialValues }: CreateInvoiceProps) {
  const { activeShopId } = useActiveShop();
  const [items, setItems] = useState<Item[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [createPartyOpen, setCreatePartyOpen] = useState(false);
  const [createItemIndex, setCreateItemIndex] = useState<number | null>(null);
  const [itemSearchQueryByIndex, setItemSearchQueryByIndex] = useState<Record<number, string>>({});
  const [renderKey, setRenderKey] = useState(0);
  const [additionalChargesExpanded, setAdditionalChargesExpanded] = useState(false);
  const [originalPrices, setOriginalPrices] = useState<Record<string, number>>({});
  const [priceUpdateItems, setPriceUpdateItems] = useState<Record<string, boolean>>({});
  const isEditing = Boolean(editingInvoiceId);

  useEffect(() => {
    async function loadData() {
      try {
        console.log('🔍 Loading parties and items...');

        // Load Parties (Customers) - use high limit to get all
        const partiesRes = await fetch('/api/parties?limit=5000');
        console.log('✅ Parties response status:', partiesRes.status);

        if (partiesRes.ok) {
          const partiesData = await partiesRes.json();
          console.log('📋 Parties data received:', partiesData);
          const allParties = partiesData.data ?? partiesData.parties ?? partiesData ?? [];

          // Filter only customers and both type parties (exclude suppliers)
          const finalParties = allParties.filter((party: any) => {
            return party.partyType === undefined || ['customer', 'both'].includes(party.partyType);
          });

          console.log('✅ Setting parties:', finalParties.length, 'customer records');
          setParties(finalParties);
        } else {
          const errorText = await partiesRes.text();
          console.error('❌ Parties fetch failed:', partiesRes.status, errorText);
          toast.error('Failed to load customers');
        }

        // Load Items
        const itemsRes = await fetch('/api/items?limit=5000');
        console.log('✅ Items response status:', itemsRes.status);

        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          console.log('📦 Items data received:', itemsData);
          const finalItems = itemsData.data ?? itemsData.items ?? itemsData ?? [];
          console.log('✅ Setting items:', finalItems.length, 'records');
          setItems(finalItems);
        } else {
          const errorText = await itemsRes.text();
          console.error('❌ Items fetch failed:', itemsRes.status, errorText);
          toast.error('Failed to load items');
        }
      } catch (error) {
        console.error('💥 Failed to load form data:', error);
        toast.error('Network error while loading form data');
      }
    }

    loadData();
  }, []);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema) as any,
    defaultValues: {
      transactionDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lineItems: [],
      additionalCharges: [],
      summary: {
        roundOff: 0,
        paidAmount: 0,
        totalDiscountType: null,
        totalDiscountValue: 0,
      },
      payment: null,
      status: 'draft',
    },
  });

  // Fetch settings to pre-fill default terms & conditions
  useEffect(() => {
    async function loadSettings() {
      try {
        if (editingInvoiceId) {
          return;
        }
        const queryParam = activeShopId ? `?shopId=${activeShopId}` : '';
        const res = await fetch(`/api/settings${queryParam}`);
        if (res.ok) {
          const data = await res.json();
          const terms = data?.billing?.termsAndConditions;
          if (terms !== undefined && terms !== null) {
            form.setValue('termsAndConditions', terms);
          }
        }
      } catch {
        // Silently fail — terms field just stays empty
      }
    }
    loadSettings();
  }, [form, activeShopId, editingInvoiceId]);

  useEffect(() => {
    if (!initialValues) return;

    form.reset({
      party: initialValues.party ?? '',
      transactionDate: initialValues.transactionDate ?? new Date(),
      dueDate: initialValues.dueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lineItems: initialValues.lineItems ?? [],
      additionalCharges: initialValues.additionalCharges ?? [],
      summary: {
        roundOff: initialValues.summary?.roundOff ?? 0,
        paidAmount: initialValues.summary?.paidAmount ?? 0,
        totalDiscountType: initialValues.summary?.totalDiscountType ?? null,
        totalDiscountValue: initialValues.summary?.totalDiscountValue ?? 0,
      },
      payment: initialValues.payment ?? null,
      notes: initialValues.notes ?? '',
      termsAndConditions: initialValues.termsAndConditions ?? '',
      status: initialValues.status ?? 'draft',
    });
    setOriginalPrices({});
    setPriceUpdateItems({});
  }, [form, initialValues]);

  // After parties load, re-assert the party field value to ensure Select shows it
  // Also ensure the selected party is in the parties list even if not returned by the API
  useEffect(() => {
    if (!editingInvoiceId || !initialValues?.party) return;

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
              setParties(current => {
                if (current.some(p => p._id === partyId)) return current;
                return [missingParty, ...current];
              });
            }
          })
          .catch(() => {});
      }

      // Re-assert the form value after parties are available to sync Select
      form.setValue('party', partyId, { shouldDirty: true });
    }
  }, [parties, editingInvoiceId, initialValues?.party, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lineItems',
  });

  const {
    fields: chargeFields,
    append: appendCharge,
    remove: removeCharge,
  } = useFieldArray({
    control: form.control,
    name: 'additionalCharges',
  });

  // Always watch base lineItems array to detect add/remove operations
  form.watch('lineItems');
  form.watch('additionalCharges');

  const lineItemsCount = fields.length;

  // Watch each individual line item field
  useEffect(() => {
    const paths: string[] = [];
    for (let i = 0; i < lineItemsCount; i++) {
      paths.push(`lineItems.${i}.item`);
      paths.push(`lineItems.${i}.itemName`);
      paths.push(`lineItems.${i}.sku`);
      paths.push(`lineItems.${i}.unit`);
      paths.push(`lineItems.${i}.quantity`);
      paths.push(`lineItems.${i}.unitPrice`);
      paths.push(`lineItems.${i}.discountAmount`);
      paths.push(`lineItems.${i}.taxRate`);
    }
    for (let i = 0; i < chargeFields.length; i++) {
      paths.push(`additionalCharges.${i}.name`);
      paths.push(`additionalCharges.${i}.amount`);
    }
    paths.push('summary.roundOff');
    paths.push('summary.paidAmount');
    paths.push('summary.totalDiscountType');
    paths.push('summary.totalDiscountValue');
    paths.push('payment.method');
    paths.push('payment.referenceNumber');

    // Watch all paths - increment render counter to force re-render
    const subscription = form.watch(paths as any, () => {
      setRenderKey(prev => prev + 1);
    });

    // Cleanup on unmount
    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [form, lineItemsCount, chargeFields.length]);

  // Calculate summary DIRECTLY in render - ONLY WORKING WAY for react-hook-form
  const lineItems = form.watch('lineItems') || [];
  const roundOff = roundCurrency(form.watch('summary.roundOff') || 0);
  const paidAmount = roundCurrency(form.watch('summary.paidAmount') || 0);
  const additionalCharges = form.watch('additionalCharges') || [];
  const totalDiscountType = form.watch('summary.totalDiscountType');
  const totalDiscountValue = Number(form.watch('summary.totalDiscountValue') || 0);

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

  const additionalChargesTotal = roundCurrency(
    additionalCharges.reduce((total, charge) => total + (Number(charge.amount) || 0), 0)
  );

  // Compute total discount (percentage or fixed)
  let totalDiscount = 0;
  if (totalDiscountType === 'percentage') {
    const baseAmount = subtotal - discountTotal;
    totalDiscount = roundCurrency(baseAmount * (Math.min(totalDiscountValue, 100) / 100));
  } else if (totalDiscountType === 'fixed') {
    totalDiscount = roundCurrency(Math.min(totalDiscountValue, Math.max(subtotal - discountTotal, 0)));
  }

  const grandTotal = roundCurrency(subtotal - discountTotal - totalDiscount + taxTotal + roundOff + additionalChargesTotal);
  const dueAmount = Math.max(roundCurrency(grandTotal - paidAmount), 0);

  const calculations = {
    subtotal: roundCurrency(subtotal),
    discountTotal: roundCurrency(discountTotal),
    taxTotal: roundCurrency(taxTotal),
    totalDiscount: roundCurrency(totalDiscount),
    additionalChargesTotal,
    grandTotal: roundCurrency(grandTotal),
    dueAmount: roundCurrency(dueAmount),
  };

  const addLineItem = useCallback(() => {
    append({
      itemName: '',
      unit: 'pcs',
      quantity: 1,
      unitPrice: 0,
      discountAmount: 0,
      taxRate: 0,
    });
  }, [append]);

  const addAdditionalCharge = useCallback(() => {
    appendCharge({ name: '', amount: 0 });
    setAdditionalChargesExpanded(true);
  }, [appendCharge]);

  // Auto-expand if charges exist, auto-collapse if all removed
  useEffect(() => {
    if (chargeFields.length > 0) {
      setAdditionalChargesExpanded(true);
    }
  }, [chargeFields.length]);

  const updateItemPrices = async (data: InvoiceFormValues) => {
    const updatePromises: Promise<any>[] = [];

    data.lineItems.forEach(item => {
      const itemId = item.item;
      if (itemId && priceUpdateItems[itemId]) {
        const newPrice = Number(item.unitPrice) || 0;
        updatePromises.push(
          fetch('/api/items', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: itemId,
              pricing: { sellingPrice: newPrice },
            }),
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

  const onSubmit = async (data: InvoiceFormValues, confirm: boolean = false) => {
    setIsSubmitting(true);
    try {
      // When editing and confirming, first save the draft via PUT, then confirm via PATCH
      if (editingInvoiceId && confirm) {
        // Step 1: Save draft changes
        const savePayload = { ...data, status: 'draft' };
        const saveResponse = await fetch(`/api/invoices/${editingInvoiceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(savePayload),
        });

        if (!saveResponse.ok) {
          const saveError = await saveResponse.json();
          throw new Error(saveError.error || 'Failed to save draft before confirmation');
        }

        // Step 2: Confirm via PATCH
        const confirmResponse = await fetch(`/api/invoices/${editingInvoiceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'confirm' }),
        });

        if (!confirmResponse.ok) {
          const confirmError = await confirmResponse.json();
          throw new Error(confirmError.error || 'Failed to confirm invoice');
        }

        await updateItemPrices(data);
        toast.success('Invoice confirmed successfully');
        form.reset();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        // Normal create or draft-only edit
        const payload = {
          ...data,
          status: confirm ? 'confirmed' : 'draft',
        };

        const response = await fetch(editingInvoiceId ? `/api/invoices/${editingInvoiceId}` : '/api/invoices', {
          method: editingInvoiceId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();

          // Update item prices for checked items — only on confirmation
          if (confirm) {
            await updateItemPrices(data);
          }

          toast.success(editingInvoiceId ? 'Invoice updated successfully' : 'Invoice created successfully');
          form.reset();
          if (onSuccess) {
            onSuccess();
          }
        } else {
          const error = await response.json();
          throw new Error(error.error || error.message || 'Failed to create invoice');
        }
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  function handleCreatedItem(index: number, item: CreatedItem) {
    const sellingPrice = getItemSellingPrice(item);

    setItems((current) => {
      if (current.some((entry) => entry._id === item._id)) {
        return current;
      }

      return [item as Item, ...current];
    });

    // Update the full lineItems entry so RHF state updates reliably
    const current = form.getValues('lineItems') || [];
    const updated = [...current];
    updated[index] = {
      ...(updated[index] || {}),
      item: item._id,
      itemName: item.name,
      sku: item.sku || null,
      description: item.description || null,
      unit: getItemUnit(item),
      unitPrice: sellingPrice,
      taxRate: getDefaultTaxRate(item),
      discountAmount: 0,
    };

    form.setValue('lineItems', updated, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setOriginalPrices((prev) => ({ ...prev, [item._id]: sellingPrice }));
    setPriceUpdateItems((prev) => ({ ...prev, [item._id]: false }));
    setCreateItemIndex(null);
  }

  return (
    <div className="space-y-6" key={renderKey}>
      <CreatePartyDialog
        defaultPartyType="customer"
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
      <Card>
        <CardContent className="space-y-6">
          <Form {...(form as any)}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">

              {/* Customer & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <FormField
                  control={form.control as any}
                  name="party"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Customer</FormLabel>
                      <Select value={field.value || ''} onValueChange={(value) => field.onChange(value)}>
                        <SelectTrigger className={cn(
                          "w-full justify-between",
                          !field.value && "text-muted-foreground"
                        )}>
                          <SelectValue placeholder="Select customer" className="truncate" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <div className="px-3 py-2">
                            <Input
                              value={partySearchQuery}
                              onChange={(event) => setPartySearchQuery(event.target.value)}
                              placeholder="Search customer by name or phone..."
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
                                  No customer found.
                                </div>
                              );
                            }
                            return filteredParties.map((party) => (
                              <SelectItem
                                value={party._id}
                                key={party._id}
                                textValue={(party.displayName || party.name || '')}
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
                          <div className="border-t p-1">
                            <CommandCreateButton onClick={() => setCreatePartyOpen(true)}>
                              Create customer
                            </CommandCreateButton>
                          </div>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>

              {/* Items Table */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Invoice Items</h3>
                  <Button onClick={addLineItem} size="sm" type="button">
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </div>

                <div className="border rounded-lg">
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-75">Item</TableHead>
                          <TableHead className="w-20">Qty</TableHead>
                          <TableHead className="w-25">Unit</TableHead>
                          <TableHead className="w-25">Price</TableHead>
                          <TableHead className="w-25">Discount</TableHead>
                          <TableHead className="w-20">Tax %</TableHead>
                          <TableHead className="w-30 text-right">Amount</TableHead>
                          <TableHead className="w-15"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                              No items added. Click Add Item to start.
                            </TableCell>
                          </TableRow>
                        )}
                        {fields.map((field, index) => (
                          <TableRow key={field.id}>
                            <TableCell>
                              <FormField
                                control={form.control as any}
                                name={`lineItems.${index}.itemName`}
                                render={({ field: itemField }) => {
                                  const selectedItemId = form.watch(`lineItems.${index}.item`);

                                  return (
                                    <FormItem className="m-0">
                                      <Select
                                        value={selectedItemId || ''}
                                        onValueChange={(value) => {
                                          const item = items.find((item) => item._id === value);
                                          if (!item) return;

                                          const sellingPrice = getItemSellingPrice(item);
                                          const current = form.getValues('lineItems') || [];
                                          const updated = [...current];
                                          updated[index] = {
                                            ...(updated[index] || {}),
                                            item: item._id,
                                            itemName: item.name,
                                            sku: item.sku || null,
                                            description: item.description || null,
                                            unit: getItemUnit(item),
                                            unitPrice: sellingPrice,
                                            taxRate: getDefaultTaxRate(item),
                                            discountAmount: 0,
                                          };

                                          form.setValue('lineItems', updated, {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                            shouldValidate: true,
                                          });

                                          console.log('Invoice: item selected', item);
                                          try { toast.success && toast.success(`Selected item: ${item.name}`); } catch (e) { }

                                          setOriginalPrices(prev => ({ ...prev, [item._id]: sellingPrice }));
                                          setPriceUpdateItems(prev => ({ ...prev, [item._id]: false }));
                                        }}
                                      >
                                        <SelectTrigger className="w-full h-8 border-0 shadow-none">
                                          <SelectValue placeholder="Select item" className="truncate" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                          <div className="px-3 py-2">
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
                                                <div className="px-3 py-2 text-sm text-muted-foreground">
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
                                                    <span>Sell: ₹{getItemSellingPrice(item).toFixed(2)}</span>
                                                    <span>Stock: {typeof item.stock === 'object' ? item.stock?.currentQuantity || 0 : (item.stockQuantity || item.stock || 0)}</span>
                                                  </div>
                                                </div>
                                              </SelectItem>
                                            ));
                                          })()}
                                          <SelectSeparator className="my-1" />
                                          <div className="border-t p-1">
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
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control as any}
                                name={`lineItems.${index}.quantity`}
                                render={({ field }) => (
                                  <FormItem className="m-0">
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        {...field}
                                        className="border-0 shadow-none text-center"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control as any}
                                name={`lineItems.${index}.unit`}
                                render={({ field }) => (
                                  <FormItem className="m-0">
                                    <FormControl>
                                      <Input
                                        {...field}
                                        className="border-0 shadow-none text-center"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col items-end">
                                <FormField
                                  control={form.control as any}
                                  name={`lineItems.${index}.unitPrice`}
                                  render={({ field }) => (
                                    <FormItem className="m-0 w-full">
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          {...field}
                                          className="border-0 shadow-none text-right"
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
                                            setRenderKey(k => k + 1);
                                          }
                                        }}
                                        className="h-3 w-3"
                                      />
                                      Update item price
                                    </label>
                                  ) : null;
                                })()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control as any}
                                name={`lineItems.${index}.discountAmount`}
                                render={({ field }) => (
                                  <FormItem className="m-0">
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        {...field}
                                        className="border-0 shadow-none text-right"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control as any}
                                name={`lineItems.${index}.taxRate`}
                                render={({ field }) => (
                                  <FormItem className="m-0">
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        {...field}
                                        className="border-0 shadow-none text-center"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ₹ {calculateLineTotal({
                                quantity: lineItems[index]?.quantity || 0,
                                unitPrice: lineItems[index]?.unitPrice || 0,
                                discountAmount: lineItems[index]?.discountAmount || 0,
                                taxAmount: ((lineItems[index]?.quantity || 0) * (lineItems[index]?.unitPrice || 0) - (lineItems[index]?.discountAmount || 0)) * ((lineItems[index]?.taxRate || 0) / 100)
                              }).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {fields.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => remove(index)}
                                  className="h-8 w-8 text-destructive"
                                  type="button"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden">
                    {fields.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        No items added. Click Add Item to start.
                      </div>
                    )}
                    {fields.map((field, index) => (
                      <div key={field.id} className="space-y-3 p-3 border-b">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <FormField
                              control={form.control as any}
                              name={`lineItems.${index}.itemName`}
                              render={({ field: itemField }) => {
                                const selectedItemId = form.watch(`lineItems.${index}.item`);

                                return (
                                  <FormItem className="m-0">
                                    <Select
                                      value={selectedItemId || ''}
                                      onValueChange={(value) => {
                                        const item = items.find((item) => item._id === value);
                                        if (!item) return;

                                        const sellingPrice = getItemSellingPrice(item);
                                        const current = form.getValues('lineItems') || [];
                                        const updated = [...current];
                                        updated[index] = {
                                          ...(updated[index] || {}),
                                          item: item._id,
                                          itemName: item.name,
                                          sku: item.sku || null,
                                          description: item.description || null,
                                          unit: getItemUnit(item),
                                          unitPrice: sellingPrice,
                                          taxRate: getDefaultTaxRate(item),
                                          discountAmount: 0,
                                        };

                                        form.setValue('lineItems', updated, {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true,
                                        });

                                        setOriginalPrices(prev => ({ ...prev, [item._id]: sellingPrice }));
                                        setPriceUpdateItems(prev => ({ ...prev, [item._id]: false }));
                                      }}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select item" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white">
                                        <div className="px-3 py-2">
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
                                              <div className="px-3 py-2 text-sm text-muted-foreground">
                                                No item found.
                                              </div>
                                            );
                                          }

                                          return filteredItems.map((item) => (
                                            <SelectItem value={item._id} key={item._id} textValue={item.name}>
                                              <div className="flex flex-col">
                                                <span className="font-medium">{item.name}</span>
                                                <div className="flex gap-3 text-xs text-muted-foreground">
                                                  {item.sku && <span>SKU: {item.sku}</span>}
                                                  <span>Sell: ₹{getItemSellingPrice(item).toFixed(2)}</span>
                                                  <span>Stock: {typeof item.stock === 'object' ? item.stock?.currentQuantity || 0 : (item.stockQuantity || item.stock || 0)}</span>
                                                </div>
                                              </div>
                                            </SelectItem>
                                          ));
                                        })()}
                                        <SelectSeparator className="my-1" />
                                        <div className="border-t p-1">
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
                          {fields.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="h-8 w-8 shrink-0 text-destructive"
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                            <FormField
                              control={form.control as any}
                              name={`lineItems.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem className="m-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
                            <FormField
                              control={form.control as any}
                              name={`lineItems.${index}.unit`}
                              render={({ field }) => (
                                <FormItem className="m-0">
                                  <FormControl>
                                    <Input
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Price</label>
                            <FormField
                              control={form.control as any}
                              name={`lineItems.${index}.unitPrice`}
                              render={({ field }) => (
                                <FormItem className="m-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      {...field}
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
                                        setRenderKey(k => k + 1);
                                      }
                                    }}
                                    className="h-3 w-3"
                                  />
                                  Update item price
                                </label>
                              ) : null;
                            })()}
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Discount</label>
                            <FormField
                              control={form.control as any}
                              name={`lineItems.${index}.discountAmount`}
                              render={({ field }) => (
                                <FormItem className="m-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Tax %</label>
                            <FormField
                              control={form.control as any}
                              name={`lineItems.${index}.taxRate`}
                              render={({ field }) => (
                                <FormItem className="m-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t text-sm">
                          <span className="text-muted-foreground">Line Total</span>
                          <span className="font-semibold">₹ {calculateLineTotal({
                            quantity: lineItems[index]?.quantity || 0,
                            unitPrice: lineItems[index]?.unitPrice || 0,
                            discountAmount: lineItems[index]?.discountAmount || 0,
                            taxAmount: ((lineItems[index]?.quantity || 0) * (lineItems[index]?.unitPrice || 0) - (lineItems[index]?.discountAmount || 0)) * ((lineItems[index]?.taxRate || 0) / 100)
                          }).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">

                  <FormField
                    control={form.control as any}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="termsAndConditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Terms & Conditions</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Terms and conditions..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>

                <Card className="ml-auto w-full md:w-80">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>₹ {calculations.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Line Discount</span>
                      <span className="text-destructive">- ₹ {calculations.discountTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>₹ {calculations.taxTotal.toFixed(2)}</span>
                    </div>

                    {/* Total Discount - Percentage or Fixed */}
                    <div className="flex justify-between text-sm items-center gap-2">
                      <FormLabel className="text-xs shrink-0">Total Discount</FormLabel>
                      <div className="flex items-center gap-1">
                        <FormField
                          control={form.control as any}
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
                                    setRenderKey(k => k + 1);
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
                          control={form.control as any}
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
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    {totalDiscountType && calculations.totalDiscount > 0 && (
                      <div className="flex justify-between text-xs text-destructive">
                        <span></span>
                        <span>- ₹ {calculations.totalDiscount.toFixed(2)}</span>
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
                            ₹ {calculations.additionalChargesTotal.toFixed(2)}
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
                                control={form.control as any}
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
                                control={form.control as any}
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
                            onClick={addAdditionalCharge}
                            type="button"
                            className="w-full h-7 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add Charge
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between text-sm items-center">
                      <FormLabel>Round Off</FormLabel>
                      <FormField
                        control={form.control as any}
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
                    <div className="flex justify-between font-bold text-lg">
                      <span>Grand Total</span>
                      <span>₹ {calculations.grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <FormLabel>Paid Amount</FormLabel>
                      <FormField
                        control={form.control as any}
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
                      <span className="text-destructive">₹ {calculations.dueAmount.toFixed(2)}</span>
                    </div>

                    {/* Payment Method */}
                    <Separator className="mt-2" />
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between text-sm items-center gap-2">
                        <FormLabel className="text-xs shrink-0">Payment Method</FormLabel>
                        <FormField
                          control={form.control as any}
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
                        control={form.control as any}
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
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="secondary"
                  disabled={isSubmitting}
                  onClick={form.handleSubmit((data) => onSubmit(data as InvoiceFormValues, false))}
                  type="button"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={form.handleSubmit((data) => onSubmit(data as InvoiceFormValues, true))}
                  type="button"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isEditing ? 'Save & Confirm' : 'Confirm Invoice'}
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
