'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

interface DashboardUserMenuProps {
  name: string;
  role: string;
}

export default function DashboardUserMenu({
  name,
  role,
}: DashboardUserMenuProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOut({
        callbackUrl: '/signin',
      });
    } catch {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-semibold text-gray-900">{name}</p>
        <p className="text-xs uppercase tracking-wide text-gray-500">{role}</p>
      </div>

      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-700">
        {name.slice(0, 1).toUpperCase()}
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSigningOut ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  );
}
