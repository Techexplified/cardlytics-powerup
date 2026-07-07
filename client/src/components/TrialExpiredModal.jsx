import { useState } from "react";
import { initCheckout } from "../utils/api";

const GOLD = "#f5c842";
const GOLD_DARK = "#d4a017";

export default function TrialExpiredModal({ show, token, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!show) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const { checkoutUrl } = await initCheckout(token);
      window.open(checkoutUrl, "_blank");
      onClose();
    } catch {
      setError("Couldn't start checkout. Please try again.");
      setLoading(false);
    }
  };

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
              background: "rgba(220,53,69,0.12)",
              border: "1px solid rgba(220,53,69,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              fontSize: 22,
            }}
          >
            🔒
          </div>

          <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700, margin: "0 0 6px" }}>
            Your trial has ended
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 12.5,
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            Your 14-day free trial is over. Upgrade to Pro to keep creating tracker cards.
          </p>

          {error && (
            <div
              style={{
                width: "100%",
                background: "rgba(220,53,69,0.12)",
                border: "1px solid rgba(220,53,69,0.3)",
                borderRadius: 8,
                padding: "9px 12px",
                color: "#ff8fa3",
                fontSize: 12,
                marginBottom: 14,
                boxSizing: "border-box",
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 10,
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
              color: "#1a0e00",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(0,0,0,0.25)",
                    borderTopColor: "#1a0e00",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                    display: "inline-block",
                  }}
                />
                Opening checkout…
              </>
            ) : (
              "⚡ Upgrade to Pro"
            )}
          </button>

          <button
            onClick={onClose}
            style={{
              width: "100%",
              marginTop: 10,
              padding: "13px 0",
              borderRadius: 10,
              background: "transparent",
              border: "0.5px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.5)",
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalIn { from { opacity:0; transform: scale(0.96); } to { opacity:1; transform: scale(1); } }
      `}</style>
    </div>
  );
}