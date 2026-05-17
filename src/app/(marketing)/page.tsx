"use client";

import { useEffect } from "react";
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

const FEATURES = [
  {
    label: "MY ALGORITHM PAGE",
    title: "You control the algorithm",
    body: "Adjust the scoring weights for each news category. Care more about finance than politics? Slide the dial. Your feed adapts in real time — no black box, no guessing.",
    flip: false,
    imgSrc: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    imgAlt: "Data controls and analytics dashboard",
  },
  {
    label: "IMPACT ANALYSIS",
    title: "Every article explains itself",
    body: "The ⚡ impact block appears under every story that directly affects your life. No more wondering 'so what?' — we tell you exactly what this means for your wallet, commute, or career.",
    flip: true,
    imgSrc: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
    imgAlt: "Person reading news on phone",
  },
  {
    label: "ARCHIVE SYSTEM",
    title: "Never lose a digest",
    body: "Every digest you've ever received is stored and searchable. Refresh for a fresh set of articles — the old batch is archived, not discarded. Your reading history is yours.",
    flip: false,
    imgSrc: "https://images.unsplash.com/photo-1568667256549-094345857637?w=800&q=80",
    imgAlt: "Organized documents and files",
  },
];

const HOW_IT_WORKS = [
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
];

export default function HeroPage() {
  const year = new Date().getFullYear();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    document
      .querySelectorAll(".animate-on-scroll, .number-pop")
      .forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ background: "#F7F4EF", minHeight: "100vh" }}>

      {/* ─── Top rule — rulerExpand ──────────────────────────────────────── */}
      <div
        style={{
          height: "4px",
          background: "#0F0E0C",
          width: "0%",
          animation: "rulerExpand 0.6s ease-out 0s forwards",
        }}
      />

      {/* ─── Masthead ────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-10 pb-6 text-center">

        {/* BRIEFD title */}
        <h1
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "clamp(56px, 10vw, 96px)",
            fontWeight: 800,
            letterSpacing: "0.15em",
            color: "#0F0E0C",
            lineHeight: 1,
            textTransform: "uppercase",
            opacity: 0,
            animation: "letterSpacingIn 0.8s ease-out 0.3s forwards",
          }}
        >
          BRIEFD
        </h1>

        {/* Static middle rule */}
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.18)", margin: "20px 0 12px" }} />

        {/* Tagline */}
        <p
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "11px",
            letterSpacing: "0.12em",
            color: "#5C5750",
            fontVariant: "small-caps",
            textTransform: "uppercase",
            opacity: 0,
            animation: "heroFadeIn 0.6s ease-out 0.8s forwards",
          }}
        >
          Your Personal News Intelligence · Est. 2025
        </p>

        {/* Bottom rule — rulerExpand */}
        <div
          style={{
            height: "1px",
            background: "rgba(0,0,0,0.18)",
            margin: "12px 0 0",
            width: "0%",
            animation: "rulerExpand 0.6s ease-out 1.0s forwards",
          }}
        />
      </div>

      {/* ─── Hero section ────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">

          {/* Left: copy */}
          <div className="md:col-span-7">

            {/* Headline */}
            <h2
              style={{
                fontFamily: "var(--font-playfair), Georgia, serif",
                fontSize: "clamp(28px, 4vw, 48px)",
                fontStyle: "italic",
                fontWeight: 600,
                color: "#0F0E0C",
                lineHeight: 1.2,
                marginBottom: "24px",
                opacity: 0,
                animation: "heroFadeUp 0.7s ease-out 1.2s forwards",
              }}
            >
              Stop reading everything. Start knowing what matters.
            </h2>

            {/* Body paragraphs */}
            <div
              style={{
                opacity: 0,
                animation: "heroFadeUp 0.6s ease-out 1.5s forwards",
              }}
            >
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
            </div>

            {/* CTA buttons */}
            <div
              className="flex flex-wrap gap-3"
              style={{
                opacity: 0,
                animation: "heroFadeUp 0.5s ease-out 1.7s forwards",
              }}
            >
              <Link
                href="/register"
                className="cta-btn"
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
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1D5C3A")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#0F0E0C")}
              >
                Start reading smarter <span className="cta-arrow-char">→</span>
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
              >
                See how it works ↓
              </a>
            </div>
          </div>

          {/* Right: mock digest — scaleIn entrance, then float */}
          <div
            className="md:col-span-5 hidden md:block"
            style={{
              opacity: 0,
              animation: "heroScaleIn 0.7s ease-out 1.9s forwards",
            }}
          >
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.15)",
                padding: "20px",
                transform: "rotate(1.5deg)",
                boxShadow: "4px 6px 24px rgba(0,0,0,0.08)",
                animation: "heroFloat 4s ease-in-out 2.6s infinite",
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

      {/* ─── How it works ────────────────────────────────────────────────── */}
      <div
        id="how-it-works"
        style={{ borderTop: "3px solid #0F0E0C", background: "#F0ECE4" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-14">
          <p
            className="animate-on-scroll"
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
            {HOW_IT_WORKS.map(({ n, title, body }, i) => (
              <div
                key={n}
                className="animate-on-scroll"
                style={{ transitionDelay: `${i * 0.15}s` }}
              >
                <div
                  className="number-pop"
                  style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontSize: "64px",
                    fontWeight: 800,
                    color: "rgba(0,0,0,0.1)",
                    lineHeight: 1,
                    marginBottom: "12px",
                    display: "inline-block",
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

      {/* ─── Feature highlights ───────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.12)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-14">
          <p
            className="animate-on-scroll"
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

          {FEATURES.map(({ label, title, body, flip, imgSrc, imgAlt }, i) => (
            <div
              key={label}
              className={`animate-on-scroll grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center mb-14 ${flip ? "md:[direction:rtl]" : ""}`}
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              {/* Copy */}
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

              {/* Image panel */}
              <div className="feature-panel-img" style={{ direction: "ltr" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc} alt={imgAlt} />
                <div className="feature-panel-overlay" />
                <span className="feature-panel-label">{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
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
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C9972A")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#F7F4EF")}
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
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C9972A")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#F7F4EF")}
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
