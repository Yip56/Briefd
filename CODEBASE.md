# Briefd — Complete Codebase Documentation

This document explains every file, every function, and every important code block in the Briefd project. It is written to be understood plainly, while staying technically precise where it matters. Think of it as a guided tour that shows you not just *what* the code does, but *why* it exists and *how* each piece connects to the rest.

---

## Table of Contents

1. [What Briefd Is](#1-what-briefd-is)
2. [How the Whole System Fits Together](#2-how-the-whole-system-fits-together)
3. [How the AI Works (End-to-End)](#3-how-the-ai-works-end-to-end)
4. [Core Type Definitions — `src/lib/types.ts`](#4-core-type-definitions--srclibtypests)
5. [Global Constants — `src/lib/constants.ts`](#5-global-constants--srclibconstantsts)
6. [Authentication & Routing — `src/middleware.ts` + `src/lib/supabase/`](#6-authentication--routing--srcmiddlewarets--srclibsupabase)
7. [Article Sources — `src/lib/sources/`](#7-article-sources--srclibsources)
8. [Scoring & Ranking — `src/lib/scoring/ranker.ts`](#8-scoring--ranking--srclibscoringrankerts)
9. [AI Layer — `src/lib/ai/`](#9-ai-layer--srclibai)
10. [Article Queue — `src/lib/queue/buildQueue.ts`](#10-article-queue--srclibqueuebuildqueuets)
11. [Demo Mode — `src/lib/demo/`](#11-demo-mode--srclibdemo)
12. [The Digest API — `src/app/api/digest/route.ts`](#12-the-digest-api--srcappapidigeastroutets)
13. [Feedback API — `src/app/api/feedback/route.ts`](#13-feedback-api--srcappapifeefeedbackroutets)
14. [Profile Regeneration API — `src/app/api/algorithm/regenerate-profile/route.ts`](#14-profile-regeneration-api)
15. [The Digest UI — `src/components/digest/DigestFeed.tsx`](#15-the-digest-ui--srccomponentsdigestdigestfeedtsx)
16. [Article Card — `src/components/digest/ArticleCard.tsx`](#16-article-card--srccomponentsdigestarticlecardtsx)
17. [Algorithm Settings Page — `src/app/(dashboard)/algorithm/page.tsx`](#17-algorithm-settings-page)
18. [Email System — `src/lib/email/`](#18-email-system--srcliblemail)
19. [Database Schema (Implied)](#19-database-schema-implied)
20. [Data Flow Diagrams](#20-data-flow-diagrams)

---

## 1. What Briefd Is

Briefd is a personalised Malaysian news digest web app. It collects articles from multiple sources, scores each article based on who you are (your job, location, life stage, vehicle, chosen topics), writes a short plain-English summary telling you how each article affects *you personally*, and delivers up to five articles at a time in a newspaper-style layout.

The system has two modes:
- **Demo mode** — uses a built-in set of 28 pre-written articles. No live fetching. Good for testing.
- **Live mode** — fetches real articles from NewsAPI, RSS feeds, Reddit, Google News, and YouTube in real time.

---

## 2. How the Whole System Fits Together

```
Browser
  │
  ├─► Next.js Middleware (src/middleware.ts)
  │     Checks login. Redirects to /digest if logged in, to / if not.
  │
  ├─► /digest page
  │     Renders DigestFeed component (src/components/digest/DigestFeed.tsx)
  │     Calls GET /api/digest
  │
  ├─► GET /api/digest (src/app/api/digest/route.ts)
  │     Loads user profile + topics + algorithm settings + feedback
  │     If DEMO MODE → calls buildDemoDigest() → returns instantly
  │     If LIVE MODE → reads article_queue table
  │                   If queue is thin → calls buildArticleQueue()
  │                     → fetches from 5 sources
  │                     → scores articles
  │                     → upserts to articles table
  │                     → AI enrichment (Groq LLM)
  │                     → inserts into article_queue table
  │                   Returns top 5 unserved articles
  │
  ├─► ArticleCard (src/components/digest/ArticleCard.tsx)
  │     User clicks 👍 or 👎 → POST /api/feedback
  │     User clicks Read → POST /api/articles/click (tracks click)
  │
  └─► /algorithm page
        Tune scoring weights, topic composition, keywords
        POST /api/algorithm/settings → saves to user_algorithm_settings table
        POST /api/algorithm/regenerate-profile → asks Groq to rewrite AI profile
```

---

## 3. How the AI Works (End-to-End)

Briefd uses **Groq** (a fast AI inference service) running the **`llama-3.1-8b-instant`** model. Here is what happens from the moment an article is fetched to the moment the summary appears on screen.

### Step 1 — Article arrives raw
An article comes in from a source (e.g. RSS) with a `title` and a raw `summary`. The raw summary is often a news wire excerpt — dry, impersonal, sometimes cut off.

### Step 2 — Budget check (`src/lib/ai/budget.ts`)
Before calling Groq, the system checks two limits:
- **Daily budget**: Groq is capped at 100 calls per user per day (resets at midnight MYT). Gemini is capped at 25.
- **Session budget**: Each digest build session can use at most 20 AI calls.

If either limit is hit, the article gets the raw summary as a fallback. No AI call is made.

### Step 3 — The Groq prompt (`src/lib/ai/groq.ts`, lines 55–68)
The system builds two text blocks and sends them to the Groq API:

**System prompt** (what role Groq plays):
> "You are a personal news analyst for a Malaysian news digest. Write in second person ('you'/'your'). Only mention the reader's profile if DIRECTLY relevant. Be specific with numbers and dates. Never start with 'This article'. Always write complete sentences. Never end mid-word or mid-sentence."

**User prompt** (the actual request):
> "Reader profile: [occupation] in [location], [life stage], owns [vehicle].
> Preferences: [AI-generated profile from past feedback]
> Article: [title]
> Content: [first 400 chars of summary]
> Respond with JSON only:
> {"combined":"[what happened] — [direct impact on you] [date if available]. Max 45 words.","impactLevel":"high or medium or low"}"

### Step 4 — Groq responds
Groq returns a JSON string like:
```json
{"combined":"Bank Negara held rates at 3% — your mortgage repayments stay the same this month.","impactLevel":"medium"}
```

### Step 5 — Result is stored and cached
- The `combined` text is written to `article_queue.ai_summary` and `articles.ai_summary`.
- Next time the same article is requested, it's read from the cache instead of calling Groq again.

### Step 6 — Displayed to user
`ArticleCard.tsx` reads `article.combined`. If it doesn't end with `.`, `!`, or `?`, a `...` is appended as a safety net (line 92).

### How the AI profile works
When you dislike articles, two things happen automatically:
1. **Keyword extraction** — Groq reads the article title, your reason for disliking, and any comment you typed. It extracts 2–4 keywords representing what you want to avoid. These are stored in `user_algorithm_settings.avoidance_keywords`.
2. **Profile regeneration** — Your last 20 feedback votes are sent to Groq with the prompt: *"Write a 3-sentence profile describing their news preferences, topics they care about, what they want to avoid, and their likely occupation context."* The result is stored in `user_algorithm_settings.gemini_profile` and injected into every future article prompt.

---

## 4. Core Type Definitions — `src/lib/types.ts`

**File:** `src/lib/types.ts`

This file defines the shape of every important data object in the system. Think of it as a glossary. If you want to know what fields an article has, or what a user profile looks like, this is where you look.

---

### Lines 1–5 — Simple union types

```ts
export type ImpactLevel = 'high' | 'medium' | 'low'
export type DigestFrequency = 'daily' | 'weekly'
export type VoteValue = 'up' | 'down'
```

These are "pick one of these options" types. `ImpactLevel` is the AI's judgement of how much an article affects you personally. `VoteValue` is whether you liked or disliked an article.

---

### Lines 9–21 — `Profile`

```ts
export interface Profile {
  id: string
  email: string
  occupation: string | null
  location: string | null
  life_stage: string | null
  vehicle: string | null
  digest_time: string        // e.g. "08:00:00"
  digest_frequency: DigestFrequency
  email_digest_enabled: boolean
  ...
}
```

This is your user account. The `occupation`, `location`, `life_stage`, and `vehicle` fields are used by the AI and the scoring algorithm to decide which articles are most relevant to you. For example, if your vehicle is "Car owner", fuel price articles will score higher.

---

### Lines 23–30 — `UserTopic`

```ts
export interface UserTopic {
  id: string
  user_id: string
  topic: string
  is_preset: boolean
  weight: number
  ...
}
```

One row per topic you have selected (e.g. "Economy", "Tech & AI"). The `weight` field (0.0–2.0) multiplies the topic-match score — a higher weight means you want more articles on that topic.

---

### Lines 74–86 — `RawArticle`

```ts
export interface RawArticle {
  externalId: string
  title: string
  summary: string
  sourceName: string
  sourceUrl: string
  articleUrl: string
  topic: string
  publishedAt: string
  isVideo?: boolean
  impactScore?: number
  profileTags?: string[]
}
```

This is an article as it comes out of the sources layer — before it is scored, stored in the database, or AI-enriched. `impactScore` and `profileTags` are used by demo articles to give them pre-baked scoring hints.

---

### Lines 96–101 — `ScoredArticle`

```ts
export interface ScoredArticle extends Article {
  relevanceScore: number
  impactLevel: ImpactLevel
  combined: string
  userVote?: VoteValue | null
}
```

This is what the UI actually displays. It extends the database `Article` type with:
- `relevanceScore` — the number computed by the ranker (higher = more relevant to you).
- `impactLevel` — the AI's "high / medium / low" label.
- `combined` — the AI-written sentence explaining the article's impact. This is what you read under the headline.
- `userVote` — whether you previously liked or disliked this article.

---

### Lines 117–126 — `DigestResult`

```ts
export interface DigestResult {
  articles: ScoredArticle[]
  remainingArticles?: ScoredArticle[]
  generatedAt: string
  totalScored: number
  geminiQuotaRetryAfter?: string | null
  queueStats?: QueueStats
  isDemo?: boolean
  aiBudgetExhausted?: boolean
}
```

This is the entire JSON payload the `/api/digest` route returns. `articles` is the main batch of 5. `remainingArticles` is populated only in demo mode — it powers the "More Articles" panel. `queueStats` tells the UI how many refreshes are left.

---

### Lines 128–144 — `UserAlgorithmSettings`

```ts
export interface UserAlgorithmSettings {
  impact_weight: number
  topic_weight: number
  recency_weight: number
  keyword_weight: number
  feedback_weight: number
  feedback_penalty: number
  click_read_bonus: number
  custom_keywords: Array<{ keyword: string; points: number }>
  avoidance_keywords: Array<{ keyword: string; points: number }>
  gemini_profile: string
  topic_composition: Record<string, number>
  ...
}
```

Everything on the "My Algorithm" page is stored here. Each `weight` is a number from 0–100 that controls how much a scoring factor matters. `custom_keywords` boost articles. `avoidance_keywords` penalise articles. `gemini_profile` is the 3-sentence text the AI wrote to describe your preferences. `topic_composition` is a map like `{"Economy": 40, "Tech & AI": 30, ...}` controlling how many articles from each topic appear in your digest.

---

## 5. Global Constants — `src/lib/constants.ts`

**File:** `src/lib/constants.ts`

---

### Lines 1–12 — `PRESET_TOPICS`

```ts
export const PRESET_TOPICS = [
  'Economy', 'Fuel & Transport', 'Property', 'Jobs & Career',
  'Malaysian Politics', 'Tech & AI', 'Health', 'Startups',
  'Global News', 'Finance & Investing',
] as const
```

The 10 topics a user can choose during onboarding. These exact strings are matched against `article.topic` throughout the scoring and filtering pipeline — spelling must match exactly.

---

### Lines 52–58 — `SCORING_WEIGHTS`

```ts
export const SCORING_WEIGHTS = {
  recency: 40,
  topicMatch: 30,
  profileMatch: 25,
  keywordMatch: 15,
  voteFeedback: { up: 10, down: -20 },
} as const
```

These are the *default* scoring weights used when a user has not customised their algorithm. The recency score (40 pts) is the biggest factor — fresh articles always get priority. Downvotes hurt more than upvotes help (–20 vs +10), which trains the system quickly on what you don't like.

---

### Lines 70–77 — `RSS_FEEDS`

```ts
export const RSS_FEEDS = [
  { name: 'Free Malaysia Today', url: '...', topic: 'Malaysian Politics' },
  { name: 'The Star', url: '...', topic: 'Economy' },
  { name: 'Malay Mail', url: '...', topic: 'Malaysian Politics' },
  { name: 'Reuters Business', url: '...', topic: 'Economy' },
  { name: 'Tech in Asia', url: '...', topic: 'Tech & AI' },
  { name: 'EdgeProp', url: '...', topic: 'Property' },
]
```

The six RSS feeds Briefd polls. Each feed is pre-labelled with a topic so articles from it are automatically categorised before any AI processing.

---

### Lines 79–81 — `IS_DEMO_MODE`

```ts
export const IS_DEMO_MODE =
  process.env.NEXT_PUBLIC_DATA_MODE === 'demo' ||
  process.env.DATA_MODE === 'demo'
```

A boolean that is `true` when either environment variable is set to `"demo"`. Two variables are checked because `NEXT_PUBLIC_*` is available in the browser but `DATA_MODE` is server-only. The digest route also allows a per-request cookie override (`briefd_data_mode`), letting you toggle modes without restarting the server.

---

## 6. Authentication & Routing — `src/middleware.ts` + `src/lib/supabase/`

### `src/middleware.ts` (Lines 1–12)

```ts
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|...)$).*)"],
};
```

This file runs before every single request. The `matcher` pattern means it runs on all paths *except* static files (images, fonts, etc.). It delegates entirely to `updateSession`.

---

### `src/lib/supabase/middleware.ts` — `updateSession` (Lines 7–49)

```ts
const PROTECTED_ROUTES = ["/digest", "/settings", "/algorithm", "/archive"];
const AUTH_ROUTES      = ["/login", "/register"];
```

- **Lines 35–39**: If a user is **not logged in** and visits `/digest`, `/settings`, etc., they are redirected to `/` (the marketing homepage).
- **Lines 42–46**: If a user **is logged in** and visits `/login`, `/register`, or `/` (marketing home), they are redirected to `/digest`. This prevents a logged-in user from accidentally landing on the marketing page.
- **Line 30**: Uses `getUser()` (which validates the JWT with the Supabase server) rather than `getSession()` (which trusts a potentially stale local cookie). This is more secure.

---

### `src/lib/supabase/actions.ts`

**`createUserProfile` (Lines 17–32)**
Creates a new row in the `profiles` table when a user registers. Uses a **service-role** Supabase client (line 9–15) that bypasses Row Level Security — this is safe here because it's a server action, never exposed to the browser. Error code `23505` means the profile already exists; that is silently ignored.

**`signOut` (Lines 34–38)**
Calls Supabase `signOut()` and redirects to `/login`.

**`getUserProfile` (Lines 46–60)**
Fetches the user's profile row and all their topic rows in a single parallel call. Returns them combined as `UserPreferences`.

---

## 7. Article Sources — `src/lib/sources/`

**File:** `src/lib/sources/index.ts`

This is where Briefd gets its raw news. Five sources run in parallel using `Promise.allSettled` so that if one source fails (e.g. the RSS server is down), the others still succeed.

---

### Lines 9–92 — `FALLBACK_ARTICLES`

Eight hardcoded articles covering Economy, Tech & AI, and Malaysian Politics. These are used when *all* live sources return zero articles — a last resort to ensure the digest is never empty. They are filtered by selected topics.

---

### Lines 94–137 — `fetchAllSources`

```ts
const [newsApiResult, rssResult, redditResult, googleNewsResult, youtubeResult] =
  await Promise.allSettled([
    fetchNewsApiArticles(topics, newsApiKey),
    fetchRssFeeds([...RSS_FEEDS]),
    fetchRedditPosts(),
    fetchGoogleNews(topics),
    fetchYouTubeVideos(topics, youtubeKey),
  ]);
```

**`Promise.allSettled`** (line 98) means all five fetches run at the same time (fast), and a failure in one does NOT stop the others. Compare with `Promise.all` which would throw if any one fails.

**Lines 119–122** — If all live sources return empty, fall back to the hardcoded articles.

**Lines 125–136** — Deduplication by URL: uses a `Set<string>` to remove any article whose URL was already seen. Articles are then sorted newest-first. The result is capped at `MAX_ARTICLES = 100`.

---

### Sub-sources

| File | What it does |
|------|-------------|
| `src/lib/sources/rss.ts` | Parses the 6 RSS feeds using `rss-parser`. Strips HTML from summaries. Times out after 10 seconds per feed. |
| `src/lib/sources/newsapi.ts` | Calls NewsAPI.org searching for Malaysian news by topic. Returns up to 20 articles per topic. |
| `src/lib/sources/reddit.ts` | Fetches posts from `/r/malaysia`, `/r/personalfinanceMalaysia`, etc. Only includes posts with score ≥ 10 (popular posts). Maps subreddit name to a Briefd topic. |
| `src/lib/sources/googlenews.ts` | Searches Google News RSS with a `?q=[topic]+Malaysia` query. Returns up to 10 articles per topic. |
| `src/lib/sources/youtube.ts` | Uses the YouTube Data API to find relevant videos. Filters out `#shorts`. Returns up to 15 videos. Videos are flagged with `isVideo: true`. |

---

## 8. Scoring & Ranking — `src/lib/scoring/ranker.ts`

**File:** `src/lib/scoring/ranker.ts`

This is the brain of the personalisation. It takes a list of raw articles and returns them sorted by how relevant they are to *you specifically*.

---

### Lines 4–7 — `HIGH_IMPACT_WORDS`

```ts
const HIGH_IMPACT_WORDS = [
  "subsidy", "price hike", "interest rate", "opr", "epf", "tax",
  "layoff", "ban", "mandatory", "emergency",
];
```

If any of these words appear in an article's title, the article is automatically labelled `"high"` impact regardless of its score. These are words that tend to signal news that directly affects people's money or daily life.

---

### Lines 11–19 — `recencyScore`

```ts
function recencyScore(publishedAt: string, recencyWeight: number): number {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const h = ageMs / 3_600_000;  // convert ms to hours
  if (h <= 6)  return Math.round(recencyWeight * scale);   // very fresh
  if (h <= 24) return Math.round(30 * scale);              // same day
  if (h <= 72) return Math.round(15 * scale);              // last 3 days
  return Math.round(5 * scale);                            // older
}
```

An article published within the last 6 hours scores the full `recencyWeight` (default 40 points). After 72 hours it scores only 5 points. The `scale` factor adjusts all values when the user has changed their recency weight from the default.

---

### Lines 21–38 — `topicMatchScore`

```ts
function topicMatchScore(articleTopic: string, userTopics: UserTopic[], topicWeight: number): number
```

Compares the article's topic against your selected topics. An exact match (e.g. article is "Economy" and you selected "Economy") scores the full `topicWeight`. A partial word match (e.g. article is "Finance & Investing" and you selected "Finance") scores half. The result is then multiplied by the topic's `weight` (0.5–2.0), which you set on the My Algorithm page.

---

### Lines 40–70 — `profileMatchScore`

```ts
function profileMatchScore(article, profile, impactWeight): number
```

Checks whether *your profile* makes this article personally relevant. Four checks, any one of which awards the full `profileMatch` score:

1. You own a car or motorcycle AND the article is about fuel or transport.
2. You are a student or fresh graduate AND the article is about jobs or careers.
3. You are a business owner or investor AND the article is about finance or economy.
4. You are renting or looking to buy AND the article is about property.

This is a simple rule-based system — no AI involved at this stage.

---

### Lines 72–81 — `keywordMatchScore`

Scans the full article text (title + summary) for the names of your selected topics. Each topic name found adds `keywordWeight` points. This is a secondary boost on top of the topic match — it rewards articles that mention multiple topics you care about.

---

### Lines 83–108 — Vote scores and custom keyword scores

- `voteFeedbackScore`: If you previously upvoted this article, +`feedbackUp` (default 10). If you downvoted, −`feedbackDown` (default 20).
- `customKeywordScore`: Scans the article text against your "Boost keywords" list (adds points) and your "Avoidance keywords" list (subtracts points). The number of points per keyword is set by you on the My Algorithm page.

---

### Lines 117–192 — `scoreArticles` (main export)

```ts
export function scoreArticles(
  articles: RawArticle[],
  preferences: UserPreferences,
  feedbackMap: Record<string, VoteValue>,
  algorithmSettings?: UserAlgorithmSettings | null,
  clickedArticleUrls?: Set<string>
): ScoredArticle[]
```

This is the function that ties everything together. For every article:

1. Reads your algorithm settings (or uses defaults if you haven't saved custom settings).
2. Checks if the article's topic is in your selected topics. If not, applies a −50 penalty (`offTopicPenalty`, line 145).
3. Adds an `impactScoreBonus` (line 147) — demo articles come with a pre-set `impactScore` (0–100); this converts it to up to 20 bonus points.
4. Adds a `profileTagBonus` (lines 149–154) — demo articles have `profileTags`; if one matches your profile fields (vehicle, occupation, location, life stage), +25 points each.
5. Sums all scoring factors into a single `score`.
6. Calls `deriveImpactLevel` (line 168) to convert the score into "high / medium / low".
7. Returns articles sorted highest-score-first, capped at `TOP_N = 50`.

---

## 9. AI Layer — `src/lib/ai/`

### `src/lib/ai/groq.ts`

The direct interface to the Groq AI API.

**Lines 12–18 — Lazy singleton**
```ts
let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}
```
The Groq client is only created once, the first time it is needed. This avoids creating it at import time (which would crash during a browser-side build because `process.env.GROQ_API_KEY` doesn't exist there).

**Lines 21–35 — `callGroq`**
The generic wrapper. Takes a user prompt, a system prompt, and a max token limit. Sends a chat completion request and returns the response text.

**Lines 37–89 — `analyseArticleGroq`**
The most important function. Builds the personalised prompt described in section 3 and parses the JSON response. If parsing fails or the API is unavailable, it returns a `fallback` of the first 150 characters of the raw summary with `"medium"` impact.

**Lines 91–111 — `groqSummariseArticle`**
A simpler call that generates a single factual sentence summarising the article. Used for legacy contexts.

**Lines 113–142 — `groqGetImpactAnalysis`**
Generates 1–2 sentences explaining how the article affects the reader. Addresses the reader as "you". Used in legacy contexts.

**Lines 144–170 — `groqGetAiImpactScore`**
Classifies an article as high/medium/low impact with a short reason phrase. Returns JSON.

**Lines 172–193 — `groqExtractAvoidanceKeywords`**
When you dislike an article, this is called. Groq reads the article title, your chosen reason ("Too technical", etc.), and any free-text comment you typed, then returns a JSON array of 2–4 keywords representing what you want to avoid (e.g. `["cryptocurrency", "blockchain"]`).

**Lines 195–231 — `groqUpdateProfile`**
Fetches your last 20 feedback votes from Supabase, sends them to Groq, and asks it to write a 3-sentence preference profile. Saves the result to `user_algorithm_settings.gemini_profile`. This profile is injected into every subsequent article analysis prompt, personalising the AI's writing to match your interests.

---

### `src/lib/ai/budget.ts`

Controls how many AI calls can be made.

**Lines 19–22 — Limits**
```ts
const GROQ_LIMIT   = 100;   // max Groq calls per user per day
const GEMINI_LIMIT = 25;    // max Gemini calls per user per day
const DIGEST_CAP   = 20;    // max calls per digest-build session
```

**Lines 24–31 — `getTodayMYT` / `nextMidnightMYT`**
Compute today's date and the next midnight in Malaysian time (UTC+8). This ensures daily budgets reset at midnight KL time, not UTC midnight.

**Lines 34–104 — `getDailyBudget`**
Reads the `gemini_daily_budget` table. If no row exists for today, creates one. If the stored date is yesterday (the user's row is from a previous day), resets all counters to 0.

**Lines 106–119 — `getDigestBudget`**
Counts how many AI calls have been made in the current `sessionId` by querying `gemini_usage`. A session is identified by a string like `digest_1716912345678` (timestamp-based, created fresh each time the queue is built).

**Lines 121–133 — `canMakeCall`**
Returns `true` only if both the daily provider budget AND the session budget have calls remaining. This is the guard called before every Groq API request.

**Lines 135–174 — `recordAiCall`**
After a successful AI call, logs it: inserts a row into `gemini_usage` and calls a Supabase RPC `increment_ai_usage` which increments the counters in `gemini_daily_budget`. If the insert fails, returns `false` — budget enforcement is best-effort, not transactional.

---

### `src/lib/ai/summarise.ts`

A thin orchestration layer between the queue and the raw Groq functions.

**Lines 16–47 — `analyseArticle`**
The main entry point called during queue enrichment. It:
1. Checks if `GROQ_API_KEY` is set. If not, returns the fallback immediately.
2. Calls `canMakeCall` with the provided user + session IDs.
3. If allowed, delegates to `analyseArticleGroq` with the tracking info (so the call gets recorded).

---

### `src/lib/ai/feedback.ts`

Manages the feedback → AI profile update loop.

**Lines 5–33 — `extractAvoidanceKeywords`**
Checks the budget, calls `groqExtractAvoidanceKeywords`, records the call, and returns the keyword array.

**Lines 35–82 — `updateGeminiProfile`**
Called both automatically (after every downvote) and manually (when you click "↻ Regenerate AI Profile"). It:
1. Fetches your last 20 feedback votes with the article titles and topics joined in.
2. Checks the budget.
3. Calls Groq with a profile-generation prompt.
4. Saves the result to `user_algorithm_settings.gemini_profile`.

---

### `src/lib/ai/digest.ts`

A lower-level digest builder used in non-queue contexts.

**Lines 6–7 — Constants**
```ts
const TOTAL_ARTICLES = 15;
const CONCURRENCY = 3;
```
Targets 15 articles and enriches 3 at a time (to avoid rate-limit bursts).

**Lines 11–21 — `batchedAsync`**
A helper that runs async tasks in batches. With `concurrency = 3`, it runs tasks 0–2 in parallel, waits for them, then runs 3–5, etc.

**Lines 23–123 — `buildDigest`**
Scores articles, groups them into topic buckets, allocates slots proportionally, interleaves topics (so you don't get all Economy articles first), then enriches with AI summaries from the cache.

---

## 10. Article Queue — `src/lib/queue/buildQueue.ts`

**File:** `src/lib/queue/buildQueue.ts`

This is the pipeline that goes from "nothing" to "five AI-enriched articles ready to show the user." It is long (363 lines) because it has to handle many edge cases. Here is a section-by-section walkthrough.

---

### Lines 10–24 — `sleep` and `runBatched`

```ts
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
```

`runBatched` runs an async function on articles in batches of `batchSize`, with a `pauseMs` pause between batches. This prevents hammering the Groq API with too many concurrent requests.

---

### Lines 28–66 — `allocateTopicSlots`

Takes your topic composition percentages (e.g. `{"Economy": 40, "Tech & AI": 30, ...}`) and converts them into article slot counts (e.g. `{"Economy": 6, "Tech & AI": 4, ...}` for a 15-article digest). Handles rounding errors by giving leftover slots to the top topic.

If the composition percentages don't add up to ~100%, it falls back to equal allocation.

---

### Lines 68–107 — `buildCompositionQueue`

Takes a flat list of scored articles and redistributes them into the correct topic proportions. Articles within each topic bucket are already sorted by score (best first) because `scoreArticles` sorted them.

---

### Lines 109–362 — `buildArticleQueue` (main function)

```ts
export async function buildArticleQueue(
  userId: string,
  preferences: UserPreferences,
  algorithmSettings: UserAlgorithmSettings | null,
  feedbackMap: Record<string, VoteValue>,
  clickedUrls: Set<string>,
  supabase: SupabaseClient,
  isDemoMode = false
): Promise<void>
```

**Step-by-step flow:**

1. **Lines 123–133** — Fetch raw articles. In demo mode, filters `DEMO_ARTICLES` by topic. In live mode, calls `fetchAllSources`.

2. **Lines 135–143** — Hard topic filter: removes any article whose topic is not in your selected list. This is a safety net after scoring.

3. **Lines 145–163** — Deduplication: removes duplicate articles by `external_id`. PostgreSQL cannot update the same row twice in one `upsert` batch, so this prevents database errors.

4. **Lines 165–173** — Upserts all articles to the `articles` table. If an article already exists (same `external_id`), it updates the existing row.

5. **Lines 183–193** — Cache check: reads back any articles that already have an AI summary in the database. Builds an `EnrichmentCache` map so those articles don't need a new Groq call.

6. **Lines 195** — Scores all articles using the full ranker.

7. **Lines 199–219** — Reads the existing unserved queue. Articles already waiting in the queue are excluded from re-adding. When the queue is fully exhausted (zero unserved rows), it purges the served rows so the table doesn't grow unboundedly.

8. **Lines 248** — Applies `buildCompositionQueue` to respect your topic composition percentages.

9. **Lines 266–275** — Inserts the new queue rows into `article_queue`.

10. **Lines 282–329 — `enrichArticle`**: The async function called on each article. If the cache has an AI summary, writes it to the queue row without calling Groq. Otherwise calls `analyseArticle` (which calls Groq), then writes the result to both `article_queue.ai_summary` and `articles.ai_summary`.

11. **Lines 331–356** — Two enrichment strategies:
    - **Demo mode**: Uses a simple template string, no AI calls.
    - **Live mode**: Enriches the first `DIGEST_SIZE` (5) articles immediately (synchronously, before returning the response). The next 10 articles are enriched in the background using Next.js's `after()` function, which runs after the HTTP response has been sent to the browser.

---

## 11. Demo Mode — `src/lib/demo/`

### `src/lib/demo/articles.ts`

Contains 28 pre-written `RawArticle` objects covering all 10 topics. Each article has:
- A realistic Malaysian headline and summary.
- An `impactScore` (0–100) that tells the ranker how personally impactful this article is.
- `profileTags` (e.g. `["Car owner", "Kuala Lumpur"]`) that give extra points to users whose profile matches.

These articles are static — they never expire, never come from the internet.

---

### `src/lib/demo/buildDemoDigest.ts`

**Lines 5–10 — `buildDemoSentence`**

```ts
function buildDemoSentence(text: string): string {
  if (text.length <= 180) return text;
  const truncated = text.slice(0, 180);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}
```

Truncates a summary to 180 characters but always cuts at a word boundary (the last space before character 180). This prevents mid-word truncation like *"RON95 prices now fixed at RM2.05 per lit..."* becoming *"RON95 prices now fixed at RM2.05 per li..."*.

**Lines 12–37 — `buildDemoDigest`**

1. Filters demo articles to only those matching your selected topics.
2. Scores them using the standard `scoreArticles` ranker (including your custom weights and feedback).
3. Applies `buildDemoSentence` to every article's summary (overwriting whatever the ranker put in `combined`).
4. Returns the top 5 as `articles` and everything else as `remainingArticles`.
5. Sets `isDemo: true` so the UI shows the "DEMO MODE" badge and the "More Articles" panel instead of the "Past Digests" accordion.

---

## 12. The Digest API — `src/app/api/digest/route.ts`

**File:** `src/app/api/digest/route.ts`

This is the route that the browser calls on every page load to get articles.

---

### Lines 11–15 — Setup

```ts
export const dynamic = "force-dynamic";
const BATCH_SIZE = 5;
```

`force-dynamic` tells Next.js never to cache this route — every request must hit the server because the response depends on who is logged in.

---

### Lines 42–63 — `rowToScoredArticle`

Converts a raw database row (from `article_queue` joined to `articles`) into a `ScoredArticle` object the UI can display. Key line:

```ts
combined: row.ai_summary ?? art.ai_summary ?? art.summary ?? "",
```

Priority order for the summary text:
1. `row.ai_summary` — the queue row's AI summary (freshest).
2. `art.ai_summary` — the article table's cached AI summary.
3. `art.summary` — the raw RSS/NewsAPI summary.
4. Empty string as last resort.

---

### Lines 118–226 — `GET` handler (the main function)

**Lines 125–130 — Demo mode detection:**
```ts
const cookieMode = request.cookies.get("briefd_data_mode")?.value;
const isDemo = cookieMode === "live" ? false : cookieMode === "demo" ? true : IS_DEMO_MODE;
```
The cookie overrides the environment variable. This lets you toggle demo/live mode from the Settings page without restarting the server.

**Lines 135–162 — Data loading**: Loads your profile, topics, algorithm settings, clicks, and feedback votes in parallel (four queries run simultaneously using `Promise.all`).

**Lines 164 — Feedback map**: Builds a `Record<externalId, "up"|"down">` so the ranker can look up your vote for any article by its external ID.

**Lines 169–175 — Demo hard guard:**
```ts
if (isDemo) {
  const result = buildDemoDigest(selectedTopics, preferences, algorithmSettings);
  return NextResponse.json(result);
}
```
If demo mode is on, skip everything below and return the demo digest immediately. This bypasses the database queue entirely.

**Lines 177–187 — `?refresh=new`**: Marks all current unserved articles as served (archives them) then builds a completely fresh queue. Used by the "Rebuild Queue" button.

**Lines 189–217 — `?refresh=true`**: Archives the current 5-article batch (inserts into `digest_archives`), marks them as served, then returns the next 5. If the queue is running low, triggers a background rebuild.

**Lines 219–225 — Initial load**: On first load, fetches the current unserved batch. If it has fewer than 5 articles, triggers a background queue build.

---

## 13. Feedback API — `src/app/api/feedback/route.ts`

**File:** `src/app/api/feedback/route.ts`

Handles both upvotes and downvotes on articles.

---

### Lines 36–65 — Demo article UUID resolution

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}$/i;
let resolvedArticleId = articleId;
if (!UUID_RE.test(articleId)) {
  // articleId is something like "demo_027" — not a real UUID
  // Upsert the demo article into the articles table to get a real UUID
  const { data: upserted } = await supabase.from("articles").upsert({
    external_id: articleId,
    title: articleTitle,
    ...
  }, { onConflict: "external_id" }).select("id").single();
  resolvedArticleId = upserted.id;
}
```

The `article_feedback` table requires `article_id` to be a UUID that exists in the `articles` table. Demo articles have IDs like `"demo_027"`. This code upserts the demo article into the `articles` table on the first feedback interaction, generating a real UUID. Subsequent feedback on the same demo article finds the existing row (via the `external_id` conflict key) and reuses its UUID.

This is why demo feedback persists correctly and why "Regenerate AI Profile" works even in demo mode.

---

### Lines 83–128 — Down-vote side effects

When you dislike an article (`vote === "down"`):
1. Calls `extractAvoidanceKeywords` (Groq) to extract keywords from your reason and comment.
2. Merges new keywords with your existing `avoidance_keywords` list (no duplicates).
3. Upserts the updated list to `user_algorithm_settings`.
4. Fire-and-forgets `updateGeminiProfile` — regenerates your 3-sentence AI profile asynchronously in the background.

---

### Lines 133–155 — `GET` handler (email feedback)

When you click the 👍 or 👎 link in a digest email, this handler records your vote and redirects to the `redirect` URL. It only accepts UUID article IDs (not demo IDs) because email links are only generated for live articles.

---

## 14. Profile Regeneration API

**File:** `src/app/api/algorithm/regenerate-profile/route.ts`

**Lines 7–43 — `POST` handler**

Triggered by the "↻ Regenerate AI Profile" button on the My Algorithm page.

1. **Line 14–19** — Fetches the last 20 feedback rows, joining in the article title and topic.
2. **Lines 23–27** — If zero feedback rows, returns a `400` error: *"No feedback yet — dislike some articles first, then regenerate."*
3. **Line 31** — Calls `updateGeminiProfile`, which sends the feedback history to Groq and saves the resulting 3-sentence profile.
4. **Lines 33–40** — Reads back the freshly saved profile and returns it to the browser so the UI can update the textarea without a page reload.

---

## 15. The Digest UI — `src/components/digest/DigestFeed.tsx`

**File:** `src/components/digest/DigestFeed.tsx`

This is the largest UI file. It manages the state of the entire digest page.

---

### Lines 14–21 — `formatDigestDate`

Returns a date string in the style of a newspaper masthead: `"SUNDAY · 18 MAY 2025"`. Updates once on mount (`useEffect` at line 634).

---

### Lines 25–119 — `NewspaperGrid`

Takes the 5 articles and arranges them in a newspaper layout:
- **Article 0**: Banner — full width, large headline, largest text.
- **Articles 1–2**: Two-column grid.
- **Articles 3–5**: Three-column grid.
- **Articles 6+**: Compact list rows.

Each zone uses a different `variant` prop on `ArticleCard` which renders a different visual layout.

The `animate-fadeUp-1` through `animate-fadeUp-4` class names trigger staggered fade-in animations defined in `globals.css`.

---

### Lines 123–358 — `MoreArticlesPanel` (demo mode only)

Displayed below the main digest when `isDemo` is true. Shows all articles beyond the top 5.

- **Line 130** — `useState(true)` starts expanded.
- **Lines 130–131** — Two independent states: `expanded` (show/hide the list) and `panelTopic` (topic filter within the panel).
- **Lines 188–213** — Topic filter pills. Clicking "All" sets `panelTopic` to `null`; clicking a topic string filters the visible list.
- **Lines 224–228** — The expand/collapse animation uses `maxHeight` transitioning from `"9999px"` (fully open) to `"0"` (fully closed) via CSS transition. An actual height animation cannot be used because the height is unknown.
- **Lines 315–316** — The paragraph uses `WebkitLineClamp: 2` to display at most 2 lines of summary text, clipping overflow with an ellipsis.

---

### Lines 361–441 — `ArchiveArticleRow` and `ArchiveEntry`

Simple components for rendering a single article row and a collapsible archive entry in the "Past Digests" section.

---

### Lines 491–579 — `PastDigests` (live mode only)

Fetches `/api/archives` on mount, displays up to 5 archives, with a "LOAD N MORE" button to show the rest. Each archive expands/collapses on click.

---

### Lines 616–1082 — `DigestFeedInner`

The main state machine of the page. Key state variables:

| Variable | Purpose |
|----------|---------|
| `digest` | The full `DigestResult` from the API |
| `articles` | The current articles to display (may differ from `digest.articles` when filters are active) |
| `loading` | True during the initial fetch |
| `activeTopic` | The selected topic filter (null = "ALL") |
| `impactFilter` | True when the "⚡ High Impact" filter is on |
| `queueDone` | True when the queue is exhausted (no more articles to show) |
| `confettiFiredRef` | Prevents the celebration confetti from firing twice |

**Lines 649–716 — `fetchDigest`**

The central async function. Called on mount (`useEffect` at line 718) and when the Refresh button is clicked.

- `isRefresh = true` archives the current batch before fetching the next.
- `rebuild = true` skips the celebration logic and always shows fresh articles.
- **Lines 678–694** — Queue exhaustion detection: if the server returns 0 articles, pulls the last archived batch from `/api/archives` to show something on screen, then triggers the confetti celebration.

**Lines 636–646 — Confetti logic**

```ts
useEffect(() => {
  if (!queueDone || confettiFiredRef.current) return;
  confettiFiredRef.current = true;
  import("canvas-confetti").then(({ default: confetti }) => {
    // Three bursts with staggered timing
  });
}, [queueDone]);
```

When `queueDone` becomes true, fires three confetti bursts at different positions and timings. The `confettiFiredRef` prevents re-firing if the component re-renders.

**Lines 818–847 — Demo mode badge**

In the masthead, the right side shows either:
- "PERSONAL EDITION" (live mode) — a plain text label.
- "📋 DEMO MODE" (demo mode) — an amber pill that links to /settings so you can switch to live mode.

---

## 16. Article Card — `src/components/digest/ArticleCard.tsx`

**File:** `src/components/digest/ArticleCard.tsx`

Renders a single article in one of four visual styles (banner, twoCol, threeCol, list).

---

### Lines 16–33 — `REASON_CHIPS` and `getReasonChips`

A map from topic names to lists of dislike reasons. When you click 👎 on a "Tech & AI" article, the popup shows `["Too technical", "Not relevant to me", "Already knew this", "Too promotional", "Other"]`. Different topics get different reason options because the reasons that make sense for a technology article differ from those for a property article.

---

### Lines 36–72 — `TopicPill`

A small label shown above the headline. Shows the topic in green (e.g. "ECONOMY") and, if applicable, a separate "HIGH IMPACT" badge in orange/red.

---

### Lines 74–93 — Component setup

```ts
const combined = article.combined || article.summary || "";
const safeText = /[.!?]$/.test(combined.trimEnd()) ? combined : combined + "...";
```

`safeText` is a client-side safety net: if the AI-generated summary somehow got cut off without a sentence-ending punctuation mark, it appends `"..."` to indicate the text continues. This prevents a jarring hard cut in the middle of a sentence.

---

### Lines 94–115 — `handleUpvote`

Toggles the upvote state locally, then sends `POST /api/feedback` with `vote: "up"`. The full article metadata (`title`, `topic`, `url`, `summary`, `publishedAt`) is sent so that demo articles can be upserted into the database if needed.

---

### Lines 117–145 — `handleDislikeSubmit`

Called when you click "SUBMIT FEEDBACK" in the dislike popup. Sends `vote: "down"` along with the selected `reason` chip and any free-text comment. On success, calls `onRemove(article.id)` which removes the article from the list in the parent component's state.

---

### Lines 147–160 — `handleReadClick`

Intercepts the link click to first `POST /api/articles/click` (tracking that you read this article, which gives it a small score boost next time) before opening the URL in a new tab.

---

### Lines 162–260 — Dislike popup

A modal overlay (`fixed inset-0 z-50`) that renders the reason chips and free-text input. Clicking the dark backdrop (line 165) closes the popup. Clicking inside the white card (line 168) stops the click from propagating to the backdrop via `e.stopPropagation()`.

---

### Lines 286–360 — Banner variant

The hero article. Largest font sizes. Summary text is full-size (16px, 1.75 line height). The `safeText` and the ⚡ symbol are displayed together (line 322). Source name and date are shown bottom-left; feedback buttons and "READ FULL ARTICLE →" link are shown bottom-right.

The other variants (twoCol, threeCol, list) follow the same pattern at progressively smaller sizes.

---

## 17. Algorithm Settings Page

**File:** `src/app/(dashboard)/algorithm/page.tsx`

---

### Lines 26–38 — `DEFAULTS`

The default values for every algorithm setting. Used when no saved settings are found and to reset sliders.

---

### Lines 40–52 — `WEIGHT_META`

An array that drives the rendering of all seven weight sliders. Each entry has a `key` (which property of `Settings` to read/write), a `label` (display name), and a `description` (hint text shown below the slider). This avoids duplicating JSX for each slider.

---

### Lines 68–81 — `initComposition`

When the page loads, converts saved `topic_composition` percentages into the slider state. If no saved values exist, distributes 100% evenly across all topics.

---

### Lines 139–233 — `TopicComposition`

The stacked colour bar and per-topic sliders. The bar (line 167–183) renders as a flex row where each topic's width is its percentage. As you drag a slider, the bar updates in real time via CSS `transition: "width 0.2s ease"`. A validation indicator shows "Total: 97% ❌" or "Total: 100% ✓" (line 215) and disables the Save button until it equals exactly 100%.

---

### Lines 308–325 — `handleRegenProfile`

Calls `POST /api/algorithm/regenerate-profile`. On success, updates the `gemini_profile` field in the local state so the textarea shows the new text immediately (no page reload needed). On failure, sets `regenError` which renders as a red error message below the button (line 427–429).

---

## 18. Email System — `src/lib/email/`

### `src/lib/email/scheduler.ts`

**`shouldSendDigest`**: Takes a user's `digest_time` (e.g. `"08:00:00"`) in MYT and checks whether the current time (in UTC) is within a 5-minute window of that scheduled time. Used by the cron job at `/api/cron/digest` to decide whether to send each user's email.

### `src/lib/email/templates.tsx`

**`buildEmailHtml`**: Generates a 600px-wide HTML email. Renders up to 5 articles. Each article shows the topic tag, headline, source, publication date, the AI-combined summary (with ⚡ for high impact), and a "Read →" link. The email has a footer with links to Settings and an unsubscribe option. The brand green `#1D5C3A` is used for headlines and links.

---

## 19. Database Schema (Implied)

These are the Supabase (PostgreSQL) tables referenced throughout the code.

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `profiles` | One row per user | `id`, `email`, `occupation`, `location`, `life_stage`, `vehicle`, `digest_time`, `digest_frequency`, `email_digest_enabled` |
| `user_topics` | Topics each user has selected | `user_id`, `topic`, `is_preset`, `weight` |
| `articles` | All articles ever fetched or upserted | `id` (UUID), `external_id` (source ID), `title`, `summary`, `article_url`, `topic`, `published_at`, `ai_summary`, `is_video` |
| `article_queue` | The personalised reading queue per user | `user_id`, `article_id` (FK → articles), `relevance_score`, `impact_level`, `ai_summary`, `position`, `served`, `served_at` |
| `article_feedback` | Votes on articles | `user_id`, `article_id` (FK → articles), `vote` ("up"/"down"), `reason`, `free_text` |
| `article_clicks` | Articles the user has clicked | `user_id`, `article_url` |
| `digest_archives` | Past digest batches | `user_id`, `archived_at`, `label`, `articles` (JSONB array of ScoredArticle) |
| `user_algorithm_settings` | Custom scoring weights + AI profile | `user_id`, `impact_weight`, `topic_weight`, `recency_weight`, `keyword_weight`, `feedback_weight`, `feedback_penalty`, `click_read_bonus`, `custom_keywords` (JSONB), `avoidance_keywords` (JSONB), `gemini_profile`, `topic_composition` (JSONB) |
| `gemini_daily_budget` | Daily AI usage counters | `user_id`, `date`, `groq_calls_used`, `groq_calls_limit`, `gemini_calls_used`, `gemini_calls_limit` |
| `gemini_usage` | Per-call AI usage log | `user_id`, `call_type`, `digest_session_id`, `provider`, `model`, `called_at` |

---

## 20. Data Flow Diagrams

### A. First page load (Live mode)

```
Browser → GET /api/digest
  └─ Load profile, topics, algorithm settings, clicks, feedback (parallel)
  └─ isDemo = false → skip demo guard
  └─ fetchUnservedBatch(userId, limit=5)
       └─ If < 5 rows: buildArticleQueue()
            ├─ fetchAllSources(topics)
            │    ├─ NewsAPI + RSS + Reddit + GoogleNews + YouTube (parallel)
            │    └─ Deduplicate → sort by date → cap at 100
            ├─ scoreArticles(rawArticles, preferences, feedbackMap, settings)
            │    └─ For each article: recency + topic + profile + keyword + feedback + custom + click scores
            ├─ upsert to articles table
            ├─ buildCompositionQueue (respects topic % targets)
            ├─ insert into article_queue
            └─ enrichArticle × 5 (immediate, before response)
                 ├─ check cache (articles.ai_summary)
                 └─ if not cached: callGroq → store in article_queue + articles
  └─ buildDigestResponse()
       └─ fetchUnservedBatch × 5
       └─ rowToScoredArticle × 5
       └─ return DigestResult { articles[5], queueStats, generatedAt }
Browser renders DigestFeed → NewspaperGrid → ArticleCard × 5
```

### B. Demo mode

```
Browser → GET /api/digest
  └─ isDemo = true
  └─ buildDemoDigest(selectedTopics, preferences, algorithmSettings)
       ├─ filter DEMO_ARTICLES by topic
       ├─ scoreArticles (same ranker, no AI)
       ├─ buildDemoSentence on every article.summary
       └─ return { articles[5], remainingArticles[23], isDemo: true }
Browser renders DigestFeed
  ├─ "📋 DEMO MODE" badge in masthead
  ├─ NewspaperGrid (top 5)
  └─ MoreArticlesPanel (remaining 23)
```

### C. Feedback loop

```
User clicks 👎
  └─ handleDislikeSubmit()
       └─ POST /api/feedback { articleId, vote: "down", reason, freeText, ... }
            ├─ if articleId is not UUID: upsert demo article → get real UUID
            ├─ upsert article_feedback row
            ├─ extractAvoidanceKeywords (Groq) → merge into avoidance_keywords
            └─ updateGeminiProfile (Groq, background)
                 └─ fetch last 20 feedback votes
                 └─ send to Groq: "write a 3-sentence preference profile"
                 └─ save to user_algorithm_settings.gemini_profile
Next digest build:
  └─ gemini_profile is injected into every article analysis prompt
  └─ avoidance_keywords penalise matching articles in scoreArticles
```

---

*End of documentation. Every file referenced here can be found under `src/` relative to the project root. Line numbers correspond to the file contents as of the last commit on this branch.*
