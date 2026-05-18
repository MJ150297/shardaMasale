import { formatDate } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Shop from "@/models/Shop";
import Link from "next/link";
import { Plus } from "lucide-react";
import ShopsClient from "./shops-client";

export default async function OwnerShopsManagementPage() {
  const user = await requireOwner();
  await connectToDatabase();

  const rawShops = await Shop.find({ ownerId: user.id })
    .sort({ createdAt: -1 })
    .lean();

  // Serialize dates server-side to avoid hydration mismatch on locale-dependent formatting
  const shops = rawShops.map((shop: any) => ({
    ...shop,
    _id: shop._id.toString(),
    createdAtFormatted: formatDate(shop.createdAt),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Shops</h1>
          <p className="text-muted-foreground">
            Manage your business locations
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/shops/new">
            <Plus className="size-4 mr-2" />
            Add New Shop
          </Link>
        </Button>
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
          <ShopsClient shops={JSON.parse(JSON.stringify(shops))} />
        </CardContent>
      </Card>
    </div>
  );
}
