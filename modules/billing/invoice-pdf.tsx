import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Times-Roman',
  },
  watermark: {
    position: 'absolute',
    top: '25%',
    left: '20%',
    width: '60%',
    height: '50%',
    opacity: 0.1,
  },
  watermarkImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  pageContent: {
    position: 'relative',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  companyDetail: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  invoiceMeta: {
    marginTop: 10,
    fontSize: 10,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 4,
  },
  customerInfo: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  table: {
    width: '100%',
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#f9fafb',
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
    fontSize: 10,
  },
  colItem: {
    width: '40%',
  },
  colQty: {
    width: '10%',
    textAlign: 'center',
  },
  colPrice: {
    width: '15%',
    textAlign: 'right',
  },
  colAmount: {
    width: '20%',
    textAlign: 'right',
  },
  summary: {
    marginTop: 30,
    marginLeft: 'auto',
    width: '35%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    fontSize: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: 'bold',
    borderTopWidth: 2,
    borderTopColor: '#000',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
  },
});

interface InvoiceLineItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
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
  phoneNumber?: string;
  email?: string;
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
  grandTotal: number;
  notes?: string;
  termsAndConditions?: string;
  business?: BusinessInfo;
  logoDataUri?: string;
}

const InvoicePDF: React.FC<{ invoice: InvoiceData }> = ({ invoice }) => {
  const businessName = invoice.business?.displayName || invoice.business?.legalName || 'Business Name';
  const businessAddress = invoice.business?.address || '';
  const currency = 'Rs.';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark Logo */}
        {invoice.logoDataUri && (
          <View style={styles.watermark} fixed>
            <Image
              style={styles.watermarkImage}
              src={invoice.logoDataUri}
            />
          </View>
        )}
        <View style={styles.pageContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.companyName}>{businessName}</Text>
              {businessAddress && <Text style={styles.companyDetail}>{businessAddress}</Text>}
              {invoice.business?.gstin && <Text style={styles.companyDetail}>GSTIN: {invoice.business.gstin}</Text>}
              {invoice.business?.phoneNumber && <Text style={styles.companyDetail}>Phone: {invoice.business.phoneNumber}</Text>}
              {invoice.business?.email && <Text style={styles.companyDetail}>Email: {invoice.business.email}</Text>}
            </View>
            <View style={{ textAlign: 'right' }}>
              <Text style={styles.invoiceTitle}>INVOICE</Text>
              <View style={styles.invoiceMeta}>
                <Text>Invoice #: {invoice.invoiceNumber}</Text>
                <Text>Date: {invoice.invoiceDate}</Text>
                <Text>Due Date: {invoice.dueDate}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <View style={styles.customerInfo}>
              <Text style={{ fontWeight: 'bold' }}>{invoice.customer.name}</Text>
              {invoice.customer.phone && <Text>{invoice.customer.phone}</Text>}
              {invoice.customer.email && <Text>{invoice.customer.email}</Text>}
              {invoice.customer.address && <Text>{invoice.customer.address}</Text>}
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colItem}>Item</Text>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colPrice}>Price</Text>
              <Text style={styles.colAmount}>Amount</Text>
            </View>

            {invoice.lineItems.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.colItem}>{item.itemName}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colPrice}>{currency} {item.unitPrice.toFixed(2)}</Text>
                <Text style={styles.colAmount}>{currency} {item.lineTotal.toFixed(2)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text>Subtotal</Text>
              <Text>{currency} {invoice.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>Discount</Text>
              <Text>- {currency} {invoice.discountTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>Tax</Text>
              <Text>{currency} {invoice.taxTotal.toFixed(2)}</Text>
            </View>
            {invoice.additionalCharges && invoice.additionalCharges.length > 0 && (
              <>
                <View style={{ borderTopWidth: 1, borderTopColor: '#eee', marginVertical: 4 }} />
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#666', marginBottom: 2 }}>Additional Charges</Text>
                {invoice.additionalCharges.map((charge, index) => (
                  <View key={index} style={[styles.summaryRow, { fontSize: 9 }]}>
                    <Text>{charge.name}</Text>
                    <Text>{currency} {Number(charge.amount).toFixed(2)}</Text>
                  </View>
                ))}
              </>
            )}
            <View style={styles.totalRow}>
              <Text>Total</Text>
              <Text>{currency} {invoice.grandTotal.toFixed(2)}</Text>
            </View>
          </View>

          {invoice.termsAndConditions && (
            <View style={{ marginTop: 30 }}>
              <Text style={styles.sectionTitle}>Terms & Conditions</Text>
              <Text style={{ fontSize: 10 }}>{invoice.termsAndConditions}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
        </View>
      </Page>
    </Document>
  );
};

export default InvoicePDF;