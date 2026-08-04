# Deployment

## Overview

Sharda Masale is a Next.js 16 application that can be deployed to various hosting platforms. This document covers environment configuration, build process, and deployment considerations.

## Environment Variables

The following environment variables must be configured for production:

```env
# MongoDB (required)
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/gsms_next

# MongoDB database name (optional, defaults to URI path)
MONGODB_DB=gsms_next

# NextAuth (required)
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://your-domain.com

# Node environment (optional)
NODE_ENV=production
```

## Build

```bash
# Standard Next.js build
npm run build

# The output is in the .next/ directory
# Static assets are in the out/ directory if using static export
```

## Deployment Platforms

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy — Vercel auto-detects Next.js configuration
4. Set `NEXTAUTH_URL` to your Vercel domain

**Note**: Background workers (`node-cron`) won't run on Vercel's serverless functions. Use Vercel Cron Jobs or an external cron service for production invoice/stock checks.

### Traditional Server (Node.js)

```bash
# Build
npm run build

# Start production server
npm run start

# The server runs on port 3000 by default
# Set PORT env var to change: PORT=8080 npm run start
```

With a process manager (PM2):

```bash
npm install -g pm2
pm2 start npm --name "gsms" -- start
pm2 save
pm2 startup
```

### Docker

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

Note: For Docker, set `output: 'standalone'` in `next.config.ts`.

## Production Considerations

### Database
- Use **MongoDB Atlas** or a managed MongoDB service
- Configure network access (IP whitelist or VPC peering)
- Enable backup schedules
- Consider a replica set for high availability

### Authentication
- Generate a strong `NEXTAUTH_SECRET`
- Set `NEXTAUTH_URL` to your production domain
- Configure session timeouts appropriately (default: 8 hours)

### Background Workers
- On traditional servers: Workers auto-start with `npm run start`
- On serverless: Use external cron (Vercel Cron, AWS CloudWatch, GitHub Actions)
- Worker schedules:
  - Invoice overdue check: Daily at 10 AM
  - Stock check: Every hour

### Performance
- MongoDB indexes are defined in each model — ensure they're created in production
- The global Mongoose plugin adds query overhead; monitor query performance
- Connection pooling is configured (max 20 connections)
- JWT session `updateAge` of 15 minutes reduces DB reads

### Monitoring
- Monitor MongoDB connection status
- Set up error logging (console logs are used throughout)
- Track API response times for slow queries

## Scaling

| Component | Strategy |
|-----------|----------|
| Next.js app | Horizontal scaling with load balancer |
| MongoDB | Replica set → sharding |
| Sessions | JWT-based (no session store needed) |
| File uploads | Currently not used; add S3/CDN if needed |

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is a strong, random value
- [ ] `MONGODB_URI` has strong credentials
- [ ] HTTPS is enforced (Vercel handles this automatically)
- [ ] Login lockout is configured (default: 5 attempts)
- [ ] Password hashing uses bcrypt
- [ ] API routes are properly guarded with role checks
- [ ] Shop-scoping middleware prevents cross-shop data access
- [ ] Rate limiting is considered for auth endpoints