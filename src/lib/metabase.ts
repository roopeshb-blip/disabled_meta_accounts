/**
 * Fetches seller data from Metabase API using saved card #8931.
 * Authenticates with email/password to get a session token.
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
}

const METABASE_CARD_ID = 8932; // "Meta Ad Account Monitor - Hit Sellers"

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

export async function fetchHitSellersWithAdAccounts(): Promise<SellerAdAccount[]> {
  const metabaseUrl = process.env.METABASE_URL;
  const sessionToken = await getSessionToken();

  const url = `${metabaseUrl}/api/card/${METABASE_CARD_ID}/query/json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Metabase-Session": sessionToken,
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
    a2h_date: row.a2h_date || null,
  }));
}
