import { requireUser } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Party from '@/models/Party';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Mail,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  Clock,
  Edit,
  Trash2,
  Send,
} from 'lucide-react';

interface PartyPageProps {
  params: {
    partyId: string;
  };
}

export default async function PartyPage({ params }: PartyPageProps) {
  const resolvedParams = await params;
  const user = await requireUser();
  await connectToDatabase();

  const party = await Party.findOne({
    _id: resolvedParams.partyId,
    owner: user.id,
  }).lean();

  if (!party) {
    notFound();
  }

  const partyStatusColors = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const partyTypeLabels = {
    customer: 'Customer',
    supplier: 'Supplier',
    both: 'Customer & Supplier',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{party.displayName}</h1>
            <Badge className={partyStatusColors[party.status]}>
              {party.status}
            </Badge>
            <Badge variant="secondary">
              {partyTypeLabels[party.partyType]}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {/* @ts-ignore */}
            Created {format(new Date(party.createdAt), 'dd MMM yyyy')}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm">
            <Send className="w-4 h-4 mr-2" />
            Send Invite
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{party.currentBalance?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Credit Limit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{party.creditLimit?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Opening Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{party.openingBalance?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>{party.email || 'No email provided'}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span>{party.phoneNumber || 'No phone provided'}</span>
                </div>

                {party.alternatePhoneNumber && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{party.alternatePhoneNumber}</span>
                  </div>
                )}

                <Separator />

                {party.gstin && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">GSTIN</span>
                    <span className="font-mono">{party.gstin}</span>
                  </div>
                )}

                {party.pan && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">PAN</span>
                    <span className="font-mono">{party.pan}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Tax Treatment</span>
                  <span className="capitalize">{party.taxTreatment}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {party.legalName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Legal Name</span>
                    <span>{party.legalName}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Party Type</span>
                  <span>{partyTypeLabels[party.partyType]}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className="capitalize">{party.status}</span>
                </div>

                {party.tags && party.tags.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <span className="text-sm text-gray-500">Tags</span>
                      <div className="flex flex-wrap gap-2">
                        {party.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {party.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {party.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>All transactions for this party</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>All invoices for this party</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No invoices generated yet</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity & Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No notes added yet</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}