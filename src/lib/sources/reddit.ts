import type { RawArticle } from "@/lib/types";

const SUBREDDITS = [
  "malaysia",
  "malaysiaFIRE",
  "KualaLumpur",
  "personalfinanceMalaysia",
  "MalaysianPF",
] as const;

interface RedditPost {
  data: {
    id: string
    title: string
    permalink: string
    url: string
    selftext: string
    score: number
    created_utc: number
    subreddit: string
    is_self: boolean
  }
}

interface RedditListing {
  data: {
    children: RedditPost[]
  }
}

function topicForSubreddit(subreddit: string): string {
  const map: Record<string, string> = {
    malaysia: "Malaysian Politics",
    malaysiaFIRE: "Finance & Investing",
    KualaLumpur: "Malaysian Politics",
    personalfinanceMalaysia: "Finance & Investing",
    MalaysianPF: "Finance & Investing",
  };
  return map[subreddit] ?? "Global News";
}

async function fetchSubreddit(subreddit: string): Promise<RawArticle[]> {
  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=10`,
    {
      headers: { "User-Agent": "Briefd/1.0 (news digest)" },
      next: { revalidate: 3600 },
    }
  );

  if (!res.ok) return [];

  const json: RedditListing = await res.json();
  const posts = json.data?.children ?? [];

  return posts
    .map((p) => p.data)
    .filter((p) => p.score >= 10 && p.title)
    .map((p) => {
      const permalink = `https://www.reddit.com${p.permalink}`;
      // For link posts, use the external URL; for text posts, use the permalink
      const articleUrl = p.is_self ? permalink : p.url;
      const rawSummary = p.selftext ? p.selftext.slice(0, 200).trim() : p.title;

      return {
        externalId: `reddit-${p.id}`,
        title: p.title,
        summary: rawSummary,
        sourceName: `Reddit r/${p.subreddit}`,
        sourceUrl: `https://www.reddit.com/r/${p.subreddit}`,
        articleUrl,
        topic: topicForSubreddit(subreddit),
        publishedAt: new Date(p.created_utc * 1000).toISOString(),
      };
    });
}

export async function fetchRedditPosts(
  subreddits: string[] = [...SUBREDDITS]
): Promise<RawArticle[]> {
  const results = await Promise.allSettled(subreddits.map(fetchSubreddit));

  const articles: RawArticle[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
  }

  // Deduplicate by URL (same link can appear across subreddits)
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.articleUrl)) return false;
    seen.add(a.articleUrl);
    return true;
  });
}
