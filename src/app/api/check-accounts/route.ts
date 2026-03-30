import { NextResponse } from "next/server";

// Redirects to trigger-check — the actual check runs on GitHub Actions now
export async function POST() {
  return NextResponse.json(
    { error: "Use /api/trigger-check instead. The check now runs on GitHub Actions." },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { message: "Account checks now run via GitHub Actions every 6 hours. Use /api/trigger-check to trigger manually." }
  );
}
