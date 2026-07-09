import { useState } from "react";

const GOLD = "#f5c842";
const GOLD_DARK = "#d4a017";

// Shows once when a user's 14-day trial begins.
// Purely informational — no API calls. Parent decides when to show it
// (first time we see the user in an active trial) and clears the flag on close.
export default function TrialStartedModal({ show, trialEndsAt, onClose }) {
  const [closing] = useState(false);

  if (!show) return null;

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt) - Date.now()) / 86400000))
    : 14;

  const endDateLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        fontFamily: "'DM Sans', sans-serif",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#13131f",
          border: "0.5px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          width: 360,
          maxWidth: "92vw",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          animation: "modalIn 0.25s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                color: "#1a1000",
              }}
            >
              C
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
              Cardlytics
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(245,200,66,0.12)",
              border: "1px solid rgba(245,200,66,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              fontSize: 24,
            }}
          >
            🎉
          </div>

          <h2
            style={{
              color: "#fff",
              fontSize: 17,
              fontWeight: 700,
              margin: "0 0 6px",
            }}
          >
            Your free trial has started
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 12.5,
              margin: "0 0 18px",
              lineHeight: 1.5,
            }}
          >
            You have <strong style={{ color: GOLD }}>{daysLeft} days</strong> of
            full Pro access
            {endDateLabel ? ` — until ${endDateLabel}.` : "."} Create unlimited
            tracker cards, export reports, and more.
          </p>

          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {[
              "Unlimited tracked cards & reports",
              "CSV, JSON & PDF export",
              "Team-wide analytics",
              "Priority support",
            ].map((f) => (
              <div
                key={f}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 12.5,
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                <span style={{ color: "#4caf50", fontSize: 13 }}>✓</span>
                {f}
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 10,
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
              color: "#1a0e00",
            }}
          >
            Start exploring
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalIn { from { opacity:0; transform: scale(0.96); } to { opacity:1; transform: scale(1); } }
      `}</style>
    </div>
  );
}