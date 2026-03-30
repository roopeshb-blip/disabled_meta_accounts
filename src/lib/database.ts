import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

export async function initSchema(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS meta_ad_account_status (
      id SERIAL PRIMARY KEY,
      seller_id TEXT NOT NULL,
      seller_name TEXT,
      ad_account_id TEXT NOT NULL,
      ad_account_type TEXT,
      account_status INTEGER NOT NULL,
      account_status_label TEXT,
      disable_reason INTEGER,
      disable_reason_label TEXT,
      bm_id TEXT,
      bm_name TEXT,
      bm_status TEXT,
      gc_name TEXT,
      gc_id TEXT,
      gm_name TEXT,
      gm_id TEXT,
      last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      previous_status INTEGER,
      status_changed_at TIMESTAMPTZ
    )
  `);

  // Index for fast lookups
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_meta_status_ad_account
    ON meta_ad_account_status (ad_account_id, last_checked_at DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_meta_status_account_status
    ON meta_ad_account_status (account_status)
  `);
}

export async function saveAccountStatuses(
  statuses: Record<string, unknown>[]
): Promise<void> {
  if (statuses.length === 0) return;

  const db = getPool();

  // Batch insert using a single query with VALUES
  const columns = [
    "seller_id", "seller_name", "ad_account_id", "ad_account_type",
    "account_status", "account_status_label", "disable_reason", "disable_reason_label",
    "bm_id", "bm_name", "bm_status", "gc_name", "gc_id", "gm_name", "gm_id",
    "last_checked_at", "previous_status", "status_changed_at",
  ];

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < statuses.length; i++) {
    const s = statuses[i];
    const offset = i * columns.length;
    const rowPlaceholders = columns.map((_, j) => `$${offset + j + 1}`);
    placeholders.push(`(${rowPlaceholders.join(", ")})`);

    values.push(
      s.seller_id, s.seller_name, s.ad_account_id, s.ad_account_type,
      s.account_status, s.account_status_label, s.disable_reason, s.disable_reason_label,
      s.bm_id, s.bm_name, s.bm_status, s.gc_name, s.gc_id, s.gm_name, s.gm_id,
      s.last_checked_at, s.previous_status, s.status_changed_at || null,
    );
  }

  // Insert in chunks of 100 to avoid param limit
  const chunkSize = 100;
  for (let i = 0; i < statuses.length; i += chunkSize) {
    const chunkStatuses = statuses.slice(i, i + chunkSize);
    const chunkValues: unknown[] = [];
    const chunkPlaceholders: string[] = [];

    for (let j = 0; j < chunkStatuses.length; j++) {
      const s = chunkStatuses[j];
      const offset = j * columns.length;
      const rowPlaceholders = columns.map((_, k) => `$${offset + k + 1}`);
      chunkPlaceholders.push(`(${rowPlaceholders.join(", ")})`);

      chunkValues.push(
        s.seller_id, s.seller_name, s.ad_account_id, s.ad_account_type,
        s.account_status, s.account_status_label, s.disable_reason, s.disable_reason_label,
        s.bm_id, s.bm_name, s.bm_status, s.gc_name, s.gc_id, s.gm_name, s.gm_id,
        s.last_checked_at, s.previous_status, s.status_changed_at || null,
      );
    }

    await db.query(
      `INSERT INTO meta_ad_account_status (${columns.join(", ")}) VALUES ${chunkPlaceholders.join(", ")}`,
      chunkValues
    );
  }
}

export async function getLatestStatuses(): Promise<Record<string, unknown>[]> {
  const db = getPool();
  const result = await db.query(`
    SELECT DISTINCT ON (ad_account_id) *
    FROM meta_ad_account_status
    ORDER BY ad_account_id, last_checked_at DESC
  `);
  return result.rows;
}

export async function getPreviousStatusMap(): Promise<Map<string, number>> {
  const db = getPool();
  const result = await db.query(`
    SELECT DISTINCT ON (ad_account_id) ad_account_id, account_status
    FROM meta_ad_account_status
    ORDER BY ad_account_id, last_checked_at DESC
  `);

  const map = new Map<string, number>();
  for (const row of result.rows) {
    map.set(row.ad_account_id, row.account_status);
  }
  return map;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
