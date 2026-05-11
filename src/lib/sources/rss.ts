import Parser from "rss-parser";
import type { RawArticle, RssFeed } from "@/lib/types";

const parser = new Parser({
  timeout: 10_000,
  headers: { "User-Agent": "Briefd/1.0 (news digest app)" },
});

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toExternalId(url: string): string {
  // Use the full URL (with special chars replaced) so IDs are always unique
  return `rss-${url.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function deriveSourceUrl(feedUrl: string): string {
  try {
    const u = new URL(feedUrl);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return feedUrl;
  }
}

async function fetchFeed(feed: RssFeed): Promise<RawArticle[]> {
  const parsed = await parser.parseURL(feed.url);
  const sourceUrl = deriveSourceUrl(feed.url);

  return (parsed.items ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => {
      const rawSummary = item.contentSnippet ?? item.content ?? item.summary ?? item.title ?? "";
      return {
        externalId: toExternalId(item.link!),
        title: item.title!.trim(),
        summary: stripHtml(rawSummary).slice(0, 500),
        sourceName: feed.name,
        sourceUrl,
        articleUrl: item.link!,
        topic: feed.topic,
        publishedAt: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString(),
      };
    });
}

export async function fetchRssFeeds(feeds: RssFeed[]): Promise<RawArticle[]> {
  const results = await Promise.allSettled(feeds.map(fetchFeed));

  const articles: RawArticle[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
    // silently skip failed feeds — one broken feed shouldn't kill the digest
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.articleUrl)) return false;
    seen.add(a.articleUrl);
    return true;
  });
}
