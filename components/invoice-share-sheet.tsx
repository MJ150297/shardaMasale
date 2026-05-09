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
  X,
  Check,
  MessageCircle,
  Send,
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
}

interface InvoiceShareSheetProps {
  invoice: Invoice;
  children?: React.ReactNode;
  variant?: 'button' | 'icon' | 'menu-item';
}

export default function InvoiceShareSheet({ invoice, children, variant = 'button' }: InvoiceShareSheetProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const invoiceUrl = `${window.location.origin}/api/invoices/${invoice.id}/pdf`;
  const publicUrl = `${window.location.origin}/invoices/${invoice.id}`;

  const messageTemplate = `📄 Invoice ${invoice.invoiceNumber}%0A%0AAmount: ₹${invoice.grandTotal.toFixed(2)}%0ADue Date: ${new Date(invoice.dueDate).toLocaleDateString()}%0A%0AView and Download: ${invoiceUrl}`;

  const shareActions = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'text-green-600',
      handler: () => {
        const phone = invoice.party?.phone?.replace(/\D/g, '') || '';
        window.open(`https://wa.me/${phone}?text=${messageTemplate}`, '_blank');
        trackShare('whatsapp');
      },
    },
    {
      id: 'email',
      name: 'Email',
      icon: Mail,
      color: 'text-blue-600',
      handler: () => {
        const email = invoice.party?.email || '';
        const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber}`);
        const body = encodeURIComponent(`Please find attached invoice ${invoice.invoiceNumber} for ₹${invoice.grandTotal.toFixed(2)}, due on ${new Date(invoice.dueDate).toLocaleDateString()}.\n\nYou can also view and download the invoice here: ${invoiceUrl}`);
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
        window.open(`sms:${phone}?body=${messageTemplate}`, '_blank');
        trackShare('sms');
      },
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: Send,
      color: 'text-sky-500',
      handler: () => {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(invoiceUrl)}&text=${encodeURIComponent(`Invoice ${invoice.invoiceNumber} - ₹${invoice.grandTotal.toFixed(2)}`)}`, '_blank');
        trackShare('telegram');
      },
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
        const details = `Invoice #: ${invoice.invoiceNumber}\nAmount: ₹${invoice.grandTotal.toFixed(2)}\nDue Date: ${new Date(invoice.dueDate).toLocaleDateString()}\nDownload: ${invoiceUrl}`;
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

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.invoiceNumber}`,
          text: `Invoice ${invoice.invoiceNumber} for ₹${invoice.grandTotal.toFixed(2)}`,
          url: invoiceUrl,
        });
        trackShare('native');
      } catch (e) {
        // User cancelled
      }
    }
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
          >
            <Share2 className="mr-3 h-5 w-5" />
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
          >
            <action.icon className={`mr-2 h-4 w-4 ${action.color}`} />
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

  if (isMobile) {
    return (
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
    );
  }

  return (
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
  );
}
