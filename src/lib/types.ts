export type ImpactLevel = 'high' | 'medium' | 'low'

export type DigestFrequency = 'daily' | 'weekly'

export type VoteValue = 'up' | 'down'

// ─── Database row types ───────────────────────────────────────────────────────

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
  created_at: string
  updated_at: string
}

export interface UserTopic {
  id: string
  user_id: string
  topic: string
  is_preset: boolean
  weight: number
  created_at: string
}

export interface Article {
  id: string
  external_id: string | null
  title: string
  summary: string | null
  source_name: string | null
  source_url: string | null
  article_url: string
  topic: string | null
  published_at: string | null
  fetched_at: string
}

export interface DigestEntry {
  id: string
  user_id: string
  article_id: string
  relevance_score: number
  impact_level: ImpactLevel
  ai_summary: string | null
  shown_at: string
}

export interface ArticleFeedback {
  id: string
  user_id: string
  article_id: string
  vote: VoteValue
  created_at: string
}

export interface EmailLog {
  id: string
  user_id: string
  sent_at: string
  status: string | null
  article_count: number | null
}

// ─── Pipeline types ───────────────────────────────────────────────────────────

export interface RawArticle {
  externalId: string
  title: string
  summary: string
  sourceName: string
  sourceUrl: string
  articleUrl: string
  topic: string
  publishedAt: string
}

export interface RssFeed {
  name: string
  url: string
  topic: string
}

// ─── Derived / composite types ────────────────────────────────────────────────

export interface ScoredArticle extends Article {
  relevanceScore: number
  impactLevel: ImpactLevel
  aiSummary: string
  userVote?: VoteValue | null
}

export interface UserPreferences {
  profile: Profile
  topics: UserTopic[]
}

export interface DigestResult {
  articles: ScoredArticle[]
  generatedAt: string
  totalScored: number
}
