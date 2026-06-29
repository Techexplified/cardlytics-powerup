import { useState, useEffect, useRef } from "react";
import { fetchSubscriptionStatus, initCheckout } from "../utils/api";

const GOLD = "#f5c842";
const GOLD_DARK = "#d4a017";

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
        <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle
          cx="36" cy="36" r="30" fill="none"
          stroke={resolved ? (isPro ? GOLD : "#f5c842") : "#f5c842"}
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
        fontSize: resolved ? 26 : 13, color: resolved ? GOLD : "rgba(255,255,255,0.4)",
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
      padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: 13,
    }}>
      <span style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
      {state === "pending" ? (
        <span style={{
          width: 12, height: 12, border: "2px solid rgba(255,255,255,0.15)",
          borderTopColor: GOLD, borderRadius: "50%",
          animation: "spin 0.7s linear infinite", display: "inline-block",
        }} />
      ) : (
        <span style={{ color: state === "good" ? "#4caf50" : "#ffffff", fontWeight: 600 }}>
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
  const [selectedTab, setSelectedTab] = useState("trial"); // UI-only: free | trial | pro — does not affect phase logic
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
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, fontFamily: "'DM Sans', sans-serif",
    }} onClick={(e) => e.target === e.currentTarget && phase !== "checkout-wait" && onClose()}>
      <div style={{
        background: "#13131f", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 16,
        width: 380, maxWidth: "92vw", boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        overflow: "hidden", animation: "modalIn 0.25s ease",
      }}>
        {/* header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#1a1000",
            }}>C</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#ffffff" }}>Cardlytics</span>
          </div>
          {phase !== "checkout-wait" && (
            <button onClick={onClose} style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.4)",
              fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "2px 4px", borderRadius: 4,
            }}>✕</button>
          )}
        </div>

        <div style={{ padding: "20px" }}>
          {phase === "verifying" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <VerifyRing resolved={false} />
              <h2 style={{ color: "#ffffff", fontSize: 16, fontWeight: 700, margin: "18px 0 6px" }}>
                Verifying your subscription
              </h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12.5, margin: "0 0 20px" }}>
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
              <h2 style={{ color: "#ffffff", fontSize: 17, fontWeight: 700, margin: "18px 0 4px" }}>
                You're on Cardlytics Pro
              </h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12.5, margin: "0 0 20px" }}>
                {status?.expiresAt
                  ? `Renews on ${formatDate(status.expiresAt)}`
                  : "Your plan is active"}
              </p>
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                {["Unlimited tracked cards", "Team-wide analytics"].map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: "rgba(212,160,23,0.18)", border: "0.5px solid rgba(212,160,23,0.4)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, color: GOLD, flexShrink: 0,
                    }}>✓</span>{p}
                  </div>
                ))}
              </div>
              <button onClick={onClose} style={btnPrimary(true)}>Got it</button>
            </div>
          )}

          {(phase === "free" || phase === "checkout-wait") && (
            <div>
              {/* Plan tabs — UI only, selectedTab does not affect phase/logic */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[
                  { key: "free", label: "Free" },
                  { key: "trial", label: "14-day trial" },
                  { key: "pro", label: "Pro" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => phase !== "checkout-wait" && setSelectedTab(t.key)}
                    style={{
                      flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", borderRadius: 8,
                      border: selectedTab === t.key ? `0.5px solid ${GOLD_DARK}` : "0.5px solid rgba(255,255,255,0.1)",
                      background: selectedTab === t.key ? "rgba(212,160,23,0.15)" : "transparent",
                      color: selectedTab === t.key ? GOLD : "rgba(255,255,255,0.45)",
                      cursor: phase === "checkout-wait" ? "default" : "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* FREE TAB */}
              {selectedTab === "free" && (
                <>
                  <div style={{
  borderRadius: 12, padding: "12px 16px", marginBottom: 18, minHeight: 80,
  background: "#1a1a2e", border: "0.5px solid rgba(255,255,255,0.08)",
}}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500,
                      padding: "3px 10px", borderRadius: 20, marginBottom: 12,
                      background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)",
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                      Free plan
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.6)" }}>$</span>
                      <span style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>0</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>/mo</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Basic access · no card needed</div>
                  </div>
                  <ul style={{ listStyle: "none", margin: "0 0 18px", display: "flex", flexDirection: "column", gap: 10, padding: 0 }}>
                    {["Basic analytics", "Limited reports (5/mo)", "Single workspace"].map((f, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: "rgba(255,255,255,0.35)",
                        }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <button style={btnGhost(true)}>Current plan</button>
                  <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "10px 0 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    🔒 Secure checkout via Paddle
                  </p>
                </>
              )}

              {/* TRIAL TAB */}
              {selectedTab === "trial" && (
                <>
                  <div style={{
                    background: "rgba(212,160,23,0.1)", border: "0.5px solid rgba(212,160,23,0.25)",
                    borderRadius: 8, padding: "9px 12px", marginBottom: 14, fontSize: 11.5,
                    color: "#e8b830", display: "flex", alignItems: "center", gap: 7,
                  }}>
                    ⚡ No credit card required · cancel anytime
                  </div>
                  <div style={{
  borderRadius: 12, padding: "12px 16px", marginBottom: 18, minHeight: 80,
  position: "relative", overflow: "hidden",
  background: "linear-gradient(135deg, #1a1200 0%, #2a1f00 60%, #1a1a2e 100%)",
  border: "0.5px solid rgba(212,160,23,0.3)",
}}>
                    <div style={{
                      position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(212,160,23,0.18) 0%, transparent 70%)", pointerEvents: "none",
                    }} />
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500,
                      padding: "3px 10px", borderRadius: 20, marginBottom: 12,
                      background: "rgba(212,160,23,0.18)", color: GOLD,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                      14-day free trial
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: GOLD }}>$</span>
                     <span style={{ fontSize: 24, fontWeight: 700, color: GOLD, lineHeight: 1 }}>0</span>

                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>for 14 days</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Then $19/mo · cancel before trial ends</div>
                  </div>
                  <ul style={{ listStyle: "none", margin: "0 0 18px", display: "flex", flexDirection: "column", gap: 10, padding: 0 }}>
                    {["Unlimited tracked cards & reports", "CSV, JSON & PDF export", "Team-wide analytics", "Priority support"].map((f, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(212,160,23,0.18)", border: "0.5px solid rgba(212,160,23,0.4)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: GOLD,
                        }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>

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
                        width: 16, height: 16, border: "2px solid rgba(255,255,255,0.15)",
                        borderTopColor: GOLD, borderRadius: "50%",
                        animation: "spin 0.7s linear infinite", margin: "0 auto 10px",
                      }} />
                      <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12.5, margin: "0 0 14px" }}>
                        Complete your payment in the new window — we'll detect it automatically.
                      </p>
                      <button onClick={() => { popupRef.current?.close(); setPhase("free"); }} style={btnGhost()}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={handleUpgrade} style={btnPrimary(true)}>
                        ⚡ Start free trial
                      </button>
                      <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "10px 0 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        🔒 Secure checkout via Paddle
                      </p>
                    </>
                  )}
                </>
              )}

              {/* PRO TAB */}
              {selectedTab === "pro" && (
                <>
                 <div style={{
  borderRadius: 12, padding: "12px 16px", marginBottom: 18, minHeight: 80,
  position: "relative", overflow: "hidden",
  background: "linear-gradient(135deg, #130e00 0%, #241800 60%, #1a1a2e 100%)",
  border: "0.5px solid rgba(212,160,23,0.5)",
}}>
                    <div style={{
                      position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(212,160,23,0.18) 0%, transparent 70%)", pointerEvents: "none",
                    }} />
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500,
                      padding: "3px 10px", borderRadius: 20, marginBottom: 12,
                      background: "rgba(212,160,23,0.22)", color: GOLD,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                      Pro plan
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: GOLD }}>$</span>
                      <span style={{ fontSize: 24, fontWeight: 700, color: GOLD, lineHeight: 1 }}>19</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>/mo</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Billed monthly · cancel anytime</div>
                  </div>
                  <ul style={{ listStyle: "none", margin: "0 0 18px", display: "flex", flexDirection: "column", gap: 10, padding: 0 }}>
                    {["Unlimited tracked cards & reports", "CSV, JSON & PDF export", "Team-wide analytics", "Priority support"].map((f, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(212,160,23,0.18)", border: "0.5px solid rgba(212,160,23,0.4)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: GOLD,
                        }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>

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
                        width: 16, height: 16, border: "2px solid rgba(255,255,255,0.15)",
                        borderTopColor: GOLD, borderRadius: "50%",
                        animation: "spin 0.7s linear infinite", margin: "0 auto 10px",
                      }} />
                      <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12.5, margin: "0 0 14px" }}>
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
                      <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "10px 0 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        🔒 Secure checkout via Paddle
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {phase === "error" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
              <h2 style={{ color: "#ffffff", fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>
                Couldn't verify your plan
              </h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12.5, margin: "0 0 18px" }}>
                Check your connection and try again.
              </p>
              <button onClick={verify} style={btnPrimary(true)}>Retry</button>
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
      flex: 1, borderRadius: 12, padding: "14px 12px",
      background: highlight
        ? "linear-gradient(135deg, #130e00 0%, #241800 60%, #1a1a2e 100%)"
        : "#1a1a2e",
      border: highlight ? "0.5px solid rgba(212,160,23,0.5)" : "0.5px solid rgba(255,255,255,0.08)",
      position: "relative",
      overflow: "hidden",
    }}>
      {highlight && (
        <div style={{
          position: "absolute", top: -30, right: -30, width: 100, height: 100,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,160,23,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
      )}
      {highlight && (
        <div style={{
          position: "absolute", top: -9, right: 10,
          background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
          color: "#1a0e00", fontSize: 9.5, fontWeight: 700, padding: "2px 7px",
          borderRadius: 5, letterSpacing: 0.3,
        }}>POPULAR</div>
      )}
      <div style={{
        fontSize: 11, fontWeight: 500, marginBottom: 10, display: "inline-flex",
        alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20,
        background: highlight ? "rgba(212,160,23,0.22)" : "rgba(255,255,255,0.08)",
        color: highlight ? GOLD : "rgba(255,255,255,0.5)",
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
        {title}{active && <span style={{ color: "#4caf50" }}> · current</span>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: highlight ? GOLD : "#ffffff", marginBottom: 10, lineHeight: 1 }}>
        {price}<span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>/mo</span>
      </div>
      {features.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
          <span style={{
            width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
            background: highlight ? "rgba(212,160,23,0.18)" : "rgba(255,255,255,0.06)",
            border: highlight ? "0.5px solid rgba(212,160,23,0.4)" : "0.5px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, color: highlight ? GOLD : "rgba(255,255,255,0.35)",
          }}>✓</span>{f}
        </div>
      ))}
    </div>
  );
}

function btnPrimary(gold) {
  return {
    width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
    fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    background: gold ? `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})` : "#0052cc",
    color: gold ? "#1a0e00" : "#fff",
  };
}
function btnGhost(muted) {
  return {
    background: "transparent", border: "0.5px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.5)",
    borderRadius: 10, padding: muted ? "13px 0" : "8px 18px", width: muted ? "100%" : undefined,
    fontSize: muted ? 14 : 12.5, fontWeight: muted ? 600 : 400,
    cursor: muted ? "default" : "pointer",
    fontFamily: "'DM Sans', sans-serif",
  };
}