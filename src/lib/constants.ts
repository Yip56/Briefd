export const PRESET_TOPICS = [
  'Economy',
  'Fuel & Transport',
  'Property',
  'Jobs & Career',
  'Malaysian Politics',
  'Tech & AI',
  'Health',
  'Startups',
  'Global News',
  'Finance & Investing',
] as const

export type PresetTopic = (typeof PRESET_TOPICS)[number]

export const OCCUPATION_OPTIONS = [
  'Student',
  'Fresh Graduate',
  'Employed (Private)',
  'Employed (Government)',
  'Self-Employed / Freelance',
  'Business Owner',
  'Investor',
  'Homemaker',
] as const

export const LOCATION_OPTIONS = [
  'Kuala Lumpur',
  'Selangor',
  'Penang',
  'Johor',
  'Sabah',
  'Sarawak',
  'Other Malaysia',
] as const

export const LIFE_STAGE_OPTIONS = [
  'Renting',
  'Property owner',
  'Looking to buy property',
  'Investing in property',
  'Living with family',
] as const

export const VEHICLE_OPTIONS = [
  'Car owner',
  'Motorcycle owner',
  'Both',
  'No vehicle',
] as const

export const SCORING_WEIGHTS = {
  recency: 40,
  topicMatch: 30,
  profileMatch: 25,
  keywordMatch: 15,
  voteFeedback: { up: 10, down: -20 },
} as const

export const DIGEST_SCHEDULE_OPTIONS = [
  { label: '6:00 AM',  value: '06:00' },
  { label: '7:00 AM',  value: '07:00' },
  { label: '8:00 AM',  value: '08:00' },
  { label: '9:00 AM',  value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '6:00 PM',  value: '18:00' },
  { label: '9:00 PM',  value: '21:00' },
] as const

export const RSS_FEEDS = [
  { name: 'Free Malaysia Today', url: 'https://www.freemalaysiatoday.com/feed/', topic: 'Malaysian Politics' },
  { name: 'The Star', url: 'https://www.thestar.com.my/rss/News/Malaysia', topic: 'Economy' },
  { name: 'Malay Mail', url: 'https://www.malaymail.com/feed', topic: 'Malaysian Politics' },
  { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews', topic: 'Economy' },
  { name: 'Tech in Asia', url: 'https://www.techinasia.com/feed', topic: 'Tech & AI' },
  { name: 'EdgeProp', url: 'https://www.edgeprop.my/rss.xml', topic: 'Property' },
] as const

export const APP_NAME = 'Briefd'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'digest@briefd.app'
