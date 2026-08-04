import { formatDate } from '@/lib/date-utils';
import { roundCurrency } from '@/lib/utils';

export type ShareTemplateKind =
  | 'invoice'
  | 'sale'
  | 'purchase'
  | 'sale-return'
  | 'purchase-return'
  | 'payment-in'
  | 'payment-out'
  | 'adjustment'
  | 'opening-balance';

export type ShareDocumentKind =
  | ShareTemplateKind
  | (string & {});

export interface ShareAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface ShareBusinessProfile {
  legalName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  website?: string | null;
  gstin?: string | null;
  pan?: string | null;
  address?: ShareAddress | null;
  footerText?: string | null;
}

export type ShareMessageTemplates = Partial<Record<ShareTemplateKind, string | null | undefined>>;

export interface SharePartyProfile {
  displayName?: string | null;
  name?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}

export interface ShareLineItem {
  itemName: string;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  sku?: string | null;
  description?: string | null;
}

export interface ShareCharge {
  name: string;
  amount?: number | null;
}

export interface ShareSummary {
  subtotal?: number | null;
  discountTotal?: number | null;
  taxTotal?: number | null;
  roundOff?: number | null;
  grandTotal?: number | null;
  paidAmount?: number | null;
  dueAmount?: number | null;
  totalDiscount?: number | null;
}

export interface SharePaymentDetails {
  method?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface EnterpriseShareMessageOptions {
  kind: ShareDocumentKind;
  business?: ShareBusinessProfile | null;
  template?: string | null;
  templates?: ShareMessageTemplates | null;
  footerText?: string | null;
  referenceNumber?: string | null;
  referenceLabel?: string | null;
  secondaryReferenceNumber?: string | null;
  secondaryReferenceLabel?: string | null;
  documentDate?: Date | string | number | null;
  dueDate?: Date | string | number | null;
  documentStatus?: string | null;
  paymentStatus?: string | null;
  party?: SharePartyProfile | null;
  partyLabel?: string | null;
  lineItems?: ShareLineItem[];
  additionalCharges?: ShareCharge[];
  summary?: ShareSummary | null;
  payment?: SharePaymentDetails | null;
  notes?: string | null;
  termsAndConditions?: string | null;
  maxLineItems?: number;
}

export const DEFAULT_SHARE_MESSAGE_TEMPLATES: Record<ShareTemplateKind, string> = {
  invoice: `{{business_block}}

*{{document_title}}*
{{intro}}

Invoice No.: {{reference_no}}
Transaction No.: {{secondary_reference_no}}
Date: {{document_date}}
Due Date: {{due_date}}
Customer: {{party_name}}
Phone: {{party_phone}}
Email: {{party_email}}
Payment Status: {{payment_status}}

{{line_items}}

{{additional_charges}}

{{summary}}

{{payment_details}}

{{notes}}

{{terms_and_conditions}}

{{footer}}`,
  sale: `{{business_block}}

*{{document_title}}*
{{intro}}

Transaction No.: {{reference_no}}
Invoice No.: {{secondary_reference_no}}
Date: {{document_date}}
Customer: {{party_name}}
Phone: {{party_phone}}
Email: {{party_email}}
Payment Status: {{payment_status}}

{{line_items}}

{{additional_charges}}

{{summary}}

{{payment_details}}

{{notes}}

{{footer}}`,
  purchase: `{{business_block}}

*{{document_title}}*
{{intro}}

Transaction No.: {{reference_no}}
Date: {{document_date}}
Supplier: {{party_name}}
Phone: {{party_phone}}
Email: {{party_email}}
Status: {{document_status}}

{{line_items}}

{{additional_charges}}

{{summary}}

{{payment_details}}

{{notes}}

{{footer}}`,
  'sale-return': `{{business_block}}

*{{document_title}}*
{{intro}}

Return Ref.: {{reference_no}}
Date: {{document_date}}
Customer: {{party_name}}
Payment Status: {{payment_status}}

{{line_items}}

{{summary}}

{{notes}}

{{footer}}`,
  'purchase-return': `{{business_block}}

*{{document_title}}*
{{intro}}

Return Ref.: {{reference_no}}
Date: {{document_date}}
Supplier: {{party_name}}
Status: {{document_status}}

{{line_items}}

{{summary}}

{{notes}}

{{footer}}`,
  'payment-in': `{{business_block}}

*{{document_title}}*
{{intro}}

Payment Ref.: {{reference_no}}
Date: {{document_date}}
Received From: {{party_name}}
Phone: {{party_phone}}
Email: {{party_email}}
Payment Status: {{payment_status}}

{{summary}}

{{payment_details}}

{{notes}}

{{footer}}`,
  'payment-out': `{{business_block}}

*{{document_title}}*
{{intro}}

Payment Ref.: {{reference_no}}
Date: {{document_date}}
Paid To: {{party_name}}
Phone: {{party_phone}}
Email: {{party_email}}
Payment Status: {{payment_status}}

{{summary}}

{{payment_details}}

{{notes}}

{{footer}}`,
  adjustment: `{{business_block}}

*{{document_title}}*
{{intro}}

Entry Ref.: {{reference_no}}
Date: {{document_date}}
Party: {{party_name}}
Status: {{document_status}}

{{summary}}

{{notes}}

{{footer}}`,
  'opening-balance': `{{business_block}}

*{{document_title}}*
{{intro}}

Entry Ref.: {{reference_no}}
Date: {{document_date}}
Party: {{party_name}}

{{summary}}

{{notes}}

{{footer}}`,
};

const KIND_META: Record<string, {
  title: string;
  intro: string;
  partyLabel: string;
  referenceLabel: string;
  secondaryReferenceLabel?: string;
}> = {
  invoice: {
    title: 'INVOICE',
    intro: 'Professional invoice summary generated from Sharda Masale.',
    partyLabel: 'Customer',
    referenceLabel: 'Invoice No.',
    secondaryReferenceLabel: 'Transaction No.',
  },
  sale: {
    title: 'SALES TRANSACTION',
    intro: 'Sales entry recorded successfully.',
    partyLabel: 'Customer',
    referenceLabel: 'Transaction No.',
    secondaryReferenceLabel: 'Invoice No.',
  },
  purchase: {
    title: 'PURCHASE TRANSACTION',
    intro: 'Purchase entry recorded successfully.',
    partyLabel: 'Supplier',
    referenceLabel: 'Transaction No.',
  },
  'sale-return': {
    title: 'SALES RETURN',
    intro: 'Sales return recorded successfully.',
    partyLabel: 'Customer',
    referenceLabel: 'Return Ref.',
  },
  'purchase-return': {
    title: 'PURCHASE RETURN',
    intro: 'Purchase return recorded successfully.',
    partyLabel: 'Supplier',
    referenceLabel: 'Return Ref.',
  },
  'payment-in': {
    title: 'PAYMENT RECEIPT',
    intro: 'Incoming payment has been recorded and applied.',
    partyLabel: 'Received From',
    referenceLabel: 'Payment Ref.',
  },
  'payment-out': {
    title: 'PAYMENT DISBURSEMENT',
    intro: 'Outgoing payment has been recorded successfully.',
    partyLabel: 'Paid To',
    referenceLabel: 'Payment Ref.',
  },
  adjustment: {
    title: 'ADJUSTMENT ENTRY',
    intro: 'Ledger or inventory adjustment recorded successfully.',
    partyLabel: 'Party',
    referenceLabel: 'Entry Ref.',
  },
  'opening-balance': {
    title: 'OPENING BALANCE ENTRY',
    intro: 'Opening balance captured in the ledger.',
    partyLabel: 'Party',
    referenceLabel: 'Entry Ref.',
  },
};

function compact(parts: Array<string | null | undefined>): string[] {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
}

function capitalizeWords(value: string): string {
  return value
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatMoney(value: number | null | undefined): string {
  return `₹${roundCurrency(Number(value || 0)).toFixed(2)}`;
}

function formatMaybeDate(value: Date | string | number | null | undefined): string {
  return value ? formatDate(value) : '-';
}

function renderTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key: string) => context[key] ?? '');
}

function normalizeRenderedMessage(value: string): string {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function resolveBusinessName(business?: ShareBusinessProfile | null): string {
  return business?.displayName?.trim()
    || business?.legalName?.trim()
    || 'Sharda Masale Shop Management System';
}

function formatBusinessAddress(address?: ShareAddress | null): string[] {
  if (!address) return [];

  const lines = compact([
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(', ') || null,
    compact([address.postalCode, address.country]).join(', ') || null,
  ]);

  return lines;
}

function formatBusinessAddressInline(address?: ShareAddress | null): string {
  return formatBusinessAddress(address).join(', ');
}

function resolvePartyName(party?: SharePartyProfile | null): string {
  return party?.displayName?.trim()
    || party?.name?.trim()
    || 'Guest Customer';
}

function formatLineItems(lineItems: ShareLineItem[] | undefined, maxItems: number): string | null {
  if (!lineItems || lineItems.length === 0) return null;

  const visibleItems = lineItems.slice(0, maxItems);
  const lines = visibleItems.map((item, index) => {
    const qty = item.quantity !== undefined && item.quantity !== null
      ? `${roundCurrency(Number(item.quantity)).toFixed(2)} ${item.unit || ''}`.trim()
      : '-';
    const rate = item.unitPrice !== undefined && item.unitPrice !== null ? formatMoney(item.unitPrice) : '-';
    const total = item.lineTotal !== undefined && item.lineTotal !== null ? formatMoney(item.lineTotal) : '-';
    return `${index + 1}. ${item.itemName} | Qty: ${qty} | Rate: ${rate} | Total: ${total}`;
  });

  if (lineItems.length > maxItems) {
    lines.push(`... and ${lineItems.length - maxItems} more item(s)`);
  }

  return ['Items', ...lines].join('\n');
}

function formatCharges(additionalCharges: ShareCharge[] | undefined): string | null {
  if (!additionalCharges || additionalCharges.length === 0) return null;

  const lines = additionalCharges.map((charge) => `- ${charge.name}: ${formatMoney(charge.amount)}`);
  return ['Additional Charges', ...lines].join('\n');
}

function formatSummary(summary: ShareSummary | null | undefined): string | null {
  if (!summary) return null;

  const lines = compact([
    summary.subtotal !== undefined && summary.subtotal !== null ? `Subtotal: ${formatMoney(summary.subtotal)}` : null,
    summary.discountTotal !== undefined && summary.discountTotal !== null && summary.discountTotal > 0 ? `Discount: -${formatMoney(summary.discountTotal)}` : null,
    summary.totalDiscount !== undefined && summary.totalDiscount !== null && summary.totalDiscount > 0 ? `Total Discount: -${formatMoney(summary.totalDiscount)}` : null,
    summary.taxTotal !== undefined && summary.taxTotal !== null ? `Tax: ${formatMoney(summary.taxTotal)}` : null,
    summary.roundOff !== undefined && summary.roundOff !== null && summary.roundOff !== 0 ? `Round Off: ${formatMoney(summary.roundOff)}` : null,
    summary.grandTotal !== undefined && summary.grandTotal !== null ? `Grand Total: ${formatMoney(summary.grandTotal)}` : null,
    summary.paidAmount !== undefined && summary.paidAmount !== null ? `Paid: ${formatMoney(summary.paidAmount)}` : null,
    summary.dueAmount !== undefined && summary.dueAmount !== null ? `Due: ${formatMoney(summary.dueAmount)}` : null,
  ]);

  if (lines.length === 0) return null;
  return ['Financial Summary', ...lines].join('\n');
}

function formatPayment(payment: SharePaymentDetails | null | undefined): string | null {
  if (!payment) return null;

  const lines = compact([
    payment.method ? `Method: ${capitalizeWords(payment.method)}` : null,
    payment.referenceNumber ? `Reference: ${payment.referenceNumber}` : null,
    payment.notes ? `Notes: ${payment.notes}` : null,
  ]);

  if (lines.length === 0) return null;
  return ['Payment Details', ...lines].join('\n');
}

function formatPartySection(party?: SharePartyProfile | null, label?: string | null): string | null {
  if (!party) return null;

  const lines = compact([
    `Name: ${resolvePartyName(party)}`,
    label ? `Role: ${label}` : null,
    party.phoneNumber || party.phone ? `Phone: ${party.phoneNumber || party.phone}` : null,
    party.email ? `Email: ${party.email}` : null,
  ]);

  if (lines.length === 0) return null;
  return ['Party Details', ...lines].join('\n');
}

function formatBusinessBlock(business?: ShareBusinessProfile | null): string[] {
  const businessName = resolveBusinessName(business);
  const lines = [businessName];

  const details = compact([
    business?.gstin ? `GSTIN: ${business.gstin}` : null,
    business?.pan ? `PAN: ${business.pan}` : null,
    business?.phoneNumber ? `Phone: ${business.phoneNumber}` : null,
    business?.email ? `Email: ${business.email}` : null,
    business?.website ? `Website: ${business.website}` : null,
    ...formatBusinessAddress(business?.address),
  ]);

  if (details.length > 0) {
    lines.push(...details);
  }

  return lines;
}

function getKindMeta(kind: ShareDocumentKind) {
  return KIND_META[kind] || {
    title: 'TRANSACTION RECORD',
    intro: 'Transaction recorded successfully.',
    partyLabel: 'Party',
    referenceLabel: 'Reference No.',
  };
}

function buildShareContext(options: EnterpriseShareMessageOptions) {
  const businessName = resolveBusinessName(options.business);
  const businessAddress = formatBusinessAddressInline(options.business?.address);
  const businessBlock = formatBusinessBlock(options.business).join('\n');
  const referenceLabel = options.referenceLabel || getKindMeta(options.kind).referenceLabel;
  const secondaryReferenceLabel = options.secondaryReferenceLabel || getKindMeta(options.kind).secondaryReferenceLabel || 'Related Ref.';
  const partyLabel = options.partyLabel || getKindMeta(options.kind).partyLabel;
  const summary = formatSummary(options.summary);
  const paymentDetails = formatPayment(options.payment);
  const lineItems = formatLineItems(options.lineItems, options.maxLineItems ?? 4);
  const additionalCharges = formatCharges(options.additionalCharges);
  const footerText = options.footerText?.trim() || options.business?.footerText?.trim() || '';
  const footer = footerText || `This message was generated by ${businessName}.`;

  return {
    business_block: businessBlock,
    business_name: businessName,
    business_legal_name: options.business?.legalName?.trim() || '',
    business_display_name: options.business?.displayName?.trim() || '',
    business_email: options.business?.email?.trim() || '',
    business_phone: options.business?.phoneNumber?.trim() || '',
    business_website: options.business?.website?.trim() || '',
    business_gstin: options.business?.gstin?.trim() || '',
    business_pan: options.business?.pan?.trim() || '',
    business_address: businessAddress,
    document_title: getKindMeta(options.kind).title,
    intro: getKindMeta(options.kind).intro,
    kind: options.kind,
    reference_label: referenceLabel,
    reference_no: options.referenceNumber?.trim() || '',
    secondary_reference_label: secondaryReferenceLabel,
    secondary_reference_no: options.secondaryReferenceNumber?.trim() || '',
    document_date: formatMaybeDate(options.documentDate),
    due_date: formatMaybeDate(options.dueDate),
    document_status: options.documentStatus?.trim() ? capitalizeWords(options.documentStatus.trim()) : '',
    payment_status: options.paymentStatus?.trim() ? capitalizeWords(options.paymentStatus.trim()) : '',
    party_label: partyLabel,
    party_name: resolvePartyName(options.party),
    party_phone: options.party?.phoneNumber?.trim() || options.party?.phone?.trim() || '',
    party_email: options.party?.email?.trim() || '',
    line_items: lineItems || '',
    additional_charges: additionalCharges || '',
    summary: summary || '',
    payment_details: paymentDetails || '',
    notes: options.notes?.trim() || '',
    terms_and_conditions: options.termsAndConditions?.trim() || '',
    footer,
    thank_you: 'Thank you for your business.',
  };
}

export function buildEnterpriseShareMessage(options: EnterpriseShareMessageOptions): string {
  const kind = (options.kind in DEFAULT_SHARE_MESSAGE_TEMPLATES
    ? options.kind
    : 'invoice') as ShareTemplateKind;
  const template = options.template
    || options.templates?.[kind]
    || DEFAULT_SHARE_MESSAGE_TEMPLATES[kind];
  const context = buildShareContext(options);
  return normalizeRenderedMessage(renderTemplate(template, context));
}
