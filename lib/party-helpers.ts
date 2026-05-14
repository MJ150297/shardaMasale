export interface PartyLike {
  _id?: string | { toString(): string };
  id?: string | null;
  displayName?: string | null;
  name?: string | null;
  fullName?: string | null;
  partyName?: string | null;
  phoneNumber?: string | null;
  alternatePhoneNumber?: string | null;
  mobile?: string | null;
  phone?: string | null;
  contactPerson?: {
    name?: string | null;
    phoneNumber?: string | null;
  } | null;
}

export function getPartyId(party?: PartyLike | string | null): string | null {
  if (!party) {
    return null;
  }

  if (typeof party === 'string') {
    return party;
  }

  const partyId = party._id ?? party.id;

  if (!partyId) {
    return null;
  }

  return typeof partyId === 'string' ? partyId : partyId.toString();
}

export function getPartyName(
  party?: PartyLike | string | null,
  fallback = '-',
): string {
  if (!party || typeof party === 'string') {
    return fallback;
  }

  return (
    party.displayName ||
    party.name ||
    party.fullName ||
    party.partyName ||
    party.contactPerson?.name ||
    fallback
  );
}

export function getPartyPhone(party?: PartyLike | string | null): string | null {
  if (!party || typeof party === 'string') {
    return null;
  }

  return (
    party.phoneNumber ||
    party.alternatePhoneNumber ||
    party.mobile ||
    party.phone ||
    party.contactPerson?.phoneNumber ||
    null
  );
}
