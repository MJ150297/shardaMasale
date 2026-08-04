'use client';

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

// --- Shared Transaction Type ---

export type TransactionType = 'sale' | 'purchase' | 'sale-return' | 'purchase-return' | 'payment-in' | 'payment-out' | 'adjustment' | 'opening-balance';
export type TransactionStatus = 'draft' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'void' | 'not-applicable';

export interface ActionableTransaction {
  _id: string;
  transactionNumber: string;
  type: TransactionType;
  status: TransactionStatus;
  paymentStatus?: PaymentStatus;
  transactionDate: string | Date;
  invoiceId?: {
    _id: string;
    invoiceNumber: string;
    status: string;
  } | string | null;
  party?: {
    id?: string;
    _id?: string;
    name?: string;
    displayName?: string;
    phone?: string;
    phoneNumber?: string;
  } | null;
  lineItems?: Array<{
    item?: string | { itemType?: string } | null;
    itemName?: string;
    unit?: string;
    quantity?: number;
    unitPrice?: number;
    discountAmount?: number;
    taxRate?: number;
    taxAmount?: number;
    lineTotal?: number;
    costPrice?: number | null;
    description?: string | null;
    sku?: string | null;
    itemType?: string;
  }>;
  summary: {
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
    subtotal?: number;
    discountTotal?: number;
    taxTotal?: number;
    roundOff?: number;
  };
  notes?: string | null;
  tags?: string[];
  payment?: {
    method?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
  } | null;
  additionalCharges?: Array<{ name: string; amount: number }>;
  dueDate?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

// --- Invoice type for preview ---

interface InvoiceLike {
  _id: string;
  invoiceNumber: string;
  transactionId: ActionableTransaction;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate?: string | Date;
  totalAmount?: number;
  party?: {
    id?: string;
    displayName?: string;
    name?: string;
  } | null;
  notes?: string | null;
  termsAndConditions?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

// --- Hook ---

interface UseTransactionActionsOptions {
  onRefresh?: () => void;
}

export function useTransactionActions(options?: UseTransactionActionsOptions): {
  viewDialogOpen: boolean;
  setViewDialogOpen: (v: boolean) => void;
  selectedTransaction: ActionableTransaction | null;
  setSelectedTransaction: (v: ActionableTransaction | null) => void;
  editDialogOpen: boolean;
  setEditDialogOpen: (v: boolean) => void;
  draftTransactionToEdit: ActionableTransaction | null;
  setDraftTransactionToEdit: (v: ActionableTransaction | null) => void;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (v: boolean) => void;
  transactionToDelete: ActionableTransaction | null;
  setTransactionToDelete: (v: ActionableTransaction | null) => void;
  isDeleting: boolean;
  cancelDialogOpen: boolean;
  setCancelDialogOpen: (v: boolean) => void;
  transactionToCancel: ActionableTransaction | null;
  setTransactionToCancel: (v: ActionableTransaction | null) => void;
  isCancelling: boolean;
  paymentInEditOpen: boolean;
  setPaymentInEditOpen: (v: boolean) => void;
  paymentInEditTransaction: ActionableTransaction | null;
  setPaymentInEditTransaction: (v: ActionableTransaction | null) => void;
  paymentOutEditOpen: boolean;
  setPaymentOutEditOpen: (v: boolean) => void;
  paymentOutEditTransaction: ActionableTransaction | null;
  setPaymentOutEditTransaction: (v: ActionableTransaction | null) => void;
  invoiceToPreview: any;
  setInvoiceToPreview: (v: any) => void;
  viewTransaction: (t: ActionableTransaction) => void;
  handleDeleteTransaction: () => Promise<void>;
  confirmDelete: (t: ActionableTransaction) => void;
  handleCancelClick: (t: ActionableTransaction) => void;
  handleConfirmCancel: () => Promise<void>;
  handleStatusUpdate: (t: ActionableTransaction, s: 'confirmed' | 'cancelled') => Promise<void>;
  handleEditDraft: (t: ActionableTransaction) => void;
  getTransactionId: (t: ActionableTransaction) => string;
  mapTransactionToFormValues: (t: ActionableTransaction) => any;
  draftTransactionInitialValues: any;
  generateInvoiceForTransaction: (t: ActionableTransaction) => Promise<void>;
  handleViewInvoice: (id: string) => Promise<void>;
  downloadInvoice: (inv: any) => void;
  printInvoice: (inv: any) => void;
  renderExtraActions: (t: ActionableTransaction) => React.ReactNode;
} {
  const { onRefresh } = options || {};

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<ActionableTransaction | null>(null);

  // Edit draft
  const [draftTransactionToEdit, setDraftTransactionToEdit] = useState<ActionableTransaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<ActionableTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cancel
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [transactionToCancel, setTransactionToCancel] = useState<ActionableTransaction | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Payment edit
  const [paymentInEditOpen, setPaymentInEditOpen] = useState(false);
  const [paymentInEditTransaction, setPaymentInEditTransaction] = useState<ActionableTransaction | null>(null);
  const [paymentOutEditOpen, setPaymentOutEditOpen] = useState(false);
  const [paymentOutEditTransaction, setPaymentOutEditTransaction] = useState<ActionableTransaction | null>(null);

  // Invoice preview
  const [invoiceToPreview, setInvoiceToPreview] = useState<InvoiceLike | null>(null);

  const getTransactionId = useCallback((transaction: ActionableTransaction) => {
    return (transaction as any).id || transaction._id || transaction.transactionNumber;
  }, []);

  async function viewTransaction(transaction: ActionableTransaction) {
    // Fetch full transaction details including metadata (settlements, payment, etc.)
    try {
      const transactionId = getTransactionId(transaction);
      const res = await fetch(`/api/transactions/${transactionId}`);
      if (res.ok) {
        const data = await res.json();
        const fullTransaction = data.data || data;
        // Merge metadata fields into the transaction object for the dialog
        const enriched = {
          ...transaction,
          payment: fullTransaction.payment || transaction.payment,
          additionalCharges: fullTransaction.additionalCharges || transaction.additionalCharges,
          invoiceSettlements: (fullTransaction.metadata as any)?.invoiceSettlements,
          purchaseSettlements: (fullTransaction.metadata as any)?.purchaseSettlements,
        };
        setSelectedTransaction(enriched as any);
      } else {
        setSelectedTransaction(transaction);
      }
    } catch {
      setSelectedTransaction(transaction);
    }
    setViewDialogOpen(true);
  }

  async function handleDeleteTransaction() {
    if (!transactionToDelete) return;
    try {
      setIsDeleting(true);
      const transactionId = getTransactionId(transactionToDelete);
      const res = await fetch(`/api/transactions/${transactionId}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteDialogOpen(false);
        setTransactionToDelete(null);
        toast.success('Transaction deleted successfully');
        onRefresh?.();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete transaction');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  }

  function confirmDelete(transaction: ActionableTransaction) {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  }

  function handleCancelClick(transaction: ActionableTransaction) {
    setTransactionToCancel(transaction);
    setCancelDialogOpen(true);
  }

  async function handleConfirmCancel() {
    if (!transactionToCancel) return;
    setIsCancelling(true);
    try {
      const transactionId = getTransactionId(transactionToCancel);
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel transaction');
      setCancelDialogOpen(false);
      setTransactionToCancel(null);
      toast.success('Transaction cancelled successfully');
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel transaction');
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleStatusUpdate(transaction: ActionableTransaction, status: 'confirmed' | 'cancelled') {
    try {
      const transactionId = getTransactionId(transaction);
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update transaction status');
      toast.success(
        status === 'confirmed' ? 'Draft confirmed successfully' : 'Transaction cancelled successfully',
      );
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update transaction status');
    }
  }

  function getTransactionEditMode(type: string) {
    switch (type) {
      case 'sale':
      case 'purchase':
      case 'sale-return':
      case 'purchase-return':
      case 'payment-in':
      case 'payment-out':
        return type;
      default:
        return null;
    }
  }

  function handleEditDraft(transaction: ActionableTransaction) {
    if (transaction.type === 'payment-in') {
      setPaymentInEditTransaction(transaction);
      setPaymentInEditOpen(true);
      return;
    }
    if (transaction.type === 'payment-out') {
      setPaymentOutEditTransaction(transaction);
      setPaymentOutEditOpen(true);
      return;
    }
    const editMode = getTransactionEditMode(transaction.type);
    if (!editMode) {
      toast.info('Editing this draft type is not wired yet');
      return;
    }
    setDraftTransactionToEdit(transaction);
    setEditDialogOpen(true);
  }

  function mapTransactionToFormValues(transaction: ActionableTransaction) {
    const narrowType = (
      transaction.type === 'sale' || transaction.type === 'purchase' ||
      transaction.type === 'sale-return' || transaction.type === 'purchase-return'
    ) ? transaction.type : 'sale';

    return {
      type: narrowType,
      party: (transaction.party as { _id?: string } | null)?._id || (transaction.party as { id?: string } | null)?.id || '',
      transactionDate: transaction.transactionDate ? new Date(transaction.transactionDate) : new Date(),
      dueDate: transaction.dueDate ? new Date(transaction.dueDate) : null,
      lineItems: (transaction.lineItems || []).map((item) => ({
        item: item.item ?? null,
        itemName: item.itemName || '',
        sku: item.sku ?? null,
        description: item.description ?? null,
        unit: item.unit || 'pcs',
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        discountAmount: item.discountAmount || 0,
        taxRate: item.taxRate || 0,
        costPrice: item.costPrice ?? null,
      })),
      additionalCharges: transaction.additionalCharges ?? [],
      summary: {
        roundOff: transaction.summary.roundOff ?? 0,
        paidAmount: transaction.summary.paidAmount ?? 0,
        totalDiscountType: (transaction as any).summary?.totalDiscountType ?? null,
        totalDiscountValue: (transaction as any).summary?.totalDiscountValue ?? null,
      },
      payment: transaction.payment ?? null,
      notes: transaction.notes ?? null,
      tags: transaction.tags ?? [],
      status: transaction.status,
    };
  }

  const draftTransactionInitialValues = useMemo(
    () => (draftTransactionToEdit ? mapTransactionToFormValues(draftTransactionToEdit) : null),
    [draftTransactionToEdit],
  );

  async function generateInvoiceForTransaction(transaction: ActionableTransaction) {
    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: getTransactionId(transaction) }),
      });
      if (response.ok) {
        toast.success('Invoice generated successfully');
        onRefresh?.();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to generate invoice');
      }
    } catch {
      toast.error('Failed to generate invoice');
    }
  }

  async function handleViewInvoice(invoiceId: string) {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) throw new Error('Failed to load invoice');
      const data = await res.json();
      setInvoiceToPreview(data.data || data);
    } catch (error) {
      toast.error('Could not load invoice details');
    }
  }

  function downloadInvoice(invoice: InvoiceLike) {
    window.open(`/api/invoices/${invoice._id}/pdf`, '_blank');
  }

  function printInvoice(invoice: InvoiceLike) {
    const printWindow = window.open(`/api/invoices/${invoice._id}/pdf#toolbar=0`, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    }
  }

  /** Shared extra actions for the 3-dot menu (Edit Draft, Confirm Draft, Cancel, Print, Delete Draft) */
  const renderExtraActions = useCallback(
    (transaction: ActionableTransaction) => {
      return (
        <>
          {transaction.status === 'draft' && (
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleEditDraft(transaction); }}
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit Draft
            </DropdownMenuItem>
          )}
          {transaction.status === 'draft' && (
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleStatusUpdate(transaction, 'confirmed'); }}
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Confirm Draft
            </DropdownMenuItem>
          )}
          {(transaction.status === 'draft' || transaction.status === 'confirmed') && (
            <DropdownMenuItem
              className="text-red-600"
              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleCancelClick(transaction); }}
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Cancel Transaction
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print
          </DropdownMenuItem>
          {transaction.status === 'draft' && (
            <DropdownMenuItem
              className="text-red-600"
              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); confirmDelete(transaction); }}
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete Draft
            </DropdownMenuItem>
          )}
        </>
      );
    },
    // These refs are stable within the hook instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftTransactionToEdit, transactionToCancel, transactionToDelete],
  );

  return {
    // State
    viewDialogOpen,
    setViewDialogOpen,
    selectedTransaction,
    setSelectedTransaction,
    editDialogOpen,
    setEditDialogOpen,
    draftTransactionToEdit,
    setDraftTransactionToEdit,
    deleteDialogOpen,
    setDeleteDialogOpen,
    transactionToDelete,
    setTransactionToDelete,
    isDeleting,
    cancelDialogOpen,
    setCancelDialogOpen,
    transactionToCancel,
    setTransactionToCancel,
    isCancelling,
    paymentInEditOpen,
    setPaymentInEditOpen,
    paymentInEditTransaction,
    setPaymentInEditTransaction,
    paymentOutEditOpen,
    setPaymentOutEditOpen,
    paymentOutEditTransaction,
    setPaymentOutEditTransaction,
    invoiceToPreview,
    setInvoiceToPreview,

    // Actions
    viewTransaction,
    handleDeleteTransaction,
    confirmDelete,
    handleCancelClick,
    handleConfirmCancel,
    handleStatusUpdate,
    handleEditDraft,
    getTransactionId,
    mapTransactionToFormValues,
    draftTransactionInitialValues,
    generateInvoiceForTransaction,
    handleViewInvoice,
    downloadInvoice,
    printInvoice,
    renderExtraActions,
  };
}