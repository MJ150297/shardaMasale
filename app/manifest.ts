import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GSMS - Shop Management",
    short_name: "GSMS",
    description: "Generic Shop Management System",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "any",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Create Sale",
        short_name: "Sale",
        url: "/dashboard/transactions",
        description: "Record a new sale transaction",
      },
      {
        name: "View Inventory",
        short_name: "Items",
        url: "/dashboard/items",
        description: "View and manage inventory",
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        url: "/dashboard",
        description: "View your shop dashboard",
      },
    ],
    screenshots: [
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        form_factor: "wide",
        label: "GSMS Dashboard on desktop",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        form_factor: "narrow",
        label: "GSMS on mobile",
      },
    ],
  };
}
