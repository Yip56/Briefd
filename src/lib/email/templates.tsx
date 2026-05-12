import type { ScoredArticle } from "@/lib/types";
import { APP_NAME, APP_URL } from "@/lib/constants";

const BRAND = "#1D5C3A";
const BG    = "#F5F3EE";

const IMPACT: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: "#FEF3C7", color: "#92400E", label: "⚡ High impact" },
  medium: { bg: "#F3F4F6", color: "#6B7280", label: "Medium"        },
  low:    { bg: "#F3F4F6", color: "#9CA3AF", label: "Low"           },
};

function isVideoArticle(a: ScoredArticle): boolean {
  return a.is_video === true || (a.external_id ?? "").startsWith("yt_");
}

function articleRow(a: ScoredArticle, index: number): string {
  const imp     = IMPACT[a.impactLevel] ?? IMPACT.medium;
  const pubDate = a.published_at
    ? new Date(a.published_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })
    : "";
  const isVideo = isVideoArticle(a);
  const readCta = isVideo ? "Watch video →" : "Read full article →";
  const sourceLbl = isVideo ? `🎬 ${a.source_name ?? ""}` : (a.source_name ?? "");
  const rule    = index < 4 ? `<tr><td style="padding:0 0 20px"><hr style="border:none;border-top:1px solid #E5E7EB;margin:0"></td></tr>` : "";

  return `
<tr><td style="padding-bottom:24px">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding-bottom:6px">
      <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;background:${imp.bg};color:${imp.color}">${a.topic ?? ""}</span>
      ${a.impactLevel === "high" ? `<span style="margin-left:8px;font-size:11px;color:#92400E">⚡</span>` : ""}
    </td></tr>
    <tr><td style="padding-bottom:8px">
      <a href="${a.article_url}" style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;color:#111827;text-decoration:none;line-height:1.35">${a.title}</a>
    </td></tr>
    <tr><td style="padding-bottom:10px;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#374151;line-height:1.65">
      ${a.aiSummary || a.summary || ""}
    </td></tr>
    ${a.impactAnalysis && a.impactLevel !== "low" ? `
    <tr><td style="padding-bottom:12px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:3px;background:#F0A500;border-radius:2px"></td>
          <td style="padding:8px 12px;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-style:italic;color:#5C4A00;line-height:1.6">
            ⚡ Impacts you: ${a.impactAnalysis}
          </td>
        </tr>
      </table>
    </td></tr>` : ""}
    <tr><td>
      <div style="display:flex;align-items:center;justify-content:space-between">
        ${sourceLbl ? `<span style="font-family:monospace;font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em">${sourceLbl}${pubDate ? ` · ${pubDate}` : ""}</span>` : ""}
        <a href="${a.article_url}" style="font-family:monospace;font-size:11px;color:${BRAND};text-decoration:underline;letter-spacing:.04em">${readCta}</a>
      </div>
    </td></tr>
  </table>
</td></tr>
${rule}`;
}

export function buildEmailHtml(articles: ScoredArticle[], userEmail: string): string {
  const now     = new Date();
  const dayOfWeek = now.toLocaleDateString("en-MY", { weekday: "long" });
  const dateStr   = now.toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your ${APP_NAME} Digest</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

      <!-- Header -->
      <tr><td style="padding-bottom:4px;text-align:center">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:36px;font-weight:800;color:${BRAND};letter-spacing:.12em;text-transform:uppercase">${APP_NAME}</div>
      </td></tr>
      <tr><td style="padding-bottom:6px"><hr style="border:none;border-top:2px solid #0F0E0C;margin:0"></td></tr>
      <tr><td style="padding-bottom:24px;text-align:center">
        <span style="font-family:monospace;font-size:11px;color:#6B7280;letter-spacing:.08em;text-transform:uppercase">${dayOfWeek}, ${dateStr} &middot; Personal Edition</span>
      </td></tr>

      <!-- Articles -->
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${articles.slice(0, 5).map((a, i) => articleRow(a, i)).join("")}
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding-top:24px;text-align:center;font-size:12px;color:#9CA3AF;line-height:1.7">
        <div>You&rsquo;re receiving this because you scheduled a ${APP_NAME} digest.</div>
        <div style="margin-top:4px">
          <a href="${APP_URL}/settings" style="color:${BRAND};text-decoration:underline">Manage your schedule</a>
          &nbsp;&middot;&nbsp;
          <a href="${APP_URL}/settings" style="color:#9CA3AF;text-decoration:underline">Unsubscribe</a>
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// Legacy alias
export const renderDigestEmailHtml = buildEmailHtml;

export function DigestEmailTemplate({ articles }: { articles: ScoredArticle[] }) {
  return (
    <div>
      <h1>{APP_NAME} Digest</h1>
      {articles.map((a) => <div key={a.id}>{a.title}</div>)}
    </div>
  );
}
