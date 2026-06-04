# UI Components

## Overview

GSMS uses **shadcn/ui** as its component library, built on top of **Radix UI** primitives and styled with **Tailwind CSS 4**. Components are organized into three tiers:

1. **UI Primitives** (`components/ui/`) — Generic, reusable building blocks
2. **Layout Components** (`components/layout/`) — Application shell and navigation
3. **Domain Components** (`components/`) — Feature-specific composite components

## UI Primitives (shadcn/ui)

The project includes 30+ UI primitives under `components/ui/`:

| Component | Description |
|-----------|-------------|
| `button.tsx` | Button variants (primary, secondary, outline, ghost, destructive) |
| `dialog.tsx` | Modal dialogs with header, body, footer |
| `dropdown-menu.tsx` | Context menus and actions |
| `table.tsx` | Data table with sort, filter, pagination support |
| `form.tsx` | Form wrapper with react-hook-form integration |
| `input.tsx` | Text input with variants |
| `select.tsx` | Native select with custom styling |
| `combobox.tsx` | Searchable dropdown with autocomplete (alternative to SearchableSelect) |
| `searchable-select.tsx` | Advanced searchable dropdown with cmdk, scrollbar, fixed action button |
| `tooltip.tsx` | Hover tooltips |
| `sheet.tsx` | Slide-out panels (side drawers) |
| `tabs.tsx` | Tabbed content panels |
| `card.tsx` | Content cards with header, body, footer |
| `badge.tsx` | Status badges and labels |
| `avatar.tsx` | User avatars with fallback |
| `separator.tsx` | Visual dividers |
| `skeleton.tsx` | Loading skeleton placeholders |
| `calendar.tsx` | Date picker calendar |
| `popover.tsx` | Floating content panels |
| `sonner.tsx` | Toast notification integration |
| `checkbox.tsx` | Checkbox input |
| `textarea.tsx` | Multi-line text input |
| `label.tsx` | Form labels |
| `alert-dialog.tsx` | Confirmation dialogs |
| `command.tsx` | Command palette / search |
| `input-group.tsx` | Grouped input elements |
| `sidebar.tsx` | Sidebar navigation component |
| `theme-toggle.tsx` | Dark/light mode toggle |

## Layout Components

### DashboardShell (`components/layout/dashboard-shell.tsx`)

The main application shell providing:
- **Sidebar** — Navigation menu with links to all sections
- **Header** — Shop switcher, user menu, notifications
- **Content area** — Page content with responsive padding

```tsx
<DashboardShell user={user}>
  {children}
</DashboardShell>
```

### NotificationBell (`components/layout/notification-bell.tsx`)

Displays unread notification count with dropdown listing recent notifications.

## Providers

### SessionProviderWrapper (`components/providers/session-provider-wrapper.tsx`)

Wraps the app with NextAuth's `SessionProvider` for client-side session access:

```tsx
<SessionProviderWrapper>
  <DashboardShell>
    {children}
  </DashboardShell>
</SessionProviderWrapper>
```

### ShopProvider (`components/providers/shop-provider.tsx`)

Provides shop context throughout the dashboard (see [Multi-Tenant Shops](./05-multi-tenant-shops.md)):

```tsx
const { activeShopId, availableShops, currentShop, switchShop } = useActiveShop();
```

### ThemeProvider (`components/providers/theme-provider.tsx`)

Enables dark/light/system theme switching using `next-themes`.

## SearchableSelect (`components/ui/searchable-select.tsx`)

A searchable dropdown component used extensively throughout the app for selecting items, customers, suppliers, and other entities from large lists.

### Why cmdk?

The component is built on the **cmdk** (Command) library, the same library powering shadcn/ui's combobox pattern. cmdk provides:

- **Built-in search/filter** — type to instantly filter through hundreds of options
- **Keyboard navigation** — arrow keys to move up/down, Enter to select
- **Consistent UX** — matches standard shadcn combobox behavior

### Features

- **Searchable** — type to filter options in real-time
- **Scrollable** — `max-h-[260px]` with visible scrollbar when options overflow
- **Fixed action button** — "Create item" / "Create customer" stays pinned at the bottom while items scroll independently
- **Custom item rendering** — supports rich item content (e.g. inline badges for item types like **PB**, **P**, **S**)
- **Background** — semi-transparent white (`bg-white/90`) for modern overlay look
- **Wheel & touch scrolling** — cmdk normally captures wheel events for keyboard navigation; a custom `onWheel` handler detects boundaries and stops propagation only when scrolling within the list, allowing native mouse/trackpad scrolling

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Currently selected value |
| `onValueChange` | `(value: string) => void` | — | Called when selection changes |
| `options` | `SearchableSelectOption[]` | — | Array of `{ value, label, data? }` |
| `placeholder` | `string` | `'Select...'` | Placeholder text when no selection |
| `searchPlaceholder` | `string` | `'Search...'` | Search input placeholder |
| `triggerClassName` | `string` | — | Additional classes for the trigger button |
| `emptyMessage` | `string` | `'No results found.'` | Text when no options match search |
| `renderItem` | `(option) => ReactNode` | — | Custom render for each option |
| `disabled` | `boolean` | `false` | Disables the dropdown |
| `actionSlot` | `ReactNode` | — | Slot rendered at the bottom (e.g. "Create new" button) |

### Usage

```tsx
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';

<SearchableSelect
  value={selectedId}
  onValueChange={(value) => setSelectedId(value)}
  options={items.map((item): SearchableSelectOption => ({
    value: item._id,
    label: item.name,
    data: item,
  }))}
  placeholder="Select item"
  searchPlaceholder="Search by name or SKU..."
  renderItem={(option) => {
    const item = option.data;
    return (
      <span className="font-medium">
        {item.itemType === 'product' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 mr-1.5 uppercase">
            P
          </span>
        )}
        {item.name}
      </span>
    );
  }}
  actionSlot={
    <CommandCreateButton onClick={() => setCreateItemIndex(index)}>
      Create item
    </CommandCreateButton>
  }
/>
```

### Implementation Details

The component resolves a key tension between cmdk and native scrolling:

1. **cmdk's default behavior:** cmdk uses `overflow-hidden` and captures mouse wheel events for its internal keyboard navigation system. This prevents native scroll from working.
2. **The fix:** The component uses `CommandPrimitive.List` directly (instead of the shadcn `CommandList` wrapper which forces `no-scrollbar`), with `overflow-y-auto` for a visible scrollbar. The parent `Command` gets `overflow-visible`. A custom `handleWheel` callback uses a ref to check if the list can scroll in the wheel's direction — if not at a boundary, it stops propagation so cmdk doesn't intercept the event.
3. **Fixed action slot:** The `actionSlot` is rendered **outside** `CommandPrimitive.List` but still inside `Command`, keeping it pinned at the bottom regardless of how many items are in the list.

### Files using SearchableSelect

- `components/transaction-form.tsx` — Customer and item selection in transaction dialogs
- `modules/billing/create-invoice.tsx` — Customer and item selection in invoice creation

## Domain Components

### RequireShopGuard (`components/require-shop-guard.tsx`)

UI-level guard that blocks actions when no shop is selected. Wraps create buttons to show tooltips prompting shop creation/selection.

### Create/Edit Dialogs

Each entity has a dialog component for creation and editing:

| Component | Purpose |
|-----------|---------|
| `create-item-dialog.tsx` | Create new item (product or service) |
| `edit-item-dialog.tsx` | Edit existing item |
| `create-party-dialog.tsx` | Create new party |
| `edit-party-dialog.tsx` | Edit existing party |
| `create-shop-dialog.tsx` | Create new shop (with auto-switch option) |
| `item-preview-dialog.tsx` | View item details |

### Transaction Dialogs

| Component | Purpose |
|-----------|---------|
| `create-sale-dialog.tsx` | New sale transaction |
| `create-purchase-dialog.tsx` | New purchase transaction |
| `create-sale-return-dialog.tsx` | Sale return |
| `create-purchase-return-dialog.tsx` | Purchase return |
| `create-payment-in-dialog.tsx` | Receive payment |
| `create-payment-out-dialog.tsx` | Make payment |
| `stock-adjustment-dialog.tsx` | Adjust stock levels |

### TransactionForm (`components/transaction-form.tsx`)

The shared form component used by all transaction dialogs. Manages:
- Dynamic line items table (add/remove rows)
- Item search and selection
- Party selection
- Discounts (line-level and overall)
- Tax calculations
- Payment entry
- Form validation (Zod schema)

### Invoice Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `invoice-share-sheet.tsx` | `components/` | Shareable invoice view |
| `invoice-preview-modal.tsx` | `modules/billing/` | Invoice preview before sending |
| `invoice-pdf.tsx` | `modules/billing/` | PDF generation |

### Data Components

| Component | Purpose |
|-----------|---------|
| `data-table-toolbar.tsx` | Search, filter, and sort controls for tables |
| `onboarding-banner.tsx` | Prompt to create first shop |

## Common UI Patterns

### Dialog Pattern
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Create Item</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create Item</DialogTitle>
    </DialogHeader>
    <FormComponent onSubmit={handleSubmit}>
      {/* form fields */}
    </FormComponent>
  </DialogContent>
</Dialog>
```

### Data Table Pattern
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Price</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map(item => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.price}</TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Guard Pattern
```tsx
<RequireShopGuard>
  <Button onClick={openDialog}>
    Create New
  </Button>
</RequireShopGuard>