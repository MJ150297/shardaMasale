# Glossary

## Terms & Definitions

| Term | Definition |
|------|------------|
| **Owner** | Business owner who creates and manages shops. Has the `owner` role. |
| **Shop** | A tenant/business entity within the system. All data is scoped to a shop. |
| **Item** | A product or service that can be sold or purchased. |
| **Party** | A customer, supplier, or both — who transactions are made with. |
| **Transaction** | A financial record representing a sale, purchase, payment, or adjustment. |
| **Line Item** | An individual product/service entry within a transaction (quantity, price, etc.). |
| **Invoice** | A billable document generated from a confirmed sale transaction. |
| **Stock Movement** | A record of inventory change (IN or OUT) with audit trail. |
| **Settlement** | Allocation of a payment across multiple invoices. |
| **COGS** | Cost of Goods Sold — the total cost of inventory sold during a period. |
| **Draft** | An editable, unconfirmed transaction that doesn't affect inventory or balances. |
| **Confirmed** | A finalized transaction that updates inventory and party balances. |
| **Cancelled** | A voided transaction that reverses any previous effects. |
| **Active Shop** | The currently selected shop in the user's session. All operations are scoped to it. |
| **Super Owner** | Platform-level administrator who can manage all owners and shops. |
| **Customer** | An end-user role with limited, read-only access to shop items. |
| **RequireShopGuard** | A UI component that blocks actions when no shop is selected. |
| **Mongoose Global Plugin** | A plugin that automatically scopes all database queries by the user's active shop. |