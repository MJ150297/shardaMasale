import { requireUser } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Party from '@/models/Party';
import { notFound } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import PartyClientWrapper from './party-client';
import {
  Mail,
  Phone,
  MapPin,
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

  const partyTypeLabels: Record<string, string> = {
    customer: 'Customer',
    supplier: 'Supplier',
    both: 'Customer & Supplier',
  };

  const serializableParty = JSON.parse(JSON.stringify({
    _id: party._id.toString(),
    displayName: party.displayName,
    legalName: party.legalName,
    email: party.email,
    phoneNumber: party.phoneNumber,
    alternatePhoneNumber: party.alternatePhoneNumber,
    gstin: party.gstin,
    pan: party.pan,
    partyType: party.partyType,
    status: party.status,
    taxTreatment: party.taxTreatment,
    address: party.address,
    billingAddress: party.billingAddress,
    shippingAddress: party.shippingAddress,
    contactPerson: party.contactPerson,
    creditLimit: party.creditLimit,
    currentBalance: party.currentBalance,
    openingBalance: party.openingBalance,
    tags: party.tags,
    notes: party.notes,
    // @ts-ignore - createdAt exists from timestamps
    createdAt: party.createdAt.toISOString(),
  }));

  return (
    <PartyClientWrapper party={serializableParty}>

      {/* KPI Cards */}
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

      {/* Contact Information */}
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

            {party.address && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                  <span>{party.address}</span>
                </div>
              </>
            )}
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

            {/* Contact Person */}
            {party.contactPerson && (
              <>
                <Separator />
                <div className="space-y-2">
                  <span className="text-sm text-gray-500">Contact Person</span>
                  <p className="font-medium">{party.contactPerson.name}</p>
                  {party.contactPerson.designation && (
                    <p className="text-sm text-gray-500">{party.contactPerson.designation}</p>
                  )}
                  {party.contactPerson.phoneNumber && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <span>{party.contactPerson.phoneNumber}</span>
                    </div>
                  )}
                  {party.contactPerson.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-3 h-3 text-gray-400" />
                      <span>{party.contactPerson.email}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Credit Utilization */}
            {party.creditLimit > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Credit Utilization</span>
                  <span className="text-sm font-medium">
                    ₹{party.currentBalance?.toLocaleString() || 0} / ₹{party.creditLimit.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (party.currentBalance || 0) <= 0
                        ? 'bg-green-500'
                        : (party.currentBalance || 0) > party.creditLimit
                        ? 'bg-red-500'
                        : (party.currentBalance || 0) > party.creditLimit * 0.8
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(Math.max((party.currentBalance || 0), 0) / party.creditLimit * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Tags */}
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

      {/* Billing & Shipping Address */}
      {(party.billingAddress || party.shippingAddress) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {party.billingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Billing Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-500 mt-1 shrink-0" />
                  <div>
                    <p>{party.billingAddress.line1}</p>
                    {party.billingAddress.line2 && <p>{party.billingAddress.line2}</p>}
                    {party.billingAddress.landmark && <p className="text-sm text-gray-500">{party.billingAddress.landmark}</p>}
                    <p>{party.billingAddress.city}, {party.billingAddress.state} - {party.billingAddress.postalCode}</p>
                    <p className="text-sm text-gray-500">{party.billingAddress.country}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {party.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-500 mt-1 shrink-0" />
                  <div>
                    <p>{party.shippingAddress.line1}</p>
                    {party.shippingAddress.line2 && <p>{party.shippingAddress.line2}</p>}
                    {party.shippingAddress.landmark && <p className="text-sm text-gray-500">{party.shippingAddress.landmark}</p>}
                    <p>{party.shippingAddress.city}, {party.shippingAddress.state} - {party.shippingAddress.postalCode}</p>
                    <p className="text-sm text-gray-500">{party.shippingAddress.country}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Notes */}
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

    </PartyClientWrapper>
  );
}