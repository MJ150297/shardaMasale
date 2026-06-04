'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import CreatePartyDialog from '@/components/create-party-dialog';
import EditPartyDialog from '@/components/edit-party-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import DataTableToolbar from '@/components/data-table-toolbar';
import RequireShopGuard from '@/components/require-shop-guard';

interface Party {
  _id: string;
  displayName: string;
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  status: string;
  partyType: 'customer' | 'supplier' | 'both';
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'invited': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getTypeBadgeClass(type: string) {
  switch (type) {
    case 'customer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'supplier': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'both': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

export default function PartiesClient() {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [partyTypeFilter, setPartyTypeFilter] = useState('all');

  // Separate state for edit party dialog triggered from dropdown
  const [editPartyOpen, setEditPartyOpen] = useState(false);
  const [editPartyTarget, setEditPartyTarget] = useState<Party | null>(null);

  useEffect(() => {
    loadParties();
  }, [pagination.page, statusFilter, partyTypeFilter]);

  async function loadParties() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(partyTypeFilter !== 'all' && { type: partyTypeFilter }),
      });

      const res = await fetch(`/api/parties?${params}`);
      const data = await res.json();

      if (res.ok) {
        setParties(data.parties || []);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to load parties:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredParties = useMemo(() => {
    return parties.filter(party => {
      const matchesSearch = searchQuery === '' || 
        (party.displayName || party.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (party.email && party.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (party.phoneNumber && party.phoneNumber.includes(searchQuery));

      return matchesSearch;
    });
  }, [parties, searchQuery]);

  const handleFilter = (key: string, value: string) => {
    if (key === 'status') setStatusFilter(value);
  };

  const handleSendInvite = (party: Party) => {
    if (party.email) {
      toast.success(`Invite sent to ${party.email}`);
    } else {
      toast.error(`No email found for ${party.displayName || party.name}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers / Suppliers</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your customers and send login invites</p>
        </div>
        <RequireShopGuard>
          <CreatePartyDialog onPartyCreated={() => { loadParties(); }} />
        </RequireShopGuard>
      </div>

      <Tabs defaultValue="all" value={partyTypeFilter} onValueChange={setPartyTypeFilter} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Parties</TabsTrigger>
          <TabsTrigger value="customer">Customers</TabsTrigger>
          <TabsTrigger value="supplier">Suppliers</TabsTrigger>
          <TabsTrigger value="both">Both</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTableToolbar
        onSearch={setSearchQuery}
        onFilter={handleFilter}
        searchPlaceholder="Search parties by name, email, phone..."
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'invited', label: 'Invited' },
              { value: 'inactive', label: 'Inactive' },
            ]
          }
        ]}
      />

      {/* Flexbox Card Layout */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 md:px-6 py-3 md:py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-4">
                    <Skeleton className="h-8 w-8 md:h-10 md:w-10 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-4xl mb-2">👥</div>
            <p className="font-medium text-gray-900 dark:text-white">No parties found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Try changing the filter or add a new party</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredParties.map((party) => (
              <div
                key={party._id}
                className="px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/parties/${party._id}`)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                    e.preventDefault();
                    router.push(`/dashboard/parties/${party._id}`);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="space-y-3">
                  {/* Main row: left info + right meta */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 md:w-5 md:h-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white truncate">
                          {party.displayName || party.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getTypeBadgeClass(party.partyType)}`}>
                            {party.partyType}
                          </span>
                          {party.email && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline truncate">
                              {party.email}
                            </span>
                          )}
                          {party.phoneNumber && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {party.phoneNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: status + actions */}
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                      {/* Status badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadgeClass(party.status)}`}>
                        {party.status}
                      </span>

                      {/* 3-dot Action Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white/90 dark:bg-gray-900/90" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleSendInvite(party); }}
                          >
                            Send Login Invite
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/dashboard/parties/${party._id}`); }}
                          >
                            View Profile
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditPartyTarget(party);
                              setEditPartyOpen(true);
                            }}
                          >
                            Edit Party
                          </DropdownMenuItem>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              >
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()} className="bg-white/80 dark:bg-gray-900/80">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Party</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the party
                                  <span className="font-semibold"> {party.displayName || party.name} </span>
                                  and remove all associated data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(`/api/parties?id=${party._id}`, {
                                        method: 'DELETE',
                                      });
                                      
                                      if (!response.ok) {
                                        const error = await response.json();
                                        throw new Error(error.error || 'Failed to delete party');
                                      }
                                      
                                      toast.success('Party deleted successfully');
                                      loadParties();
                                    } catch (error) {
                                      console.error('Error deleting party:', error);
                                      toast.error(error instanceof Error ? error.message : 'Failed to delete party');
                                    }
                                  }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Party Dialog - rendered outside dropdown */}
      {editPartyTarget && (
        <EditPartyDialog
          key={editPartyTarget._id}
          party={editPartyTarget}
          open={editPartyOpen}
          onOpenChange={setEditPartyOpen}
          onPartyUpdated={() => { loadParties(); }}
        />
      )}
    </div>
  );
}