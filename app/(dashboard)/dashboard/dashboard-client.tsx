'use client';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  Package, Users, Receipt, 
  ArrowUpRight, ArrowDownRight, Clock, DollarSign
} from 'lucide-react';
import { useTheme } from 'next-themes';

const salesData = [
  { name: 'Jan', sales: 4000, orders: 240 },
  { name: 'Feb', sales: 3000, orders: 198 },
  { name: 'Mar', sales: 5000, orders: 300 },
  { name: 'Apr', sales: 2780, orders: 189 },
  { name: 'May', sales: 4890, orders: 278 },
  { name: 'Jun', sales: 5390, orders: 349 },
];

interface LowStockItem {
  _id: string;
  name: string;
  sku?: string | null;
  stock: {
    currentQuantity: number;
    reorderLevel: number;
  };
}

interface DashboardClientProps {
  userName: string;
  stats: {
    totalItems: number;
    lowStockCount: number;
    todayTransactions: number;
    todayRevenue: number;
  };
  lowStockItems: LowStockItem[];
}

const recentOrders = [
  { id: '#INV-001', customer: 'Acme Corp', amount: '₹ 12,450', status: 'Completed', time: '5 min ago' },
  { id: '#INV-002', customer: 'Global Tech', amount: '₹ 8,920', status: 'Pending', time: '12 min ago' },
  { id: '#INV-003', customer: 'Prime Suppliers', amount: '₹ 15,670', status: 'Processing', time: '25 min ago' },
  { id: '#INV-004', customer: 'Metro Industries', amount: '₹ 6,230', status: 'Completed', time: '1 hour ago' },
];

export default function DashboardClient({ userName, stats, lowStockItems }: DashboardClientProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const statsCards = [
    {
      title: 'Today Revenue',
      value: `₹ ${stats.todayRevenue.toLocaleString('en-IN')}`,
      change: 'Today',
      positive: true,
      icon: <DollarSign className="h-6 w-6" />,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Today Transactions',
      value: stats.todayTransactions.toString(),
      change: 'Today',
      positive: true,
      icon: <Receipt className="h-6 w-6" />,
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockCount.toString(),
      change: stats.lowStockCount > 0 ? 'Attention' : 'Good',
      positive: stats.lowStockCount === 0,
      icon: <Package className="h-6 w-6" />,
      gradient: stats.lowStockCount > 0 ? 'from-red-500 to-orange-500' : 'from-emerald-500 to-green-500',
    },
    {
      title: 'Total Items',
      value: stats.totalItems.toString(),
      change: 'Active',
      positive: true,
      icon: <Package className="h-6 w-6" />,
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Good Morning, {userName} 👋</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Here's what's happening with your business today
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">Last updated: Just now</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white`}>
                  {stat.icon}
                </div>
                <span className={`inline-flex items-center text-xs font-medium ${stat.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {stat.positive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                  {stat.change}
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Sales Overview</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly sales performance</p>
            </div>
          </div>
          <div className="h-72 w-full min-w-[300px]">
            <ResponsiveContainer width="100%" height={280} minWidth={300}>
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f0f0f0'} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#1f2937' : '#fff', 
                    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, 
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Orders Trend</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last 6 months</p>
            </div>
          </div>
          <div className="h-72 w-full min-w-[200px]">
            <ResponsiveContainer width="100%" height={280} minWidth={200}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f0f0f0'} vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#1f2937' : '#fff', 
                    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, 
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="orders" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-red-200 dark:border-red-900/50 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-red-50 dark:bg-red-950/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Low Stock Alert
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} below reorder level
                </p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {lowStockItems.map((item) => (
              <div key={item._id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                    {item.sku && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.sku}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {item.stock.currentQuantity} / {item.stock.reorderLevel}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Current / Minimum</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Latest 4 orders</p>
            </div>
            <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              View all
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {recentOrders.map((order, index) => (
            <div key={index} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{order.id} - {order.customer}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {order.time}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.amount}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    order.status === 'Completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    order.status === 'Pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}