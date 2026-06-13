# Progressive Web App (PWA)

## Overview

GSMS is a fully installable Progressive Web App, allowing shop owners to add it to their phone's home screen or desktop for a native app-like experience. The PWA provides offline caching, fast page loads, and proper mobile viewport handling — essential for shops with unreliable internet connections.

---

## Architecture

```
app/
├── manifest.ts                  # Web App Manifest (auto-served as /manifest.json)
├── apple-icon.png               # Apple Touch Icon (180×180)
├── layout.tsx                   # Viewport export, Apple Web App meta, SW registration
components/
├── providers/
│   └── sw-register.tsx          # Client-side service worker registration
public/
├── sw.js                        # Service worker with caching strategies
├── offline.html                 # Offline fallback page
├── icon-192.png                 # Android icon (192×192)
├── icon-512.png                 # Android icon + splash (512×512)
└── logo.png                     # App logo
```

---

## Web App Manifest

**File:** `app/manifest.ts`

The manifest is generated using Next.js `MetadataRoute.Manifest` and auto-served at `/manifest.json`.

### Configuration

| Field | Value | Purpose |
|-------|-------|---------|
| `name` | `"GSMS - Shop Management"` | Full name shown on install prompts |
| `short_name` | `"GSMS"` | Label on home screen icon |
| `id` | `"/"` | Unique app identity for update detection |
| `start_url` | `"/"` | Entry point when launched from home screen |
| `scope` | `"/"` | Navigation scope — app can't navigate outside |
| `display` | `"standalone"` | Runs without browser chrome (no URL bar) |
| `display_override` | `["window-controls-overlay", "standalone"]` | Prefers desktop window controls when available |
| `background_color` | `"#ffffff"` | Splash screen background |
| `theme_color` | `"#000000"` | Browser chrome / status bar color |
| `orientation` | `"any"` | Works in both portrait and landscape |
| `categories` | `["business", "finance", "productivity"]` | App store categorization |

### Icons

| Icon | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192×192 | Android home screen icon |
| `icon-512.png` (purpose: `any`) | 512×512 | Android splash screen + PWA install criteria |
| `icon-512.png` (purpose: `maskable`) | 512×512 | Android adaptive icon (safe zone for circle/squircle crops) |
| `apple-icon.png` | 180×180 | iOS home screen icon (served by Next.js App Router convention) |

### Shortcuts

Home screen long-press provides quick actions:

| Shortcut | URL | Description |
|----------|-----|-------------|
| Create Sale | `/dashboard/transactions` | Jump directly to recording a sale |
| View Inventory | `/dashboard/items` | Check stock levels |
| Dashboard | `/dashboard` | Overview of shop performance |

### Screenshots

Used in the install prompt on Android and desktop:

| Screenshot | Form Factor | Description |
|-----------|-------------|-------------|
| `icon-512.png` | `wide` (16:9) | Desktop install prompt preview |
| `icon-512.png` | `narrow` (9:16) | Mobile install prompt preview |

---

## Service Worker

**File:** `public/sw.js`

A custom service worker with **five caching strategies**, each tailored to the type of request.

### Caching Strategies

```
┌─────────────────────────────────────────────────────┐
│                    REQUEST TYPE                      │
├──────────────┬──────────────────────────────────────┤
│ /api/*       │  Network-Only (never cache)          │
│ _next/static │  Cache-First (cache, then network)   │
│ Images/Fonts │  Cache-First (cache, then network)   │
│ Navigation   │  Stale-While-Revalidate              │
│ Everything   │  Stale-While-Revalidate              │
└──────────────┴──────────────────────────────────────┘
```

#### 1. API Requests → Network-Only

```
Request → Always fetch from server → Return JSON response
         If offline → Return 503 { "error": "Offline" }
```

**Why:** Financial data (balances, stock, invoices) must never be stale. Caching would show incorrect party balances or inventory counts.

#### 2. Static Assets (`_next/static/`) → Cache-First

```
Request → Check cache
           ├─ Hit  → Return cached file (instant)
           └─ Miss → Fetch from network → Cache → Return
```

**Why:** Next.js uses content-hashed filenames (e.g., `chunk.abc123.js`). A file with hash `abc123` will never change — if code updates, the hash changes to a new filename. Caching is 100% safe and gives near-instant loads on repeat visits.

#### 3. Images & Fonts → Cache-First

```
Request → Check cache
           ├─ Hit  → Return cached file (instant)
           └─ Miss → Fetch from network → Cache → Return
```

**Why:** Icons (lucide-react SVGs), shop logos, and product images are expensive to re-download on slow mobile connections and rarely change.

#### 4. Navigation (Page Loads) → Stale-While-Revalidate

```
Request → Check cache
           ├─ Hit  → Return cached page IMMEDIATELY
           │         → Fetch fresh version in background → Update cache
           └─ Miss → Fetch from network → Cache → Return
                     If offline → Return cached page (fallback)
```

**Why:** Shows content instantly (no white screen on 3G) while still eventually refreshing with fresh data. Best balance of speed and freshness for a shop management UI.

#### 5. Everything Else → Stale-While-Revalidate

Same as navigation — covers CSS, dynamically loaded JS chunks, etc.

### Cache Namespaces

| Cache Name | Contents | Lifetime |
|-----------|----------|----------|
| `gsms-static-v1` | Precached app shell + static assets + images | Versioned — old caches cleaned on SW activate |
| `gsms-dynamic-v1` | Navigation pages + dynamic content | Versioned — old caches cleaned on SW activate |

### Precache (Install Time)

On first visit, the service worker immediately caches:

```
/                    ← App shell
/icon-192.png        ← Home screen icon
/icon-512.png        ← Splash screen icon
```

This ensures the app shell is available offline after the very first load.

---

## Offline Behavior

### What Works Offline

| Feature | Status | Notes |
|---------|--------|-------|
| App shell (layout, sidebar, navigation) | ✅ Cached | From stale-while-revalidate |
| Last-viewed pages | ✅ Cached | From navigation cache |
| Static assets (JS, CSS, images) | ✅ Cached | From cache-first strategy |
| Offline fallback page | ✅ Available | Shown when no cached page exists |

### What Doesn't Work Offline

| Feature | Status | Reason |
|---------|--------|--------|
| Creating transactions | ❌ | API calls require network |
| Loading party balances | ❌ | Real-time financial data |
| Inventory updates | ❌ | Server-side data |
| Authentication | ❌ | Auth tokens not cached |
| Report generation | ❌ | Requires server computation |

**Design decision:** Offline API calls return a `503 JSON response` instead of failing silently. The app can detect this and show an "Offline — data may be outdated" message rather than displaying incorrect data.

### Offline Fallback Page

**File:** `public/offline.html`

A clean, branded page shown when:
1. User navigates to a URL that isn't in the cache
2. Network is unavailable
3. No cached version exists

Features: offline icon, "You're Offline" message, explanation text, retry button.

---

## Viewport & Meta Tags

**File:** `app/layout.tsx`

### Viewport Export

```ts
export const viewport: Viewport = {
  width: "device-width",      // Responsive to device width
  initialScale: 1,            // No zoom on load
  maximumScale: 1,            // Prevent pinch-to-zoom (app-like)
  viewportFit: "cover",       // Extend into notch/safe area on modern phones
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};
```

### Apple Web App

```ts
export const metadata: Metadata = {
  appleWebApp: {
    capable: true,                    // Allow "Add to Home Screen"
    statusBarStyle: "black-translucent", // Translucent status bar
    title: "GSMS",                    // Home screen label
  },
};
```

### Theme Color

Adaptive theme color responds to system dark/light mode:
- **Light mode:** White status bar (`#ffffff`)
- **Dark mode:** Black status bar (`#000000`)

---

## Installation Guide

### Android (Chrome)

1. Open `https://your-domain.com` in Chrome
2. Tap **"Add to Home Screen"** banner or ⋮ menu → **"Install app"**
3. Confirm installation
4. App appears on home screen with GSMS icon

### iOS (Safari)

1. Open `https://your-domain.com` in Safari
2. Tap the **Share** button (square with arrow)
3. Scroll down → **"Add to Home Screen"**
4. Confirm — app appears on home screen

**Note:** iOS PWAs have some limitations: no push notifications, limited offline storage, no background sync.

### Desktop (Chrome/Edge)

1. Open `https://your-domain.com`
2. Click the **install icon** in the address bar ( ⊕ )
3. Confirm installation
4. App opens in its own window without browser chrome

---

## Cache Management

### Updating the Service Worker

When you modify `public/sw.js`:

1. Browser detects the file has changed (new byte content)
2. New SW installs and caches precache URLs
3. On next page navigation, old SW is replaced
4. `activate` handler deletes old versioned caches
5. All open tabs are claimed by the new SW

### Bumping Cache Versions

If you need to force-invalidate all caches (e.g., after a major deployment):

```js
// In public/sw.js — change the version numbers:
const STATIC_CACHE = "gsms-static-v2";  // Was v1
const DYNAMIC_CACHE = "gsms-dynamic-v2"; // Was v1
```

The old `v1` caches are automatically cleaned up in the `activate` handler.

### Forcing Update (Client-Side)

The `sw-register.tsx` component listens for `updatefound` events. When a new SW is detected:

```js
newWorker.addEventListener("statechange", () => {
  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
    console.log("New SW content available");
    // Could show a "New version available — refresh?" toast
  }
});
```

---

## Known Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| No API caching | All data requires network | App shows "Offline" message |
| No push notifications | Can't alert users of updates | Use in-app notification system |
| iOS limited storage | ~50MB cache limit | Only caches essential assets |
| No background sync | Can't queue actions offline | Transactions require network |
| Auth not cached | Must re-authenticate after expiry | Session tokens handled by NextAuth |

---

## Testing the PWA

### Lighthouse Audit

Run a Lighthouse PWA audit to verify all criteria are met:

```bash
# In Chrome DevTools → Lighthouse tab
# Select "Progressive Web App" category
# Run audit
```

Expected results:
- ✅ Web app manifest meets installability requirements
- ✅ Service worker controls the page
- ✅ Has a registered service worker
- ✅ Current page responds with 200 when offline (if cached)
- ✅ Installable — manifest has valid icons, name, and display mode
- ✅ Uses HTTPS (required for service workers)

### Manual Testing

1. **Install test:** Open on Android/iOS → verify install prompt appears
2. **Offline test:** Enable airplane mode → open app → verify cached pages load
3. **Cache test:** Open DevTools → Application → Storage → verify caches exist
4. **Update test:** Modify `sw.js` → reload → verify old cache is cleaned