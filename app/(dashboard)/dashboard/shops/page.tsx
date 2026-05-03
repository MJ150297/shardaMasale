import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { requireOwner } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Shop from "@/models/Shop";

export default async function OwnerShopsManagementPage() {
  const user = await requireOwner();
  await connectToDatabase();

  const shops = await Shop.find({ ownerId: user.id })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Shops</h1>
          <p className="text-muted-foreground">
            Manage your business locations
          </p>
        </div>
        <Button>Add New Shop</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shops.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shops.filter((s: any) => s.isActive).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Shops</CardTitle>
        </CardHeader>
        <CardContent>
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
              {shops.map((shop: any) => (
                <TableRow key={shop._id.toString()}>
                  <TableCell className="font-medium">{shop.name}</TableCell>
                  <TableCell>
                    <Badge variant={shop.isActive ? 'default' : 'secondary'}>
                      {shop.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(shop.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="secondary">Edit</Button>
                    <Button size="sm" variant="default">View</Button>
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