'use client';

import type { IItem } from '@/models/Item';

interface CustomerDashboardClientProps {
  items: (IItem & { _id: string })[];
  userName: string;
}

export default function CustomerDashboardClient({ items, userName }: CustomerDashboardClientProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {userName}!</h1>
        <p className="text-gray-500 mt-1">Browse our products and place your orders</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Featured Items</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item._id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gray-100 rounded-md mb-3 flex items-center justify-center text-4xl">
                📦
              </div>
              <h3 className="font-medium text-gray-900">{item.name}</h3>
              {item.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
              )}
              <div className="flex justify-between items-center mt-3">
                <span className="text-lg font-bold text-gray-900">₹{item.pricing.sellingPrice.toFixed(2)}</span>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm font-medium">
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="text-4xl mb-2">📦</div>
            <p className="font-medium text-gray-900">No items available yet</p>
            <p className="text-sm text-gray-500 mt-1">Check back soon for new products</p>
          </div>
        )}
      </div>
    </div>
  );
}