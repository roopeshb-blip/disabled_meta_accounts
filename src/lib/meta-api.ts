import { ACCOUNT_STATUS_MAP, DISABLE_REASON_MAP } from "@/types";

const META_API_BASE = `https://graph.facebook.com/${process.env.META_API_VERSION || "v22.0"}`;
const BATCH_SIZE = 50; // Meta batch API limit
const RATE_LIMIT_DELAY_MS = 2000; // 2s between batches to avoid rate limits

interface MetaAccountStatusResponse {
  id: string;
  account_status: number;
  disable_reason?: number;
  name?: string;
  business?: {
    id: string;
    name: string;
    verification_status?: string;
  };
}

interface MetaBatchResponse {
  code: number;
  body: string;
}

export interface AccountCheckResult {
  ad_account_id: string;
  account_status: number;
  account_status_label: string;
  disable_reason: number | null;
  disable_reason_label: string | null;
  bm_id: string | null;
  bm_name: string | null;
  bm_status: string | null;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkAccountStatus(
  adAccountId: string,
  accessToken: string
): Promise<AccountCheckResult> {
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const url = `${META_API_BASE}/${actId}?fields=account_status,disable_reason,name,business{id,name,verification_status}&access_token=${accessToken}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errBody = await response.text();
      return {
        ad_account_id: adAccountId,
        account_status: -1,
        account_status_label: "Error",
        disable_reason: null,
        disable_reason_label: null,
        bm_id: null,
        bm_name: null,
        bm_status: null,
        error: `HTTP ${response.status}: ${errBody}`,
      };
    }

    const data: MetaAccountStatusResponse = await response.json();
    return {
      ad_account_id: adAccountId,
      account_status: data.account_status,
      account_status_label: ACCOUNT_STATUS_MAP[data.account_status] || `Unknown (${data.account_status})`,
      disable_reason: data.disable_reason ?? null,
      disable_reason_label: data.disable_reason != null
        ? (DISABLE_REASON_MAP[data.disable_reason] || `Unknown (${data.disable_reason})`)
        : null,
      bm_id: data.business?.id ?? null,
      bm_name: data.business?.name ?? null,
      bm_status: data.business?.verification_status ?? null,
    };
  } catch (err) {
    return {
      ad_account_id: adAccountId,
      account_status: -1,
      account_status_label: "Error",
      disable_reason: null,
      disable_reason_label: null,
      bm_id: null,
      bm_name: null,
      bm_status: null,
      error: String(err),
    };
  }
}

export async function batchCheckAccountStatuses(
  adAccountIds: string[],
  accessToken: string
): Promise<AccountCheckResult[]> {
  const results: AccountCheckResult[] = [];

  // Split into batches of 50
  const batches: string[][] = [];
  for (let i = 0; i < adAccountIds.length; i += BATCH_SIZE) {
    batches.push(adAccountIds.slice(i, i + BATCH_SIZE));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    // Use Meta Batch API
    const batchRequests = batch.map((id) => {
      const actId = id.startsWith("act_") ? id : `act_${id}`;
      return {
        method: "GET",
        relative_url: `${actId}?fields=account_status,disable_reason,name,business{id,name,verification_status}`,
      };
    });

    try {
      const response = await fetch(
        `${META_API_BASE}/?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch: JSON.stringify(batchRequests) }),
        }
      );

      if (!response.ok) {
        // Fallback: check individually
        for (const id of batch) {
          const result = await checkAccountStatus(id, accessToken);
          results.push(result);
        }
      } else {
        const batchResponses: MetaBatchResponse[] = await response.json();

        for (let i = 0; i < batchResponses.length; i++) {
          const batchResp = batchResponses[i];
          const adAccountId = batch[i];

          if (batchResp.code === 200) {
            const data: MetaAccountStatusResponse = JSON.parse(batchResp.body);
            results.push({
              ad_account_id: adAccountId,
              account_status: data.account_status,
              account_status_label: ACCOUNT_STATUS_MAP[data.account_status] || `Unknown (${data.account_status})`,
              disable_reason: data.disable_reason ?? null,
              disable_reason_label: data.disable_reason != null
                ? (DISABLE_REASON_MAP[data.disable_reason] || `Unknown (${data.disable_reason})`)
                : null,
              bm_id: data.business?.id ?? null,
              bm_name: data.business?.name ?? null,
              bm_status: data.business?.verification_status ?? null,
            });
          } else {
            results.push({
              ad_account_id: adAccountId,
              account_status: -1,
              account_status_label: "Error",
              disable_reason: null,
              disable_reason_label: null,
              bm_id: null,
              bm_name: null,
              bm_status: null,
              error: `Batch error ${batchResp.code}: ${batchResp.body}`,
            });
          }
        }
      }
    } catch (err) {
      // On batch failure, try individual
      for (const id of batch) {
        const result = await checkAccountStatus(id, accessToken);
        results.push(result);
      }
    }

    // Rate limit between batches
    if (batchIdx < batches.length - 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  return results;
}
