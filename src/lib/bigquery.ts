import { BigQuery } from "@google-cloud/bigquery";

let bqClient: BigQuery | null = null;

function getBQClient(): BigQuery {
  if (bqClient) return bqClient;

  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentials) {
    const parsed = JSON.parse(credentials);
    bqClient = new BigQuery({
      projectId: process.env.BQ_PROJECT_ID || "blitzscale-prod-project",
      credentials: parsed,
    });
  } else {
    bqClient = new BigQuery({
      projectId: process.env.BQ_PROJECT_ID || "blitzscale-prod-project",
    });
  }
  return bqClient;
}

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

export async function fetchHitSellersWithAdAccounts(): Promise<SellerAdAccount[]> {
  const client = getBQClient();
  const query = `
    SELECT
      mac.seller_id,
      COALESCE(s.display_name, CONCAT(s.first_name, ' ', COALESCE(s.last_name, ''))) as seller_name,
      mac.ad_account_id,
      mac.ad_account_type,
      gc.manager_id as gc_id,
      COALESCE(gc_s.display_name, CONCAT(gc_s.first_name, ' ', COALESCE(gc_s.last_name, ''))) as gc_name,
      gm.manager_id as gm_id,
      COALESCE(gm_s.display_name, CONCAT(gm_s.first_name, ' ', COALESCE(gm_s.last_name, ''))) as gm_name
    FROM \`nushop.marketing_ad_accounts_configs\` mac
    INNER JOIN \`nushop.sellers\` s ON mac.seller_id = s._id
    LEFT JOIN \`nushop.seller_managers\` gc ON mac.seller_id = gc.seller_id AND gc.manager_type = 'growth_consultant'
    LEFT JOIN \`nushop.seller_managers\` gm ON mac.seller_id = gm.seller_id AND gm.manager_type = 'growth_manager'
    LEFT JOIN \`nushop.sellers\` gc_s ON gc.manager_id = gc_s._id
    LEFT JOIN \`nushop.sellers\` gm_s ON gm.manager_id = gm_s._id
    WHERE mac.ad_deletion_date IS NULL
      AND mac.marketing_channel = 'facebook'
      AND s.seller_account_status = 'hit'
      AND (gc.manager_id IS NOT NULL OR gm.manager_id IS NOT NULL)
  `;

  const [rows] = await client.query({ query });
  return rows as SellerAdAccount[];
}

export async function saveAccountStatuses(statuses: Record<string, unknown>[]): Promise<void> {
  const client = getBQClient();
  const dataset = client.dataset("nushop");
  const table = dataset.table("meta_ad_account_status");

  const [tableExists] = await table.exists();
  if (!tableExists) {
    await dataset.createTable("meta_ad_account_status", {
      schema: {
        fields: [
          { name: "seller_id", type: "STRING" },
          { name: "seller_name", type: "STRING" },
          { name: "ad_account_id", type: "STRING" },
          { name: "ad_account_type", type: "STRING" },
          { name: "account_status", type: "INTEGER" },
          { name: "account_status_label", type: "STRING" },
          { name: "disable_reason", type: "INTEGER", mode: "NULLABLE" },
          { name: "disable_reason_label", type: "STRING", mode: "NULLABLE" },
          { name: "bm_id", type: "STRING", mode: "NULLABLE" },
          { name: "bm_name", type: "STRING", mode: "NULLABLE" },
          { name: "bm_status", type: "STRING", mode: "NULLABLE" },
          { name: "gc_name", type: "STRING", mode: "NULLABLE" },
          { name: "gc_id", type: "STRING", mode: "NULLABLE" },
          { name: "gm_name", type: "STRING", mode: "NULLABLE" },
          { name: "gm_id", type: "STRING", mode: "NULLABLE" },
          { name: "last_checked_at", type: "TIMESTAMP" },
          { name: "previous_status", type: "INTEGER", mode: "NULLABLE" },
          { name: "status_changed_at", type: "TIMESTAMP", mode: "NULLABLE" },
        ],
      },
    });
  }

  if (statuses.length > 0) {
    await table.insert(statuses);
  }
}

export async function getLatestStatuses(): Promise<Record<string, unknown>[]> {
  const client = getBQClient();
  const query = `
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY ad_account_id ORDER BY last_checked_at DESC) as rn
      FROM \`nushop.meta_ad_account_status\`
    )
    SELECT * EXCEPT(rn) FROM ranked WHERE rn = 1
    ORDER BY account_status ASC, seller_name ASC
  `;
  const [rows] = await client.query({ query });
  return rows;
}

export async function getPreviousStatusMap(): Promise<Map<string, number>> {
  const client = getBQClient();
  const query = `
    WITH ranked AS (
      SELECT ad_account_id, account_status,
        ROW_NUMBER() OVER (PARTITION BY ad_account_id ORDER BY last_checked_at DESC) as rn
      FROM \`nushop.meta_ad_account_status\`
    )
    SELECT ad_account_id, account_status FROM ranked WHERE rn = 1
  `;
  const [rows] = await client.query({ query });
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.ad_account_id, row.account_status);
  }
  return map;
}
