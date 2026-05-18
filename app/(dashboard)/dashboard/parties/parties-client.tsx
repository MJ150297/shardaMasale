'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import CreatePartyDialog from '@/components/create-party-dialog';
import EditPartyDialog from '@/components/edit-party-dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  status: string;
  partyType: 'customer' | 'supplier' | 'both';
}

interface PartiesClientProps {
  parties: Party[];
}

export default function PartiesClient({ parties }: PartiesClientProps) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [partyTypeFilter, setPartyTypeFilter] = useState('all');

  const filteredParties = useMemo(() => {
    return parties.filter(party => {
      const matchesSearch = searchQuery === '' || 
        party.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (party.email && party.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (party.phoneNumber && party.phoneNumber.includes(searchQuery));

      const matchesStatus = statusFilter === 'all' || party.status === statusFilter;
      const matchesType = partyTypeFilter === 'all' || party.partyType === partyTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [parties, searchQuery, statusFilter, partyTypeFilter]);

  const handleFilter = (key: string, value: string) => {
    if (key === 'status') setStatusFilter(value);
  };

  const handlePartyCreated = () => {
    // Increment key to trigger re-fetch on server component
    setRefreshKey(prev => prev + 1);
    // Hard refresh for now until proper revalidation is implemented
    window.location.reload();
  };

  return (
    <div className="space-y-6" key={refreshKey}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers / Suppliers</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your customers and send login invites</p>
        </div>
        <RequireShopGuard>
          <CreatePartyDialog onPartyCreated={handlePartyCreated} />
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

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Party</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredParties.map((party) => (
                <tr key={party._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{party.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="secondary" className="capitalize">
                      {party.partyType}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">{party.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">{party.phoneNumber || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      party.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      party.status === 'invited' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}>
                      {party.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => alert(`Send invite to ${party.email}`)}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send Login Invite</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => router.push(`/dashboard/parties/${party._id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Profile</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <EditPartyDialog
                              party={party}
                              onPartyUpdated={() => window.location.reload()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </EditPartyDialog>
                          </TooltipTrigger>
                          <TooltipContent>Edit Party</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()} className='bg-white/80'>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Party</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the party
                                <span className="font-semibold"> {party.name} </span>
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
                                    window.location.reload();
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
                          </TooltipTrigger>
                          <TooltipContent>Delete Party</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredParties.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="text-4xl mb-2">👥</div>
                    <p className="font-medium text-gray-900 dark:text-white">No parties found</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Try changing the filter or add a new party</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}