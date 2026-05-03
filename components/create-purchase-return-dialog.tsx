'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import TransactionForm from '@/components/transaction-form';

interface CreatePurchaseReturnDialogProps {
  onPurchaseReturnCreated?: () => void;
  children?: React.ReactNode;
}

export default function CreatePurchaseReturnDialog({ onPurchaseReturnCreated, children }: CreatePurchaseReturnDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="default">
            + Purchase Return
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Create Purchase Return</DialogTitle>
          <DialogDescription>
            Record supplier returns. Confirming this transaction deducts stock.
          </DialogDescription>
        </DialogHeader>

        <TransactionForm
          mode="purchase-return"
          isOpen={open}
          onSuccess={() => {
            setOpen(false);
            onPurchaseReturnCreated?.();
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
