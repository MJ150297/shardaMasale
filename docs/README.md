# GSMS Next — Documentation

**Generic Shop Management System (GSMS)** — a multi-tenant, Next.js 16 application for managing shops, items, parties, transactions, inventory, invoices, share-message templates, and reports.

## Table of Contents

| # | Document | Description |
|---|----------|-------------|
| 01 | [Architecture Overview](./01-architecture-overview.md) | High-level system design, stack, roles, data flow |
| 02 | [Getting Started](./02-getting-started.md) | Setup, environment variables, running locally |
| 03 | [Project Structure](./03-project-structure.md) | Folder-by-folder breakdown of the codebase |
| 04 | [Auth System](./04-auth-system.md) | NextAuth config, role hierarchy, route guards, login lockout |
| 05 | [Multi-Tenant Shops](./05-multi-tenant-shops.md) | Shop scoping, global middleware, JWT, ShopProvider, RequireShopGuard |
| 06 | [Models & Schema](./06-models-schema.md) | All 7 Mongoose models with fields, indexes, hooks, relationships |
| 07 | [API Routes](./07-api-routes.md) | All REST endpoints organized by resource |
| 08 | [Transactions & Billing](./08-transactions-and-billing.md) | Transaction types, lifecycle, line items, summaries, invoice generation, settlements |
| 09 | [Inventory Management](./09-inventory-management.md) | Stock movements, reservations, adjustments, reorder levels |
| 10 | [UI Components](./10-ui-components.md) | Key components: dialogs, guards, data tables, layout shell |
| 11 | [Client Pages](./11-client-pages.md) | Dashboard pages by route group (items, parties, transactions, invoices) |
| 12 | [Reports](./12-reports.md) | Profit/Loss, stock, transaction reports — filters, export |
| 13 | [Customer Portal](./13-customer-portal.md) | Customer-facing route group and UI |
| 14 | [Super Owner Panel](./14-super-owner-panel.md) | Super admin features for managing owners, shops, settings |
| 15 | [Background Jobs](./15-background-jobs.md) | Cron workers for overdue invoices and stock checks |
| 16 | [Deployment](./16-deployment.md) | Build, deploy, environment configuration |
| 17 | [API Reference](./17-api-reference.md) | Detailed endpoint reference (method, path, body, response, errors) |
| 18 | [Extending the System](./18-extending-the-system.md) | Guide for adding new models, routes, and pages |
| 19 | [Glossary](./19-glossary.md) | Key terms and definitions |
| 20 | [Notification Service Roadmap](./20-notification-service-roadmap.md) | Notification service planning and roadmap |
| 21 | [Notification Ticket List](./21-notification-ticket-list.md) | Notification ticket tracking |
| 22 | [Subscription](./22-subscription.md) | Subscription plans, credits, and limits |
| 23 | [PWA](./23-pwa.md) | Progressive Web App: manifest, service worker, caching, offline, installation |

---

**Tech Stack:** Next.js 16, React 19, TypeScript, MongoDB (Mongoose 9), NextAuth 4, Tailwind CSS 4, shadcn/ui, TanStack React Query, Zod, Sonner, Recharts
