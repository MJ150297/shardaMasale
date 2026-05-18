'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useActiveShop } from '@/components/providers/shop-provider';
import { Edit, Eye } from 'lucide-react';

interface ShopData {
  _id: string;
  name: string;
  displayName?: string;
  isActive: boolean;
  createdAtFormatted: string;
}

interface ShopsClientProps {
  shops: ShopData[];
}

export default function ShopsClient({ shops }: ShopsClientProps) {
  const router = useRouter();
  const { switchShop } = useActiveShop();
  const [switchingShopId, setSwitchingShopId] = useState<string | null>(null);

  const handleView = async (shop: ShopData) => {
    const shopId = shop._id.toString();
    setSwitchingShopId(shopId);
    await switchShop(shopId);
    // switchShop does window.location.reload() after success
  };

  const handleEdit = (shop: ShopData) => {
    router.push(`/dashboard/shops/${shop._id.toString()}/edit`);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Shop Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shops.map((shop) => (
          <TableRow key={shop._id.toString()}>
            <TableCell className="font-medium">{shop.name}</TableCell>
            <TableCell>
              <Badge variant={shop.isActive ? 'default' : 'secondary'}>
                {shop.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell>{shop.createdAtFormatted}</TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(shop)}
                >
                  <Edit className="size-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleView(shop)}
                  disabled={switchingShopId === shop._id.toString()}
                >
                  <Eye className="size-3.5 mr-1" />
                  {switchingShopId === shop._id.toString() ? 'Switching...' : 'View'}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}