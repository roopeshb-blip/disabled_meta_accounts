import { NextResponse } from "next/server";
import { getLatestStatuses } from "@/lib/database";
import { fetchHitSellersWithAdAccounts } from "@/lib/metabase";

export async function GET() {
  try {
    // Source of truth: Metabase query (what SHOULD be monitored)
    const metabaseSellers = await fetchHitSellersWithAdAccounts();
    const metabaseAccountIds = new Set(metabaseSellers.map((s) => s.ad_account_id));
    const metabaseSellerIds = new Set(metabaseSellers.map((s) => s.seller_id));

    // What we actually have in Supabase (what IS monitored)
    const supabaseStatuses = await getLatestStatuses();
    const supabaseAccountIds = new Set(supabaseStatuses.map((s) => s.ad_account_id as string));
    const supabaseSellerIds = new Set(supabaseStatuses.map((s) => s.seller_id as string));

    // Find gaps
    const missingAccountIds = [...metabaseAccountIds].filter((id) => !supabaseAccountIds.has(id));
    const extraAccountIds = [...supabaseAccountIds].filter((id) => !metabaseAccountIds.has(id));
    const missingSellerIds = [...metabaseSellerIds].filter((id) => !supabaseSellerIds.has(id));

    // Build missing sellers detail
    const missingDetails = missingAccountIds.map((adId) => {
      const seller = metabaseSellers.find((s) => s.ad_account_id === adId);
      return {
        ad_account_id: adId,
        seller_id: seller?.seller_id,
        seller_name: seller?.seller_name,
        ad_account_type: seller?.ad_account_type,
        gc_name: seller?.gc_name,
      };
    });

    const coverage = metabaseAccountIds.size > 0
      ? ((supabaseAccountIds.size - extraAccountIds.length) / metabaseAccountIds.size * 100).toFixed(1)
      : "0";

    return NextResponse.json({
      verification: {
        metabase_source: {
          total_ad_accounts: metabaseAccountIds.size,
          total_sellers: metabaseSellerIds.size,
        },
        supabase_monitored: {
          total_ad_accounts: supabaseAccountIds.size,
          total_sellers: supabaseSellerIds.size,
        },
        coverage_percent: `${coverage}%`,
        missing_from_supabase: {
          count: missingAccountIds.length,
          accounts: missingDetails.slice(0, 50),
        },
        extra_in_supabase: {
          count: extraAccountIds.length,
          note: "These accounts are in Supabase but no longer in Metabase source (seller may have left hit status or GC unmapped)",
          accounts: extraAccountIds.slice(0, 20),
        },
        missing_sellers: {
          count: missingSellerIds.length,
          seller_ids: missingSellerIds.slice(0, 20),
        },
      },
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Verification failed:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
