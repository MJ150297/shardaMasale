'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import TransactionForm from '@/components/transaction-form';

interface CreateSaleDialogProps {
  onSaleCreated?: () => void;
  children?: React.ReactNode;
}

export default function CreateSaleDialog({ onSaleCreated, children }: CreateSaleDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            + New Sale
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Create New Sale</DialogTitle>
          <DialogDescription>
            Save as draft to reserve stock, or confirm to deduct stock immediately.
          </DialogDescription>
        </DialogHeader>

        <TransactionForm
          mode="sale"
          isOpen={open}
          onSuccess={() => {
            setOpen(false);
            onSaleCreated?.();
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
