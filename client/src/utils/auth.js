export const TRELLO_API_KEY = "eea918ac665b2e6ffcd2c13fb34decb4";

export const AUTH_CALLBACK_URL = `${window.location.origin}/auth.html`;

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
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );

    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups for this site."));
      return;
    }

    const handler = (event) => {
      if (!event.data) return;
      try {
        const data = typeof event.data === "string"
          ? JSON.parse(event.data)
          : event.data;
        if (data && data.token) {
          window.removeEventListener("message", handler);
          clearInterval(pollTimer);
          storeToken(data.token);
          resolve(data.token);
        }
      } catch (_) {}
    };

    window.addEventListener("message", handler);

    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        window.removeEventListener("message", handler);
        const stored = localStorage.getItem("trello_token");
        if (stored) {
          localStorage.removeItem("trello_token");
          storeToken(stored);
          resolve(stored);
        } else {
          reject(new Error("Authorization cancelled."));
        }
      }
    }, 500);
  });
}