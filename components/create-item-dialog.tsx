'use client';

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
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';

const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  itemType: z.enum(['product', 'service']).default('product'),
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

type CreateItemFormData = z.infer<typeof createItemSchema>;

const PRODUCT_UNIT_OPTIONS = [
  'pcs', 'kg', 'liter', 'meter', 'box', 'pack', 'dozen', 'pair', 'set', 'roll', 'sheet', 'tube'
];

const SERVICE_UNIT_OPTIONS = [
  'hour', 'day', 'week', 'month', 'session', 'visit', 'project', 'unit'
];

interface CreateItemDialogProps {
  onItemCreated?: (item: CreatedItem) => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export interface CreatedItem {
  _id: string;
  name: string;
  description?: string;
  sku?: string;
  unit?: string;
  unitOfMeasure?: string;
  price?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  costPrice?: number;
  purchaseTaxRate?: number;
  saleTaxRate?: number;
  taxRate?: number;
  pricing?: {
    costPrice?: number;
    purchasePrice?: number;
    sellingPrice?: number;
    mrp?: number;
  };
  stock?: {
    currentQuantity?: number;
    openingQuantity?: number;
    allowNegativeStock?: boolean;
  };
  stockQuantity?: number;
}

export default function CreateItemDialog({
  onItemCreated,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showTrigger = true,
}: CreateItemDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  }

  const form = useForm<CreateItemFormData>({
    // @ts-ignore - Zod v4 resolver type compatibility issue
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      name: '',
      description: '',
      itemType: 'product',
      category: '',
      brand: '',
      unitOfMeasure: 'pcs',
      sku: '',
      barcode: '',
      hsnCode: '',
      sacCode: '',
      purchaseTaxRate: 0,
      saleTaxRate: 0,
      pricing: {
        costPrice: 0,
        purchasePrice: 0,
        sellingPrice: 0,
        mrp: 0,
      },
      stock: {
        openingQuantity: 0,
        reorderLevel: 0,
        reorderQuantity: 0,
        allowNegativeStock: false,
        location: '',
      },
      trackInventory: true,
      trackBatch: false,
      trackExpiry: false,
      batchNumber: '',
      expiryDate: undefined,
      tags: [],
      status: 'active',
    },
  });

  const itemType = form.watch('itemType');
  const trackInventory = form.watch('trackInventory');

  // Auto-select appropriate default unit when switching item type
  useEffect(() => {
    const defaultUnit = itemType === 'product' 
      ? PRODUCT_UNIT_OPTIONS[0] 
      : SERVICE_UNIT_OPTIONS[0];
    
    form.setValue('unitOfMeasure', defaultUnit);
  }, [itemType, form]);

  const onSubmit = async (formData: unknown) => {
    const data = formData as CreateItemFormData;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const item = (await response.json()) as CreatedItem | { error?: string };

      if (!response.ok) {
        throw new Error('error' in item ? item.error || 'Failed to create item' : 'Failed to create item');
      }

      toast.success('Item created successfully!');
      handleOpenChange(false);
      form.reset();
      onItemCreated?.(item as CreatedItem);
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create item');
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
      {showTrigger && (
        <DialogTrigger asChild>
          {children || (
            <Button className='bg-blue-600 hover:bg-blue-700 text-white px-4 py-4 rounded-md text-sm font-medium transition-colors'>
              + Add Item (Product/Service)
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Create New Item</DialogTitle>
          <DialogDescription>
            Add a new product or service to your inventory.
          </DialogDescription>
        </DialogHeader>

        {/* @ts-ignore - Zod v4 + React Hook Form type incompatibility */}
        <Form {...(form as any)}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="identification">ID & Codes</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="additional">Additional</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                 <FormField
                   // @ts-ignore - Zod v4 resolver type incompatibility
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="product">Product</SelectItem>
                            <SelectItem value="service">Service</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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

                   {itemType === 'product' && (
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(itemType === 'product' ? PRODUCT_UNIT_OPTIONS : SERVICE_UNIT_OPTIONS).map((unit) => (
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
                 {itemType === 'product' && (
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
                  {itemType === 'product' ? (
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
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? ''}
                            />
                        </FormControl>
                        <FormDescription>
                          {itemType === 'product' 
                            ? 'Your purchase / manufacturing cost' 
                            : 'Your cost to deliver this service'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {itemType === 'product' && (
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
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Price you charge to customers
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {itemType === 'product' && (
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
                {itemType === 'product' && (
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
              </TabsContent>

              <TabsContent value="additional" className="space-y-4">
                <FormField
                  control={form.control as any}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                {isSubmitting ? 'Creating...' : 'Create Item'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
