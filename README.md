# Briefd

Briefd is a personalised daily news digest app built for Malaysians — it pulls articles from RSS feeds, NewsAPI, and Reddit, scores them against your profile, and delivers a curated summary to your inbox every morning.

## Tech stack

| Layer        | Technology                                    |
|--------------|-----------------------------------------------|
| Framework    | Next.js 14 (App Router, TypeScript)           |
| Styling      | Tailwind CSS v4                               |
| Database     | Supabase (Postgres + Auth + RLS)              |
| AI           | Anthropic Claude (claude-sonnet-4-20250514)   |
| Email        | Resend                                        |
| News sources | RSS feeds, NewsAPI, Reddit public JSON API    |
| Deployment   | Vercel (with cron job for digest scheduling)  |

## Local setup

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd briefd
```

### 2. Install dependencies

```bash
npm install
```

### 3. Fill in `.env.local`

Copy the placeholder file and fill in each value:

```env
# Supabase — https://supabase.com/dashboard → your project → Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic — https://console.anthropic.com
ANTHROPIC_API_KEY=

# Resend — https://resend.com/api-keys
RESEND_API_KEY=
RESEND_FROM_EMAIL=digest@briefd.app   # must be a verified sender domain

# NewsAPI — https://newsapi.org (free tier: 100 req/day)
NEWSAPI_KEY=

# Vercel Cron secret — generate any random string, paste same value in Vercel env vars
CRON_SECRET=

# App URL — change to your production URL when deploying
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Apply the database schema

Option A — Supabase SQL editor:
1. Open your Supabase project → SQL Editor
2. Paste the contents of `supabase/schema.sql` and run it

Option B — Supabase CLI:
```bash
npx supabase db push
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register an account, complete the 3-step onboarding, and your first digest will be built on the spot.

## How the algorithm works

When you request a digest, Briefd fetches up to 100 articles from six Malaysian RSS feeds (FMT, The Star, Malay Mail, EdgeProp, Tech in Asia, Reuters), NewsAPI queries for your topics, and five Malaysian subreddits. Each article receives a composite score: **recency** (up to 40 pts — articles under 6 hours old score highest), **topic match** (30 pts for an exact match to your selected topics), **profile match** (25 pts — e.g. if you own a car, fuel and transport articles are boosted), **keyword match** (15 pts per custom keyword found in the title or body), and **vote feedback** (+10 for thumbs up, −20 for thumbs down, applied to future articles in the same topic). The top 12 articles are then summarised by Claude in a single sentence tailored to your occupation and location. Articles scoring above 75 or containing high-impact financial/political keywords (OPR, EPF, subsidy, tax, etc.) are flagged as ⚡ High Impact.

## Deployment to Vercel

1. Push your repo to GitHub and import it in the [Vercel dashboard](https://vercel.com/new). Add all `.env.local` keys as environment variables in the Vercel project settings (including `CRON_SECRET`).

2. Vercel automatically reads `vercel.json` and schedules `/api/cron/digest` to run every hour. The cron handler checks which users have a `digest_time` within ±5 minutes of the current UTC time, builds their digests, and emails them if `email_digest_enabled` is true.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           Briefd                                │
│          Next.js 14 App Router · TypeScript · Tailwind v4       │
├────────────────┬───────────────────────┬────────────────────────┤
│   Auth Pages   │    Dashboard / Feed   │    Settings Page       │
│   /login       │    / (server comp)    │    /settings           │
│   /register    │    DigestFeed         │    (client component)  │
└───────┬────────┴──────────┬────────────┴───────────┬────────────┘
        │                   │                        │
        ▼                   ▼                        ▼
┌───────────────┐  ┌────────────────────┐  ┌──────────────────────┐
│   Supabase    │  │    API Routes      │  │    Vercel Cron       │
│   Auth        │  │  GET /api/digest   │  │  GET /api/cron/      │
│   profiles    │  │  GET /api/articles │  │       digest         │
│   user_topics │  │  POST /api/feedback│  │  Runs hourly         │
│   articles    │  │  GET|POST /profile │  │  Matches digest_time │
│   digest_     │  │  POST /email/send  │  │  within ±5 min UTC   │
│   entries     │  └────────┬───────────┘  └──────────┬───────────┘
│   article_    │           │                         │
│   feedback    │           ▼                         ▼
│   email_log   │  ┌──────────────────────────────────────────┐
└───────────────┘  │           News Pipeline                   │
                   │  fetchAllSources(topics)                  │
                   │  ├─ RSS (6 Malaysian feeds)               │
                   │  ├─ NewsAPI (topic + Malaysia queries)    │
                   │  └─ Reddit (5 MY subreddits, score ≥ 10) │
                   │                                          │
                   │  scoreArticles()   ← ranker.ts           │
                   │  buildDigest()     ← digest.ts           │
                   │  summariseArticle() ← Anthropic API      │
                   │    (batched, 3 concurrent requests)       │
                   └──────────────────┬───────────────────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │   Resend Email  │
                             │  buildEmailHtml │
                             │  renderToStatic │
                             │  Markup (JSX)   │
                             │  One-click vote │
                             │  links in email │
                             └─────────────────┘
```
  │      Email       │  Password   │            Profile            │                                                                                                                                                           
  ├──────────────────┼─────────────┼───────────────────────────────┤                                                                                                                                                           
  │ test1@briefd.app │ password123 │ KL, employed, car owner       │                                                                                                                                                           
  ├──────────────────┼─────────────┼───────────────────────────────┤
  │ test2@briefd.app │ password123 │ Selangor, student, motorcycle │
  ├──────────────────┼─────────────┼───────────────────────────────┤
  │ test3@briefd.app │ password123 │ Penang, business owner        