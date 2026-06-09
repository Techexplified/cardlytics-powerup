export const TRELLO_API_KEY = import.meta.env.VITE_TRELLO_API_KEY;

// ✅ Hardcoded — window.location.origin is unreliable inside Trello iframes
export const AUTH_CALLBACK_URL =
  "https://cardlytics-powerup-eight.vercel.app/auth.html";

export const TRELLO_AUTH_URL = () =>
  `https://trello.com/1/authorize?` +
  `expiration=never` +
  `&name=Cardlytics` +
  `&scope=read,write` +
  `&response_type=token` +
  `&key=${TRELLO_API_KEY}` +
  `&return_url=${encodeURIComponent(AUTH_CALLBACK_URL)}` +
  `&callback_method=fragment`;

const TOKEN_KEY = "cardlytics_trello_token";

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const storeToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export function authorizeWithTrello() {
  return new Promise((resolve, reject) => {
    const width = 500, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      TRELLO_AUTH_URL(),
      "TrelloAuth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups."));
      return;
    }

    // ✅ Listen for token via postMessage (from auth.html)
    const handler = (event) => {
      if (!event.data) return;
      try {
        const data =
          typeof event.data === "string"
            ? JSON.parse(event.data)
            : event.data;

        if (data && data.token) {
          window.removeEventListener("message", handler);
          clearInterval(pollTimer);
          clearInterval(checkUrlForToken);

          storeToken(data.token);
          resolve(data.token);
        }
      } catch (e) {}
    };

    window.addEventListener("message", handler);

    // ✅ Fallback: read token directly from popup URL
    const checkUrlForToken = setInterval(() => {
      try {
        if (popup.location.href.includes("#token=")) {
          const hash = popup.location.hash;
          const token = new URLSearchParams(
            hash.replace("#", "")
          ).get("token");

          if (token) {
            clearInterval(checkUrlForToken);
            clearInterval(pollTimer);

            storeToken(token);
            popup.close();
            resolve(token);
          }
        }
      } catch (e) {
        // Ignore cross-origin errors
      }
    }, 500);

    // ✅ Check if popup closed
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        clearInterval(checkUrlForToken);
        window.removeEventListener("message", handler);

        const stored = localStorage.getItem(TOKEN_KEY);
        if (stored) {
          resolve(stored);
        } else {
          reject(new Error("Authorization cancelled."));
        }
      }
    }, 500);
  });
}