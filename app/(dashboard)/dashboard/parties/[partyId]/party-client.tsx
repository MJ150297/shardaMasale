'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import EditPartyDialog from '@/components/edit-party-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Edit, Trash2, Send, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface Party {
  _id: string;
  name: string;
  displayName: string;
  email?: string | null;
  phoneNumber?: string | null;
  alternatePhoneNumber?: string | null;
  gstin?: string | null;
  pan?: string | null;
  partyType: 'customer' | 'supplier' | 'both';
  status: 'active' | 'inactive' | 'blocked';
  creditLimit?: number;
  currentBalance?: number;
  openingBalance?: number;
  tags?: string[];
  notes?: string;
  createdAt: string;
}

interface PartyClientWrapperProps {
  party: Party;
  children: React.ReactNode;
}

interface Transaction {
  _id: string;
  transactionNumber: string;
  type: 'sale' | 'purchase' | 'sale-return' | 'purchase-return' | 'payment-in' | 'payment-out';
  status: 'draft' | 'confirmed' | 'cancelled';
  transactionDate: string;
  summary: {
    grandTotal: number;
  };
  lineItems: any[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function PartyClientWrapper({ party, children }: PartyClientWrapperProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/parties', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: party._id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete party');
      }

      toast.success('Party deleted successfully');
      router.push('/dashboard/parties');
      router.refresh();
    } catch (error) {
      console.error('Error deleting party:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete party');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePartyUpdated = () => {
    router.refresh();
  };

  const loadTransactions = useCallback(async () => {
    try {
      setTransactionsLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        party: party._id,
      });

      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();

      if (res.ok) {
        setTransactions(data.data || []);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  }, [pagination.page, pagination.limit, party._id]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTransactions();
    }
  }, [activeTab, pagination.page, loadTransactions]);

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'purchase': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'sale-return': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'purchase-return': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'payment-in': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'payment-out': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{party.displayName}</h1>
            <Badge className={partyStatusColors[party.status]}>
              {party.status}
            </Badge>
            <Badge variant="secondary">
              {partyTypeLabels[party.partyType]}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Created {format(new Date(party.createdAt), 'dd MMM yyyy')}
          </p>
        </div>

        <div className="flex gap-2">
          <EditPartyDialog party={party} onPartyUpdated={handlePartyUpdated}>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </EditPartyDialog>

          <Button variant="outline" size="sm">
            <Send className="w-4 h-4 mr-2" />
            Send Invite
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Party</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this party? This action cannot be undone.
                  All associated transactions and history will remain but this party will no longer be selectable.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {children}
    </div>
  );
}

const partyStatusColors = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const partyTypeLabels = {
  customer: 'Customer',
  supplier: 'Supplier',
  both: 'Customer & Supplier',
};

function format(date: Date, formatString: string) {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}