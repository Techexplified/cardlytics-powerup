export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://cardlyticsapi-pf6diz22ka-uc.a.run.app";

export async function fetchSubscriptionStatus(token) {
  const res = await fetch(`${API_BASE_URL}/api/subscription/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("verify_failed");
  return res.json(); // { plan, expiresAt, isActive }
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