import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { requireSuperOwner } from "@/lib/auth";
import { formatDate } from "@/lib/date-utils";
import connectToDatabase from "@/lib/db";
import Shop from "@/models/Shop";

export default async function ShopsListingPage() {
  await requireSuperOwner();
  await connectToDatabase();

  const shops = await Shop.find({})
    .populate('ownerId', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shops Management</h1>
          <p className="text-muted-foreground">
            View and manage all shops across the platform
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Shops ({shops.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shops.map((shop: any) => (
                <TableRow key={shop._id.toString()}>
                  <TableCell className="font-medium">{shop.name}</TableCell>
                  <TableCell>{shop.ownerId?.name || 'Unknown'} <br /><span className="text-xs text-muted-foreground">{shop.ownerId?.email}</span></TableCell>
                  <TableCell>
                    <Badge variant={shop.isActive ? 'default' : 'secondary'}>
                      {shop.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(shop.createdAt)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="secondary">View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}