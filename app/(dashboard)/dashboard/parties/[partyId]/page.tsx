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
import { formatDate } from '@/lib/date-utils';
import Link from 'next/link';
import PartyClientWrapper from './party-client';
import {
  Mail,
  Phone,
  MapPin,
  StickyNote,
  ChevronRight,
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
    notesList: party.notesList,
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

      {/* Notes Preview */}
      {(party.notes || (party.notesList && party.notesList.length > 0)) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="w-4 h-4" />
              Notes
              {party.notesList && party.notesList.length > 0 && (
                <Badge variant="secondary">{party.notesList.length}</Badge>
              )}
            </CardTitle>
            <Link
              href={`/dashboard/parties/${party._id}?tab=notes`}
              className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {party.notesList && party.notesList.length > 0 ? (
              // Show latest 3 notes from notesList
              [...party.notesList]
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3)
                .map((note: any) => (
                  <div key={note._id.toString()} className="border-l-2 border-gray-200 dark:border-gray-700 pl-3 py-1">
                    <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-2 whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(note.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {note.pinned && ' • 📌 Pinned'}
                    </p>
                  </div>
                ))
            ) : party.notes ? (
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-3">
                {party.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

    </PartyClientWrapper>
  );
}