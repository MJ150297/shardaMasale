import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { requireSuperOwner } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import OwnersClient from "./owners-client";

export default async function OwnersManagementPage() {
  await requireSuperOwner();
  await connectToDatabase();

  const owners = await User.find({ role: 'owner' })
    .select('name email status createdAt lastLoginAt')
    .sort({ createdAt: -1 })
    .lean()
    .then(items => items.map(item => ({
      ...item,
      _id: item._id.toString()
    })));

  return (
    <div className="space-y-6">
      <OwnersClient initialOwners={owners} />

      <Card>
        <CardHeader>
          <CardTitle>All Owners ({owners.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map((owner: any) => (
                <TableRow key={owner._id.toString()}>
                  <TableCell className="font-medium">{owner.name}</TableCell>
                  <TableCell>{owner.email}</TableCell>
                  <TableCell>
                    <Badge variant={owner.status === 'active' ? 'default' : 'secondary'}>
                      {owner.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(owner.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{owner.lastLoginAt ? new Date(owner.lastLoginAt).toLocaleDateString() : 'Never'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="secondary">Edit</Button>
                    <Button size="sm" variant="default">Impersonate</Button>
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
