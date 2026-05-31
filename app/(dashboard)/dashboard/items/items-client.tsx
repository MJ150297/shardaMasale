'use client';

import { useState, useMemo } from 'react';
import type { IItem } from '@/models/Item';
import { MoreHorizontal, Package } from 'lucide-react';
import CreateItemDialog from '@/components/create-item-dialog';
import StockAdjustmentDialog from '@/components/stock-adjustment-dialog';
import ItemPreviewDialog from '@/components/item-preview-dialog';
import EditItemDialog from '@/components/edit-item-dialog';
import DataTableToolbar from '@/components/data-table-toolbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import RequireShopGuard from '@/components/require-shop-guard';

interface ItemsClientProps {
  items: (IItem & { _id: string; serviceUsageCount?: number })[];
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'discontinued': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getTypeBadgeClass(type: string) {
  switch (type) {
    case 'product': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'service': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

export default function ItemsClient({ items }: ItemsClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<(IItem & { _id: string }) | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Separate state for dialogs triggered from dropdown
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editItemTarget, setEditItemTarget] = useState<(IItem & { _id: string }) | null>(null);
  const [stockAdjustOpen, setStockAdjustOpen] = useState(false);
  const [stockAdjustTarget, setStockAdjustTarget] = useState<(IItem & { _id: string }) | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesType = typeFilter === 'all' || item.itemType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [items, searchQuery, statusFilter, typeFilter]);

  const handleFilter = (key: string, value: string) => {
    if (key === 'status') setStatusFilter(value);
    if (key === 'type') setTypeFilter(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Items</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your products and services</p>
        </div>
        <RequireShopGuard>
          <CreateItemDialog onItemCreated={() => window.location.reload()} />
        </RequireShopGuard>
      </div>

      <Tabs defaultValue="all" value={typeFilter} onValueChange={setTypeFilter} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Items</TabsTrigger>
          <TabsTrigger value="product">Products</TabsTrigger>
          <TabsTrigger value="service">Services</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTableToolbar
        onSearch={setSearchQuery}
        onFilter={handleFilter}
        searchPlaceholder="Search items by name, SKU, category..."
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'draft', label: 'Draft' },
              { value: 'discontinued', label: 'Discontinued' },
            ]
          },
          {
            key: 'type',
            label: 'Type',
            options: [
              { value: 'product', label: 'Product' },
              { value: 'service', label: 'Service' },
            ]
          }
        ]}
      />

      {/* Flexbox Card Layout - Matching Dashboard Transactions */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-4xl mb-2">📦</div>
            <p className="font-medium text-gray-900 dark:text-white">No items found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Get started by creating your first item</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredItems.map((item) => {
              const availableQuantity = item.stock.currentQuantity - item.stock.reservedQuantity;

              return (
                <div
                  key={item._id.toString()}
                  className="px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedItem(item);
                    setPreviewOpen(true);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="space-y-3">
                    {/* Main row: left info + right meta */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 md:w-5 md:h-5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white truncate">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getTypeBadgeClass(item.itemType)}`}>
                              {item.itemType}
                            </span>
                            {item.sku && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                SKU: {item.sku}
                              </span>
                            )}
                            {item.category && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline truncate">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: stock + price + status + actions */}
                      <div className="flex items-center gap-2 md:gap-3 shrink-0">
                        {/* Stock info - desktop only */}
                        <div className="text-right hidden sm:block">
                          {item.itemType === 'service' ? (
                            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                              {(item as any).serviceUsageCount ?? 0} times
                            </p>
                          ) : (
                            <div>
                              <p className={`text-xs md:text-sm font-medium ${availableQuantity <= item.stock.reorderLevel ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                {availableQuantity} {item.unitOfMeasure}
                              </p>
                              {item.stock.reservedQuantity > 0 && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                  {item.stock.reservedQuantity} reserved
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Price - desktop only */}
                        <div className="text-right hidden sm:block">
                          <p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">
                            ₹{item.pricing.sellingPrice.toFixed(2)}
                          </p>
                        </div>

                        {/* Status badge */}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadgeClass(item.status)}`}>
                          {item.status}
                        </span>

                        {/* Mobile stock & price inline (shown only on small screens) */}
                        <div className="sm:hidden text-right">
                          {item.itemType === 'service' ? (
                            <p className="text-[10px] text-gray-500">
                              {(item as any).serviceUsageCount ?? 0} uses
                            </p>
                          ) : (
                            <p className={`text-[10px] ${availableQuantity <= item.stock.reorderLevel ? 'text-red-600' : 'text-gray-500'}`}>
                              {availableQuantity} {item.unitOfMeasure}
                              {item.stock.reservedQuantity > 0 && ` (${item.stock.reservedQuantity} res.)`}
                            </p>
                          )}
                        </div>

                        {/* 3-dot Action Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white/90 dark:bg-gray-900/90" onClick={(e) => e.stopPropagation()}>
                            {item.itemType === 'product' && (
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setStockAdjustTarget(item);
                                  setStockAdjustOpen(true);
                                }}
                              >
                                Adjust Stock
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditItemTarget(item);
                                setEditItemOpen(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onSelect={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()} className="bg-white/80 dark:bg-gray-900/80">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Item</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the item
                                    <span className="font-semibold"> {item.name} </span>
                                    and remove all associated data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(`/api/items?id=${item._id}`, {
                                          method: 'DELETE',
                                        });
                                        
                                        if (!response.ok) {
                                          const error = await response.json();
                                          throw new Error(error.error || 'Failed to delete item');
                                        }
                                        
                                        toast.success('Item deleted successfully');
                                        window.location.reload();
                                      } catch (error) {
                                        console.error('Error deleting item:', error);
                                        toast.error(error instanceof Error ? error.message : 'Failed to delete item');
                                      }
                                    }}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Item Dialog - rendered outside dropdown */}
      {editItemTarget && (
        <EditItemDialog
          key={"edit-" + editItemTarget._id}
          item={editItemTarget}
          open={editItemOpen}
          onOpenChange={(open) => {
            setEditItemOpen(open);
            if (!open) setEditItemTarget(null);
          }}
          onItemUpdated={() => window.location.reload()}
        />
      )}

      {/* Stock Adjustment Dialog - rendered outside dropdown */}
      {stockAdjustTarget && (
        <StockAdjustmentDialog
          key={"adjust-" + stockAdjustTarget._id}
          item={stockAdjustTarget}
          open={stockAdjustOpen}
          onOpenChange={(open) => {
            setStockAdjustOpen(open);
            if (!open) setStockAdjustTarget(null);
          }}
          onAdjustmentComplete={() => window.location.reload()}
        />
      )}

      <ItemPreviewDialog
        item={selectedItem}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}