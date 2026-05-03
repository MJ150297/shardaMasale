import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperOwner } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import Shop from "@/models/Shop";
import Transaction from "@/models/Transaction";

export default async function SuperOwnerDashboardPage() {
  await requireSuperOwner();
  await connectToDatabase();

  const totalUsers = await User.countDocuments();
  const totalShops = await Shop.countDocuments();
  const totalTransactions = await Transaction.countDocuments();
  const totalOwners = await User.countDocuments({ role: 'owner' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Super Owner Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview and system administration
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Owners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOwners}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShops}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}