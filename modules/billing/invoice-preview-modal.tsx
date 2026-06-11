'use client';

import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Download, Printer } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import InvoiceShareSheet from '@/components/invoice-share-sheet';
import { useActiveShop } from '@/components/providers/shop-provider';
import { numberToWords } from '@/lib/utils';

interface InvoicePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  onDownload: () => void;
  onPrint: () => void;
}

interface BusinessSettings {
  displayName?: string;
  legalName?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  gstin?: string;
  pan?: string;
  logo?: string | null;
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
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

function formatPaymentMethod(method: string): string {
  if (!method) return '';
  if (method.toLowerCase() === 'upi') return 'UPI';
  return method.replace(/\b\w/g, c => c.toUpperCase());
}

function computeTaxBreakup(lineItems: any[]): TaxBreakupRow[] {
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

export default function InvoicePreviewModal({
  open,
  onOpenChange,
  invoice,
  onDownload,
  onPrint
}: InvoicePreviewModalProps) {
  const { activeShopId } = useActiveShop();
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [billingTerms, setBillingTerms] = useState<string | null>(null);
  const [footerText, setFooterText] = useState<string | null>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const fetchSettings = async () => {
      try {
        setBillingTerms(null);
        setFooterText(null);
        setLogoDataUri(null);
        const queryParam = activeShopId ? `?shopId=${activeShopId}` : '';
        const res = await fetch(`/api/settings${queryParam}`);
        if (res.ok) {
          const settings = await res.json();
          setBusiness(settings.business);
          setBillingTerms(settings?.billing?.termsAndConditions ?? null);
          setFooterText(settings?.billing?.footerText ?? null);
          setLogoDataUri(settings?.business?.logo ?? null);
        }
      } catch (error) {
        console.error('Failed to fetch business settings:', error);
      }
    };
    fetchSettings();
  }, [open, activeShopId]);

  const businessName = business?.displayName || business?.legalName || 'BUSINESS NAME';
  const businessAddress = business?.address
    ? [business.address.line1, business.address.city, business.address.state]
      .filter(Boolean)
      .join(', ')
    : 'Business Address';

  const lineItems = invoice?.transactionId?.lineItems || invoice?.lineItems || [];
  const additionalCharges = invoice?.transactionId?.additionalCharges || invoice?.additionalCharges || [];
  const subtotal = invoice?.transactionId?.summary?.subtotal || invoice?.summary?.subtotal || 0;
  const discountTotal = invoice?.transactionId?.summary?.discountTotal || invoice?.summary?.discountTotal || 0;
  const taxTotal = invoice?.transactionId?.summary?.taxTotal || invoice?.summary?.taxTotal || 0;
  const totalDiscount = invoice?.transactionId?.summary?.totalDiscount || invoice?.summary?.totalDiscount || 0;
  const totalDiscountType = invoice?.transactionId?.summary?.totalDiscountType || invoice?.summary?.totalDiscountType;
  const totalDiscountValue = invoice?.transactionId?.summary?.totalDiscountValue || invoice?.summary?.totalDiscountValue;
  const roundOff = invoice?.transactionId?.summary?.roundOff || invoice?.summary?.roundOff || 0;
  const grandTotal = invoice?.transactionId?.summary?.grandTotal || invoice?.summary?.grandTotal || 0;
  const paidAmount = invoice?.transactionId?.summary?.paidAmount || invoice?.summary?.paidAmount || 0;
  const dueAmount = invoice?.transactionId?.summary?.dueAmount || invoice?.summary?.dueAmount || 0;
  const transactionDate = invoice?.transactionId?.transactionDate || invoice?.transactionDate;
  const paymentMethod = invoice?.transactionId?.payment?.method || invoice?.payment?.method || '';
  const notes = invoice?.notes?.trim() || '';

  const additionalChargesTotal = additionalCharges.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);

  const taxBreakup = useMemo(() => computeTaxBreakup(lineItems), [lineItems]);
  const resolvedTermsAndConditions = invoice?.termsAndConditions || billingTerms || '';

  // Format amount helper
  const fmt = (val: number | undefined | null) =>
    `₹${(val || 0).toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none! w-[95vw] sm:w-[90vw] max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="p-3 sm:p-4 border-b flex flex-row items-center justify-between shrink-0 pr-12 sm:pr-14">
          <DialogTitle className="text-sm sm:text-base truncate pr-2">Invoice: {invoice?.invoiceNumber}</DialogTitle>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            <InvoiceShareSheet
              invoice={{
                id: invoice?.id || invoice?._id || invoice?.invoiceNumber,
                invoiceNumber: invoice?.invoiceNumber,
                grandTotal,
                dueDate: invoice?.dueDate,
                party: invoice?.transactionId?.party || invoice?.party,
                transactionId: invoice?.transactionId,
                lineItems: invoice?.transactionId?.lineItems || invoice?.lineItems,
                additionalCharges,
                subtotal,
                discountTotal,
                taxTotal,
                notes: invoice?.notes,
                termsAndConditions: resolvedTermsAndConditions,
              }}
              variant="button"
            />
            <Button size="sm" onClick={onDownload} className="px-2 sm:px-3">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button size="sm" onClick={onPrint} className="px-2 sm:px-3">
              <Printer className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto p-4 sm:p-6 md:p-8 bg-gray-100 flex-1">
          <div className="mx-auto shadow-xl" style={{ maxWidth: '210mm' }}>
            <div className="relative bg-white p-2 sm:p-3 md:p-4" style={{ minHeight: '297mm' }}>

              {/* Watermark Logo (background) */}
              {(logoDataUri || business?.logo) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                <Image
                  src={logoDataUri || business?.logo || ''}
                  alt=""
                  width={350}
                  height={350}
                  className="object-contain"
                  style={{ width: '55%', height: 'auto', opacity: 0.3 }}
                  priority
                />
              </div>
              )}

              {/* MAIN CONTENT */}
              <div className="relative z-10">



                {/* TAX INVOICE TAG */}
                <div className="text-center mb-1">
                  <span className="inline-block px-3 py-0.5 text-[10px] font-semibold tracking-wider border border-gray-400 rounded-sm uppercase">
                    TAX INVOICE | ORIGINAL FOR RECIPIENT
                  </span>
                </div>

                {/* Vendor & Invoice Meta Split Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 border border-gray-300 mb-4 text-[11px]">
                  <div className="p-2 sm:p-3 border-gray-300 space-y-0.5 leading-tight">
                    <p className="font-bold text-sm">{businessName}</p>
                    <p className="text-gray-600">{businessAddress}</p>
                    {business?.phoneNumber && (
                      <p className="text-gray-600">Mobile: {business.phoneNumber}</p>
                    )}
                    {business?.pan && (
                      <p className="text-gray-600">PAN: {business.pan}</p>
                    )}
                    {business?.gstin && (
                      <p className="text-gray-600">GSTIN: {business.gstin}</p>
                    )}
                    {business?.email && (
                      <p className="text-gray-600">Email: {business.email}</p>
                    )}
                  </div>
                  {/* Center Header Logo */}
                  {(logoDataUri || business?.logo) && (
                  <div className="hidden sm:flex justify-center mb-4">
                    <Image
                      src={logoDataUri || business?.logo || ''}
                      alt="Company Logo"
                      width={100}
                      height={100}
                      className="object-contain"
                      style={{ maxHeight: '2in', height: 'auto' }}
                      priority
                    />
                  </div>
                  )}
                  <div className="flex justify-end items-center text-[11px]">
                    <div className="p-2 sm:p-3 text-right sm:text-left">
                      <p className="text-gray-500 text-[10px]">Invoice No.</p>
                      <p className="font-semibold">{invoice?.invoiceNumber}</p>
                      <p className="text-gray-500 text-[10px]">Invoice Date</p>
                      <p className="font-semibold">{transactionDate ? formatDate(transactionDate) : ''}</p>
                    </div>
                  </div>
                </div>

                {/* Bill To */}
                <div className="mb-3 border-b border-gray-200 pb-2">
                  <div className="text-[11px]">
                    <span className="font-semibold">Bill To: </span>
                    <span>
                      {invoice?.transactionId?.party?.displayName || invoice?.transactionId?.party?.name}
                      {(invoice?.transactionId?.party?.phoneNumber || invoice?.transactionId?.party?.phone) && (
                        <> - {invoice?.transactionId?.party?.phoneNumber || invoice?.transactionId?.party?.phone}</>
                      )}
                    </span>
                    {(invoice?.transactionId?.party?.billingAddress) && (() => {
                      const ba = invoice?.transactionId?.party?.billingAddress;
                      const lineParts = [ba.line1, ba.line2, ba.landmark].filter(Boolean).join(', ');
                      const cityLine = [ba.city, ba.state].filter(Boolean).join(', ');
                      return (
                        <>
                          <br />
                          <span className="text-gray-600">{lineParts}</span>
                          {cityLine && (
                            <>
                              <br />
                              <span className="text-gray-600">{cityLine}</span>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                <div className="border border-gray-100 text-[10px] mb-4 flex flex-col" style={{ minHeight: '125mm' }}>
                  {/* Table Header */}
                  <div className="grid grid-cols-[20px_1fr_35px_55px_55px] sm:grid-cols-[32px_1fr_60px_50px_70px_55px_70px] bg-gray-200 font-semibold border-b border-gray-300">
                    <div className="px-0.5 sm:px-1.5 py-2 text-center">#</div>
                    <div className="px-0.5 sm:px-1.5 py-2">Items</div>
                    <div className="hidden sm:block px-1.5 py-2 text-center">HSN</div>
                    <div className="px-0.5 sm:px-1.5 py-2 text-center">Qty</div>
                    <div className="px-0.5 sm:px-1.5 py-2 text-right text-[9px] sm:text-[10px]">PRICE/ITEM (₹)</div>
                    <div className="hidden sm:block px-1.5 py-2 text-right">Disc</div>
                    <div className="px-0.5 sm:px-1.5 py-2 text-right text-[9px] sm:text-[10px]">Total</div>
                  </div>

                  <div className="flex flex-1 flex-col">
                    {/* Table Rows */}
                    <div className="flex-1">
                      {lineItems.length === 0 && (
                        <div className="px-3 py-4 text-center text-gray-400 text-[10px]">No items</div>
                      )}
                      {lineItems.map((item: any, index: number) => (
                        <div key={index} className="grid grid-cols-[20px_1fr_35px_55px_55px] sm:grid-cols-[32px_1fr_60px_50px_70px_55px_70px] border-b border-gray-200">
                          <div className="px-0.5 sm:px-1.5 py-2 text-center text-gray-500">{index + 1}</div>
                          <div className="px-0.5 sm:px-1.5 py-2">
                            <span className="font-medium leading-tight text-[10px] sm:text-[10px]">{item.itemName}</span>
                            {item.description && (
                              <div className="text-gray-500 text-[8px] sm:text-[9px] leading-tight mt-0.5 whitespace-pre-line">{item.description}</div>
                            )}
                          </div>
                          <div className="hidden sm:block px-1.5 py-2 text-center text-gray-500">{item.hsnCode || item.itemHsn || '-'}</div>
                          <div className="px-0.5 sm:px-1.5 py-2 text-center text-[9px] sm:text-[10px]">{Number(item.quantity).toFixed(2)}</div>
                          <div className="px-0.5 sm:px-1.5 py-2 text-right text-[9px] sm:text-[10px]">{fmt(item.unitPrice)}</div>
                          <div className="hidden sm:block px-1.5 py-2 text-right">{(item.discountAmount || 0) > 0 ? fmt(item.discountAmount) : '-'}</div>
                          <div className="px-0.5 sm:px-1.5 py-2 text-right font-medium text-[9px] sm:text-[10px]">{fmt(item.lineTotal)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto border-t border-gray-300">
                      {/* Additional Charges rows */}
                      {additionalCharges.map((charge: any, index: number) => (
                        <div key={`charge-${index}`} className="grid grid-cols-[20px_1fr_35px_55px_55px] sm:grid-cols-[32px_1fr_60px_50px_70px_55px_70px] border-b border-gray-200">
                          <div className="px-0.5 sm:px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2 italic text-gray-600 text-[9px] sm:text-[10px]">{charge.name}</div>
                          <div className="hidden sm:block px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2"></div>
                          <div className="hidden sm:block px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2 text-right text-[9px] sm:text-[10px]">{fmt(Number(charge.amount))}</div>
                        </div>
                      ))}

                      {/* Total Discount Row */}
                      {totalDiscount > 0 && (
                        <div className="grid grid-cols-[20px_1fr_35px_55px_55px] sm:grid-cols-[32px_1fr_60px_50px_70px_55px_70px] border-b border-gray-200">
                          <div className="px-0.5 sm:px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2 italic text-gray-600 text-[9px] sm:text-[10px]">
                            Discount
                            {totalDiscountType === 'percentage'
                              ? ` (${totalDiscountValue}%)`
                              : totalDiscountType === 'fixed'
                                ? ' (Fixed)'
                                : ''}
                          </div>
                          <div className="hidden sm:block px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2"></div>
                          <div className="hidden sm:block px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2 text-right text-red-600 text-[9px] sm:text-[10px]">-{fmt(totalDiscount)}</div>
                        </div>
                      )}

                      {/* Round Off Row */}
                      {roundOff !== 0 && (
                        <div className="grid grid-cols-[20px_1fr_35px_55px_55px] sm:grid-cols-[32px_1fr_60px_50px_70px_55px_70px] border-b border-gray-200">
                          <div className="px-0.5 sm:px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2 italic text-gray-600 text-[9px] sm:text-[10px]">Round Off</div>
                          <div className="hidden sm:block px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2"></div>
                          <div className="hidden sm:block px-1.5 py-2"></div>
                          <div className="px-0.5 sm:px-1.5 py-2 text-right text-[9px] sm:text-[10px]">{fmt(roundOff)}</div>
                        </div>
                      )}

                      {/* Grand Total Bar */}
                      <div className="grid grid-cols-[20px_1fr_35px_55px_55px] sm:grid-cols-[32px_1fr_60px_50px_70px_55px_70px] font-bold border-t-2 border-gray-800 text-[10px] sm:text-xs">
                        <div className="px-0.5 sm:px-1.5 py-2"></div>
                        <div className="px-0.5 sm:px-1.5 py-2 uppercase tracking-wide">TOTAL</div>
                        <div className="hidden sm:block px-1.5 py-2"></div>
                        <div className="px-0.5 sm:px-1.5 py-2"></div>
                        <div className="px-0.5 sm:px-1.5 py-2"></div>
                        <div className="hidden sm:block px-1.5 py-2"></div>
                        <div className="px-0.5 sm:px-1.5 py-2 text-right text-[9px] sm:text-xs">{fmt(grandTotal)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>

                {/* Tax Breakup Grid — only show when there are taxable items */}
                {taxBreakup.length > 0 && (
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                <div className="border border-gray-300 text-[9px] sm:text-[10px] mb-4 w-full">
                  <div className="grid w-full grid-cols-[14%_18%_12%_14%_12%_14%_16%] sm:grid-cols-[16.67%_18.75%_11.46%_13.54%_11.46%_13.54%_14.58%] bg-gray-100 font-semibold border-b border-gray-300">
                    <div className="px-1 sm:px-2 py-1 sm:py-1.5">HSN/SAC</div>
                    <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right">Taxable Value</div>
                    <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right">CGST (Rate)</div>
                    <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right">CGST (Amt)</div>
                    <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right">SGST (Rate)</div>
                    <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right">SGST (Amt)</div>
                    <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right">Total Tax</div>
                  </div>
                  {taxBreakup.map((row, i) => (
                    <div key={i} className="grid w-full grid-cols-[14%_18%_12%_14%_12%_14%_16%] sm:grid-cols-[16.67%_18.75%_11.46%_13.54%_11.46%_13.54%_14.58%] border-b border-gray-200 last:border-b-0">
                      <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-[8px] sm:text-[10px]">{row.hsn || "-"}</div>
                      <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right text-[8px] sm:text-[10px]">{fmt(row.taxableValue) || "N/A"}</div>
                      <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right text-[8px] sm:text-[10px]">{row.cgstRate || "N/A"}%</div>
                      <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right text-[8px] sm:text-[10px]">{fmt(row.cgstAmount) || "N/A"}</div>
                      <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right text-[8px] sm:text-[10px]">{row.sgstRate || "N/A"}%</div>
                      <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right text-[8px] sm:text-[10px]">{fmt(row.sgstAmount) || "N/A"}</div>
                      <div className="px-1 sm:px-2 py-1 sm:py-1.5 text-right font-medium text-[8px] sm:text-[10px]">{fmt(row.totalTax) || "N/A"}</div>
                    </div>
                  ))}
                </div>
                </div>
                )}

                {/* Footer: Amount in Words + Terms — Left 40% / Right 60% */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-6 text-[9px] sm:text-[10px] border-t border-gray-200 pt-2 sm:pt-3">
                  <div className="sm:col-span-2 space-y-1">
                    <p className="font-semibold">Amount in Words</p>
                    <p className="text-gray-700 leading-tight">{numberToWords(grandTotal)}</p>
                    <div className="mt-2 space-y-0.5">
                      <p className={dueAmount > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                        Payment Status: {dueAmount > 0 ? 'UNPAID' : 'PAID'}
                      </p>
                      {paidAmount > 0 && (
                        <p>Paid Amount: {fmt(paidAmount)}</p>
                      )}
                      {paymentMethod && (
                        <p>Payment Mode: {formatPaymentMethod(paymentMethod)}</p>
                      )}
                      {dueAmount > 0 && (
                        <p>Due Amount: {fmt(dueAmount)}</p>
                      )}
                      {invoice?.dueDate && (
                        <p>Due Date: {formatDate(invoice.dueDate)}</p>
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-3 space-y-2">
                    {notes && (
                      <div className="space-y-1">
                        <p className="font-semibold">Notes</p>
                        <p className="text-gray-700 leading-tight whitespace-pre-line">{notes}</p>
                      </div>
                    )}
                    {resolvedTermsAndConditions && (
                      <div className="space-y-1">
                        <p className="font-semibold">Terms & Conditions</p>
                        <p className="text-gray-700 leading-tight whitespace-pre-line">{resolvedTermsAndConditions}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Text */}
                {footerText && (
                  <div className="border-t border-gray-300 pt-2 mt-4 text-center text-[9px] text-gray-500">
                    {footerText}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
