export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://cardlyticsapi-pf6diz22ka-uc.a.run.app";

// Returns: { plan, isPro, isTrialActive, isActive, expiresAt, trialEndsAt }
export async function fetchSubscriptionStatus(token) {
  const res = await fetch(`${API_BASE_URL}/api/subscription/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("verify_failed");
  return res.json();
}

export async function initCheckout(token) {
  const res = await fetch(`${API_BASE_URL}/api/checkout/init`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 409) throw new Error("already_pro");
  if (!res.ok) throw new Error("checkout_failed");
  return res.json(); // { checkoutUrl }
}

// Returns: { overview, cancelSubscription, updatePaymentMethod }
// Only works for Pro members who've completed at least one real payment.
// Returns null for trial/free users (backend sends 404).
export async function fetchBillingPortal(token) {
  const res = await fetch(`${API_BASE_URL}/api/subscription/portal`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("portal_failed");
  return res.json();
}