import { useState, useEffect, useRef } from "react";
import { fetchSubscriptionStatus, initCheckout } from "../utils/api";

const GOLD = "#e8b339";
const GOLD_DARK = "#c9962a";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Verification ring: draws in, then resolves to ✓ or 👑 ──────────────────
function VerifyRing({ resolved, isPro }) {
  return (
    <div style={{ position: "relative", width: 72, height: 72 }}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="30" fill="none" stroke="#333" strokeWidth="4" />
        <circle
          cx="36" cy="36" r="30" fill="none"
          stroke={resolved ? (isPro ? GOLD : "#0065ff") : "#0065ff"}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray="188.5"
          strokeDashoffset={resolved ? 0 : 47}
          transform="rotate(-90 36 36)"
          style={{
            transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease",
            animation: resolved ? "none" : "ringspin 1.1s linear infinite",
          }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: resolved ? 26 : 13, color: resolved ? (isPro ? GOLD : "#4ea1ff") : "#666",
        transition: "opacity 0.3s ease", opacity: 1,
      }}>
        {resolved ? (isPro ? "👑" : "✓") : "···"}
      </div>
    </div>
  );
}

function Row({ label, value, state }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0", borderBottom: "1px solid #2c2c2c", fontSize: 13,
    }}>
      <span style={{ color: "#888" }}>{label}</span>
      {state === "pending" ? (
        <span style={{
          width: 12, height: 12, border: "2px solid #444",
          borderTopColor: "#4ea1ff", borderRadius: "50%",
          animation: "spin 0.7s linear infinite", display: "inline-block",
        }} />
      ) : (
        <span style={{ color: state === "good" ? "#4caf50" : "#e0e0e0", fontWeight: 600 }}>
          {value}
        </span>
      )}
    </div>
  );
}

export default function SubscriptionModal({ show, token, onClose, onStatusKnown }) {
  const [phase, setPhase] = useState("verifying"); // verifying | pro | free | checkout-wait | error
  const [status, setStatus] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const pollRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    setPhase("verifying");
    setCheckoutError(null);
    verify();
    return () => clearInterval(pollRef.current);
  }, [show]);

  async function verify() {
    try {
      const s = await fetchSubscriptionStatus(token);
      setStatus(s);
      onStatusKnown?.(s);
      setTimeout(() => setPhase(s.isActive ? "pro" : "free"), 450); // let the ring resolve visibly
    } catch {
      setPhase("error");
    }
  }

async function handleUpgrade() {
  setCheckoutError(null);

  try {
    const { checkoutUrl } = await initCheckout(token);

    // ← open in new tab — Power-Up stays open
    window.open(checkoutUrl, "_blank");

    // ← start polling immediately
    setPhase("checkout-wait");
    pollAfterCheckout();

  } catch (err) {
    if (err.message === "already_pro") {
      const s = await fetchSubscriptionStatus(token).catch(() => null);
      if (s) { setStatus(s); onStatusKnown?.(s); }
      setPhase("pro");
    } else {
      setCheckoutError("Couldn't start checkout. Please try again.");
    }
  }
}

async function pollAfterCheckout() {
  const maxAttempts = 40; // 2 minutes
  let attempts = 0;

  pollRef.current = setInterval(async () => {
    attempts++;
    try {
      const s = await fetchSubscriptionStatus(token);
      if (s.isActive) {
        clearInterval(pollRef.current);
        setStatus(s);
        onStatusKnown?.(s);
        setPhase("pro"); // ← shows Pro UI automatically
      }
    } catch {
      // keep polling
    }

    if (attempts >= maxAttempts) {
      clearInterval(pollRef.current);
      setPhase("free"); // timeout — go back to free UI
    }
  }, 3000);
}

  if (!show) return null;

  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, fontFamily: "'DM Sans', sans-serif",
    }} onClick={(e) => e.target === e.currentTarget && phase !== "checkout-wait" && onClose()}>
      <div style={{
        background: "#1f1f1f", border: "1px solid #333", borderRadius: 16,
        width: 380, maxWidth: "92vw", boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        overflow: "hidden", animation: "modalIn 0.25s ease",
      }}>
        {/* header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px", borderBottom: "1px solid #2c2c2c",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, background: "#0052cc",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff",
            }}>C</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>Cardlytics</span>
          </div>
          {phase !== "checkout-wait" && (
            <button onClick={onClose} style={{
              background: "none", border: "none", color: "#666",
              fontSize: 16, cursor: "pointer", lineHeight: 1,
            }}>✕</button>
          )}
        </div>

        <div style={{ padding: "28px 24px 24px" }}>
          {phase === "verifying" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <VerifyRing resolved={false} />
              <h2 style={{ color: "#e0e0e0", fontSize: 16, fontWeight: 700, margin: "18px 0 6px" }}>
                Verifying your subscription
              </h2>
              <p style={{ color: "#777", fontSize: 12.5, margin: "0 0 20px" }}>
                Confirming your plan with Cardlytics — this only takes a second.
              </p>
              <div style={{ width: "100%" }}>
                <Row label="Trello account" value="Connected" state="good" />
                <Row label="Subscription status" state="pending" />
              </div>
            </div>
          )}

          {phase === "pro" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <VerifyRing resolved isPro />
              <h2 style={{ color: "#e0e0e0", fontSize: 17, fontWeight: 700, margin: "18px 0 4px" }}>
                You're on Cardlytics Pro
              </h2>
              <p style={{ color: "#777", fontSize: 12.5, margin: "0 0 20px" }}>
                {status?.expiresAt
                  ? `Renews on ${formatDate(status.expiresAt)}`
                  : "Your plan is active"}
              </p>
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                {["AI insights on every board", "Unlimited tracked cards", "Team-wide analytics"].map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#bbb" }}>
                    <span style={{ color: GOLD }}>✓</span>{p}
                  </div>
                ))}
              </div>
              <button onClick={onClose} style={btnPrimary(false)}>Got it</button>
            </div>
          )}

          {(phase === "free" || phase === "checkout-wait") && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <h2 style={{ color: "#e0e0e0", fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>
                  Unlock Cardlytics Pro
                </h2>
                <p style={{ color: "#777", fontSize: 12.5, margin: 0 }}>
                  AI insights, unlimited reports, and team analytics.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <PlanCard title="Free" active price="$0" features={["Basic analytics", "Limited reports", "Single workspace"]} />
                <PlanCard title="Pro" highlight price="$19" features={["AI insights", "Unlimited reports", "Team analytics", "Priority support"]} />
              </div>

              {checkoutError && (
                <div style={{
                  background: "rgba(220,53,69,0.12)", border: "1px solid rgba(220,53,69,0.35)",
                  borderRadius: 8, padding: "9px 12px", color: "#ff8fa3",
                  fontSize: 12, marginBottom: 14, textAlign: "center",
                }}>{checkoutError}</div>
              )}

              {phase === "checkout-wait" ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    width: 16, height: 16, border: "2px solid #444",
                    borderTopColor: GOLD, borderRadius: "50%",
                    animation: "spin 0.7s linear infinite", margin: "0 auto 10px",
                  }} />
                  <p style={{ color: "#999", fontSize: 12.5, margin: "0 0 14px" }}>
                    Complete your payment in the new window — we'll detect it automatically.
                  </p>
                  <button onClick={() => { popupRef.current?.close(); setPhase("free"); }} style={btnGhost()}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={handleUpgrade} style={btnPrimary(true)}>
                    ⚡ Upgrade to Pro
                  </button>
                  <p style={{ textAlign: "center", fontSize: 10.5, color: "#555", margin: "12px 0 0" }}>
                    Payments securely processed by Paddle.
                  </p>
                </>
              )}
            </div>
          )}

          {phase === "error" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
              <h2 style={{ color: "#e0e0e0", fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>
                Couldn't verify your plan
              </h2>
              <p style={{ color: "#777", fontSize: 12.5, margin: "0 0 18px" }}>
                Check your connection and try again.
              </p>
              <button onClick={verify} style={btnPrimary(false)}>Retry</button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ringspin { to { transform: rotate(270deg); } }
        @keyframes modalIn { from { opacity:0; transform: scale(0.96); } to { opacity:1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

function PlanCard({ title, price, features, highlight, active }) {
  return (
    <div style={{
      flex: 1, borderRadius: 10, padding: "14px 12px",
      background: highlight ? "rgba(232,179,57,0.08)" : "#252525",
      border: highlight ? `1.5px solid ${GOLD}` : "1px solid #333",
      position: "relative",
    }}>
      {highlight && (
        <div style={{
          position: "absolute", top: -9, right: 10, background: GOLD,
          color: "#1a1a1a", fontSize: 9.5, fontWeight: 700, padding: "2px 7px",
          borderRadius: 5, letterSpacing: 0.3,
        }}>POPULAR</div>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: highlight ? GOLD : "#aaa", marginBottom: 2 }}>
        {title}{active && <span style={{ color: "#4caf50", fontWeight: 500 }}> · current</span>}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#e0e0e0", marginBottom: 8 }}>
        {price}<span style={{ fontSize: 10, color: "#666", fontWeight: 500 }}>/mo</span>
      </div>
      {features.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 5, fontSize: 11, color: "#999", marginBottom: 4 }}>
          <span style={{ color: highlight ? GOLD : "#555" }}>✓</span>{f}
        </div>
      ))}
    </div>
  );
}

function btnPrimary(gold) {
  return {
    width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
    fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    background: gold ? `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})` : "#0052cc",
    color: gold ? "#1a1a1a" : "#fff",
  };
}
function btnGhost() {
  return {
    background: "none", border: "1px solid #444", color: "#999",
    borderRadius: 8, padding: "8px 18px", fontSize: 12.5, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  };
}