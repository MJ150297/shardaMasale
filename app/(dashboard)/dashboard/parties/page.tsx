import { requireUser } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Party from '@/models/Party';
import PartiesClient from './parties-client';

export default async function PartiesPage() {
  const user = await requireUser();
  await connectToDatabase();

  const parties = await Party.find({
    owner: user.id,
    isArchived: false,
  })
    .sort({ createdAt: -1 })
    .lean();

  const serializedParties = parties.map(party => ({
    _id: party._id.toString(),
    name: party.displayName,
    email: party.email,
    phoneNumber: party.phoneNumber,
    status: party.status,
    partyType: party.partyType,
  }));

  return <PartiesClient parties={serializedParties} />;
}
