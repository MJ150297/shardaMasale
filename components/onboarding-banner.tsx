'use client';

import { useState } from 'react';
import { Store, Rocket, X } from 'lucide-react';
import CreateShopDialog from '@/components/create-shop-dialog';

export default function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-950/40 dark:via-gray-900 dark:to-indigo-950/40 dark:border-blue-900/50">
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-full text-blue-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-6">
        {/* Icon */}
        <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-100 dark:bg-blue-900/50">
          <Rocket className="size-6 sm:size-8 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Welcome to GSMS!
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Get started by creating your first shop. A shop represents your business location where you can manage inventory, sales, purchases, and more.
          </p>
          <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <Store className="size-3" /> Create a shop
            </span>
            <span className="flex items-center gap-1">
              → Add items & parties
            </span>
            <span className="flex items-center gap-1">
              → Start selling
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex-shrink-0 self-stretch sm:self-center flex items-center">
          <CreateShopDialog
            autoSwitch={true}
            trigger={
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all duration-200 active:scale-[0.97]">
                <Store className="size-4" />
                Create Your First Shop
              </button>
            }
          />
        </div>
      </div>
    </div>
  );
}