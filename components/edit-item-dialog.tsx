'use client';
// @ts-nocheck - Zod v4 and React Hook Form type incompatibility, same as create-item-dialog

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { IItem } from '@/models/Item';
import { isIntegerUnit, getQuantityStep, getQuantityMin } from '@/lib/unit-utils';

const editItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  itemType: z.enum(['product', 'service', 'compound']).default('product'),
  bundleType: z.enum(['product', 'service']).nullable().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  unitOfMeasure: z.string().min(1).max(20).default('pcs'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  hsnCode: z.string().optional(),
  sacCode: z.string().optional(),
  purchaseTaxRate: z.coerce.number().min(0).max(100).default(0),
  saleTaxRate: z.coerce.number().min(0).max(100).default(0),
  pricing: z.object({
    costPrice: z.coerce.number().min(0).default(0),
    purchasePrice: z.coerce.number().min(0).default(0),
    sellingPrice: z.coerce.number().min(0),
    mrp: z.coerce.number().min(0).optional(),
  }),
  stock: z.object({
    openingQuantity: z.coerce.number().min(0).default(0),
    reorderLevel: z.coerce.number().min(0).default(0),
    reorderQuantity: z.coerce.number().min(0).default(0),
    allowNegativeStock: z.boolean().default(false),
    location: z.string().optional(),
  }),
  trackInventory: z.boolean().default(true),
  trackBatch: z.boolean().default(false),
  trackExpiry: z.boolean().default(false),
  batchNumber: z.string().optional(),
  expiryDate: z.union([z.date(), z.string()]).optional().transform(val => val ? new Date(val) : undefined),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'active', 'discontinued', 'archived']).default('active'),
});

type EditItemFormData = z.infer<typeof editItemSchema>;

const PRODUCT_UNIT_OPTIONS = [
  'pcs', 'kg', 'liter', 'meter', 'box', 'pack', 'dozen', 'pair', 'set', 'roll', 'sheet', 'tube'
];

const SERVICE_UNIT_OPTIONS = [
  'hour', 'day', 'week', 'month', 'session', 'visit', 'project', 'unit'
];

interface EditItemDialogProps {
  item: (IItem & { _id: string });
  onItemUpdated?: () => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function EditItemDialog({
  item,
  onItemUpdated,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: EditItemDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Component state for editing compound items
  const [components, setComponents] = useState<Array<{
    item: string;
    itemName: string;
    itemType: string;
    unitOfMeasure: string;
    quantity: number;
    costPrice: number;
    sellingPrice: number;
  }>>([]);
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [loadingAvailableItems, setLoadingAvailableItems] = useState(false);
  const [showItemSearch, setShowItemSearch] = useState(false);

  const isCompound = item.itemType === 'compound';

  const form = useForm<EditItemFormData>({
    // @ts-ignore - Zod v4 resolver type compatibility issue
    resolver: zodResolver(editItemSchema),
    defaultValues: {
      name: item.name,
      description: item.description || '',
      itemType: item.itemType,
      bundleType: item.bundleType || null,
      category: item.category || '',
      brand: item.brand || '',
      unitOfMeasure: item.unitOfMeasure,
      sku: item.sku || '',
      barcode: item.barcode || '',
      hsnCode: item.hsnCode || '',
      sacCode: item.sacCode || '',
      purchaseTaxRate: item.purchaseTaxRate ?? item.taxRate ?? 0,
      saleTaxRate: item.saleTaxRate ?? item.taxRate ?? 0,
      pricing: {
        costPrice: item.pricing.costPrice,
        purchasePrice: item.pricing.purchasePrice,
        sellingPrice: item.pricing.sellingPrice,
        mrp: item.pricing.mrp || 0,
      },
      stock: {
        openingQuantity: item.stock.openingQuantity,
        reorderLevel: item.stock.reorderLevel,
        reorderQuantity: item.stock.reorderQuantity,
        allowNegativeStock: item.stock.allowNegativeStock,
        location: item.stock.location || '',
      },
      trackInventory: item.trackInventory,
      trackBatch: item.trackBatch,
      trackExpiry: item.trackExpiry,
      batchNumber: item.batchNumber || '',
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
      tags: item.tags || [],
      status: item.status,
    },
  });

  const itemType = form.watch('itemType');
  const bundleType = form.watch('bundleType');
  const trackInventory = form.watch('trackInventory');

  // Determine if this item should behave like a product (for form field visibility)
  const isProductLike = itemType === 'product' || (itemType === 'compound' && bundleType === 'product');

  // Initialize component state from item
  useEffect(() => {
    if (isCompound && item.components && item.components.length > 0) {
      // Load component details
      loadComponentDetails(item.components);
    }
  }, [item._id]);

  async function loadComponentDetails(components: Array<{ item: any; quantity: number }>) {
    try {
      const componentIds = components.map((c) => c.item.toString());
      const res = await fetch(`/api/items?limit=5000`);
      const data = await res.json();
      if (res.ok) {
        const allItems = data.items || data.data || [];
        const mapped = components.map((c) => {
          const found = allItems.find((i: any) => i._id === c.item.toString());
          return {
            item: c.item.toString(),
            itemName: found?.name || 'Unknown',
            itemType: found?.itemType || 'product',
            unitOfMeasure: found?.unitOfMeasure || found?.unit || 'pcs',
            quantity: c.quantity,
            costPrice: found?.pricing?.costPrice || 0,
            sellingPrice: found?.pricing?.sellingPrice || 0,
          };
        });
        setComponents(mapped);
      }
    } catch (e) {
      console.error('Failed to load component details', e);
    }
  }

  // Auto-select appropriate default unit when switching item type / bundle type
  useEffect(() => {
    if (itemType === 'compound') {
      const defaultUnit = bundleType === 'product' ? PRODUCT_UNIT_OPTIONS[0] : SERVICE_UNIT_OPTIONS[0];
      form.setValue('unitOfMeasure', defaultUnit);
    } else {
      const defaultUnit = itemType === 'product' ? PRODUCT_UNIT_OPTIONS[0] : SERVICE_UNIT_OPTIONS[0];
      form.setValue('unitOfMeasure', defaultUnit);
    }
  }, [itemType, bundleType, form]);

  // Load available items for component picker
  useEffect(() => {
    if (itemType === 'compound') {
      loadAvailableItems();
    }
  }, [itemType]);

  async function loadAvailableItems() {
    setLoadingAvailableItems(true);
    try {
      const res = await fetch('/api/items?limit=5000');
      const data = await res.json();
      if (res.ok) {
        const itemsList = (data.items || data.data || []).filter(
          (item: any) => item.itemType !== 'compound'
        );
        setAvailableItems(itemsList);
      }
    } catch (e) {
      console.error('Failed to load items', e);
    } finally {
      setLoadingAvailableItems(false);
    }
  }

  // Calculate compound pricing from components
  const compoundPricing = components.reduce(
    (acc, comp) => ({
      costPrice: acc.costPrice + comp.costPrice * comp.quantity,
      sellingPrice: acc.sellingPrice + comp.sellingPrice * comp.quantity,
    }),
    { costPrice: 0, sellingPrice: 0 }
  );

  const totalCostPrice = compoundPricing.costPrice;
  const totalSellingPrice = compoundPricing.sellingPrice;

  function addComponent(compItem: any) {
    if (components.some((c) => c.item === compItem._id)) {
      toast.error('Item already added as a component');
      return;
    }

    setComponents([
      ...components,
      {
        item: compItem._id,
        itemName: compItem.name,
        itemType: compItem.itemType,
        unitOfMeasure: compItem.unitOfMeasure || compItem.unit || 'pcs',
        quantity: 1,
        costPrice: compItem.pricing?.costPrice || 0,
        sellingPrice: compItem.pricing?.sellingPrice || 0,
      },
    ]);
    setShowItemSearch(false);
    setComponentSearchQuery('');
  }

  function removeComponent(index: number) {
    setComponents(components.filter((_, i) => i !== index));
  }

  function updateComponentQuantity(index: number, quantity: number) {
    const comp = components[index];
    const unit = comp.unitOfMeasure || 'pcs';
    const minQty = getQuantityMin(unit);
    let clamped = Math.max(minQty, quantity);
    // For integer-only units, round to whole number
    if (isIntegerUnit(unit)) {
      clamped = Math.round(clamped);
    }
    const updated = [...components];
    updated[index] = { ...updated[index], quantity: clamped };
    setComponents(updated);
  }

  function updateComponentPrice(index: number, field: 'costPrice' | 'sellingPrice', value: number) {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: Math.max(0, value) };
    setComponents(updated);
  }

  const filteredAvailableItems = componentSearchQuery
    ? availableItems.filter((cItem) => {
        const q = componentSearchQuery.toLowerCase();
        return (
          cItem.name?.toLowerCase().includes(q) ||
          cItem.sku?.toLowerCase().includes(q)
        );
      })
    : availableItems;

  const onSubmit = async (formData: unknown) => {
    const data = formData as EditItemFormData;
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        id: item._id,
        ...data,
        bundleType: data.itemType === 'compound' ? (data.bundleType || 'service') : null,
      };

      // For compound items, override pricing with auto-calculated and include components
      if (data.itemType === 'compound' || item.itemType === 'compound') {
        if (components.length === 0 && data.itemType === 'compound') {
          toast.error('Compound items must have at least one component');
          setIsSubmitting(false);
          return;
        }

        payload.components = components.map((c) => ({
          item: c.item,
          quantity: c.quantity,
        }));

        // Auto-calculate pricing
        payload.pricing = {
          costPrice: totalCostPrice,
          purchasePrice: totalCostPrice,
          sellingPrice: totalSellingPrice,
          mrp: null,
        };
      }

      const response = await fetch('/api/items', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update item');
      }

      toast.success('Item updated successfully!');
      handleOpenChange(false);
      onItemUpdated?.();
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    const currentTags = form.getValues('tags') || [];
    if (tagInput.trim() && !currentTags.includes(tagInput.trim())) {
      form.setValue('tags', [...currentTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('tags') || [];
    form.setValue('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  const generateSKU = () => {
    const name = form.getValues('name');
    const category = form.getValues('category');
    if (name) {
      const baseName = name.substring(0, 3).toUpperCase();
      const categoryCode = category ? category.substring(0, 2).toUpperCase() : 'IT';
      const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const sku = `${categoryCode}${baseName}${randomNum}`;
      form.setValue('sku', sku);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto bg-background dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>
            {itemType === 'compound'
              ? bundleType === 'product'
                ? 'Edit product bundle (compound) components and settings.'
                : bundleType === 'service'
                  ? 'Edit service bundle (compound) components and settings.'
                  : 'Edit compound item (bundle/kit) components and settings.'
              : 'Update item details and settings.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList variant="segmented" className={`grid w-full ${itemType === 'compound' ? 'grid-cols-6' : 'grid-cols-5'}`}>
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="identification">ID & Codes</TabsTrigger>
                {itemType === 'compound' && (
                  <TabsTrigger value="components">Components</TabsTrigger>
                )}
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="additional">Additional</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control as any}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter item name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="itemType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="product">Product</SelectItem>
                            <SelectItem value="service">Service</SelectItem>
                            <SelectItem value="compound">Compound (Bundle)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Bundle Type selector — only for compound items */}
                {itemType === 'compound' && (
                  <FormField
                    control={form.control as any}
                    name="bundleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bundle Type *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || 'product'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select bundle type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="product">Product Bundle</SelectItem>
                            <SelectItem value="service">Service Bundle</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Determines whether this compound item is a physical product bundle (e.g., Water RO) or a service bundle (e.g., Website Package).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control as any}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter item description"
                          className="min-h-20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control as any}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Electronics, Clothing" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isProductLike && (
                    <FormField
                      control={form.control as any}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Apple, Samsung" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control as any}
                    name="unitOfMeasure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit of Measure</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(isProductLike ? PRODUCT_UNIT_OPTIONS : SERVICE_UNIT_OPTIONS).map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="identification" className="space-y-4">
                {isProductLike && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control as any}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input placeholder="Auto-generated or custom" {...field} />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={generateSKU}
                            >
                              Generate
                            </Button>
                          </div>
                          <FormDescription>
                            Stock Keeping Unit - unique identifier for inventory
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control as any}
                      name="barcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Barcode</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter barcode" {...field} />
                          </FormControl>
                          <FormDescription>
                            Optional barcode for scanning
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {isProductLike ? (
                    <FormField
                      control={form.control as any}
                      name="hsnCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>HSN Code</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 8517" {...field} />
                          </FormControl>
                          <FormDescription>
                            Harmonized System of Nomenclature for products
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control as any}
                      name="sacCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SAC Code</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 9983" {...field} />
                          </FormControl>
                          <FormDescription>
                            Services Accounting Code for services
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                </div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control as any}
                    name="pricing.costPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Price (₹)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={itemType === 'compound' ? 'Auto-calculated' : '0.00'}
                            {...field}
                            value={field.value ?? ''}
                            disabled={itemType === 'compound'}
                          />
                        </FormControl>
                        <FormDescription>
                          {itemType === 'compound'
                            ? 'Auto-calculated from component costs'
                            : itemType === 'product'
                              ? 'Your purchase / manufacturing cost'
                              : 'Your cost to deliver this service'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isProductLike && (
                  <FormField
                    control={form.control as any}
                    name="pricing.purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price (₹)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Price you pay to suppliers
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control as any}
                  name="pricing.sellingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price (₹) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={itemType === 'compound' ? 'Auto-calculated' : '0.00'}
                          {...field}
                          disabled={itemType === 'compound'}
                        />
                      </FormControl>
                      <FormDescription>
                        {itemType === 'compound'
                          ? 'Auto-calculated from component selling prices'
                          : 'Price you charge to customers'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isProductLike && (
                  <FormField
                    control={form.control as any}
                    name="pricing.mrp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MRP (₹)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum Retail Price (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {itemType === 'compound' && components.length > 0 && (
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4 space-y-2">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">Compound Pricing Summary</h4>
                  <div className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                    <p>Total Cost: ₹{totalCostPrice.toFixed(2)}</p>
                    <p>Total Selling Price: ₹{totalSellingPrice.toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-500">
                    Prices are auto-calculated from {components.length} component(s).
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control as any}
                  name="purchaseTaxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Tax (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Default input tax rate for purchase transactions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="saleTaxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale Tax (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Default output tax rate for sale transactions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              {isProductLike && (
                <>
                  <FormField
                    control={form.control as any}
                    name="trackInventory"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Track Inventory</FormLabel>
                          <FormDescription>
                            Enable stock tracking for this product
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {trackInventory && (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control as any}
                          name="stock.openingQuantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Opening Stock</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control as any}
                          name="stock.reorderLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reorder Level</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Minimum stock before reorder
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control as any}
                          name="stock.reorderQuantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reorder Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Quantity to reorder
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control as any}
                          name="stock.allowNegativeStock"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Allow Negative Stock</FormLabel>
                                <FormDescription>
                                  Permit sales when out of stock
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                         <FormField
                           control={form.control as any}
                           name="stock.location"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Storage Location</FormLabel>
                               <FormControl>
                                 <Input placeholder="e.g., Shelf A1, Warehouse 2" {...field} />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                       </div>

                       <div className="border-t pt-4 mt-4">
                         <h3 className="text-sm font-medium mb-4">Batch & Expiry Tracking</h3>
                         
                         <div className="grid grid-cols-2 gap-4">
                           <FormField
                             control={form.control as any}
                             name="trackBatch"
                             render={({ field }) => (
                               <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                 <FormControl>
                                   <Checkbox
                                     checked={field.value}
                                     onCheckedChange={field.onChange}
                                   />
                                 </FormControl>
                                 <div className="space-y-1 leading-none">
                                   <FormLabel>Track Batches</FormLabel>
                                   <FormDescription>
                                     Enable batch number tracking for this product
                                   </FormDescription>
                                 </div>
                               </FormItem>
                             )}
                           />

                           <FormField
                             control={form.control as any}
                             name="trackExpiry"
                             render={({ field }) => (
                               <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                 <FormControl>
                                   <Checkbox
                                     checked={field.value}
                                     onCheckedChange={field.onChange}
                                   />
                                 </FormControl>
                                 <div className="space-y-1 leading-none">
                                   <FormLabel>Track Expiry Dates</FormLabel>
                                   <FormDescription>
                                     Enable expiry date tracking for this product
                                   </FormDescription>
                                 </div>
                               </FormItem>
                             )}
                           />
                         </div>

                         <div className="grid grid-cols-2 gap-4 mt-4">
                           {form.watch('trackBatch') && (
                             <FormField
                               control={form.control as any}
                               name="batchNumber"
                               render={({ field }) => (
                                 <FormItem>
                                   <FormLabel>Batch Number</FormLabel>
                                   <FormControl>
                                     <Input placeholder="e.g., BATCH-001" {...field} />
                                   </FormControl>
                                   <FormMessage />
                                 </FormItem>
                               )}
                             />
                           )}

                           {form.watch('trackExpiry') && (
                             <FormField
                               control={form.control as any}
                               name="expiryDate"
                               render={({ field }) => (
                                 <FormItem>
                                   <FormLabel>Expiry Date</FormLabel>
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
                           )}
                         </div>
                       </div>
                     </>
                  )}
                </>
              )}

              {itemType === 'service' && (
                <div className="text-center py-8 text-gray-500">
                  <p>Services don't require inventory tracking.</p>
                  <p className="text-sm mt-2">Stock management is automatically disabled for services.</p>
                </div>
              )}

              {itemType === 'compound' && bundleType === 'service' && (
                <div className="text-center py-8 text-gray-500">
                  <p>Service bundles don't require inventory tracking.</p>
                  <p className="text-sm mt-2">Stock management is automatically disabled for service bundles.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="additional" className="space-y-4">
              <FormField
                control={form.control as any}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="discontinued">Discontinued</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Item availability status
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Tags</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(form.watch('tags') || []).map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
                <FormDescription>
                  Add tags to categorize and search items easily
                </FormDescription>
              </div>
            </TabsContent>

            {/* Components Tab - Only visible for compound items */}
            {itemType === 'compound' && (
              <TabsContent value="components" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium">Component Items</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowItemSearch(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Component
                    </Button>
                  </div>

                  {/* Item search popup */}
                  {showItemSearch && (
                    <div className="rounded-lg border p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-500" />
                        <Input
                          placeholder="Search products & services..."
                          value={componentSearchQuery}
                          onChange={(e) => setComponentSearchQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {loadingAvailableItems ? (
                          <p className="text-sm text-gray-500 py-2 text-center">Loading items...</p>
                        ) : filteredAvailableItems.length === 0 ? (
                          <p className="text-sm text-gray-500 py-2 text-center">
                            {componentSearchQuery ? 'No items found' : 'No products or services available'}
                          </p>
                        ) : (
                          filteredAvailableItems.slice(0, 20).map((cItem) => (
                            <div
                              key={cItem._id}
                              className="flex items-center justify-between p-2 rounded-md hover:bg-white dark:hover:bg-gray-800 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                              onClick={() => addComponent(cItem)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
                                  {cItem.itemType}
                                </span>
                                <span className="text-sm font-medium truncate">{cItem.name}</span>
                                {cItem.sku && (
                                  <span className="text-xs text-gray-500 truncate">SKU: {cItem.sku}</span>
                                )}
                              </div>
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0 ml-2">
                                ₹{(cItem.pricing?.sellingPrice || 0).toFixed(2)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowItemSearch(false);
                            setComponentSearchQuery('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Component list */}
                  {components.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 border rounded-lg">
                      <p>No components added yet.</p>
                      <p className="text-sm mt-1">Click "Add Component" to add products or services to this compound item.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {components.map((comp, index) => (
                        <div
                          key={`${comp.item}-${index}`}
                          className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-gray-900"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Badge variant="outline" className="shrink-0">
                                {comp.itemType}
                              </Badge>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{comp.itemName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-gray-500">
                                ₹{comp.costPrice.toFixed(2)}
                              </span>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-gray-400 mb-0.5">Sell</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={comp.sellingPrice}
                                  onChange={(e) => updateComponentPrice(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                                  className="w-20 h-8 text-xs text-center"
                                />
                              </div>
                              <span className="text-xs text-gray-400">×  </span>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-gray-400 mb-0.5">Qty</span>
                                <div className="flex items-center gap-0.5">
                                  <Input
                                    type="number"
                                    min={getQuantityMin(comp.unitOfMeasure || 'pcs')}
                                    step={getQuantityStep(comp.unitOfMeasure || 'pcs')}
                                    value={comp.quantity}
                                    onChange={(e) => updateComponentQuantity(index, parseFloat(e.target.value) || 0.01)}
                                    className="w-16 h-8 text-xs text-center"
                                  />
                                  <span className="text-[10px] text-gray-400 shrink-0 w-5">
                                    {comp.unitOfMeasure || 'pcs'}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs text-gray-400">=</span>
                              <span className="text-sm font-semibold w-20 text-right">
                                ₹{(comp.sellingPrice * comp.quantity).toFixed(2)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700"
                                onClick={() => removeComponent(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                        </div>
                      ))}

                      {/* Summary footer */}
                      <div className="rounded-lg border bg-gray-50 dark:bg-gray-900 p-4 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                          <span className="font-medium">₹{totalCostPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Total Selling Price:</span>
                          <span className="font-semibold text-gray-900 dark:text-white">₹{totalSellingPrice.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-gray-500 pt-1">
                          Component prices are editable. Compound total is calculated from component prices × quantities.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Item'}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  </Dialog>
);
}