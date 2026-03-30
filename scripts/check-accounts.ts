/**
 * Standalone check script — runs in GitHub Actions.
 * Queries BQ for hit sellers, checks Meta API, saves results, sends Slack alerts.
 */
import "tsconfig-paths/register";
import { runFullCheck } from "@/lib/checker";

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

    // Fail the action if there were errors on >10% of accounts
    if (result.errors > 0 && result.errors / result.total_checked > 0.1) {
      console.error(`\nWARNING: ${result.errors} errors (>${Math.round(result.errors / result.total_checked * 100)}% failure rate)`);
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

main();
