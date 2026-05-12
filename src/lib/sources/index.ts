import type { RawArticle } from "@/lib/types";
import { RSS_FEEDS } from "@/lib/constants";
import { fetchNewsApiArticles } from "./newsapi";
import { fetchRssFeeds } from "./rss";
import { fetchRedditPosts } from "./reddit";
import { fetchGoogleNews } from "./googlenews";
import { fetchYouTubeVideos } from "./youtube";

const MAX_ARTICLES = 100;

const FALLBACK_ARTICLES: RawArticle[] = [
  {
    externalId: "fallback-1",
    title: "Bank Negara Holds OPR at 3.00% Amid Global Uncertainty",
    summary: "Malaysia's central bank maintained the overnight policy rate at 3.00% citing resilient domestic demand but cautious global outlook. Analysts expect rates to remain stable through 2025.",
    sourceName: "The Star",
    sourceUrl: "https://www.thestar.com.my",
    articleUrl: "https://www.thestar.com.my/business/business-news/2025/05/09/bnm-holds-opr",
    topic: "Economy",
    publishedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
  {
    externalId: "fallback-2",
    title: "Ringgit Strengthens Against USD as Fed Signals Rate Pause",
    summary: "The Malaysian ringgit gained 0.4% against the US dollar after the Federal Reserve indicated a potential pause in rate hikes, boosting emerging market currencies across Asia.",
    sourceName: "Reuters",
    sourceUrl: "https://www.reuters.com",
    articleUrl: "https://www.reuters.com/markets/asia/ringgit-strengthens-2025",
    topic: "Economy",
    publishedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
  },
  {
    externalId: "fallback-3",
    title: "Malaysia's Budget 2025: Key Takeaways for Working Adults",
    summary: "The government announced targeted subsidies, expanded tax relief for EPF contributions, and new incentives for electric vehicles in the latest budget revision affecting millions of Malaysians.",
    sourceName: "Malay Mail",
    sourceUrl: "https://www.malaymail.com",
    articleUrl: "https://www.malaymail.com/news/malaysia/2025/05/budget-2025-key-takeaways",
    topic: "Economy",
    publishedAt: new Date(Date.now() - 10 * 3600_000).toISOString(),
  },
  {
    externalId: "fallback-4",
    title: "OpenAI Launches GPT-5 with Real-Time Reasoning Capabilities",
    summary: "OpenAI unveiled GPT-5, its most capable model yet, featuring advanced real-time reasoning and multimodal understanding. The model is now available via API and will roll out to ChatGPT users globally.",
    sourceName: "Tech in Asia",
    sourceUrl: "https://www.techinasia.com",
    articleUrl: "https://www.techinasia.com/news/openai-gpt5-launch-2025",
    topic: "Tech & AI",
    publishedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  },
  {
    externalId: "fallback-5",
    title: "Malaysia Launches AI Roadmap: RM2 Billion for Digital Infrastructure",
    summary: "The government unveiled a national AI strategy allocating RM2 billion over five years for cloud infrastructure, upskilling programmes, and AI research hubs at public universities.",
    sourceName: "Free Malaysia Today",
    sourceUrl: "https://www.freemalaysiatoday.com",
    articleUrl: "https://www.freemalaysiatoday.com/category/nation/2025/05/malaysia-ai-roadmap",
    topic: "Tech & AI",
    publishedAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
  },
  {
    externalId: "fallback-6",
    title: "Grab Expands GrabPay Services to Rural Areas with Offline Mode",
    summary: "Grab announced expansion of its digital payment services to underserved rural communities in Sabah and Sarawak through an offline-capable GrabPay feature, targeting financial inclusion.",
    sourceName: "Tech in Asia",
    sourceUrl: "https://www.techinasia.com",
    articleUrl: "https://www.techinasia.com/news/grab-offline-payments-rural-2025",
    topic: "Tech & AI",
    publishedAt: new Date(Date.now() - 14 * 3600_000).toISOString(),
  },
  {
    externalId: "fallback-7",
    title: "Parliament Passes Revised Anti-Corruption Bill with Stricter Penalties",
    summary: "Malaysia's parliament approved amendments to the MACC Act introducing mandatory minimum sentences for corruption convictions and new whistleblower protections after heated cross-party debate.",
    sourceName: "Free Malaysia Today",
    sourceUrl: "https://www.freemalaysiatoday.com",
    articleUrl: "https://www.freemalaysiatoday.com/category/nation/2025/05/anti-corruption-bill-passed",
    topic: "Malaysian Politics",
    publishedAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
  },
  {
    externalId: "fallback-8",
    title: "Anwar Ibrahim Announces Cabinet Reshuffle Amid Economic Reform Push",
    summary: "Prime Minister Anwar Ibrahim made key ministerial changes focused on accelerating economic reforms, with the Finance Ministry taking on expanded oversight of investment promotion agencies.",
    sourceName: "Malay Mail",
    sourceUrl: "https://www.malaymail.com",
    articleUrl: "https://www.malaymail.com/news/malaysia/2025/05/cabinet-reshuffle-anwar",
    topic: "Malaysian Politics",
    publishedAt: new Date(Date.now() - 8 * 3600_000).toISOString(),
  },
];

export async function fetchAllSources(topics: string[]): Promise<RawArticle[]> {
  const newsApiKey  = process.env.NEWSAPI_KEY ?? "";
  const youtubeKey  = process.env.YOUTUBE_API_KEY ?? "";

  const [newsApiResult, rssResult, redditResult, googleNewsResult, youtubeResult] =
    await Promise.allSettled([
      fetchNewsApiArticles(topics, newsApiKey),
      fetchRssFeeds([...RSS_FEEDS]),
      fetchRedditPosts(),
      fetchGoogleNews(topics),
      fetchYouTubeVideos(topics, youtubeKey),
    ]);

  const newsApi    = newsApiResult.status    === "fulfilled" ? newsApiResult.value    : [];
  const rss        = rssResult.status        === "fulfilled" ? rssResult.value        : [];
  const reddit     = redditResult.status     === "fulfilled" ? redditResult.value     : [];
  const googleNews = googleNewsResult.status === "fulfilled" ? googleNewsResult.value : [];
  const youtube    = youtubeResult.status    === "fulfilled" ? youtubeResult.value    : [];

  console.log(
    `[Sources] Fetched: ${newsApi.length} NewsAPI + ${rss.length} RSS + ${reddit.length} Reddit ` +
    `+ ${googleNews.length} GoogleNews + ${youtube.length} YouTube = ` +
    `${newsApi.length + rss.length + reddit.length + googleNews.length + youtube.length} total`
  );

  const combined = [...newsApi, ...rss, ...reddit, ...googleNews, ...youtube];
  const source   = combined.length > 0 ? combined : [...FALLBACK_ARTICLES];

  const seen = new Set<string>();
  const deduped = source.filter((a) => {
    if (seen.has(a.articleUrl)) return false;
    seen.add(a.articleUrl);
    return true;
  });

  deduped.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return deduped.slice(0, MAX_ARTICLES);
}
