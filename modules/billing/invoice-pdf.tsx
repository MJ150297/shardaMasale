import React from 'react';
import path from 'path';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';

Font.register({
  family: 'DejaVuSans',
  fonts: [
    { src: path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf') },
    { src: path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Bold.ttf'), fontWeight: 'bold' },
    { src: path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Italic.ttf'), fontStyle: 'italic' },
    { src: path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans-BoldItalic.ttf'), fontWeight: 'bold', fontStyle: 'italic' },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: '15mm',
    fontFamily: 'DejaVuSans',
    fontSize: 10,
  },
  watermark: {
    position: 'absolute',
    top: '20%',
    left: '22%',
    width: '56%',
    height: '60%',
    opacity: 0.3,
  },
  watermarkImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  pageContent: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    flexDirection: 'column',
  },
  // Center Logo
  centerLogo: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLogoImage: {
    width: 100,
    height: 100,
    objectFit: 'contain',
  },
  // Tax Invoice Tag
  taxInvoiceTag: {
    textAlign: 'center',
    marginBottom: 4,
  },
  taxInvoiceTagText: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: '#999',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  // Vendor Meta Split Grid
  vendorGrid: {
    display: 'flex',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#999',
    marginBottom: 5,
  },
  vendorLeft: {
    flex: 1,
    padding: 8,
  },
  vendorRight: {
    width: '40%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  companyDetail: {
    fontSize: 9,
    color: '#666',
    marginBottom: 1,
    lineHeight: 1.3,
  },
  metaLabel: {
    fontSize: 8,
    color: '#888',
    marginBottom: 1,
  },
  metaValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Bill To
  billTo: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 4,
    marginBottom: 10,
    fontSize: 10,
  },
  // Items Table
  itemsTable: {
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 10,
    minHeight: '123mm',
  },
  itemsTableBody: {
    flexGrow: 1,
  },
  itemsTableSummary: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    fontSize: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRowSummary: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRowTotal: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#1f2937',
    fontWeight: 'bold',
    fontSize: 10,
  },
  colNo: { width: '6%', textAlign: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  colItem: { flexGrow: 1, flexBasis: 0, paddingVertical: 4, paddingHorizontal: 2 },
  colHsn: { width: '12%', textAlign: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  colQty: { width: '9%', textAlign: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  colPrice: { width: '15%', textAlign: 'right', paddingVertical: 4, paddingHorizontal: 2 },
  colDisc: { width: '11%', textAlign: 'right', paddingVertical: 4, paddingHorizontal: 2 },
  colAmount: { width: '15%', textAlign: 'right', paddingVertical: 4, paddingHorizontal: 2 },
  // Tax Breakup
  taxGrid: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 10,
    width: '100%',
  },
  taxHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    fontSize: 8,
    fontWeight: 'bold',
  },
  taxRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    fontSize: 8,
  },
  taxColHsn: { width: '16.67%', padding: 3, textAlign: 'center' },
  taxColVal: { width: '18.75%', padding: 3, textAlign: 'right' },
  taxColRate: { width: '11.46%', padding: 3, textAlign: 'right' },
  taxColAmt: { width: '13.54%', padding: 3, textAlign: 'right' },
  taxColTotal: { width: '14.58%', padding: 3, textAlign: 'right' },
  // Footer
  footerGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 8,
    marginBottom: 16,
  },
  footerLeft: {
    flex: 2,
    paddingRight: 12,
  },
  footerRight: {
    flex: 3,
    paddingLeft: 12,
  },
  footerTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  footerText: {
    fontSize: 9,
    color: '#444',
    lineHeight: 1.4,
  },
  // Signature
  signatureGrid: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    fontSize: 9,
  },
  signatureLeft: {
    flex: 1,
  },
  signatureRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  signatureLine: {
    width: 120,
    borderTopWidth: 1,
    borderTopColor: '#999',
    marginTop: 20,
    marginBottom: 4,
  },
  websiteFooter: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    textAlign: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  websiteFooterText: {
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
  },
});

function formatPaymentMethod(method: string): string {
  if (!method) return '';
  if (method.toLowerCase() === 'upi') return 'UPI';
  return method.replace(/\b\w/g, c => c.toUpperCase());
}

// Helper to format currency
const fmt = (val: number | undefined | null) =>
  `₹${(val || 0).toFixed(2)}`;

// Tax Breakup computation
function computeTaxBreakup(lineItems: InvoiceLineItem[]): TaxBreakupRow[] {
  const grouped: Record<string, TaxBreakupRow> = {};

  for (const item of lineItems) {
    const hsn = item.hsnCode || (item.itemHsn || 'N/A');
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const discount = Number(item.discountAmount) || 0;
    const taxRate = Number(item.taxRate) || 0;
    const taxableValue = (qty * unitPrice) - discount;

    if (taxRate === 0) continue;

    if (!grouped[hsn]) {
      grouped[hsn] = {
        hsn,
        taxableValue: 0,
        cgstRate: taxRate / 2,
        cgstAmount: 0,
        sgstRate: taxRate / 2,
        sgstAmount: 0,
        totalTax: 0,
      };
    }

    grouped[hsn].taxableValue += taxableValue;
    const cgst = Math.round(taxableValue * (taxRate / 2) / 100 * 100) / 100;
    const sgst = Math.round(taxableValue * (taxRate / 2) / 100 * 100) / 100;
    grouped[hsn].cgstAmount += cgst;
    grouped[hsn].sgstAmount += sgst;
    grouped[hsn].totalTax += cgst + sgst;
  }

  return Object.values(grouped);
}

// Number to words - simple version for PDF
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertBelow1000 = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    return ones[hundreds] + ' Hundred' + (remainder !== 0 ? ' ' + convertBelow1000(remainder) : '');
  };

  const whole = Math.floor(num);
  const fraction = Math.round((num - whole) * 100);

  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const remaining = whole % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(convertBelow1000(crore) + ' Crore');
  if (lakh > 0) parts.push(convertBelow1000(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertBelow1000(thousand) + ' Thousand');
  if (remaining > 0) parts.push(convertBelow1000(remaining));

  let result = parts.join(' ');
  if (fraction > 0) {
    result += ' and ' + convertBelow1000(fraction) + ' Paise';
  }
  return result + ' Only';
}

interface InvoiceLineItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  lineTotal: number;
  hsnCode?: string;
  itemHsn?: string;
  description?: string;
  taxRate?: number;
  subItems?: InvoiceLineItem[];
}

interface TaxBreakupRow {
  hsn: string;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  totalTax: number;
}

interface AdditionalCharge {
  name: string;
  amount: number;
}

interface BusinessInfo {
  displayName?: string;
  legalName?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  lineItems: InvoiceLineItem[];
  additionalCharges?: AdditionalCharge[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  roundOff?: number;
  totalDiscount?: number;
  totalDiscountType?: string | null;
  totalDiscountValue?: number | null;
  grandTotal: number;
  paidAmount?: number;
  dueAmount?: number;
  payment?: {
    method?: string;
    referenceNumber?: string;
    notes?: string;
  };
  termsAndConditions?: string;
  footerText?: string | null;
  business?: BusinessInfo;
  logoDataUri?: string;
  authorisedSignature?: string | null;
  amountInWords?: string;
}

const InvoicePDF: React.FC<{ invoice: InvoiceData }> = ({ invoice }) => {
  const businessName = invoice.business?.displayName || invoice.business?.legalName || 'Business Name';
  const businessAddress = invoice.business?.address || '';

  const lineItems = invoice.lineItems || [];
  const additionalCharges = invoice.additionalCharges || [];
  const totalDiscount = invoice.totalDiscount || 0;
  const totalDiscountType = invoice.totalDiscountType;
  const totalDiscountValue = invoice.totalDiscountValue;
  const roundOff = invoice.roundOff || 0;
  const grandTotal = invoice.grandTotal;
  const paidAmount = invoice.paidAmount || 0;
  const dueAmount = invoice.dueAmount || 0;
  const amountInWords = invoice.amountInWords || numberToWords(grandTotal);

  const taxBreakup = computeTaxBreakup(lineItems);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Watermark Logo */}
        {invoice.logoDataUri && (
          <View style={styles.watermark} fixed>
            <Image style={styles.watermarkImage} src={invoice.logoDataUri} />
          </View>
        )}

        <View style={styles.pageContent}>
          {/* Tax Invoice Tag */}
          <View style={styles.taxInvoiceTag}>
            <Text style={styles.taxInvoiceTagText}>TAX INVOICE | ORIGINAL FOR RECIPIENT</Text>
          </View>

          {/* Vendor & Invoice Meta Split Grid */}
          <View style={styles.vendorGrid}>
            <View style={styles.vendorLeft}>
              <Text style={styles.companyName}>{businessName}</Text>
              <Text style={styles.companyDetail}>{businessAddress}</Text>
              {invoice.business?.phoneNumber && (
                <Text style={styles.companyDetail}>Mobile: {invoice.business.phoneNumber}</Text>
              )}
              {invoice.business?.pan && (
                <Text style={styles.companyDetail}>PAN: {invoice.business.pan}</Text>
              )}
              {invoice.business?.gstin && (
                <Text style={styles.companyDetail}>GSTIN: {invoice.business.gstin}</Text>
              )}
              {invoice.business?.email && (
                <Text style={styles.companyDetail}>Email: {invoice.business.email}</Text>
              )}
            </View>
            {/* Center Header Logo */}
            {invoice.logoDataUri && (
              <View style={styles.centerLogo}>
                <Image style={styles.centerLogoImage} src={invoice.logoDataUri} />
              </View>
            )}
            <View style={styles.vendorRight}>
              <Text style={styles.metaLabel}>Invoice No.</Text>
              <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
              <Text style={styles.metaLabel}>Invoice Date</Text>
              <Text style={styles.metaValue}>{invoice.invoiceDate}</Text>
            </View>
          </View>

          {/* Bill To */}
          <View style={styles.billTo}>
            <Text>
              <Text style={{ fontWeight: 'bold' }}>Bill To: </Text>
              {invoice.customer.name}
              {invoice.customer.phone ? ` - ${invoice.customer.phone}` : ''}
              {invoice.customer.address ? `\n${invoice.customer.address}` : ''}
            </Text>
          </View>

          {/* Items Table */}
          <View style={styles.itemsTable} wrap>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colNo}>#</Text>
              <Text style={styles.colItem}>Items</Text>
              <Text style={styles.colHsn}>HSN</Text>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colPrice}>PRICE/ITEM (₹)</Text>
              <Text style={styles.colDisc}>Disc</Text>
              <Text style={styles.colAmount}>Total</Text>
            </View>

            <View style={styles.itemsTableBody}>
              {/* Item Rows */}
              {lineItems.map((item, index) => (
                <React.Fragment key={index}>
                  <View style={styles.tableRow} wrap={false}>
                    <Text style={styles.colNo}>{index + 1}</Text>
                    <View style={styles.colItem}>
                      <Text>{item.itemName}</Text>
                      {item.description && (
                        <Text style={{ fontSize: 7, color: '#888', marginTop: 1 }}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.colHsn, { fontSize: 8 }]}>
                      {item.hsnCode || item.itemHsn || '-'}
                    </Text>
                    <Text style={styles.colQty}>{Number(item.quantity).toFixed(2)}</Text>
                    <Text style={styles.colPrice}>{fmt(item.unitPrice)}</Text>
                    <Text style={styles.colDisc}>
                      {(item.discountAmount || 0) > 0 ? fmt(item.discountAmount) : '-'}
                    </Text>
                    <Text style={styles.colAmount}>{fmt(item.lineTotal)}</Text>
                  </View>
                  {/* Sub-items for compound items — name only */}
                  {item.subItems && item.subItems.length > 0 && item.subItems.map((subItem, subIndex) => (
                    <View key={`sub-${subIndex}`} style={[styles.tableRow, { backgroundColor: '#f9fafb' }]} wrap={false}>
                      <Text style={styles.colNo}></Text>
                      <View style={styles.colItem}>
                        <Text style={{ fontSize: 8, color: '#666', paddingLeft: 8 }}>
                          └ {subItem.itemName}
                        </Text>
                      </View>
                      <Text style={styles.colHsn}></Text>
                      <Text style={styles.colQty}></Text>
                      <Text style={styles.colPrice}></Text>
                      <Text style={styles.colDisc}></Text>
                      <Text style={styles.colAmount}></Text>
                    </View>
                  ))}
                </React.Fragment>
              ))}
            </View>

            <View style={styles.itemsTableSummary}>
              {/* Additional Charges rows */}
              {additionalCharges.map((charge, index) => (
                <View key={`ac-${index}`} style={styles.tableRowSummary} wrap={false}>
                  <Text style={styles.colNo}></Text>
                  <Text style={[styles.colItem, { fontStyle: 'italic', color: '#666' }]}>
                    {charge.name}
                  </Text>
                  <Text style={styles.colHsn}></Text>
                  <Text style={styles.colQty}></Text>
                  <Text style={styles.colPrice}></Text>
                  <Text style={styles.colDisc}></Text>
                  <Text style={styles.colAmount}>{fmt(Number(charge.amount))}</Text>
                </View>
              ))}

              {/* Total Discount Row */}
              {totalDiscount > 0 && (
                <View style={styles.tableRowSummary} wrap={false}>
                  <Text style={styles.colNo}></Text>
                  <Text style={[styles.colItem, { fontStyle: 'italic', color: '#666' }]}>
                    Discount{totalDiscountType === 'percentage'
                      ? ` (${totalDiscountValue}%)`
                      : totalDiscountType === 'fixed'
                        ? ' (Fixed)'
                        : ''}
                  </Text>
                  <Text style={styles.colHsn}></Text>
                  <Text style={styles.colQty}></Text>
                  <Text style={styles.colPrice}></Text>
                  <Text style={styles.colDisc}></Text>
                  <Text style={[styles.colAmount, { color: '#dc2626' }]}>
                    -{fmt(totalDiscount)}
                  </Text>
                </View>
              )}

              {/* Round Off Row */}
              {roundOff !== 0 && (
                <View style={styles.tableRowSummary} wrap={false}>
                  <Text style={styles.colNo}></Text>
                  <Text style={[styles.colItem, { fontStyle: 'italic', color: '#666' }]}>
                    Round Off
                  </Text>
                  <Text style={styles.colHsn}></Text>
                  <Text style={styles.colQty}></Text>
                  <Text style={styles.colPrice}></Text>
                  <Text style={styles.colDisc}></Text>
                  <Text style={styles.colAmount}>{fmt(roundOff)}</Text>
                </View>
              )}

              {/* Grand Total Bar */}
              <View style={styles.tableRowTotal}>
                <Text style={styles.colNo}></Text>
                <Text style={[styles.colItem, { textTransform: 'uppercase', letterSpacing: 1 }]}>
                  TOTAL
                </Text>
                <Text style={styles.colHsn}></Text>
                <Text style={styles.colQty}></Text>
                <Text style={styles.colPrice}></Text>
                <Text style={styles.colDisc}></Text>
                <Text style={styles.colAmount}>{fmt(grandTotal)}</Text>
              </View>
            </View>
          </View>

          {/* Tax Breakup Grid — only show when there are taxable items */}
          {taxBreakup.length > 0 && (
            <View style={styles.taxGrid} wrap>
              <View style={styles.taxHeader}>
                <Text style={styles.taxColHsn}>HSN/SAC</Text>
                <Text style={styles.taxColVal}>Taxable Value</Text>
                <Text style={styles.taxColRate}>CGST (Rate)</Text>
                <Text style={styles.taxColAmt}>CGST (Amt)</Text>
                <Text style={styles.taxColRate}>SGST (Rate)</Text>
                <Text style={styles.taxColAmt}>SGST (Amt)</Text>
                <Text style={[styles.taxColTotal, { fontWeight: 'bold' }]}>Total Tax</Text>
              </View>
              {taxBreakup.map((row, i) => (
                <View key={i} style={styles.taxRow}>
                  <Text style={styles.taxColHsn}>{row.hsn || 'N/A'}</Text>
                  <Text style={styles.taxColVal}>{fmt(row.taxableValue)}</Text>
                  <Text style={styles.taxColRate}>{row.cgstRate}%</Text>
                  <Text style={styles.taxColAmt}>{fmt(row.cgstAmount)}</Text>
                  <Text style={styles.taxColRate}>{row.sgstRate}%</Text>
                  <Text style={styles.taxColAmt}>{fmt(row.sgstAmount)}</Text>
                  <Text style={[styles.taxColTotal, { fontWeight: 'bold' }]}>{fmt(row.totalTax)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Footer: Amount in Words + Terms */}
          <View style={styles.footerGrid}>
            <View style={styles.footerLeft}>
              <Text style={styles.footerTitle}>Amount in Words</Text>
              <Text style={styles.footerText}>{amountInWords}</Text>
              <View style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: dueAmount > 0 ? 'bold' : 'bold', color: dueAmount > 0 ? '#dc2626' : '#16a34a' }}>
                  Payment Status: {dueAmount > 0 ? 'UNPAID' : 'PAID'}
                </Text>
                {paidAmount > 0 && (
                  <Text style={styles.footerText}>Paid Amount: {fmt(paidAmount)}</Text>
                )}
                {invoice.payment?.method && (
                  <Text style={styles.footerText}>Payment Mode: {formatPaymentMethod(invoice.payment.method)}</Text>
                )}
                {dueAmount > 0 && (
                  <Text style={[styles.footerText, { fontWeight: 'bold', color: '#dc2626' }]}>
                    Due Amount: {fmt(dueAmount)}
                  </Text>
                )}
                {invoice.dueDate && (
                  <Text style={styles.footerText}>Due Date: {invoice.dueDate}</Text>
                )}
              </View>
            </View>
            <View style={styles.footerRight}>
              {invoice.termsAndConditions && (
                <>
                  <Text style={styles.footerTitle}>Terms & Conditions</Text>
                  <Text style={styles.footerText}>{invoice.termsAndConditions}</Text>
                </>
              )}
            </View>
          </View>

          {/* Signature Area */}
          <View style={styles.signatureGrid}>
            <View style={styles.signatureLeft}>
              <Text style={{ color: '#888' }}>Receiver's Signature</Text>
              <View style={[styles.signatureLine, { marginTop: 20 }]} />
            </View>
            <View style={styles.signatureRight}>
              {invoice.authorisedSignature ? (
                <Image
                  src={invoice.authorisedSignature}
                  style={{ width: 100, height: 40, objectFit: 'contain', marginTop: 4 }}
                />
              ) : (
                <View style={[styles.signatureLine, { marginTop: 20 }]}>
                  <Text style={{ color: '#888' }}>For {businessName}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Footer Text — repeats on every page */}
        {invoice.footerText && (
          <View style={styles.websiteFooter} fixed>
            <Text style={styles.websiteFooterText}>{invoice.footerText}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
};

export default InvoicePDF;
