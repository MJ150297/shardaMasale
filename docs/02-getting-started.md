# Getting Started

## Prerequisites

- **Node.js** >= 20.x
- **MongoDB** >= 6.0 (local instance or MongoDB Atlas)
- **npm** or **yarn**

## Installation

```bash
# Clone the repository
git clone https://github.com/MJ150296/gsms_next.git
cd gsms_next

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
```

## Environment Variables

Edit `.env.local` with your values:

```env
# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/gsms_next

# Optional: specify database name (defaults to URI path)
MONGODB_DB=gsms_next

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-secret-key-here

# NextAuth URL (for production, set to your domain)
NEXTAUTH_URL=http://localhost:3000
```

## Development Server

```bash
# Start in development mode
npm run dev

# The app will be available at http://localhost:3000
```

## Seeding the Database

The project includes seed scripts for initial setup:

### Seed a Super Owner

```bash
npm run seed:super-owner
```

This creates a super owner account with platform admin privileges.

### Seed an Owner Account

```bash
npm run seed:owner
```

This creates an owner account with associated shops and demo data.

### Backfill Invoice IDs

```bash
npm run backfill:invoice-ids
```

Migrates existing transactions without invoice references.

## Quick Start Flow

1. **Run seed scripts** to create initial users
2. **Sign in** at `/signin` with the seeded credentials
3. **Accept invitation** (if invited) or your account is ready
4. **Create a shop** via the dashboard settings
5. **Add items** (products/services with pricing and inventory)
6. **Add parties** (customers and suppliers)
7. **Create transactions** (sales, purchases, payments)

## Default Credentials

Check the seed scripts at `scripts/seed-super-owner.ts` and `scripts/seed-owner.ts` for the default email/password combinations.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run seed:owner` | Seed an owner account with demo data |
| `npm run seed:super-owner` | Seed a super owner account |
| `npm run backfill:invoice-ids` | Backfill invoice IDs for existing transactions |

## Project Initialization Details

The application uses:
- **Next.js 16.2.3** with App Router
- **React 19.2.4**
- **TypeScript 5.9.3**
- **Mongoose 9.4.1** for MongoDB ODM
- **NextAuth 4.24.13** for authentication
- **Tailwind CSS 4** for styling
- **shadcn/ui** for component library
- **ESLint 9** for linting
- **Prettier** for formatting