'use client';

import { useState, useMemo } from 'react';
import type { IItem } from '@/models/Item';
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
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ItemsClientProps {
  items: (IItem & { _id: string })[];
}

export default function ItemsClient({ items }: ItemsClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<(IItem & { _id: string }) | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

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
          <h1 className="text-2xl font-bold text-gray-900">Items</h1>
          <p className="text-gray-500 mt-1">Manage your products and services</p>
        </div>
        <CreateItemDialog onItemCreated={() => window.location.reload()} />
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

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-2">📦</div>
                    <p className="font-medium">No items found</p>
                    <p className="text-sm mt-1">Get started by creating your first item</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const availableQuantity = item.stock.currentQuantity - item.stock.reservedQuantity;

                  return (
                   <tr 
                     key={item._id.toString()} 
                     className="hover:bg-gray-50 cursor-pointer"
                     onClick={() => {
                       setSelectedItem(item);
                       setPreviewOpen(true);
                     }}
                   >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.category && (
                        <div className="text-sm text-gray-500">{item.category}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap capitalize text-sm text-gray-600">
                      {item.itemType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.sku || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col">
                        <span className={availableQuantity <= item.stock.reorderLevel ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {availableQuantity} {item.unitOfMeasure}
                        </span>
                        {item.stock.reservedQuantity > 0 && (
                          <span className="text-xs text-amber-600">
                            {item.stock.reservedQuantity} reserved
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{item.pricing.sellingPrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : item.status === 'discontinued'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                       <StockAdjustmentDialog
                         item={item}
                         onAdjustmentComplete={() => window.location.reload()}
                       >
                          <button 
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Adjust Stock
                          </button>
                       </StockAdjustmentDialog>
                       <EditItemDialog
                         item={item}
                         onItemUpdated={() => window.location.reload()}
                       >
                         <button 
                           className="text-gray-600 hover:text-gray-900 mr-3"
                           onClick={(e) => e.stopPropagation()}
                         >
                           Edit
                         </button>
                       </EditItemDialog>
                       
                       <AlertDialog>
                         <AlertDialogTrigger asChild>
                           <button 
                             className="text-red-600 hover:text-red-900"
                             onClick={(e) => e.stopPropagation()}
                           >
                             Delete
                           </button>
                         </AlertDialogTrigger>
                         <AlertDialogContent onClick={(e) => e.stopPropagation()} className="bg-white/80">
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
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
       </div>

       <ItemPreviewDialog
         item={selectedItem}
         open={previewOpen}
         onOpenChange={setPreviewOpen}
       />
     </div>
   );
 }
