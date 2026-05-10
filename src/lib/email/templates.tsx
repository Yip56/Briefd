import type { ScoredArticle } from "@/lib/types";
import { APP_NAME, APP_URL } from "@/lib/constants";

const BRAND = "#1D5C3A";
const BG    = "#F5F3EE";

const IMPACT: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: "#FEF3C7", color: "#92400E", label: "⚡ High impact" },
  medium: { bg: "#F3F4F6", color: "#6B7280", label: "Medium"         },
  low:    { bg: "#F3F4F6", color: "#9CA3AF", label: "Low"            },
};

function articleRow(a: ScoredArticle): string {
  const imp     = IMPACT[a.impactLevel] ?? IMPACT.medium;
  const pubDate = a.published_at
    ? new Date(a.published_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })
    : "";
  const base    = `${APP_URL}/api/feedback?articleId=${a.external_id ?? a.id}`;
  const stripe  = a.impactLevel === "high"
    ? `<td style="width:4px;background:#F59E0B"></td>`
    : "";

  return `
<tr><td style="padding-bottom:20px">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden">
    <tr>
      ${stripe}
      <td style="padding:20px 22px">
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-bottom:6px">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${imp.bg};color:${imp.color}">${imp.label}</span>
          ${a.source_name ? `<span style="margin-left:8px;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em">${a.source_name}${pubDate ? ` · ${pubDate}` : ""}</span>` : ""}
        </td></tr>
        <tr><td style="padding-bottom:8px">
          <a href="${a.article_url}" style="font-size:16px;font-weight:700;color:#111827;text-decoration:none;line-height:1.4">${a.title}</a>
        </td></tr>
        <tr><td style="padding-bottom:14px;font-size:14px;color:#374151;line-height:1.65">
          ${a.aiSummary || a.summary || ""}
        </td></tr>
        <tr><td>
          <a href="${base}&vote=up&redirect=${encodeURIComponent(a.article_url)}"
             style="display:inline-block;margin-right:8px;padding:4px 12px;border-radius:6px;border:1px solid #D1FAE5;background:#F0FDF4;font-size:12px;font-weight:600;color:#166534;text-decoration:none">👍 Useful</a>
          <a href="${base}&vote=down&redirect=${encodeURIComponent(a.article_url)}"
             style="display:inline-block;margin-right:16px;padding:4px 12px;border-radius:6px;border:1px solid #FEE2E2;background:#FEF2F2;font-size:12px;font-weight:600;color:#B91C1C;text-decoration:none">👎 Not relevant</a>
          <a href="${a.article_url}" style="font-size:12px;color:${BRAND};text-decoration:underline">Read full article →</a>
        </td></tr></table>
      </td>
    </tr>
  </table>
</td></tr>`;
}

export function buildEmailHtml(articles: ScoredArticle[], userEmail: string): string {
  const today = new Date().toLocaleDateString("en-MY", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your ${APP_NAME} Digest</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

      <tr><td style="padding-bottom:28px;text-align:center">
        <div style="font-size:30px;font-weight:800;color:${BRAND};letter-spacing:-.5px">${APP_NAME}</div>
        <div style="margin-top:4px;font-size:13px;color:#6B7280">Your personalised news digest &middot; ${today}</div>
      </td></tr>

      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${articles.map(articleRow).join("")}
        </table>
      </td></tr>

      <tr><td style="padding-top:8px;text-align:center;font-size:12px;color:#9CA3AF;line-height:1.7">
        <div>You&rsquo;re receiving this because you set up a ${APP_NAME} digest.</div>
        <div style="margin-top:4px">
          <a href="${APP_URL}/settings" style="color:${BRAND};text-decoration:underline">Manage your schedule</a>
          &nbsp;&middot;&nbsp;
          <a href="${APP_URL}/unsubscribe?email=${encodeURIComponent(userEmail)}" style="color:#9CA3AF;text-decoration:underline">Unsubscribe</a>
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// Legacy alias
export const renderDigestEmailHtml = buildEmailHtml;

// JSX component kept for documentation / future Resend React integration
export function DigestEmailTemplate({ articles }: { articles: ScoredArticle[] }) {
  return (
    <div>
      <h1>{APP_NAME} Digest</h1>
      {articles.map((a) => <div key={a.id}>{a.title}</div>)}
    </div>
  );
}
