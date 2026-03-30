import { AdAccountStatus, ACCOUNT_STATUS_MAP } from "@/types";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: { type: string; text: string }[];
  fields?: { type: string; text: string }[];
}

function getStatusEmoji(status: number): string {
  switch (status) {
    case 1: return ":white_check_mark:";
    case 2: return ":red_circle:";
    case 7: return ":warning:";
    case 9: return ":hourglass:";
    default: return ":question:";
  }
}

export async function sendSlackAlert(
  accounts: AdAccountStatus[],
  alertType: "disabled" | "under_review" | "reactivated",
  channelId?: string
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = channelId || process.env.SLACK_CHANNEL_ID;

  if (!token || !channel) {
    console.warn("Slack not configured — skipping alert");
    return;
  }

  const headerMap = {
    disabled: ":rotating_light: *Ad Accounts Blocked/Disabled*",
    under_review: ":warning: *Ad Accounts Under Review / Grace Period*",
    reactivated: ":tada: *Ad Accounts Reactivated*",
  };

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: headerMap[alertType].replace(/[*:]/g, "").trim() },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${headerMap[alertType]}\n*${accounts.length} account(s)* detected at ${new Date().toISOString().slice(0, 16)} UTC`,
      },
    },
    { type: "divider" } as SlackBlock,
  ];

  // Group by GM for accountability
  const byGM = new Map<string, AdAccountStatus[]>();
  for (const acc of accounts) {
    const gm = acc.gm_name || acc.gc_name || "Unassigned";
    if (!byGM.has(gm)) byGM.set(gm, []);
    byGM.get(gm)!.push(acc);
  }

  for (const [gmName, gmAccounts] of byGM) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${gmName}* (${gmAccounts.length} account${gmAccounts.length > 1 ? "s" : ""})`,
      },
    });

    // Show up to 10 accounts per GM to avoid Slack limits
    const shown = gmAccounts.slice(0, 10);
    for (const acc of shown) {
      const emoji = getStatusEmoji(acc.account_status);
      const status = ACCOUNT_STATUS_MAP[acc.account_status] || `Status ${acc.account_status}`;
      const reason = acc.disable_reason_label ? ` | Reason: ${acc.disable_reason_label}` : "";
      const prevStatus = acc.previous_status != null
        ? ` | Was: ${ACCOUNT_STATUS_MAP[acc.previous_status] || acc.previous_status}`
        : "";

      blocks.push({
        type: "section",
        fields: [
          { type: "mrkdwn", text: `${emoji} *${acc.seller_name}*` },
          { type: "mrkdwn", text: `Ad Account: \`${acc.ad_account_id}\`` },
          { type: "mrkdwn", text: `Status: *${status}*${reason}` },
          { type: "mrkdwn", text: `Type: ${acc.ad_account_type}${prevStatus}` },
        ],
      });
    }

    if (gmAccounts.length > 10) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `_...and ${gmAccounts.length - 10} more_` }],
      });
    }

    blocks.push({ type: "divider" } as SlackBlock);
  }

  // Slack has a 50 block limit — truncate if needed
  const truncatedBlocks = blocks.slice(0, 49);
  if (blocks.length > 49) {
    truncatedBlocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "_Message truncated. View full details on Atlas dashboard._" }],
    });
  }

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel,
      blocks: truncatedBlocks,
      text: `${headerMap[alertType]} — ${accounts.length} account(s)`,
    }),
  });
}
