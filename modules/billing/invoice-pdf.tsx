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
    fontFamily: 'Helvetica',
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
}

const InvoicePDF: React.FC<{ invoice: InvoiceData }> = ({ invoice }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.companyName}>Business Name</Text>
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
            <Text style={styles.colPrice}>₹ {item.unitPrice.toFixed(2)}</Text>
            <Text style={styles.colAmount}>₹ {item.lineTotal.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text>Subtotal</Text>
          <Text>₹ {invoice.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text>Discount</Text>
          <Text>- ₹ {invoice.discountTotal.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text>Tax</Text>
          <Text>₹ {invoice.taxTotal.toFixed(2)}</Text>
        </View>
        {invoice.additionalCharges && invoice.additionalCharges.length > 0 && (
          <>
            <View style={{ borderTopWidth: 1, borderTopColor: '#eee', marginVertical: 4 }} />
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#666', marginBottom: 2 }}>Additional Charges</Text>
            {invoice.additionalCharges.map((charge, index) => (
              <View key={index} style={[styles.summaryRow, { fontSize: 9 }]}>
                <Text>{charge.name}</Text>
                <Text>₹ {Number(charge.amount).toFixed(2)}</Text>
              </View>
            ))}
          </>
        )}
        <View style={styles.totalRow}>
          <Text>Total</Text>
          <Text>₹ {invoice.grandTotal.toFixed(2)}</Text>
        </View>
      </View>

      {invoice.termsAndConditions && (
        <View style={{ marginTop: 30 }}>
          <Text style={styles.sectionTitle}>Terms & Conditions</Text>
          <Text style={{ fontSize: 10 }}>{invoice.termsAndConditions}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text>Thank you for your business!</Text>
      </View>
    </Page>
  </Document>
);

export default InvoicePDF;