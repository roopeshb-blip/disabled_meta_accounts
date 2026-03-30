import { NextResponse } from "next/server";
import { runFullCheck } from "@/lib/checker";

// This endpoint is called by GitHub Actions cron or manually
export async function POST(request: Request) {
  // Simple auth via secret header
  const authHeader = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFullCheck();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Check failed:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

// Allow GET for manual trigger from browser (dev only)
export async function GET() {
  try {
    const result = await runFullCheck();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Check failed:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

export const maxDuration = 300; // 5 min timeout for Vercel
