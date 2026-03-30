/**
 * Fetches seller data from Metabase API using saved card #8931.
 * This avoids needing direct BQ credentials.
 */

export interface SellerAdAccount {
  seller_id: string;
  seller_name: string;
  ad_account_id: string;
  ad_account_type: string;
  gc_id: string | null;
  gc_name: string | null;
  gm_id: string | null;
  gm_name: string | null;
}

const METABASE_CARD_ID = 8931; // "Meta Ad Account Monitor - Hit Sellers"

export async function fetchHitSellersWithAdAccounts(): Promise<SellerAdAccount[]> {
  const metabaseUrl = process.env.METABASE_URL;
  const metabaseApiKey = process.env.METABASE_API_KEY;

  if (!metabaseUrl || !metabaseApiKey) {
    throw new Error("METABASE_URL and METABASE_API_KEY must be set");
  }

  const url = `${metabaseUrl}/api/card/${METABASE_CARD_ID}/query/json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": metabaseApiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Metabase API error ${response.status}: ${errBody}`);
  }

  const rows: Record<string, string | null>[] = await response.json();

  return rows.map((row) => ({
    seller_id: row.seller_id || "",
    seller_name: row.seller_name || "",
    ad_account_id: row.ad_account_id || "",
    ad_account_type: row.ad_account_type || "",
    gc_id: row.gc_id || null,
    gc_name: row.gc_name || null,
    gm_id: row.gm_id || null,
    gm_name: row.gm_name || null,
  }));
}
