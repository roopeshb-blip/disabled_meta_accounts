import { NextResponse } from "next/server";

// Triggers the GitHub Actions workflow instead of running the check on Vercel
export async function POST() {
  const token = process.env.GITHUB_PAT;
  const repo = "roopeshb-blip/disabled_meta_accounts";
  const workflow = "check-accounts.yml";

  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_PAT not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );

    if (res.status === 204 || res.ok) {
      return NextResponse.json({
        message: "Check triggered — results will appear in 2-5 minutes",
        triggered_at: new Date().toISOString(),
      });
    }

    const errBody = await res.text();
    return NextResponse.json(
      { error: `GitHub API error: ${res.status} — ${errBody}` },
      { status: res.status }
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to trigger: ${String(err)}` },
      { status: 500 }
    );
  }
}
