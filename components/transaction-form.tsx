'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import { roundCurrency } from '@/lib/utils';

// Transaction Types
const transactionFormSchema = z.object({
  type: z.enum(["sale", "purchase", "sale-return", "purchase-return"]),
  party: z.string().optional().nullable(),
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
  summary: z.object({
    roundOff: z.coerce.number().default(0),
    paidAmount: z.coerce.number().min(0).default(0),
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
}

export default function TransactionForm({ mode, isOpen, onSuccess, onCancel }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'draft' | 'confirmed' | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingParties, setLoadingParties] = useState(false);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [renderKey, setRenderKey] = useState(0);

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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems"
  });

  // Calculate summary totals - FULL REACTIVITY FOR ALL OPERATIONS
  const lineItemsCount = fields.length;

  // Always watch base lineItems array to detect add/remove operations
  form.watch('lineItems');
  
  // Watch each individual line item field
  useEffect(() => {
    const paths: string[] = [];
    for (let i = 0; i < lineItemsCount; i++) {
      paths.push(`lineItems.${i}.quantity`);
      paths.push(`lineItems.${i}.unitPrice`);
      paths.push(`lineItems.${i}.discountAmount`);
      paths.push(`lineItems.${i}.taxRate`);
    }
    paths.push('summary.roundOff');
    paths.push('summary.paidAmount');
    
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
  }, [form, lineItemsCount]);

  // Calculate summary DIRECTLY in render - ONLY WORKING WAY for react-hook-form
  const lineItems = form.watch('lineItems') || [];
  const roundOff = roundCurrency(form.watch('summary.roundOff') || 0);
  const paidAmount = roundCurrency(form.watch('summary.paidAmount') || 0);
  
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

  const grandTotal = roundCurrency(subtotal - discountTotal + taxTotal + roundOff);
  const dueAmount = Math.max(roundCurrency(grandTotal - paidAmount), 0);

  const summary = {
    subtotal: roundCurrency(subtotal),
    discountTotal: roundCurrency(discountTotal),
    taxTotal: roundCurrency(taxTotal),
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
        const res = await fetch('/api/items?limit=100');
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
        const allowedTypes = isSaleFlow(mode)
          ? ['customer', 'both'] 
          : ['supplier', 'both'];
          
        const res = await fetch('/api/parties?limit=1000');
        const data = await res.json();
        
        if (res.ok) {
          // Filter parties by allowed types
          const filtered = (data.parties || []).filter((party: any) => {
            return party.partyType === undefined || allowedTypes.includes(party.partyType);
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

  // Only load data when dialog is actually open
  if (!isOpen) return null;

  async function submitTransaction(status: 'draft' | 'confirmed') {
    const values = form.getValues();
    setLoading(true);
    setSubmitStatus(status);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
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

      toast.success(
        status === 'draft'
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
    form.setValue(`lineItems.${index}.item`, item._id);
    form.setValue(`lineItems.${index}.itemName`, item.name);
    form.setValue(`lineItems.${index}.sku`, item.sku);
    form.setValue(`lineItems.${index}.unitPrice`, getDefaultUnitPrice(item, mode));
    form.setValue(`lineItems.${index}.costPrice`, getItemCostPrice(item));
    form.setValue(`lineItems.${index}.unit`, getItemUnit(item));
    form.setValue(`lineItems.${index}.taxRate`, getDefaultTaxRate(item, mode));
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit(() => submitTransaction('confirmed'))(event);
        }}
        className="space-y-6"
      >
        {/* Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="party"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{isSaleFlow(mode) ? 'Customer' : 'Supplier'}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value
                          ? (() => {
                              const party = parties.find(p => p._id === field.value);
                              if (!party) return `Select ${getPartyRole(mode)}`;
                              return party.phoneNumber 
                                ? `${party.displayName || party.name} (${party.phoneNumber})` 
                                : party.displayName || party.name;
                            })()
                          : `Select ${getPartyRole(mode)}`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Search party by name or phone..." 
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
                                "mr-2 h-4 w-4",
                                field.value === null ? "opacity-100" : "opacity-0"
                              )}
                            />
                            None
                          </CommandItem>
                          {(() => {
                            const search = partySearchQuery.toLowerCase();

                            if (search === '') {
                              return parties;
                            }
                            
                            return parties.filter(party => {
                              const partyName = party.displayName || party.name || party.fullName || party.partyName || '';
                              const phone = party.phoneNumber || party.mobile || party.phone || '';

                              return partyName.toLowerCase().includes(search) || phone.toLowerCase().includes(search);
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
                                  "mr-2 h-4 w-4",
                                  party._id === field.value ? "opacity-100" : "opacity-0"
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
            <div className="grid grid-cols-12 gap-2 p-3 bg-muted/50 font-medium text-sm border-b">
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
              <div key={field.id} className="grid grid-cols-12 gap-2 p-3 border-b items-center">
                <div className="col-span-4">
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.itemName`}
                    render={({ field: itemField }) => (
                      <FormItem className="m-0">
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal"
                              >
                                {itemField.value || "Select item"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command shouldFilter={false}>
                              <CommandInput 
                                placeholder="Search item by name or sku..." 
                                className="h-9"
                              />
                              <CommandList>
                                <CommandEmpty>No item found.</CommandEmpty>
                                <CommandGroup>
                                  {items.map((item) => (
                                    <CommandItem
                                      value={item._id}
                                      key={item._id}
                                      onSelect={() => {
                                        handleItemSelect(index, item);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          form.watch(`lineItems.${index}.item`) === item._id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                          <span className="font-medium">{item.name}</span>
                                        <div className="flex gap-3 text-xs text-muted-foreground">
                                          {item.sku && <span>SKU: {item.sku}</span>}
                                          <span>
                                            {isSaleFlow(mode) ? 'Sell' : 'Buy'}: ₹{getDefaultUnitPrice(item, mode).toFixed(2)}
                                          </span>
                                          <span>Stock: {
                                            typeof item.stock === 'object' 
                                              ? item.stock?.currentQuantity || 0 
                                              : (item.stockQuantity || item.stock || 0)
                                          }</span>
                                        </div>
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
              <span>Discount:</span>
              <span className="font-medium text-red-500">-₹{summary.discountTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax:</span>
              <span className="font-medium">+₹{summary.taxTotal.toFixed(2)}</span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between text-lg font-bold">
              <span>Grand Total:</span>
              <span>₹{summary.grandTotal.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <FormField
                control={form.control}
                name="summary.paidAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid Amount</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="summary.roundOff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Round Off</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <FormField
                control={form.control}
                name="payment.method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={v => field.onChange(v === 'none' ? null : v)} value={field.value || 'none'}>
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
                      <Input {...field} value={field.value || ''} placeholder="Transaction / Cheque number" />
                    </FormControl>
                    <FormMessage />
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
              `Confirm ${getModeLabel(mode)}`
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
