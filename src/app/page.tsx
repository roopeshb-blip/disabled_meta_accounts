"use client";

import { useEffect, useState, useCallback } from "react";

interface AccountRecord {
  seller_id: string;
  seller_name: string;
  ad_account_id: string;
  ad_account_type: string;
  account_status: number;
  account_status_label: string;
  disable_reason: number | null;
  disable_reason_label: string | null;
  bm_id: string | null;
  bm_name: string | null;
  bm_status: string | null;
  gc_name: string | null;
  gc_id: string | null;
  gm_name: string | null;
  gm_id: string | null;
  last_checked_at: string;
  previous_status: number | null;
  status_changed_at: string | null;
}

type FilterType = "all" | "disabled" | "under_review" | "active" | "reactivated";

const STATUS_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-red-100 text-red-800",
  7: "bg-yellow-100 text-yellow-800",
  9: "bg-orange-100 text-orange-800",
  100: "bg-yellow-100 text-yellow-800",
  101: "bg-gray-100 text-gray-800",
  [-1]: "bg-gray-100 text-gray-500",
};

const ACCOUNT_STATUS_MAP: Record<number, string> = {
  1: "Active",
  2: "Disabled",
  3: "Unsettled",
  7: "Pending Review",
  9: "In Grace Period",
  100: "Pending Risk Review",
  101: "Temporarily Unavailable",
  [-1]: "Error",
};

export default function Home() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [gmFilter, setGmFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (search) params.set("search", search);
      if (gmFilter) params.set("gm", gmFilter);

      const res = await fetch(`/api/accounts?${params.toString()}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setAccounts([]);
      } else {
        setAccounts(data.accounts || []);
        setTotal(data.total || 0);
        if (data.accounts?.length > 0) {
          setLastChecked(data.accounts[0].last_checked_at);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [filter, search, gmFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => fetchAccounts(), 300);
    return () => clearTimeout(debounce);
  }, [fetchAccounts]);

  const triggerCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/trigger-check", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        alert(`Trigger failed: ${data.error}`);
      } else {
        alert(data.message || "Check triggered — results will appear in 2-5 minutes");
        // Auto-refresh after 3 minutes
        setTimeout(() => fetchAccounts(), 180000);
      }
    } catch (err) {
      alert(`Trigger failed: ${err}`);
    } finally {
      setChecking(false);
    }
  };

  // Summary counts
  const disabledCount = accounts.filter((a) => a.account_status === 2).length;
  const reviewCount = accounts.filter((a) => [7, 9, 100].includes(a.account_status)).length;
  const activeCount = accounts.filter((a) => a.account_status === 1).length;
  const reactivatedCount = accounts.filter(
    (a) => a.account_status === 1 && a.previous_status != null && [2, 7, 9, 100].includes(a.previous_status)
  ).length;

  // Unique GMs for filter dropdown
  const uniqueGMs = Array.from(
    new Set(accounts.map((a) => a.gm_name || a.gc_name || "Unassigned").filter(Boolean))
  ).sort();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meta Ad Account Monitor</h1>
            <p className="text-sm text-gray-500 mt-1">
              Tracking {total} ad accounts across hit sellers
              {lastChecked && (
                <span> | Last checked: {new Date(lastChecked).toLocaleString()}</span>
              )}
            </p>
          </div>
          <button
            onClick={triggerCheck}
            disabled={checking}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {checking ? "Checking..." : "Run Check Now"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <SummaryCard
            label="Total"
            count={total}
            color="bg-blue-50 text-blue-700 border-blue-200"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <SummaryCard
            label="Disabled"
            count={disabledCount}
            color="bg-red-50 text-red-700 border-red-200"
            active={filter === "disabled"}
            onClick={() => setFilter("disabled")}
          />
          <SummaryCard
            label="Under Review"
            count={reviewCount}
            color="bg-yellow-50 text-yellow-700 border-yellow-200"
            active={filter === "under_review"}
            onClick={() => setFilter("under_review")}
          />
          <SummaryCard
            label="Active"
            count={activeCount}
            color="bg-green-50 text-green-700 border-green-200"
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <SummaryCard
            label="Reactivated"
            count={reactivatedCount}
            color="bg-purple-50 text-purple-700 border-purple-200"
            active={filter === "reactivated"}
            onClick={() => setFilter("reactivated")}
          />
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by seller ID, name, or ad account ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={gmFilter}
            onChange={(e) => setGmFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All GC/GM</option>
            {uniqueGMs.map((gm) => (
              <option key={gm} value={gm}>
                {gm}
              </option>
            ))}
          </select>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-500">Loading accounts...</span>
          </div>
        )}

        {/* Table */}
        {!loading && accounts.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ad Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">BM</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GC/GM</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Checked</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previous</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {accounts.map((acc, idx) => (
                    <tr key={`${acc.ad_account_id}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{acc.seller_name}</div>
                        <div className="text-gray-400 text-xs font-mono">{acc.seller_id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{acc.ad_account_id}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          acc.ad_account_type === "nushop_postpaid"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {acc.ad_account_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          STATUS_COLORS[acc.account_status] || "bg-gray-100 text-gray-600"
                        }`}>
                          {acc.account_status_label || ACCOUNT_STATUS_MAP[acc.account_status] || acc.account_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {acc.disable_reason_label || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {acc.bm_name ? (
                          <div>
                            <div className="text-xs">{acc.bm_name}</div>
                            <div className="text-xs text-gray-400">{acc.bm_status || "-"}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{acc.gc_name || "-"}</div>
                        {acc.gm_name && (
                          <div className="text-xs text-gray-400">GM: {acc.gm_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {acc.last_checked_at
                          ? new Date(acc.last_checked_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {acc.previous_status != null ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            STATUS_COLORS[acc.previous_status] || "bg-gray-100 text-gray-600"
                          }`}>
                            {ACCOUNT_STATUS_MAP[acc.previous_status] || acc.previous_status}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && accounts.length === 0 && !error && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">No accounts found</p>
            <p className="text-sm mt-1">
              {filter !== "all"
                ? "Try changing the filter or search query"
                : "Click 'Run Check Now' to fetch account statuses"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border-2 text-left transition-all ${color} ${
        active ? "ring-2 ring-offset-2 ring-blue-500" : "opacity-80 hover:opacity-100"
      }`}
    >
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-xs font-medium uppercase mt-1">{label}</div>
    </button>
  );
}
