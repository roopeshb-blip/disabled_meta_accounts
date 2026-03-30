import { NextResponse } from "next/server";
import { runFullCheck } from "@/lib/checker";

// Vercel Cron hits this as GET with Authorization: Bearer <CRON_SECRET>
export async function GET(request: Request) {
  // Verify Vercel cron auth in production
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

// POST for manual trigger from dashboard UI
export async function POST() {
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

export const maxDuration = 300; // 5 min timeout for Vercel Pro
