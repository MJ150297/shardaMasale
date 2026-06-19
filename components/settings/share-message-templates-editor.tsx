'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_SHARE_MESSAGE_TEMPLATES,
  type ShareTemplateKind,
} from '@/lib/share-messages';

interface ShareMessageTemplatesEditorProps {
  register: any;
  watch: any;
  setValue: any;
}

const TEMPLATE_OPTIONS: Array<{
  kind: ShareTemplateKind;
  label: string;
  description: string;
}> = [
  {
    kind: 'invoice',
    label: 'Invoice',
    description: 'Customer invoice and payment follow-up message.',
  },
  {
    kind: 'sale',
    label: 'Sale',
    description: 'Retail or counter-sale confirmation message.',
  },
  {
    kind: 'purchase',
    label: 'Purchase',
    description: 'Supplier or procurement transaction message.',
  },
  {
    kind: 'sale-return',
    label: 'Sale Return',
    description: 'Reverse sales / customer return message.',
  },
  {
    kind: 'purchase-return',
    label: 'Purchase Return',
    description: 'Reverse purchase / vendor return message.',
  },
  {
    kind: 'payment-in',
    label: 'Payment In',
    description: 'Receipt confirmation for incoming payments.',
  },
  {
    kind: 'payment-out',
    label: 'Payment Out',
    description: 'Payment disbursement confirmation message.',
  },
  {
    kind: 'adjustment',
    label: 'Adjustment',
    description: 'Ledger or inventory adjustment message.',
  },
  {
    kind: 'opening-balance',
    label: 'Opening Balance',
    description: 'Opening balance creation message.',
  },
];

const PLACEHOLDERS = [
  '{{business_block}}',
  '{{business_name}}',
  '{{business_legal_name}}',
  '{{business_display_name}}',
  '{{business_email}}',
  '{{business_phone}}',
  '{{business_website}}',
  '{{business_gstin}}',
  '{{business_pan}}',
  '{{business_address}}',
  '{{intro}}',
  '{{kind}}',
  '{{reference_label}}',
  '{{document_title}}',
  '{{reference_no}}',
  '{{secondary_reference_label}}',
  '{{secondary_reference_no}}',
  '{{document_date}}',
  '{{due_date}}',
  '{{party_label}}',
  '{{party_name}}',
  '{{party_phone}}',
  '{{party_email}}',
  '{{payment_status}}',
  '{{document_status}}',
  '{{line_items}}',
  '{{additional_charges}}',
  '{{summary}}',
  '{{payment_details}}',
  '{{notes}}',
  '{{terms_and_conditions}}',
  '{{footer}}',
  '{{thank_you}}',
];

export default function ShareMessageTemplatesEditor({
  register,
  watch,
  setValue,
}: ShareMessageTemplatesEditorProps) {
  const [selectedKind, setSelectedKind] = useState<ShareTemplateKind>('invoice');
  const fieldPath = `billing.shareMessageTemplates.${selectedKind}`;
  const defaultTemplate = DEFAULT_SHARE_MESSAGE_TEMPLATES[selectedKind];
  const currentTemplate = watch(fieldPath) ?? defaultTemplate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Message Templates</CardTitle>
        <CardDescription>
          Configure enterprise-style WhatsApp and share-sheet messages for each transaction type.
          Placeholders are replaced automatically from the live transaction data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="share-message-template-kind">Message Type</Label>
            <Select value={selectedKind} onValueChange={(value) => setSelectedKind(value as ShareTemplateKind)}>
              <SelectTrigger id="share-message-template-kind">
                <SelectValue placeholder="Select a message type" />
              </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                {TEMPLATE_OPTIONS.map((option) => (
                  <SelectItem key={option.kind} value={option.kind}>
                  {option.label}
                  </SelectItem>
                ))}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TEMPLATE_OPTIONS.find((option) => option.kind === selectedKind)?.description}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={fieldPath}>Template Body</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setValue(fieldPath, defaultTemplate)}
              >
                Reset to default
              </Button>
            </div>
            <Textarea
              id={fieldPath}
              rows={14}
              className="font-mono text-sm"
              placeholder={defaultTemplate}
              {...register(fieldPath)}
            />
            <p className="text-xs text-muted-foreground">
              Current length: {String(currentTemplate?.length ?? 0)} characters
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Available Tokens</Label>
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDERS.map((token) => (
              <span
                key={token}
                className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {token}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Use these tokens anywhere in the template. Blank or missing values are automatically removed from the final message.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
