/**
 * Fetches seller data from Metabase API.
 * - Card #8934: Hit sellers with ad accounts + GC/GM mapping
 * - Card #7100: OB Cohort Query v2 — source of truth for A2H and GoLive dates
 *
 * Only seller IDs present in card #7100 are included (OB cohort filter).
 * GoLive date from card #7100 is the primary date used for filtering.
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
  a2h_date: string | null;
  live_date: string | null;
}

export interface OBCohortDates {
  a2h_date: string | null;
  go_live_date: string | null;
}

const METABASE_CARD_ID = 8934; // "Meta Ad Account Monitor - Hit Sellers v4"
const OB_COHORT_CARD_ID = 7100; // "OB Cohort Query v2" — A2H + GoLive dates

async function getSessionToken(): Promise<string> {
  const metabaseUrl = process.env.METABASE_URL;
  const email = process.env.METABASE_EMAIL;
  const password = process.env.METABASE_PASSWORD;

  if (!metabaseUrl || !email || !password) {
    throw new Error("METABASE_URL, METABASE_EMAIL, and METABASE_PASSWORD must be set");
  }

  const response = await fetch(`${metabaseUrl}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Metabase auth failed ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.id; // session token
}

/**
 * Fetch OB Cohort Query v2 (card #7100) to get A2H and GoLive dates per seller_id.
 * Returns a Map of seller_id → { a2h_date, go_live_date }.
 *
 * Card #7100 columns: seller_id, dos, gtg_date, a2h_date, go_live_date
 */
async function fetchOBCohortDates(
  metabaseUrl: string,
  sessionToken: string
): Promise<Map<string, OBCohortDates>> {
  const map = new Map<string, OBCohortDates>();

  try {
    const url = `${metabaseUrl}/api/card/${OB_COHORT_CARD_ID}/query/json`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Metabase-Session": sessionToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`OB Cohort query (card #${OB_COHORT_CARD_ID}) failed ${response.status}: ${errBody}`);
      return map;
    }

    const rows: Record<string, string | null>[] = await response.json();
    console.log(`OB Cohort query returned ${rows.length} rows`);

    for (const row of rows) {
      const sellerId = row.seller_id;
      if (!sellerId) continue;

      map.set(sellerId, {
        a2h_date: row.a2h_date || null,
        go_live_date: row.go_live_date || null,
      });
    }

    const a2hCount = Array.from(map.values()).filter((v) => v.a2h_date).length;
    const goliveCount = Array.from(map.values()).filter((v) => v.go_live_date).length;
    console.log(
      `OB Cohort: ${map.size} sellers, ${a2hCount} with A2H date, ${goliveCount} with GoLive date`
    );
  } catch (err) {
    console.warn("Failed to fetch OB Cohort dates:", err);
  }

  return map;
}

export async function fetchHitSellersWithAdAccounts(): Promise<SellerAdAccount[]> {
  const metabaseUrl = process.env.METABASE_URL;
  const sessionToken = await getSessionToken();

  // Fetch both queries in parallel
  const [sellersResponse, obCohortMap] = await Promise.all([
    fetch(`${metabaseUrl}/api/card/${METABASE_CARD_ID}/query/json`, {
      method: "POST",
      headers: {
        "X-Metabase-Session": sessionToken,
        "Content-Type": "application/json",
      },
    }),
    fetchOBCohortDates(metabaseUrl!, sessionToken),
  ]);

  if (!sellersResponse.ok) {
    const errBody = await sellersResponse.text();
    throw new Error(`Metabase API error ${sellersResponse.status}: ${errBody}`);
  }

  const rows: Record<string, string | null>[] = await sellersResponse.json();
  console.log(`Hit sellers query returned ${rows.length} rows`);

  // Filter: only include sellers that appear in the OB cohort (card #7100)
  const obFilteredRows = rows.filter((row) => obCohortMap.has(row.seller_id || ""));
  console.log(
    `After OB cohort filter: ${obFilteredRows.length} of ${rows.length} rows (${rows.length - obFilteredRows.length} excluded)`
  );

  return obFilteredRows.map((row) => {
    const sellerId = row.seller_id || "";
    const cohortDates = obCohortMap.get(sellerId);

    return {
      seller_id: sellerId,
      seller_name: row.seller_name || "",
      ad_account_id: row.ad_account_id || "",
      ad_account_type: row.ad_account_type || "",
      gc_id: row.gc_id || null,
      gc_name: row.gc_name || null,
      gm_id: row.gm_id || null,
      gm_name: row.gm_name || null,
      // Use OB Cohort dates (card #7100) as the source of truth
      a2h_date: cohortDates?.a2h_date || null,
      live_date: cohortDates?.go_live_date || null,
    };
  });
}
