import { NextRequest, NextResponse } from "next/server";
import { getLatestStatuses } from "@/lib/database";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filter = searchParams.get("filter") || "all";
  const search = searchParams.get("search") || "";
  const gmFilter = searchParams.get("gm") || "";
  const a2hFrom = searchParams.get("a2h_from") || "";
  const a2hTo = searchParams.get("a2h_to") || "";

  try {
    const allStatuses = await getLatestStatuses();

    let filtered = allStatuses;

    // Filter by status
    if (filter === "disabled") {
      filtered = filtered.filter((s) => s.account_status === 2);
    } else if (filter === "under_review") {
      filtered = filtered.filter((s) => [7, 9, 100].includes(s.account_status as number));
    } else if (filter === "active") {
      filtered = filtered.filter((s) => s.account_status === 1);
    } else if (filter === "reactivated") {
      filtered = filtered.filter(
        (s) =>
          s.account_status === 1 &&
          s.previous_status != null &&
          [2, 7, 9, 100].includes(s.previous_status as number)
      );
    } else if (filter === "error") {
      filtered = filtered.filter((s) => s.account_status === -1);
    } else if (filter === "unsettled") {
      filtered = filtered.filter((s) => s.account_status === 3);
    } else if (filter === "temp_unavailable") {
      filtered = filtered.filter((s) => s.account_status === 101);
    }

    // Search by seller_id or seller_name
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          (s.seller_id as string)?.toLowerCase().includes(q) ||
          (s.seller_name as string)?.toLowerCase().includes(q) ||
          (s.ad_account_id as string)?.toLowerCase().includes(q)
      );
    }

    // Filter by A2H date range
    if (a2hFrom) {
      const from = new Date(a2hFrom);
      filtered = filtered.filter((s) => {
        if (!s.a2h_date) return false;
        return new Date(s.a2h_date as string) >= from;
      });
    }
    if (a2hTo) {
      const to = new Date(a2hTo + "T23:59:59.999Z");
      filtered = filtered.filter((s) => {
        if (!s.a2h_date) return false;
        return new Date(s.a2h_date as string) <= to;
      });
    }

    // Filter by GM
    if (gmFilter) {
      const g = gmFilter.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          (s.gm_name as string)?.toLowerCase().includes(g) ||
          (s.gc_name as string)?.toLowerCase().includes(g)
      );
    }

    return NextResponse.json({
      total: filtered.length,
      accounts: filtered,
    });
  } catch (err) {
    console.error("Failed to fetch accounts:", err);
    return NextResponse.json(
      { error: String(err), accounts: [] },
      { status: 500 }
    );
  }
}
