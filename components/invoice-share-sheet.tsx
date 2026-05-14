'use client';

import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Mail,
  MessageSquare,
  Download,
  ExternalLink,
  QrCode,
  Check,
  MessageCircle,
  Send,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';

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

interface Invoice {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  dueDate: Date | string;
  party?: {
    name?: string;
    phone?: string;
    email?: string;
  } | null;
  // Extended invoice details passed directly from parent
  lineItems?: InvoiceLineItem[];
  additionalCharges?: AdditionalCharge[];
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  notes?: string;
  termsAndConditions?: string;
  transactionId?: any;
}

interface InvoiceShareSheetProps {
  invoice: Invoice;
  children?: React.ReactNode;
  variant?: 'button' | 'icon' | 'menu-item';
}

export default function InvoiceShareSheet({ invoice, children, variant = 'button' }: InvoiceShareSheetProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const invoiceUrl = `${window.location.origin}/api/invoices/${invoice.id}/pdf`;
  const publicUrl = `${window.location.origin}/invoices/${invoice.id}`;

  // Helper to format currency
  const fmt = (val: number | undefined | null) =>
    `Rs.${(val || 0).toFixed(2)}`;

  // Extract line items from invoice object (handles both direct and nested from transactionId)
  function getLineItems(): InvoiceLineItem[] {
    if (invoice.lineItems && invoice.lineItems.length > 0) {
      return invoice.lineItems;
    }
    if (invoice.transactionId?.lineItems) {
      return invoice.transactionId.lineItems.map((item: any) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      }));
    }
    return [];
  }

  function getSubtotal(): number {
    if (invoice.subtotal !== undefined) return invoice.subtotal;
    if (invoice.transactionId?.summary?.subtotal !== undefined) return invoice.transactionId.summary.subtotal;
    return 0;
  }

  function getDiscountTotal(): number {
    if (invoice.discountTotal !== undefined) return invoice.discountTotal;
    if (invoice.transactionId?.summary?.discountTotal !== undefined) return invoice.transactionId.summary.discountTotal;
    return 0;
  }

  function getTaxTotal(): number {
    if (invoice.taxTotal !== undefined) return invoice.taxTotal;
    if (invoice.transactionId?.summary?.taxTotal !== undefined) return invoice.transactionId.summary.taxTotal;
    return 0;
  }

  function getAdditionalCharges(): AdditionalCharge[] {
    if (invoice.additionalCharges && invoice.additionalCharges.length > 0) {
      return invoice.additionalCharges;
    }
    if (invoice.transactionId?.additionalCharges) {
      return invoice.transactionId.additionalCharges.map((c: any) => ({
        name: c.name,
        amount: Number(c.amount),
      }));
    }
    return [];
  }

  function getPartyName(): string {
    return invoice.party?.name || invoice.transactionId?.party?.name || invoice.transactionId?.party?.displayName || 'Guest Customer';
  }

  function getPartyPhone(): string {
    return invoice.party?.phone || invoice.transactionId?.party?.phone || '';
  }

  function getPartyEmail(): string {
    return invoice.party?.email || invoice.transactionId?.party?.email || '';
  }

  function buildTextMessage(): string {
    const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return `Invoice ${invoice.invoiceNumber}\n\nAmount: Rs.${invoice.grandTotal.toFixed(2)}\nDue Date: ${dueDateStr}`;
  }

  async function shareViaWhatsApp() {
    setSharing('whatsapp');
    try {
      const phone = invoice.party?.phone?.replace(/\D/g, '') || '';
      const text = buildTextMessage();
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
      await trackShare('whatsapp');
    } finally {
      setSharing(null);
    }
  }

  async function shareViaTelegram() {
    setSharing('telegram');
    try {
      const text = buildTextMessage();
      const url = encodeURIComponent(invoiceUrl);
      window.open(
        `https://t.me/share/url?url=${url}&text=${encodeURIComponent(text)}`,
        '_blank'
      );
      await trackShare('telegram');
    } finally {
      setSharing(null);
    }
  }

  async function handleNativeShare() {
    setSharing('native');
    try {
      // Try to fetch the actual PDF and share it as a file
      const response = await fetch(invoiceUrl);
      if (response.ok) {
        const pdfBlob = await response.blob();
        const pdfFile = new File(
          [pdfBlob],
          `invoice-${invoice.invoiceNumber}.pdf`,
          { type: 'application/pdf' }
        );

        if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
          await navigator.share({
            title: `Invoice ${invoice.invoiceNumber}`,
            text: buildTextMessage(),
            files: [pdfFile],
          });
          await trackShare('native');
          return;
        }
      }
    } catch {
      // Fall through to text-only share
    }

    // Fallback: text-only native share
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.invoiceNumber}`,
          text: buildTextMessage(),
        });
        await trackShare('native');
      } catch (e) {
        // User cancelled
      }
    }
    setSharing(null);
  }

  const shareActions = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'text-green-600',
      handler: shareViaWhatsApp,
    },
    {
      id: 'email',
      name: 'Email',
      icon: Mail,
      color: 'text-blue-600',
      handler: () => {
        const email = invoice.party?.email || '';
        const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber}`);
        const body = encodeURIComponent(`Please find attached invoice ${invoice.invoiceNumber} for Rs.${invoice.grandTotal.toFixed(2)}, due on ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}.\n\nYou can view and download the invoice here: ${invoiceUrl}`);
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
        trackShare('email');
      },
    },
    {
      id: 'sms',
      name: 'SMS',
      icon: MessageSquare,
      color: 'text-purple-600',
      handler: () => {
        const phone = invoice.party?.phone?.replace(/\D/g, '') || '';
        const text = buildTextMessage();
        window.open(`sms:${phone}?body=${encodeURIComponent(text)}`, '_blank');
        trackShare('sms');
      },
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: Send,
      color: 'text-sky-500',
      handler: shareViaTelegram,
    },
    {
      id: 'copy-link',
      name: 'Copy Link',
      icon: Copy,
      color: 'text-gray-600',
      handler: async () => {
        await navigator.clipboard.writeText(invoiceUrl);
        setCopied('copy-link');
        toast.success('Invoice link copied to clipboard');
        setTimeout(() => setCopied(null), 2000);
        trackShare('copy-link');
      },
    },
    {
      id: 'copy-details',
      name: 'Copy Details',
      icon: Copy,
      color: 'text-gray-600',
      handler: async () => {
        const details = buildTextMessage();
        await navigator.clipboard.writeText(details);
        setCopied('copy-details');
        toast.success('Invoice details copied');
        setTimeout(() => setCopied(null), 2000);
        trackShare('copy-details');
      },
    },
    {
      id: 'download',
      name: 'Download PDF',
      icon: Download,
      color: 'text-indigo-600',
      handler: () => {
        window.open(invoiceUrl, '_blank');
        trackShare('download');
      },
    },
    {
      id: 'open',
      name: 'Open in New Tab',
      icon: ExternalLink,
      color: 'text-gray-600',
      handler: () => {
        window.open(publicUrl, '_blank');
        trackShare('open');
      },
    },
  ];

  async function trackShare(method: string) {
    try {
      await fetch(`/api/invoices/${invoice.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
    } catch (e) {
      // Ignore tracking errors
    }
    setOpen(false);
  }

  const triggerButton = children || (
    variant === 'icon' ? (
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
      </Button>
    ) : variant === 'menu-item' ? (
      <div className="flex items-center w-full cursor-pointer" onClick={() => setOpen(true)}>
        <Share2 className="mr-2 h-4 w-4" />
        Share Invoice
      </div>
    ) : (
      <Button onClick={() => setOpen(true)}>
        <Share2 className="mr-2 h-4 w-4" />
        Share
      </Button>
    )
  );

  const shareContent = (
    <div className="grid gap-1 py-2">
      {typeof window !== 'undefined' && (window.navigator.share as unknown) !== undefined && (
        <>
          <Button
            variant="default"
            className="w-full justify-start h-12"
            onClick={handleNativeShare}
            disabled={sharing !== null}
          >
            {sharing === 'native' ? (
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            ) : (
              <Share2 className="mr-3 h-5 w-5" />
            )}
            Share via System
          </Button>
          <Separator className="my-2" />
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        {shareActions.map((action) => (
          <Button
            key={action.id}
            variant="ghost"
            className="justify-start h-12"
            onClick={action.handler}
            disabled={sharing !== null}
          >
            {sharing === action.id ? (
              <Loader2 className={`mr-2 h-4 w-4 animate-spin ${action.color}`} />
            ) : (
              <action.icon className={`mr-2 h-4 w-4 ${action.color}`} />
            )}
            {copied === action.id ? (
              <Check className="mr-2 h-4 w-4 text-green-600" />
            ) : null}
            {action.name}
          </Button>
        ))}
      </div>

      <Separator className="my-3" />

      <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mt-2">
        <QrCode className="h-16 w-16 text-gray-400 mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          Scan QR code to view invoice
        </p>
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            {triggerButton}
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Share Invoice</SheetTitle>
            </SheetHeader>
            {shareContent}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            {triggerButton}
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Share Invoice</DialogTitle>
            </DialogHeader>
            {shareContent}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}