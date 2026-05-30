import { useState } from "react";
import { authorizeWithTrello } from "../utils/auth";

export default function LoginScreen({ onAuth }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await authorizeWithTrello();
      onAuth(token);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: "100vw", height: "100vh", background: "#1a1a1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: "#252525", border: "1px solid #333", borderRadius: 16,
        padding: "40px 48px", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 0, maxWidth: 380, width: "100%",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <h1 style={{ color: "#e0e0e0", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
          Welcome to Cardlytics!
        </h1>
        <p style={{ color: "#888", fontSize: 13, margin: "0 0 28px", textAlign: "center" }}>
          Track your Trello board stats as visual cards with live counts.
        </p>

        <div style={{ width: "100%", height: 1, background: "#333", marginBottom: 28 }} />

        {error && (
          <div style={{
            background: "rgba(220,53,69,0.15)", border: "1px solid rgba(220,53,69,0.4)",
            borderRadius: 8, padding: "10px 14px", color: "#ff8fa3",
            fontSize: 13, marginBottom: 16, width: "100%", textAlign: "center",
            boxSizing: "border-box",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, background: loading ? "#1a3a6e" : "#0052cc",
            color: "#fff", border: "none", borderRadius: 10,
            padding: "13px 28px", fontSize: 14, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            width: "100%", fontFamily: "'DM Sans', sans-serif",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#0065ff"; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#0052cc"; }}
        >
          {loading ? (
            <>
              <span style={{
                width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff", borderRadius: "50%",
                animation: "spin 0.7s linear infinite", display: "inline-block",
              }} />
              Connecting…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <rect x="1" y="1" width="10" height="14" rx="2" />
                <rect x="13" y="1" width="10" height="9" rx="2" />
              </svg>
              Sign in with Trello
            </>
          )}
        </button>

        <p style={{ fontSize: 11, color: "#555", textAlign: "center", margin: "16px 0 0", lineHeight: 1.6 }}>
          By signing in you grant Cardlytics read &amp; write access to your Trello boards.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}