import Link from "next/link";

const MOCK_ARTICLES = [
  {
    topic: "ECONOMY",
    headline: "Bank Negara holds OPR at 3% amid global uncertainty",
    summary: "The central bank keeps rates steady, citing controlled inflation and resilient domestic demand.",
    impact: "Your mortgage repayments remain unchanged. Fixed deposit yields hold at current levels.",
  },
  {
    topic: "TECH & AI",
    headline: "Grab launches AI-powered demand forecasting for drivers",
    summary: "New feature predicts surge zones up to 30 minutes ahead, increasing driver earnings by 18%.",
    impact: "Ride prices in KL may stabilise during peak hours as supply adjusts faster.",
  },
  {
    topic: "PROPERTY",
    headline: "Selangor exempts stamp duty on first homes under RM500k",
    summary: "State-level relief targets first-time buyers, effective from July 2025.",
    impact: "First-home buyers in Selangor could save up to RM10,000 in transaction costs.",
  },
];

export default function HeroPage() {
  const now    = new Date();
  const year   = now.getFullYear();

  return (
    <div style={{ background: "#F7F4EF", minHeight: "100vh" }}>
      {/* ─── Masthead ──────────────────────────────────────────────────── */}
      <div style={{ borderTop: "4px solid #0F0E0C" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-10 pb-6 text-center">
          <h1
            style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "clamp(56px, 10vw, 96px)",
              fontWeight: 800,
              letterSpacing: "0.12em",
              color: "#0F0E0C",
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            BRIEFD
          </h1>
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.18)", margin: "20px 0 12px" }} />
          <p
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "11px",
              letterSpacing: "0.12em",
              color: "#5C5750",
              fontVariant: "small-caps",
              textTransform: "uppercase",
            }}
          >
            Your Personal News Intelligence · Est. 2025
          </p>
          <div style={{ borderBottom: "1px solid rgba(0,0,0,0.18)", margin: "12px 0 0" }} />
        </div>
      </div>

      {/* ─── Hero section ──────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">
          {/* Left: copy */}
          <div className="md:col-span-7">
            <h2
              style={{
                fontFamily: "var(--font-playfair), Georgia, serif",
                fontSize: "clamp(28px, 4vw, 48px)",
                fontStyle: "italic",
                fontWeight: 600,
                color: "#0F0E0C",
                lineHeight: 1.2,
                marginBottom: "24px",
              }}
            >
              Stop reading everything. Start knowing what matters.
            </h2>

            <p
              style={{
                fontFamily: "var(--font-source-serif), Georgia, serif",
                fontSize: "16px",
                color: "#5C5750",
                lineHeight: 1.7,
                fontWeight: 600,
                marginBottom: "12px",
              }}
            >
              The average Malaysian reads 3 hours of news weekly. Most of it doesn&apos;t affect them.
            </p>
            <p
              style={{
                fontFamily: "var(--font-source-serif), Georgia, serif",
                fontSize: "16px",
                color: "#5C5750",
                lineHeight: 1.75,
                marginBottom: "12px",
              }}
            >
              Briefd uses your occupation, location, and life stage to score and rank every article from six news sources — then surfaces only the fifteen that actually matter to you, with a plain-English explanation of how each one affects your life.
            </p>
            <p
              style={{
                fontFamily: "var(--font-source-serif), Georgia, serif",
                fontSize: "16px",
                color: "#5C5750",
                lineHeight: 1.75,
                marginBottom: "32px",
              }}
            >
              Every morning, in under ten minutes, you get the signal without the noise.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                style={{
                  display: "inline-block",
                  background: "#0F0E0C",
                  color: "#F7F4EF",
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "13px",
                  letterSpacing: "0.06em",
                  padding: "12px 24px",
                  textDecoration: "none",
                  transition: "transform 0.15s, background 0.15s",
                }}
                className="hover:scale-[1.02] hover:bg-[#1D5C3A]"
              >
                Start reading smarter →
              </Link>
              <a
                href="#how-it-works"
                style={{
                  display: "inline-block",
                  background: "transparent",
                  color: "#0F0E0C",
                  border: "1px solid #0F0E0C",
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "13px",
                  letterSpacing: "0.06em",
                  padding: "12px 24px",
                  textDecoration: "none",
                  transition: "transform 0.15s",
                }}
                className="hover:scale-[1.02]"
              >
                See how it works ↓
              </a>
            </div>
          </div>

          {/* Right: mock digest */}
          <div className="md:col-span-5 hidden md:block">
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.15)",
                padding: "20px",
                transform: "rotate(1.5deg)",
                boxShadow: "4px 6px 24px rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "9px",
                  letterSpacing: "0.12em",
                  color: "#9C9890",
                  textTransform: "uppercase",
                  borderBottom: "1px solid rgba(0,0,0,0.1)",
                  paddingBottom: "8px",
                  marginBottom: "14px",
                }}
              >
                SAMPLE DIGEST · ECONOMY · TECH · PROPERTY
              </div>
              {MOCK_ARTICLES.map((a, i) => (
                <div
                  key={i}
                  style={{
                    borderBottom: i < MOCK_ARTICLES.length - 1 ? "1px solid rgba(0,0,0,0.08)" : "none",
                    paddingBottom: "14px",
                    marginBottom: "14px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: "8px",
                      letterSpacing: "0.1em",
                      color: "#1D5C3A",
                      background: "#e8f5ee",
                      padding: "2px 6px",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                    }}
                  >
                    {a.topic}
                  </span>
                  <p
                    style={{
                      fontFamily: "var(--font-playfair), Georgia, serif",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#0F0E0C",
                      lineHeight: 1.3,
                      marginBottom: "4px",
                    }}
                  >
                    {a.headline}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-source-serif), Georgia, serif",
                      fontSize: "11px",
                      color: "#5C5750",
                      lineHeight: 1.6,
                      marginBottom: "8px",
                    }}
                  >
                    {a.summary}
                  </p>
                  <div
                    style={{
                      background: "#FDF8ED",
                      borderLeft: "2px solid #F0A500",
                      padding: "6px 10px",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-source-serif), Georgia, serif",
                        fontSize: "10px",
                        fontStyle: "italic",
                        color: "#5C4A00",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      ⚡ {a.impact}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── How it works ──────────────────────────────────────────────── */}
      <div
        id="how-it-works"
        style={{ borderTop: "3px solid #0F0E0C", background: "#F0ECE4" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-14">
          <p
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "10px",
              letterSpacing: "0.14em",
              color: "#9C9890",
              textTransform: "uppercase",
              marginBottom: "40px",
            }}
          >
            HOW IT WORKS
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {[
              {
                n: "01",
                title: "Tell us who you are",
                body: "Fill a quick profile. Your job, location, life stage. We use this to weight what matters — a landlord cares about property news differently than a renter.",
              },
              {
                n: "02",
                title: "We fetch, score and rank",
                body: "Our algorithm pulls from 6 sources, scores every article against your profile, and surfaces the top 15 — ranked by how much each one actually affects you.",
              },
              {
                n: "03",
                title: "Read only what affects you",
                body: "Every article shows exactly how it impacts you personally. Thumbs up or down to train your feed. The more you use it, the smarter it gets.",
              },
            ].map(({ n, title, body }) => (
              <div key={n}>
                <div
                  style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontSize: "64px",
                    fontWeight: 800,
                    color: "rgba(0,0,0,0.1)",
                    lineHeight: 1,
                    marginBottom: "12px",
                  }}
                >
                  {n}
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#0F0E0C",
                    marginBottom: "10px",
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-source-serif), Georgia, serif",
                    fontSize: "15px",
                    color: "#5C5750",
                    lineHeight: 1.75,
                  }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Feature highlights ────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.12)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-14">
          <p
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "10px",
              letterSpacing: "0.14em",
              color: "#9C9890",
              textTransform: "uppercase",
              marginBottom: "40px",
            }}
          >
            WHAT MAKES BRIEFD DIFFERENT
          </p>

          {[
            {
              label: "MY ALGORITHM PAGE",
              title: "You control the algorithm",
              body: "Adjust the scoring weights for each news category. Care more about finance than politics? Slide the dial. Your feed adapts in real time — no black box, no guessing.",
              flip: false,
            },
            {
              label: "IMPACT ANALYSIS",
              title: "Every article explains itself",
              body: "The ⚡ Impacts you block appears under every story that directly affects your life. No more wondering 'so what?' — we tell you exactly what this means for your wallet, commute, or career.",
              flip: true,
            },
            {
              label: "ARCHIVE SYSTEM",
              title: "Never lose a digest",
              body: "Every digest you've ever received is stored and searchable. Refresh for a fresh set of 15 articles — the old batch is archived, not discarded. Your reading history is yours.",
              flip: false,
            },
          ].map(({ label, title, body, flip }) => (
            <div
              key={label}
              className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center mb-14 ${flip ? "md:[direction:rtl]" : ""}`}
            >
              <div style={{ direction: "ltr" }}>
                <p
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    fontSize: "9px",
                    letterSpacing: "0.14em",
                    color: "#9C9890",
                    textTransform: "uppercase",
                    marginBottom: "10px",
                  }}
                >
                  {label}
                </p>
                <h3
                  style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontSize: "28px",
                    fontWeight: 700,
                    color: "#0F0E0C",
                    lineHeight: 1.2,
                    marginBottom: "14px",
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-source-serif), Georgia, serif",
                    fontSize: "16px",
                    color: "#5C5750",
                    lineHeight: 1.75,
                  }}
                >
                  {body}
                </p>
              </div>
              <div
                style={{
                  background: "#F0ECE4",
                  border: "1px solid rgba(0,0,0,0.08)",
                  height: "180px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  direction: "ltr",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontSize: "48px",
                    color: "rgba(0,0,0,0.1)",
                    fontWeight: 800,
                  }}
                >
                  {label.split(" ")[0]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <div style={{ borderTop: "3px solid #0F0E0C", background: "#0F0E0C" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 text-center">
          <p
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "10px",
              letterSpacing: "0.14em",
              color: "#9C9890",
              textTransform: "uppercase",
              marginBottom: "16px",
            }}
          >
            BRIEFD · YOUR DAILY SIGNAL · © {year}
          </p>
          <div className="flex items-center justify-center gap-6">
            <Link
              href="/register"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "11px",
                letterSpacing: "0.08em",
                color: "#F7F4EF",
                textDecoration: "none",
              }}
              className="hover:text-[#C9972A] transition-colors"
            >
              Get Started
            </Link>
            <span style={{ color: "#5C5750" }}>·</span>
            <Link
              href="/login"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "11px",
                letterSpacing: "0.08em",
                color: "#F7F4EF",
                textDecoration: "none",
              }}
              className="hover:text-[#C9972A] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
