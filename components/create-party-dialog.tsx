'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { X, Plus, StickyNote, Pin, Tag as TagIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const billingAddressSchema = z.object({
  line1: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  line2: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  landmark: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  city: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  state: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  postalCode: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  country: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
}).optional().nullable();

const noteSchema = z.object({
  content: z.string().min(1).max(2000),
  category: z.enum(['general', 'follow-up', 'important', 'payment', 'delivery']).default('general'),
  tags: z.array(z.string().max(50)).default([]),
  pinned: z.boolean().default(false),
});

const createPartySchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(160),
  legalName: z.string().optional().nullable(),
  partyType: z.enum(['customer', 'supplier', 'both']).default('customer'),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  alternatePhoneNumber: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  taxTreatment: z.enum(['registered', 'unregistered', 'consumer', 'overseas']).default('unregistered'),
  address: z.string().max(300).optional().nullable(),
  billingAddress: billingAddressSchema,
  creditLimit: z.coerce.number().min(0).default(0),
  openingBalance: z.coerce.number().default(0),
  notes: z.string().max(2000).optional().nullable(),
  notesList: z.array(noteSchema).default([]),
  tags: z.array(z.string()).default([]),
});
type CreatePartyFormData = z.infer<typeof createPartySchema>;

type NoteCategory = 'general' | 'follow-up' | 'important' | 'payment' | 'delivery';

interface DraftNote {
  content: string;
  category: NoteCategory;
  tags: string[];
  pinned: boolean;
}

const NOTE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'important', label: 'Important' },
  { value: 'payment', label: 'Payment' },
  { value: 'delivery', label: 'Delivery' },
];

export interface CreatedParty {
  _id: string;
  id?: string;
  displayName?: string | null;
  name?: string | null;
  fullName?: string | null;
  partyName?: string | null;
  phoneNumber?: string | null;
  alternatePhoneNumber?: string | null;
  mobile?: string | null;
  phone?: string | null;
  partyType?: 'customer' | 'supplier' | 'both';
  currentBalance?: number;
  creditLimit?: number;
}

interface CreatePartyDialogProps {
  onPartyCreated?: (party: CreatedParty) => void;
  children?: React.ReactNode;
  defaultPartyType?: 'customer' | 'supplier' | 'both';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

type CreatedPartyInput = Omit<CreatedParty, '_id'> & {
  _id?: string;
  id?: string;
};

function normalizeCreatedParty(party: CreatedPartyInput): CreatedParty {
  return {
    ...party,
    _id: party._id ?? party.id ?? '',
  };
}

function getDefaultPartyValues(defaultPartyType: 'customer' | 'supplier' | 'both' = 'customer'): CreatePartyFormData {
  return {
    displayName: '',
    legalName: null,
    partyType: defaultPartyType,
    status: 'active',
    email: null,
    phoneNumber: null,
    alternatePhoneNumber: null,
    gstin: null,
    pan: null,
    taxTreatment: 'unregistered',
    address: null,
    billingAddress: null,
    creditLimit: 0,
    openingBalance: 0,
    notes: null,
    notesList: [],
    tags: [],
  };
}

export default function CreatePartyDialog({
  onPartyCreated,
  children,
  defaultPartyType = 'customer',
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showTrigger = true,
}: CreatePartyDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [draftNotes, setDraftNotes] = useState<DraftNote[]>([]);
  const [isNoteComposerOpen, setIsNoteComposerOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  }

  const form = useForm<CreatePartyFormData>({
    resolver: zodResolver(createPartySchema) as never,
    defaultValues: getDefaultPartyValues(defaultPartyType),
  });

  useEffect(() => {
    if (!open) return;

    form.reset(getDefaultPartyValues(defaultPartyType));
    setTagInput('');
    setDraftNotes([]);
    setIsNoteComposerOpen(false);
  }, [defaultPartyType, form, open]);

  const selectedPartyType = form.watch('partyType');
  const isCustomerOnly = selectedPartyType === 'customer';

  const onSubmit = async (data: CreatePartyFormData) => {
    setIsSubmitting(true);
    try {
      // Sanitize billingAddress: convert null/empty object to null to avoid Zod errors
      const payload = { ...data };
      if (payload.billingAddress) {
        const addr = payload.billingAddress;
        // If all fields are empty/blank, set to null
        if (!addr.line1 && !addr.city && !addr.state && !addr.postalCode && !addr.country) {
          payload.billingAddress = null;
        } else {
          // Ensure no null values - convert to empty string
          payload.billingAddress = {
            line1: addr.line1 || '',
            line2: addr.line2 || '',
            landmark: addr.landmark || '',
            city: addr.city || '',
            state: addr.state || '',
            postalCode: addr.postalCode || '',
            country: addr.country || '',
          };
        }
      }

      const response = await fetch('/api/parties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const party = (await response.json()) as CreatedPartyInput | { error?: string };

      if (!response.ok) {
        throw new Error('error' in party ? party.error || 'Failed to create party' : 'Failed to create party');
      }

      const normalizedParty = normalizeCreatedParty(party as CreatedPartyInput);
      toast.success('Party created successfully!');
      handleOpenChange(false);
      form.reset(getDefaultPartyValues(defaultPartyType));
      onPartyCreated?.(normalizedParty);
    } catch (error) {
      console.error('Error creating party:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create party');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !form.getValues('tags').includes(tagInput.trim())) {
      const currentTags = form.getValues('tags');
      form.setValue('tags', [...currentTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('tags');
    form.setValue('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  const addDraftNote = (note: DraftNote) => {
    setDraftNotes(prev => [...prev, note]);
    form.setValue('notesList', [...form.getValues('notesList'), note]);
    setIsNoteComposerOpen(false);
  };

  const removeDraftNote = (index: number) => {
    setDraftNotes(prev => prev.filter((_, i) => i !== index));
    const current = form.getValues('notesList');
    form.setValue('notesList', current.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger && (
        <DialogTrigger asChild>
          {children || (
            <Button>
              + Add New Customer/Supplier
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-background dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle>Create New Party / Customer</DialogTitle>
          <DialogDescription>
            Add a new customer, supplier or party to your business.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList variant="segmented" className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="additional">Additional</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Party Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter party name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!isCustomerOnly && (
                    <FormField
                      control={form.control}
                      name="legalName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Legal / Registered name" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="partyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Party Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select party type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="supplier">Supplier</SelectItem>
                            <SelectItem value="both">Both Customer & Supplier</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@example.com" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 98765 43210" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="alternatePhoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alternate Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Alternate contact number" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border rounded-lg p-4 space-y-4">
                  <div className="font-medium text-sm text-muted-foreground">Billing Address</div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="billingAddress.line1"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input placeholder="Building, street, area" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.line2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Additional details" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.landmark"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Landmark</FormLabel>
                          <FormControl>
                            <Input placeholder="Near..." {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="State" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Postal code" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="Country" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {!isCustomerOnly && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gstin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GSTIN</FormLabel>
                          <FormControl>
                            <Input placeholder="22AAAAA0000A1Z5" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN Number</FormLabel>
                          <FormControl>
                            <Input placeholder="AAAAA0000A" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="taxTreatment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Treatment</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tax treatment" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="registered">Registered (GST)</SelectItem>
                          <SelectItem value="unregistered">Unregistered</SelectItem>
                          <SelectItem value="consumer">End Consumer</SelectItem>
                          <SelectItem value="overseas">Overseas / Export</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="financial" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0" {...field} />
                        </FormControl>
                        <FormDescription>Maximum allowed credit for this party</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="openingBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Balance (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormDescription>Outstanding balance at time of creation</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="additional" className="space-y-4">
                {/* Notes Composer */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel className="flex items-center gap-2">
                      <StickyNote className="w-4 h-4" />
                      Notes
                      {draftNotes.length > 0 && (
                        <Badge variant="secondary">{draftNotes.length}</Badge>
                      )}
                    </FormLabel>
                    {!isNoteComposerOpen && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsNoteComposerOpen(true)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />Add Note
                      </Button>
                    )}
                  </div>

                  {isNoteComposerOpen && (
                    <DraftNoteComposer
                      onCancel={() => setIsNoteComposerOpen(false)}
                      onSave={addDraftNote}
                    />
                  )}

                  {draftNotes.length > 0 && (
                    <div className="space-y-2">
                      {draftNotes.map((note, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-2 border rounded-lg p-3 bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {NOTE_CATEGORIES.find(c => c.value === note.category)?.label || note.category}
                              </Badge>
                              {note.pinned && (
                                <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400">
                                  <Pin className="w-2.5 h-2.5 mr-1" />Pinned
                                </Badge>
                              )}
                              {note.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  <TagIcon className="w-2.5 h-2.5 mr-1" />{tag}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 whitespace-pre-wrap">
                              {note.content}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-red-500 hover:text-red-600"
                            onClick={() => removeDraftNote(idx)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <FormLabel>Tags</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addTag}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.watch('tags').map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                  <FormDescription>
                    Add tags to categorize and filter parties easily
                  </FormDescription>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Party'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- Draft Note Composer Component ---

function DraftNoteComposer({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (note: DraftNote) => void;
}) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>('general');
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const charCount = content.length;
  const maxChars = 2000;
  const isOverLimit = charCount > maxChars;

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSave = () => {
    if (!content.trim()) {
      toast.error('Note content is required');
      return;
    }
    if (isOverLimit) {
      toast.error(`Note must be under ${maxChars} characters`);
      return;
    }
    onSave({
      content: content.trim(),
      category,
      tags,
      pinned,
    });
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-background">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">New Note</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your note... Use **bold**, *italic*, - lists, # headings for formatting"
        className={`min-h-[100px] ${isOverLimit ? 'border-red-500 focus:ring-red-500' : ''}`}
      />

      <div className="flex items-center justify-between">
        <span className={`text-xs ${isOverLimit ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {charCount}/{maxChars}
        </span>
        {isOverLimit && (
          <span className="text-xs text-red-500">Character limit exceeded</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
          <Select value={category} onValueChange={(v) => setCategory(v as NoteCategory)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {NOTE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Tags</label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addTag}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  <TagIcon className="w-2.5 h-2.5" />
                  {tag}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => removeTag(tag)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="draft-note-pin"
          checked={pinned}
          onCheckedChange={(checked) => setPinned(checked === true)}
        />
        <label htmlFor="draft-note-pin" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          Pin this note to top
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={isOverLimit || !content.trim()}>
          Add Note
        </Button>
      </div>
    </div>
  );
}
