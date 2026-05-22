import { requireSuperOwner } from '@/lib/auth';

export default async function SuperDeveloperDashboardPage() {
  await requireSuperOwner();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Developer Dashboard 🔧</h1>
        <p className="mt-1 text-sm text-gray-500">System utilities and diagnostics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer">
          <div className="h-12 w-12 rounded-xl bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white mb-4">
            📊
          </div>
          <h3 className="font-semibold text-gray-900">Database Explorer</h3>
          <p className="text-sm text-gray-500 mt-1">Browse collections and run queries</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer">
          <div className="h-12 w-12 rounded-xl bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white mb-4">
            📝
          </div>
          <h3 className="font-semibold text-gray-900">API Tester</h3>
          <p className="text-sm text-gray-500 mt-1">Test all API endpoints directly</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer">
          <div className="h-12 w-12 rounded-xl bg-linear-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white mb-4">
            📜
          </div>
          <h3 className="font-semibold text-gray-900">Log Viewer</h3>
          <p className="text-sm text-gray-500 mt-1">Real time application logs</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer">
          <div className="h-12 w-12 rounded-xl bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white mb-4">
            ⚡
          </div>
          <h3 className="font-semibold text-gray-900">Queue Monitor</h3>
          <p className="text-sm text-gray-500 mt-1">Background jobs and tasks</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">System Status</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">Database Connection</span>
            <span className="inline-flex items-center text-sm font-medium text-green-600">
              ✅ Connected
            </span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">Application Server</span>
            <span className="inline-flex items-center text-sm font-medium text-green-600">
              ✅ Healthy
            </span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">Authentication System</span>
            <span className="inline-flex items-center text-sm font-medium text-green-600">
              ✅ Operational
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-gray-600">Next.js Build</span>
            <span className="inline-flex items-center text-sm font-medium text-green-600">
              ✅ Development Mode
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}