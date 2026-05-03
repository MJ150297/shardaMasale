import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { requireOwner } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Shop from "@/models/Shop";
import User from "@/models/User";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface StaffAssignmentPageProps {
  params: {
    shopId: string;
  };
}

export default async function ShopStaffAssignmentPage({ params }: StaffAssignmentPageProps) {
  const user = await requireOwner();
  await connectToDatabase();

  const shop = await Shop.findOne({ _id: params.shopId, ownerId: user.id }).lean();
  
  if (!shop) {
    return <div>Shop not found</div>;
  }

  const staffUsers = await User.find({ belongsTo: user.id })
    .select('name email role allowedShops')
    .lean();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/shops">
            <ChevronLeft className="size-4 mr-1" />
            Back to Shops
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff Access</h1>
        <p className="text-muted-foreground">
          Manage staff access for {shop.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assign Staff to this Shop</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12.5">Access</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffUsers.map((staff: any) => {
                const hasAccess = staff.allowedShops?.map((id: any) => id.toString()).includes(params.shopId);
                
                return (
                  <TableRow key={staff._id.toString()}>
                    <TableCell>
                      <Checkbox defaultChecked={hasAccess} />
                    </TableCell>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>{staff.email}</TableCell>
                    <TableCell className="capitalize">{staff.role}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}