'use client';

import { useState } from 'react';
import type { IItem } from '@/models/Item';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface ItemPreviewDialogProps {
  item: (IItem & { _id: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ItemPreviewDialog({
  item,
  open,
  onOpenChange,
}: ItemPreviewDialogProps) {
  if (!item) return null;

  const availableQuantity = item.stock.currentQuantity - item.stock.reservedQuantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] bg-white/80 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{item.name}</DialogTitle>
          {item.description && (
            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Status & Type */}
          <div className="flex flex-wrap gap-2">
            <Badge
              className={`${
                item.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : item.status === 'discontinued'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {item.status}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {item.itemType}
            </Badge>
            {item.category && (
              <Badge variant="outline">{item.category}</Badge>
            )}
            {item.brand && (
              <Badge variant="outline">{item.brand}</Badge>
            )}
          </div>

          {/* Identifiers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">SKU</p>
              <p className="font-medium">{item.sku || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Barcode</p>
              <p className="font-medium">{item.barcode || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">HSN Code</p>
              <p className="font-medium">{item.hsnCode || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">SAC Code</p>
              <p className="font-medium">{item.sacCode || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Unit</p>
              <p className="font-medium">{item.unitOfMeasure}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Purchase Tax</p>
              <p className="font-medium">{item.purchaseTaxRate ?? item.taxRate ?? 0}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Sale Tax</p>
              <p className="font-medium">{item.saleTaxRate ?? item.taxRate ?? 0}%</p>
            </div>
          </div>

          <Separator />

          {/* Stock Information */}
          {item.itemType === 'product' && (
            <div>
              <h3 className="font-semibold mb-3">Stock Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Current Quantity</p>
                  <p className="font-medium">{item.stock.currentQuantity} {item.unitOfMeasure}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Reserved</p>
                  <p className="font-medium">{item.stock.reservedQuantity} {item.unitOfMeasure}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Available</p>
                  <p className={`font-medium ${availableQuantity <= item.stock.reorderLevel ? 'text-red-600' : ''}`}>
                    {availableQuantity} {item.unitOfMeasure}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Reorder Level</p>
                  <p className="font-medium">{item.stock.reorderLevel} {item.unitOfMeasure}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Location</p>
                  <p className="font-medium">{item.stock.location || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Reorder Quantity</p>
                  <p className="font-medium">{item.stock.reorderQuantity} {item.unitOfMeasure}</p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Pricing */}
          <div>
            <h3 className="font-semibold mb-3">Pricing Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Cost Price</p>
                <p className="font-medium">₹{item.pricing.costPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Purchase Price</p>
                <p className="font-medium">₹{item.pricing.purchasePrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Selling Price</p>
                <p className="font-medium">₹{item.pricing.sellingPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">MRP</p>
                <p className="font-medium">{item.pricing.mrp ? `₹${item.pricing.mrp.toFixed(2)}` : '-'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Settings */}
          <div>
            <h3 className="font-semibold mb-3">Inventory Settings</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.trackInventory ? 'bg-green-500' : 'bg-gray-300'}`} />
                <p className="text-sm">Track Inventory</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.trackBatch ? 'bg-green-500' : 'bg-gray-300'}`} />
                <p className="text-sm">Track Batch</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.trackExpiry ? 'bg-green-500' : 'bg-gray-300'}`} />
                <p className="text-sm">Track Expiry</p>
              </div>
            </div>
          </div>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag, i) => (
                    <Badge key={i} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {item.expiryDate && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Expiry Date</p>
                <p className="font-medium">{formatDate(item.expiryDate)}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
