import { useEffect, useState, useRef } from "react";
import { initializePaddle } from "@paddle/paddle-js";
import { fetchSubscriptionStatus } from "../utils/api";
import { getStoredToken } from "../utils/auth";

// Minimal confetti — no extra dependency needed.
// If you already use canvas-confetti elsewhere, swap this out for that instead.
function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "9999";
  canvas.style.pointerEvents = "none";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const colors = ["#e8b339", "#c9962a", "#4ea1ff", "#4caf50", "#ff8fa3"];
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.3,
    r: 4 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: -2 + Math.random() * 4,
    vy: 2 + Math.random() * 3,
    rot: Math.random() * 360,
    vr: -6 + Math.random() * 12,
  }));

  let frame = 0;
  const maxFrames = 220; // ~3.5s at 60fps

  function tick() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04; // gravity
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    });
    if (frame < maxFrames) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(tick);
}

export default function CheckoutPage() {
  const [status, setStatus] = useState("loading");
  // loading | success | failed
  const pollRef = useRef(null);
  const firedConfettiRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function openCheckout() {
      const params = new URLSearchParams(window.location.search);
      const transactionId = params.get("_ptxn");

      if (!transactionId) {
        setStatus("failed");
        return;
      }

      const paddle = await initializePaddle({
        environment: "sandbox",
        token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN,
        eventCallback: (event) => {
          if (cancelled) return;

          // This fires the instant Paddle confirms the transaction completed —
          // much faster than waiting on your backend webhook.
          if (event.name === "checkout.completed") {
            handleSuccess();
          }

          if (event.name === "checkout.closed" && status === "loading") {
            // User closed the checkout modal without finishing.
            // Don't hard-fail here — webhook/polling might still confirm it
            // if they actually paid right before closing. Just let polling
            // keep running; only show "failed" once polling times out.
          }
        },
      });

      paddle?.Checkout.open({
        transactionId,
        settings: {
          successUrl: window.location.origin + "/",
        },
      });

      // Backend confirmation poll — this is our source of truth for whether
      // the subscription is actually marked active in our system, since
      // Paddle's client event only tells us the *checkout* succeeded, not
      // that our webhook has processed it yet.
      pollForProStatus();
    }

    function handleSuccess() {
      if (firedConfettiRef.current) return; // avoid double-fire
      firedConfettiRef.current = true;
      clearInterval(pollRef.current);
      fireConfetti();
      setStatus("success");
      setTimeout(() => {
        // Use replace so the checkout URL (with _ptxn) doesn't sit in history
        window.location.replace("/");
      }, 2200);
    }

    async function pollForProStatus() {
      const token = getStoredToken();
      if (!token) return;

      const maxAttempts = 40; // 40 × 3s = 2 minutes
      let attempts = 0;

      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const data = await fetchSubscriptionStatus(token);
          if (data.isPro) {
            handleSuccess();
            return;
          }
        } catch {
          // keep polling
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollRef.current);
          if (!firedConfettiRef.current) setStatus("failed");
        }
      }, 3000);
    }

    openCheckout();

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "success") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#1a1a1a",
          fontFamily: "'DM Sans', sans-serif",
          color: "#e0e0e0",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 48 }}>👑</div>
        <h2 style={{ color: "#e8b339", margin: 0 }}>You're now Pro!</h2>
        <p style={{ color: "#777", fontSize: 13 }}>
          Redirecting back to Cardlytics...
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#1a1a1a",
          fontFamily: "'DM Sans', sans-serif",
          color: "#e0e0e0",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2 style={{ margin: 0 }}>Payment verification pending</h2>
        <p
          style={{
            color: "#777",
            fontSize: 13,
            textAlign: "center",
            maxWidth: 300,
          }}
        >
          Your payment was received. It may take a moment to activate. Please
          close this tab and reopen Cardlytics.
        </p>
      </div>
    );
  }

  // loading state — waiting for webhook / Paddle event
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#1a1a1a",
        fontFamily: "'DM Sans', sans-serif",
        color: "#e0e0e0",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid #333",
          borderTopColor: "#e8b339",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ color: "#777", fontSize: 13 }}>Activating your Pro plan...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
