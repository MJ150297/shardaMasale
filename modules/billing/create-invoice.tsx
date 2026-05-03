'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Trash2,
  Save,
  Send,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const createInvoiceSchema = z.object({
  party: z.string().optional().nullable(),
  transactionDate: z.coerce.date().default(() => new Date()),
  dueDate: z.coerce.date(),
  lineItems: z.array(lineItemSchema).min(1, "At least one item is required"),
  summary: z.object({
    roundOff: z.coerce.number().default(0),
    paidAmount: z.coerce.number().min(0).default(0),
  }),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  status: z.enum(["draft", "confirmed"]).default("draft"),
});

type InvoiceFormValues = z.infer<typeof createInvoiceSchema>;

interface Item {
  id: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  stock: {
    currentQuantity: number;
  };
}

interface Party {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface CreateInvoiceProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CreateInvoice({ onSuccess, onCancel }: CreateInvoiceProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema) as any,
    defaultValues: {
      transactionDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lineItems: [
        {
          itemName: '',
          unit: 'pcs',
          quantity: 1,
          unitPrice: 0,
          discountAmount: 0,
          taxRate: 0,
        },
      ],
      summary: {
        roundOff: 0,
        paidAmount: 0,
      },
      status: 'draft',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lineItems',
  });

  const lineItems = form.watch('lineItems');
  const roundOff = form.watch('summary.roundOff');
  const paidAmount = form.watch('summary.paidAmount');

  const calculations = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const discountTotal = lineItems.reduce((sum, item) => sum + item.discountAmount, 0);
    const taxTotal = lineItems.reduce((sum, item) => {
      const taxable = (item.quantity * item.unitPrice) - item.discountAmount;
      return sum + (taxable * (item.taxRate / 100));
    }, 0);
    
    const grandTotal = subtotal - discountTotal + taxTotal + roundOff;
    const dueAmount = Math.max(grandTotal - paidAmount, 0);

    return {
      subtotal: roundCurrency(subtotal),
      discountTotal: roundCurrency(discountTotal),
      taxTotal: roundCurrency(taxTotal),
      grandTotal: roundCurrency(grandTotal),
      dueAmount: roundCurrency(dueAmount),
    };
  }, [lineItems, roundOff, paidAmount]);

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

  const onSubmit = async (data: InvoiceFormValues, confirm: boolean = false) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        status: confirm ? 'confirmed' : 'draft',
      };

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Invoice created successfully');
        form.reset();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
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
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {parties.map((party) => (
                            <SelectItem key={party.id} value={party.id}>
                              {party.name}
                            </SelectItem>
                          ))}
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

                <div className="border rounded-lg overflow-x-auto">
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
                      {fields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell>
                            <FormField
                              control={form.control as any}
                              name={`lineItems.${index}.itemName`}
                              render={({ field }) => (
                                <FormItem className="m-0">
                                  <FormControl>
                                    <Input
                                      placeholder="Item name"
                                      {...field}
                                      className="border-0 shadow-none"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
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
                      <span>Discount</span>
                      <span className="text-destructive">- ₹ {calculations.discountTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>₹ {calculations.taxTotal.toFixed(2)}</span>
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
                  Confirm Invoice
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}