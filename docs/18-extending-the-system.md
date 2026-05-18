# Extending the System

## Overview

This guide covers how to add new features to GSMS by following established patterns. Each section walks through the steps needed to add a new entity or extend an existing one.

## Table of Contents

1. [Adding a New Model](#adding-a-new-model)
2. [Adding a New API Route](#adding-a-new-api-route)
3. [Adding a New Client Page](#adding-a-new-client-page)
4. [Adding a New Component](#adding-a-new-component)
5. [Adding a New Transaction Type](#adding-a-new-transaction-type)
6. [Adding a New Report](#adding-a-new-report)
7. [Adding a New Background Worker](#adding-a-new-background-worker)

---

## Adding a New Model

**Step 1**: Create the model file at `models/YourModel.ts`

```typescript
import mongoose, { type Model, Schema, Types } from "mongoose";
import { mongooseDocumentTransform } from "@/lib/utils";

export interface IYourModel {
  owner: Types.ObjectId;
  shopId?: Types.ObjectId | null;
  name: string;
  // ... your fields
}

type YourModelModel = Model<IYourModel>;

const yourModelSchema = new Schema<IYourModel, YourModelModel>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // ... your field definitions
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: mongooseDocumentTransform,
    },
    toObject: {
      virtuals: true,
      transform: mongooseDocumentTransform,
    },
  }
);

// Add indexes
yourModelSchema.index({ owner: 1, name: 1 }, { unique: true });

const YourModel =
  (mongoose.models.YourModel as YourModelModel | undefined) ??
  mongoose.model<IYourModel, YourModelModel>("YourModel", yourModelSchema);

export default YourModel;
```

**Step 2**: Add `shopId` field to enable automatic multi-tenant scoping
**Step 3**: Add proper indexes for common query patterns
**Step 4**: Add hooks for validation if needed

---

## Adding a New API Route

**Step 1**: Create the route directory:

```
app/api/your-resource/
├── route.ts          # GET (list) + POST (create)
└── [id]/
    └── route.ts      # GET, PUT, DELETE (single document)
```

**Step 2**: Collection route (`app/api/your-resource/route.ts`):

```typescript
import connectToDatabase from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import YourModel from "@/models/YourModel";

export async function GET(req: Request) {
  const user = await requireUser();
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    YourModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    YourModel.countDocuments(),
  ]);

  return Response.json({ items, total, page, limit });
}

export async function POST(req: Request) {
  const user = await requireOwner();

  if (!user.activeShopId) {
    return Response.json(
      { error: "No active shop selected" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const body = await req.json();

  const item = await YourModel.create({
    ...body,
    owner: user.id,
    shopId: user.activeShopId,
    createdBy: user.id,
  });

  return Response.json({ item }, { status: 201 });
}
```

**Step 3**: Document route (`app/api/your-resource/[id]/route.ts`):

```typescript
import connectToDatabase from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import YourModel from "@/models/YourModel";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  await connectToDatabase();
  const { id } = await params;

  const item = await YourModel.findById(id);
  if (!item) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ item });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireOwner();
  await connectToDatabase();
  const { id } = await params;
  const body = await req.json();

  const item = await YourModel.findByIdAndUpdate(
    id,
    { ...body, updatedBy: user.id },
    { new: true, runValidators: true }
  );

  if (!item) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ item });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireOwner();
  await connectToDatabase();
  const { id } = await params;

  const item = await YourModel.findByIdAndDelete(id);
  if (!item) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
```

---

## Adding a New Client Page

**Step 1**: Create the page directory:

```
app/(dashboard)/dashboard/your-resource/
├── page.tsx               # Server component (auth guard)
└── your-resource-client.tsx  # Client component (interactivity)
```

**Step 2**: Server page (`page.tsx`):

```typescript
import { requireUser } from "@/lib/auth";
import { YourResourceClient } from "./your-resource-client";

export default async function YourResourcePage() {
  await requireUser(); // Redirects to /signin if not authenticated
  return <YourResourceClient />;
}
```

**Step 3**: Client component (`your-resource-client.tsx`):

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';

export function YourResourceClient() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['your-resource', search, page],
    queryFn: () =>
      fetch(`/api/your-resource?search=${search}&page=${page}`)
        .then(r => r.json()),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Resources</h1>
        <Button>Create New</Button>
      </div>

      <Input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.items?.map((item: any) => (
            <TableRow key={item._id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>
                {/* Action buttons */}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## Adding a New Component

**Step 1**: Create the component file at `components/your-component.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useActiveShop } from '@/components/providers/shop-provider';
import RequireShopGuard from '@/components/require-shop-guard';

interface YourComponentProps {
  onSuccess?: () => void;
}

export function YourComponent({ onSuccess }: YourComponentProps) {
  const [open, setOpen] = useState(false);
  const { activeShopId } = useActiveShop();

  const handleSubmit = async (data: any) => {
    const response = await fetch('/api/your-resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      setOpen(false);
      onSuccess?.();
    }
  };

  return (
    <RequireShopGuard>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Create New</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Resource</DialogTitle>
          </DialogHeader>
          {/* Form fields */}
        </DialogContent>
      </Dialog>
    </RequireShopGuard>
  );
}
```

**Key patterns to follow:**
- Use `'use client'` for interactive components
- Wrap create actions with `<RequireShopGuard>`
- Use shadcn/ui primitives from `components/ui/`
- Access shop context via `useActiveShop()` hook
- Handle loading, success, and error states

---

## Adding a New Transaction Type

**Step 1**: Add the type to `models/Transaction.ts`:

```typescript
export const TRANSACTION_TYPES = [
  "sale",
  "purchase",
  "sale-return",
  "purchase-return",
  "payment-in",
  "payment-out",
  "adjustment",
  "opening-balance",
  "your-new-type",  // Add here
] as const;
```

**Step 2**: Add inventory/balance handling in `lib/transaction-inventory.ts` if the new type affects stock or party balances.

**Step 3**: Create a new dialog component at `components/create-your-type-dialog.tsx` that uses the shared `TransactionForm`.

**Step 4**: Add the dialog to the transactions client page's "New Transaction" dropdown menu.

**Step 5**: Handle the new type in reports and aggregation queries.

---

## Adding a New Report

**Step 1**: Create the API endpoint at `app/api/reports/your-report/route.ts`.

**Step 2**: Create the report component at `modules/reports/your-report.tsx`.

**Step 3**: Add the report tab to the reports page.

**Step 4**: Implement the data aggregation using MongoDB aggregation pipelines.

**Step 5**: Add export functionality using the `ExportButton` component.

---

## Adding a New Background Worker

**Step 1**: Create the worker file at `lib/workers/your-worker.ts`:

```typescript
import cron from 'node-cron';
import connectToDatabase from '@/lib/db';
import Notification from '@/models/Notification';

export class YourWorker {
  private static isRunning = false;

  public static start() {
    // Schedule with cron expression
    cron.schedule('0 */6 * * *', async () => {
      await this.runTask();
    });
    console.log('✅ Your Worker scheduled');
  }

  public static async runTask() {
    if (this.isRunning) return;
    
    try {
      this.isRunning = true;
      await connectToDatabase();
      
      // Your task logic here
      
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Manual trigger for testing
  public static async triggerManually() {
    await this.runTask();
  }
}
```

**Step 3**: Register the worker in your application initialization.

---

## Patterns Summary

| Concern | Pattern |
|---------|---------|
| **Model** | Mongoose schema with `owner`, `shopId`, timestamps, `mongooseDocumentTransform` |
| **Indexes** | `owner + uniqueField`, `owner + queryFields` |
| **API Route** | Guard → Connect DB → Validate → CRUD → Response |
| **Auth Guard** | `requireUser()` for any auth, `requireOwner()` for write ops |
| **Shop Scope** | Global plugin auto-filters; explicit `shopId: user.activeShopId` on creates |
| **Client Page** | Server guard + client component with TanStack Query |
| **UI Guard** | `<RequireShopGuard>` wrapping create/edit actions |
| **Form** | react-hook-form + Zod validation |
| **Notifications** | Create `Notification` document + toast with Sonner |
| **Error Handling** | `AppError` class with HTTP status codes |

## Checklist for New Features

- [ ] Model includes `owner` and `shopId` fields
- [ ] Model uses `mongooseDocumentTransform` 
- [ ] Proper indexes added for query performance
- [ ] API routes guard authentication and shop selection
- [ ] POST/PUT endpoints set `shopId: user.activeShopId`
- [ ] Client pages wrapped with proper auth
- [ ] Create actions wrapped with `<RequireShopGuard>`
- [ ] Error states handled in UI (loading, empty, error)
- [ ] Success notifications shown via toast
- [ ] Documentation updated in `docs/`