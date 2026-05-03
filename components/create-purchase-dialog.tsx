'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import TransactionForm from '@/components/transaction-form';

interface CreatePurchaseDialogProps {
  onPurchaseCreated?: () => void;
  children?: React.ReactNode;
}

export default function CreatePurchaseDialog({ onPurchaseCreated, children }: CreatePurchaseDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            + New Purchase
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Create New Purchase</DialogTitle>
          <DialogDescription>
            Save as draft to review later, or confirm to add stock immediately.
          </DialogDescription>
        </DialogHeader>

        <TransactionForm
          mode="purchase"
          isOpen={open}
          onSuccess={() => {
            setOpen(false);
            onPurchaseCreated?.();
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
