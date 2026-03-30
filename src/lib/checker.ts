import { fetchHitSellersWithAdAccounts, saveAccountStatuses, getPreviousStatusMap } from "./bigquery";
import { batchCheckAccountStatuses, AccountCheckResult } from "./meta-api";
import { sendSlackAlert } from "./slack";
import { AdAccountStatus, ACCOUNT_STATUS_MAP, DISABLE_REASON_MAP, CheckResult } from "@/types";

export async function runFullCheck(): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  console.log(`[${checkedAt}] Starting account status check...`);

  // Step 1: Fetch all hit sellers with FB ad accounts + GC/GM mapping
  const sellers = await fetchHitSellersWithAdAccounts();
  console.log(`Found ${sellers.length} seller-ad-account rows to check`);

  // Deduplicate ad accounts (some sellers may have multiple managers)
  const adAccountMap = new Map<string, typeof sellers[0]>();
  for (const seller of sellers) {
    if (!adAccountMap.has(seller.ad_account_id)) {
      adAccountMap.set(seller.ad_account_id, seller);
    } else {
      // Prefer the one with GC/GM info
      const existing = adAccountMap.get(seller.ad_account_id)!;
      if (!existing.gc_name && seller.gc_name) adAccountMap.set(seller.ad_account_id, seller);
    }
  }

  const uniqueAdAccountIds = Array.from(adAccountMap.keys());
  console.log(`Unique ad accounts to check: ${uniqueAdAccountIds.length}`);

  // Step 2: Get previous statuses for diff detection
  let previousStatusMap = new Map<string, number>();
  try {
    previousStatusMap = await getPreviousStatusMap();
    console.log(`Loaded ${previousStatusMap.size} previous status records`);
  } catch {
    console.log("No previous status data found (first run)");
  }

  // Step 3: Batch check via Meta API
  const accessToken = process.env.META_ACCESS_TOKEN!;
  const apiResults = await batchCheckAccountStatuses(uniqueAdAccountIds, accessToken);
  console.log(`Meta API returned ${apiResults.length} results`);

  // Step 4: Merge API results with seller data
  const fullStatuses: AdAccountStatus[] = [];
  const disabled: AdAccountStatus[] = [];
  const underReview: AdAccountStatus[] = [];
  const reactivated: AdAccountStatus[] = [];
  let errorCount = 0;
  let activeCount = 0;

  for (const apiResult of apiResults) {
    const sellerData = adAccountMap.get(apiResult.ad_account_id);
    if (!sellerData) continue;

    const previousStatus = previousStatusMap.get(apiResult.ad_account_id) ?? null;
    const statusChanged = previousStatus !== null && previousStatus !== apiResult.account_status;

    const record: AdAccountStatus = {
      seller_id: sellerData.seller_id,
      seller_name: sellerData.seller_name,
      ad_account_id: apiResult.ad_account_id,
      ad_account_type: sellerData.ad_account_type,
      account_status: apiResult.account_status,
      account_status_label: apiResult.account_status_label,
      disable_reason: apiResult.disable_reason,
      disable_reason_label: apiResult.disable_reason_label,
      bm_id: apiResult.bm_id,
      bm_name: apiResult.bm_name,
      bm_status: apiResult.bm_status,
      gc_name: sellerData.gc_name,
      gc_id: sellerData.gc_id,
      gm_name: sellerData.gm_name,
      gm_id: sellerData.gm_id,
      last_checked_at: checkedAt,
      previous_status: previousStatus,
      status_changed_at: statusChanged ? checkedAt : null,
    };

    fullStatuses.push(record);

    if (apiResult.account_status === -1) {
      errorCount++;
    } else if (apiResult.account_status === 2) {
      disabled.push(record);
    } else if ([7, 9, 100].includes(apiResult.account_status)) {
      underReview.push(record);
    } else if (apiResult.account_status === 1) {
      activeCount++;
      // Check if reactivated (was disabled/review, now active)
      if (previousStatus !== null && [2, 7, 9, 100].includes(previousStatus)) {
        reactivated.push(record);
      }
    }
  }

  // Step 5: Save to BigQuery
  try {
    await saveAccountStatuses(
      fullStatuses.map((s) => ({
        ...s,
        last_checked_at: s.last_checked_at,
        status_changed_at: s.status_changed_at || null,
      }))
    );
    console.log(`Saved ${fullStatuses.length} status records to BigQuery`);
  } catch (err) {
    console.error("Failed to save to BigQuery:", err);
  }

  // Step 6: Send Slack alerts for problematic accounts
  if (disabled.length > 0) {
    await sendSlackAlert(disabled, "disabled");
    console.log(`Sent Slack alert for ${disabled.length} disabled accounts`);
  }
  if (underReview.length > 0) {
    await sendSlackAlert(underReview, "under_review");
    console.log(`Sent Slack alert for ${underReview.length} under-review accounts`);
  }
  if (reactivated.length > 0) {
    await sendSlackAlert(reactivated, "reactivated");
    console.log(`Sent Slack alert for ${reactivated.length} reactivated accounts`);
  }

  const result: CheckResult = {
    total_checked: apiResults.length,
    disabled: disabled.length,
    under_review: underReview.length,
    active: activeCount,
    reactivated: reactivated.length,
    errors: errorCount,
    checked_at: checkedAt,
  };

  console.log("Check complete:", result);
  return result;
}
