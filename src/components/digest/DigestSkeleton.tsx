export function DigestSkeleton() {
  return (
    <div>
      <p
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          fontSize: "10px",
          letterSpacing: "0.14em",
          color: "#9C9890",
          textTransform: "uppercase",
          marginBottom: "24px",
        }}
      >
        FETCHING YOUR DIGEST...
      </p>

      {/* Banner shimmer */}
      <div style={{ marginBottom: "28px" }}>
        <div className="shimmer" style={{ width: "80px", height: "16px", marginBottom: "14px" }} />
        <div className="shimmer" style={{ width: "100%", height: "32px", marginBottom: "8px" }} />
        <div className="shimmer" style={{ width: "75%", height: "32px", marginBottom: "16px" }} />
        <div className="shimmer" style={{ width: "100%", height: "15px", marginBottom: "6px" }} />
        <div className="shimmer" style={{ width: "85%", height: "15px", marginBottom: "6px" }} />
        <div className="shimmer" style={{ width: "60%", height: "15px", marginBottom: "24px" }} />
        <div style={{ borderBottom: "3px solid #E8E4DC" }} />
      </div>

      {/* 2-col shimmer */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginBottom: "24px",
        }}
      >
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="shimmer" style={{ width: "56px", height: "14px", marginBottom: "10px" }} />
            <div className="shimmer" style={{ width: "100%", height: "22px", marginBottom: "6px" }} />
            <div className="shimmer" style={{ width: "80%", height: "22px", marginBottom: "12px" }} />
            <div className="shimmer" style={{ width: "100%", height: "13px", marginBottom: "5px" }} />
            <div className="shimmer" style={{ width: "70%", height: "13px" }} />
          </div>
        ))}
      </div>

      {/* 3-col shimmer */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "16px",
          borderTop: "1px solid #E8E4DC",
          paddingTop: "20px",
          marginBottom: "24px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="shimmer" style={{ width: "44px", height: "12px", marginBottom: "8px" }} />
            <div className="shimmer" style={{ width: "100%", height: "18px", marginBottom: "5px" }} />
            <div className="shimmer" style={{ width: "85%", height: "18px", marginBottom: "10px" }} />
            <div className="shimmer" style={{ width: "100%", height: "12px", marginBottom: "4px" }} />
            <div className="shimmer" style={{ width: "65%", height: "12px" }} />
          </div>
        ))}
      </div>

      {/* List shimmer */}
      <div style={{ borderTop: "1px solid #E8E4DC", paddingTop: "12px" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 0",
              borderBottom: "1px solid #E8E4DC",
            }}
          >
            <div className="shimmer" style={{ width: "56px", height: "13px", flexShrink: 0 }} />
            <div className="shimmer" style={{ flex: 1, height: "15px" }} />
            <div className="shimmer" style={{ width: "80px", height: "12px", flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
