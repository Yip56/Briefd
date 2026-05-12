"use client";

interface FilterBarProps {
  topics:          string[];
  activeTopic:     string | null;
  onSelect:        (topic: string | null) => void;
  highImpactCount: number;
  impactFilter:    boolean;
  onToggleImpact:  () => void;
}

export function FilterBar({
  topics,
  activeTopic,
  onSelect,
  highImpactCount,
  impactFilter,
  onToggleImpact,
}: FilterBarProps) {
  if (topics.length === 0 && highImpactCount === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        overflowX: "auto",
        paddingBottom: "2px",
        scrollbarWidth: "none",
      }}
    >
      <Pill label="ALL" active={activeTopic === null && !impactFilter} onClick={() => { onSelect(null); if (impactFilter) onToggleImpact(); }} />

      <button
        type="button"
        onClick={onToggleImpact}
        style={{
          flexShrink: 0,
          padding: "4px 12px",
          fontFamily: "var(--font-dm-mono), monospace",
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          border: impactFilter ? "1px solid #C9972A" : "1px solid rgba(0,0,0,0.15)",
          background: impactFilter ? "#C9972A" : "transparent",
          color: impactFilter ? "#fff" : "#5C5750",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
      >
        ⚡ HIGH IMPACT{!impactFilter && highImpactCount > 0 ? ` (${highImpactCount})` : ""}
      </button>

      {topics.map((topic) => (
        <Pill
          key={topic}
          label={topic.toUpperCase()}
          active={activeTopic === topic}
          onClick={() => onSelect(activeTopic === topic ? null : topic)}
        />
      ))}
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: "4px 12px",
        fontFamily: "var(--font-dm-mono), monospace",
        fontSize: "10px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        border: active ? "1px solid #0F0E0C" : "1px solid rgba(0,0,0,0.15)",
        background: active ? "#0F0E0C" : "transparent",
        color: active ? "#F7F4EF" : "#5C5750",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}
