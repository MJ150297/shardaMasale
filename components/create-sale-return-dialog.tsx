'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import TransactionForm from '@/components/transaction-form';

interface CreateSaleReturnDialogProps {
  onSaleReturnCreated?: () => void;
  children?: React.ReactNode;
}

export default function CreateSaleReturnDialog({ onSaleReturnCreated, children }: CreateSaleReturnDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="default">
            + Sale Return
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Create Sale Return</DialogTitle>
          <DialogDescription>
            Record customer returns. Confirming this transaction adds stock back.
          </DialogDescription>
        </DialogHeader>

        <TransactionForm
          mode="sale-return"
          isOpen={open}
          onSuccess={() => {
            setOpen(false);
            onSaleReturnCreated?.();
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
