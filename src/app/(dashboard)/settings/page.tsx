"use client";

import { useEffect, useState } from "react";
import { TopicPicker } from "@/components/onboarding/TopicPicker";
import { KeywordInput } from "@/components/onboarding/KeywordInput";
import { SchedulePicker } from "@/components/onboarding/SchedulePicker";
import { useToast } from "@/components/ui/Toast";
import {
  OCCUPATION_OPTIONS,
  LOCATION_OPTIONS,
  LIFE_STAGE_OPTIONS,
  VEHICLE_OPTIONS,
  SCORING_WEIGHTS,
} from "@/lib/constants";
import type { Profile } from "@/lib/types";

interface UsageBreakdownRow {
  call_type: string;
  count: number;
  tokens_est: number;
}

interface DailyBudget {
  callsUsed: number;
  callsLimit: number;
  remaining: number;
  resetAt: string;
}

interface UsageData {
  dailyBudget: DailyBudget;
  todayBreakdown: UsageBreakdownRow[];
  weekHistory: Array<{ date: string; calls_used: number; articles_analysed: number; feedback_calls: number }>;
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 bg-white outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl card-border p-6">
      <h2 className="font-serif text-lg text-gray-900 mb-5">{title}</h2>
      {children}
    </div>
  );
}

function ScoreRow({ pts, label, desc }: { pts: string; label: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-16 text-xs font-semibold text-brand/70 pt-0.5 tabular-nums">{pts}</span>
      <div>
        <span className="font-medium text-gray-800">{label}</span>
        <span className="text-gray-500"> — {desc}</span>
      </div>
    </div>
  );
}

function topicWeight(index: number): number {
  if (index === 0) return 3.0;
  if (index === 1) return 2.0;
  return 1.0;
}

// ─── AI Usage Section ────────────────────────────────────────────────────────

function AIUsageSection({ usage }: { usage: UsageData | null }) {
  const [showHistory, setShowHistory] = useState(false);

  if (!usage) {
    return (
      <SectionCard title="AI Usage">
        <p className="text-sm text-gray-400">Loading usage data…</p>
      </SectionCard>
    );
  }

  const { dailyBudget, todayBreakdown, weekHistory } = usage;
  const pct = (dailyBudget.callsUsed / dailyBudget.callsLimit) * 100;
  const barColor = pct >= 100 ? "#DC2626" : pct >= 80 ? "#D97706" : "#1D5C3A";
  const resetTime = new Date(dailyBudget.resetAt).toLocaleTimeString("en-MY", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <SectionCard title="AI Usage">
      {/* Row 1 — Daily budget */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-gray-700">Daily AI calls</span>
          <span className="text-sm font-mono text-gray-600">{dailyBudget.callsUsed} / {dailyBudget.callsLimit}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden mb-1.5">
          <div
            style={{ width: `${Math.min(100, pct)}%`, background: barColor, transition: "width 0.3s" }}
            className="h-full rounded-full"
          />
        </div>
        <p className="text-xs text-gray-500">
          {dailyBudget.callsUsed} of {dailyBudget.callsLimit} calls used today · Resets at {resetTime}
        </p>
        <p style={{ fontFamily: "var(--font-dm-mono, monospace)" }} className="text-xs text-gray-400 mt-1">
          Each digest refresh uses up to 10 calls (5 article analyses)
        </p>
      </div>

      {/* Row 2 — Breakdown table */}
      {todayBreakdown.length > 1 && (
        <div className="mb-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-1.5 font-medium">Call Type</th>
                <th className="text-right py-1.5 font-medium">Count Today</th>
                <th className="text-right py-1.5 font-medium">Tokens (est.)</th>
              </tr>
            </thead>
            <tbody>
              {todayBreakdown.map((row) => (
                <tr key={row.call_type} className={`border-b border-gray-50 ${row.call_type === "Total" ? "font-semibold text-gray-700" : "text-gray-600"}`}>
                  <td className="py-1.5">{row.call_type}</td>
                  <td className="text-right py-1.5 font-mono">{row.count}</td>
                  <td className="text-right py-1.5 font-mono">{row.tokens_est.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Row 3 — Cost saving tips */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl">
        <p style={{ fontFamily: "var(--font-dm-mono, monospace)" }} className="text-xs text-gray-500 uppercase tracking-wide mb-2">
          How to reduce AI usage
        </p>
        <ul className="space-y-1.5 text-xs text-gray-600">
          <li>✓ Articles are cached — each article is only analysed once ever</li>
          <li>✓ Low impact articles skip AI analysis entirely</li>
          <li>↓ Reduce digest refreshes to save calls (each refresh = up to 10 calls)</li>
          <li>↓ Fewer selected topics = fewer articles to analyse</li>
          <li>↓ High Impact filter shows pre-analysed articles only</li>
        </ul>
      </div>

      {/* Row 4 — Reset info + history */}
      <div>
        <p className="text-xs text-gray-400 mb-3">
          Your daily budget resets at 12:00 AM Malaysia time (UTC+8)
        </p>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="text-xs text-brand hover:underline transition-colors"
        >
          {showHistory ? "Hide" : "View full"} usage history (last 7 days)
        </button>
        {showHistory && weekHistory.length > 0 && (
          <table className="w-full text-xs mt-3">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-1.5 font-medium">Date</th>
                <th className="text-right py-1.5 font-medium">Calls Used</th>
                <th className="text-right py-1.5 font-medium">Articles Analysed</th>
                <th className="text-right py-1.5 font-medium">Feedback Calls</th>
              </tr>
            </thead>
            <tbody>
              {weekHistory.map((row) => (
                <tr key={row.date} className="text-gray-600 border-b border-gray-50">
                  <td className="py-1.5">{row.date}</td>
                  <td className="text-right py-1.5 font-mono">{row.calls_used}</td>
                  <td className="text-right py-1.5 font-mono">{row.articles_analysed}</td>
                  <td className="text-right py-1.5 font-mono">{row.feedback_calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {showHistory && weekHistory.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">No usage data yet.</p>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { showToast } = useToast();

  const [profile,     setProfile]     = useState<Profile | null>(null);
  const [occupation,  setOccupation]  = useState("");
  const [location,    setLocation]    = useState("");
  const [lifeStage,   setLifeStage]   = useState("");
  const [vehicle,     setVehicle]     = useState("");

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicOrder,     setTopicOrder]     = useState<string[]>([]);
  const [keywords,       setKeywords]       = useState<string[]>([]);

  const [digestTime,      setDigestTime]      = useState("08:00");
  const [digestFrequency, setDigestFrequency] = useState<"daily" | "weekly">("daily");
  const [emailEnabled,    setEmailEnabled]    = useState(true);
  const [lastEmailSent,   setLastEmailSent]   = useState<string | null>(null);

  const [saving,      setSaving]      = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [usage,       setUsage]       = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile: p, topics }) => {
        setProfile(p);
        setOccupation(p?.occupation ?? "");
        setLocation(p?.location ?? "");
        setLifeStage(p?.life_stage ?? "");
        setVehicle(p?.vehicle ?? "");
        setDigestTime(p?.digest_time?.slice(0, 5) ?? "08:00");
        setDigestFrequency(p?.digest_frequency ?? "daily");
        setEmailEnabled(p?.email_digest_enabled ?? true);

        const presets: string[] = [];
        const custom:  string[] = [];
        for (const t of topics ?? []) {
          if (t.is_preset) presets.push(t.topic);
          else             custom.push(t.topic);
        }
        setSelectedTopics(presets);
        setTopicOrder(presets);
        setKeywords(custom);
      })
      .finally(() => setLoading(false));

    // Fetch last email sent
    fetch("/api/email/log")
      .then((r) => r.json())
      .then((d) => { if (d.lastSentAt) setLastEmailSent(d.lastSentAt); })
      .catch(() => {});

    // Fetch AI usage
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => { if (d.dailyBudget) setUsage(d); })
      .catch(() => {});
  }, []);

  function toggleTopic(topic: string) {
    const isSelected = selectedTopics.includes(topic);
    setSelectedTopics((prev) => isSelected ? prev.filter((t) => t !== topic) : [...prev, topic]);
    setTopicOrder((order) => isSelected ? order.filter((t) => t !== topic) : order.includes(topic) ? order : [...order, topic]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const orderedPresets = topicOrder.map((topic, i) => ({ topic, weight: topicWeight(i), is_preset: true }));
      const keywordTopics  = keywords.map((kw) => ({ topic: kw, weight: 1.0, is_preset: false }));

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupation, location, life_stage: lifeStage, vehicle,
          topics: [...orderedPresets, ...keywordTopics],
          digest_time: digestTime, digest_frequency: digestFrequency,
          email_digest_enabled: emailEnabled,
        }),
      });
      showToast(res.ok ? "Preferences saved!" : "Failed to save", res.ok ? "success" : "error");
    } catch {
      showToast("Could not connect to server", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    setSendingTest(true);
    try {
      const res = await fetch("/api/email/send", { method: "POST" });
      showToast(
        res.ok ? "Test email sent! Check your inbox." : "Failed to send email",
        res.ok ? "success" : "error"
      );
    } catch {
      showToast("Could not send email", "error");
    } finally {
      setSendingTest(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your digest preferences</p>
      </div>

      {/* Schedule */}
      <SectionCard title="Delivery schedule">
        <SchedulePicker
          digestTime={digestTime}
          digestFrequency={digestFrequency}
          emailEnabled={emailEnabled}
          onTimeChange={setDigestTime}
          onFrequencyChange={setDigestFrequency}
          onEmailToggle={setEmailEnabled}
        />
      </SectionCard>

      {/* Email */}
      <SectionCard title="Email digest">
        {profile?.email && (
          <p className="text-sm text-gray-500 mb-4">
            Digest will be sent to <strong className="text-gray-800">{profile.email}</strong>
          </p>
        )}
        <button
          type="button"
          onClick={handleTestEmail}
          disabled={sendingTest || !emailEnabled}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-brand hover:text-brand transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sendingTest ? "Sending…" : "Send test email"}
        </button>
        {!emailEnabled && (
          <p className="text-xs text-gray-400 mt-2">Enable email digest above to send a test.</p>
        )}
        {lastEmailSent && (
          <p className="text-xs text-gray-400 mt-3">
            Last digest sent:{" "}
            <strong className="text-gray-600">
              {new Date(lastEmailSent).toLocaleString("en-MY", {
                weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </strong>
          </p>
        )}
      </SectionCard>

      {/* Topics */}
      <SectionCard title="Topics & keywords">
        <TopicPicker
          selected={selectedTopics}
          onToggle={toggleTopic}
          topicOrder={topicOrder}
          onReorder={setTopicOrder}
        />
        <div className="mt-5">
          <KeywordInput
            keywords={keywords}
            onAdd={(kw) => setKeywords((p) => [...p, kw])}
            onRemove={(kw) => setKeywords((p) => p.filter((k) => k !== kw))}
          />
        </div>
      </SectionCard>

      {/* Profile */}
      <SectionCard title="Your profile">
        <div className="space-y-4">
          <Select label="Occupation" value={occupation} onChange={setOccupation} options={OCCUPATION_OPTIONS} />
          <Select label="Location"   value={location}   onChange={setLocation}   options={LOCATION_OPTIONS} />
          <Select label="Life stage" value={lifeStage}  onChange={setLifeStage}  options={LIFE_STAGE_OPTIONS} />
          <Select label="Vehicle"    value={vehicle}    onChange={setVehicle}    options={VEHICLE_OPTIONS} />
        </div>
      </SectionCard>

      {/* Algorithm explainer */}
      <div className="bg-brand-light border border-brand/10 rounded-2xl p-6">
        <h2 className="font-serif text-lg text-brand mb-4">How Briefd ranks your news</h2>
        <div className="space-y-2.5 text-sm">
          <ScoreRow pts={`${SCORING_WEIGHTS.recency} pts`}      label="Recency"       desc="Articles from the last 6 hours score highest; older content tapers off." />
          <ScoreRow pts={`${SCORING_WEIGHTS.topicMatch} pts`}   label="Topic match"   desc="Exact topic matches score full points × your topic rank weight (3×, 2×, or 1×)." />
          <ScoreRow pts={`${SCORING_WEIGHTS.profileMatch} pts`} label="Profile match" desc="Your occupation, vehicle, and life stage boost relevant articles automatically." />
          <ScoreRow pts={`${SCORING_WEIGHTS.keywordMatch} pts`} label="Keywords"      desc="Custom keywords found in the title or body add points per match." />
          <ScoreRow pts="+10 / −20"                             label="Your feedback" desc="Thumbs up adds 10 pts to similar articles; thumbs down removes 20." />
        </div>
        <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-brand/10">
          Articles scoring above 75 or containing words like &quot;subsidy&quot;, &quot;OPR&quot;, &quot;EPF&quot;, or &quot;tax&quot; are
          automatically flagged as <strong className="text-orange-600">⚡ High Impact</strong>.
        </p>
      </div>

      {/* AI Usage */}
      <AIUsageSection usage={usage} />

      {/* Save */}
      <div className="flex justify-end py-2">
        <button
          type="button" onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
