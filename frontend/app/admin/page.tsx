"use client";

import { useState, useEffect } from "react";
import { useWeb3ModalAccount } from "@web3modal/wagmi/react";
import {
  Shield,
  Users,
  Activity,
  DollarSign,
  FileText,
  AlertTriangle,
  Loader2,
  Search,
  ChevronDown,
} from "lucide-react";
import {
  getUsers,
  getComplianceLogs,
  getPlatformMetrics,
  updateUserRole,
  type User,
  type ComplianceLog,
  type PlatformMetrics,
} from "@/lib/api";

export default function AdminPage() {
  const { address, isConnected } = useWeb3ModalAccount();
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ComplianceLog[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "logs">("overview");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [userData, logData, metricData] = await Promise.all([
        getUsers(),
        getComplianceLogs(),
        getPlatformMetrics(),
      ]);
      setUsers(userData);
      setLogs(logData);
      setMetrics(metricData);
      const currentUser = userData.find((u) => u.wallet_address === address);
      setIsAdmin(currentUser?.is_admin || false);
    } catch {
      setError("Failed to load admin data. Ensure you have admin access.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleToggle = async (userId: number, makeAdmin: boolean) => {
    try {
      const updated = await updateUserRole(userId, makeAdmin);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch {
      console.error("Failed to update user role");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.wallet_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toString().includes(searchQuery),
  );

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <Shield className="w-12 h-12 text-surface-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-surface-300 mb-2">Connect Wallet</h2>
          <p className="text-surface-500">Connect your wallet to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-surface-200 mb-2">Access Denied</h2>
          <p className="text-surface-400 mb-6">{error}</p>
          <button onClick={loadAdminData} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <Shield className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-surface-200 mb-2">Admin Only</h2>
          <p className="text-surface-400">This dashboard is restricted to admin wallets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-surface-100">Admin Dashboard</h1>
            <p className="mt-1 text-surface-400">Manage users, view compliance logs, and monitor platform metrics.</p>
          </div>
          <button onClick={loadAdminData} className="btn-secondary text-sm">
            Refresh
          </button>
        </div>

        {metrics && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Users, label: "Active Users", value: metrics.total_users.toLocaleString(), color: "text-blue-400", bg: "bg-blue-500/10" },
              { icon: Shield, label: "Active Memberships", value: metrics.active_memberships.toLocaleString(), color: "text-purple-400", bg: "bg-purple-500/10" },
              { icon: DollarSign, label: "Monthly Revenue", value: `${metrics.monthly_revenue} ETH`, color: "text-green-400", bg: "bg-green-500/10" },
              { icon: Activity, label: "Verified Users", value: metrics.verified_users.toLocaleString(), color: "text-amber-400", bg: "bg-amber-500/10" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <span className="text-sm text-surface-400">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-surface-100">{stat.value}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="glass-card overflow-hidden">
          <div className="border-b border-surface-700">
            <div className="flex">
              {[
                { id: "overview" as const, label: "Overview", icon: Activity },
                { id: "users" as const, label: "Users", icon: Users },
                { id: "logs" as const, label: "Compliance Logs", icon: FileText },
              ].map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-all ${
                      activeTab === tab.id
                        ? "border-primary-500 text-primary-400 bg-primary-500/5"
                        : "border-transparent text-surface-400 hover:text-surface-300 hover:bg-surface-800"
                    }`}
                  >
                    <TabIcon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-surface-200 mb-4">Platform Health</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-surface-800/50">
                      <p className="text-sm text-surface-400">Total Content Items</p>
                      <p className="text-xl font-bold text-surface-100 mt-1">{metrics?.total_content_items || 0}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-800/50">
                      <p className="text-sm text-surface-400">Admins</p>
                      <p className="text-xl font-bold text-surface-100 mt-1">{users.filter((u) => u.is_admin).length}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-surface-200 mb-4">Recent Compliance Activity</h3>
                  {logs.length > 0 ? (
                    <div className="space-y-3">
                      {logs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-800/50">
                          <FileText className="w-4 h-4 text-surface-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-surface-300 font-medium">{log.action}</p>
                            <p className="text-xs text-surface-500 mt-0.5">{log.details}</p>
                          </div>
                          <span className="text-xs text-surface-500 shrink-0">{formatDate(log.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-surface-500">No compliance logs yet.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "users" && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input
                      type="text"
                      placeholder="Search by wallet address or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-field pl-10"
                    />
                  </div>
                  <span className="text-sm text-surface-500">{users.length} users</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-700">
                        <th className="text-left py-3 px-4 text-surface-400 font-medium">ID</th>
                        <th className="text-left py-3 px-4 text-surface-400 font-medium">Wallet</th>
                        <th className="text-left py-3 px-4 text-surface-400 font-medium">Verified</th>
                        <th className="text-left py-3 px-4 text-surface-400 font-medium">Admin</th>
                        <th className="text-left py-3 px-4 text-surface-400 font-medium">Created</th>
                        <th className="text-right py-3 px-4 text-surface-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-surface-500">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user.id} className="border-b border-surface-800 hover:bg-surface-800/50">
                            <td className="py-3 px-4 text-surface-300">{user.id}</td>
                            <td className="py-3 px-4 font-mono text-xs text-surface-300">{formatAddress(user.wallet_address)}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                user.is_verified ? "bg-green-500/10 text-green-400" : "bg-surface-800 text-surface-500"
                              }`}>
                                {user.is_verified ? "Verified" : "Unverified"}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                user.is_admin ? "bg-purple-500/10 text-purple-400" : "bg-surface-800 text-surface-500"
                              }`}>
                                {user.is_admin ? "Admin" : "User"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-surface-500">{formatDate(user.created_at)}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleRoleToggle(user.id, !user.is_admin)}
                                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                                  user.is_admin
                                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                    : "bg-primary-500/10 text-primary-400 hover:bg-primary-500/20"
                                }`}
                              >
                                {user.is_admin ? "Revoke Admin" : "Make Admin"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "logs" && (
              <div>
                {logs.length === 0 ? (
                  <p className="text-sm text-surface-500 py-8 text-center">No compliance logs recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface-700">
                          <th className="text-left py-3 px-4 text-surface-400 font-medium">ID</th>
                          <th className="text-left py-3 px-4 text-surface-400 font-medium">User ID</th>
                          <th className="text-left py-3 px-4 text-surface-400 font-medium">Action</th>
                          <th className="text-left py-3 px-4 text-surface-400 font-medium">Details</th>
                          <th className="text-right py-3 px-4 text-surface-400 font-medium">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} className="border-b border-surface-800 hover:bg-surface-800/50">
                            <td className="py-3 px-4 text-surface-300">{log.id}</td>
                            <td className="py-3 px-4 text-surface-300">{log.user_id}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 text-xs">
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-surface-400 max-w-xs truncate">{log.details}</td>
                            <td className="py-3 px-4 text-right text-surface-500">{formatDate(log.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
