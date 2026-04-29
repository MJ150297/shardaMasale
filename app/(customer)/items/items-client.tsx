'use client';

import { useState } from 'react';
import type { IItem } from '@/models/Item';

interface ItemsBrowseClientProps {
  items: (IItem & { _id: string })[];
}

export default function ItemsBrowseClient({ items }: ItemsBrowseClientProps) {
  const [cart, setCart] = useState<Record<string, number>>({});

  const addToCart = (itemId: string) => {
    setCart(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1
    }));
    alert('Item added to cart!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Browse Items</h1>
        <p className="text-gray-500 mt-1">All available products and services</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-4xl mb-2">📦</div>
          <p className="font-medium text-gray-900">No items available yet</p>
          <p className="text-sm text-gray-500 mt-1">Check back soon for new products</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item._id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gray-100 rounded-md mb-3 flex items-center justify-center text-4xl">
                📦
              </div>
              <h3 className="font-medium text-gray-900">{item.name}</h3>
              {item.category && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">
                  {item.category}
                </span>
              )}
              {item.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{item.description}</p>
              )}
              <div className="flex justify-between items-center mt-4">
                <span className="text-lg font-bold text-gray-900">₹{item.pricing.sellingPrice.toFixed(2)}</span>
                <button 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium"
                  onClick={() => addToCart(item._id)}
                >
                  Add {cart[item._id] ? `(${cart[item._id]})` : ''}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}