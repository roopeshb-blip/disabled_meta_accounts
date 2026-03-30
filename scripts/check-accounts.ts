/**
 * Standalone check script — runs in GitHub Actions.
 * Fetches sellers from Metabase, checks Meta API, saves to Supabase Postgres, sends Slack alerts.
 */
import "tsconfig-paths/register";
import { runFullCheck } from "@/lib/checker";
import { closePool } from "@/lib/database";

async function main() {
  console.log("=== Meta Ad Account Status Check ===");
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log();

  try {
    const result = await runFullCheck();

    console.log();
    console.log("=== Summary ===");
    console.log(`Total checked:  ${result.total_checked}`);
    console.log(`Disabled:       ${result.disabled}`);
    console.log(`Under Review:   ${result.under_review}`);
    console.log(`Active:         ${result.active}`);
    console.log(`Reactivated:    ${result.reactivated}`);
    console.log(`Errors:         ${result.errors}`);
    console.log(`Completed at:   ${result.checked_at}`);

    await closePool();

    // Log error rate but don't fail — some errors are expected
    // (seller_paid accounts the system user token can't access)
    if (result.errors > 0) {
      const errorRate = Math.round(result.errors / result.total_checked * 100);
      console.log(`\nNote: ${result.errors} accounts returned errors (${errorRate}% — likely permission issues for seller_paid accounts)`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Fatal error:", err);
    await closePool();
    process.exit(1);
  }
}

main();
