import { ReactNode } from 'react';
import Link from 'next/link';
import { requireCustomer } from '@/lib/auth';

interface CustomerLayoutProps {
  children: ReactNode;
}

const customerNavigation = [
  { href: '/customer', label: 'Dashboard', icon: '🏠' },
  { href: '/customer/items', label: 'Browse Items', icon: '📦' },
  { href: '/customer/cart', label: 'Cart', icon: '🛒' },
  { href: '/customer/orders', label: 'My Orders', icon: '📋' },
  { href: '/customer/profile', label: 'Profile', icon: '👤' },
] as const;

export default async function CustomerLayout({ children }: CustomerLayoutProps) {
  const user = await requireCustomer();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
          <div className="flex flex-col grow bg-white border-r border-gray-200 pt-5 pb-4">
            <div className="flex items-center shrink-0 px-4 mb-5">
              <h1 className="text-xl font-bold text-gray-900">Customer Portal</h1>
            </div>
            
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {customerNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-gray-600 hover:bg-gray-50 hover:text-gray-900 group flex items-center px-2 py-2 text-sm font-medium rounded-md"
                >
                  {item.icon} {item.label}
                </Link>
              ))}
              
              <Link
                href="/api/auth/signout"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 group flex items-center px-2 py-2 text-sm font-medium rounded-md mt-8"
              >
                🚪 Logout
              </Link>
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-64 flex flex-col flex-1">
          <header className="bg-white shadow-sm sticky top-0 z-10">
            <div className="flex justify-between h-16 px-4 items-center">
              <h2 className="lg:hidden text-lg font-semibold text-gray-900">Customer Portal</h2>
              <div className="ml-auto">
                <span className="text-sm text-gray-600">Welcome, {user.name}</span>
              </div>
            </div>
          </header>
          
          <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}