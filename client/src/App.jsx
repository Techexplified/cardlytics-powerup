import { useState, useEffect, useRef } from "react";
import {
  getBoard,
  getBoardCards,
  computeStats,
  computeDetailStats,
  getMemberId,
  getMemberDetails,
  getListCards,
  getBoardLists,
  getBoardLabels,
  createCard,
  createList,
  applyFilters,
  getWeekBounds,
  getWorkspaceBoards, // ← new
  getBoardScopedData,
} from "./trello";
import { CustomizeFlow } from "./CustomizeModal";
import LoginScreen from "./components/LoginScreen";
import { TRELLO_API_KEY, getStoredToken, storeToken } from "./utils/auth";
import "./index.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const TRELLO_BASE = "https://api.trello.com/1";

let _workspaceBoardsCache = null;
let _workspacesCache = null;

// ── Initialize Trello iframe context ONCE at module level ─────────────────────
const trelloT = (() => {
  try {
    return window.TrelloPowerUp?.iframe?.() ?? null;
  } catch {
    return null;
  }
})();

// ── module-level helper (used by refreshTrackerCards + createCard flow) ───────
function dataUrlToBlob(dataUrl) {
  const base64Data = dataUrl.split(",")[1];
  const byteCharacters = atob(base64Data);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([byteArray], { type: "image/jpeg" });
}

// ─── TRELLO LABEL COLOR MAP ───────────────────────────────────────────────────
const LABEL_COLORS = {
  red: "#ff5252",
  orange: "#ff9800",
  yellow: "#f9c74f",
  green: "#4caf50",
  blue: "#4ea1ff",
  purple: "#ab47bc",
  pink: "#f06292",
  sky: "#29b6f6",
  lime: "#a3e635",
  black: "#555",
  null: "#888",
  none: "#888",
};

const MEMBER_AVATAR_COLORS = [
  "#e85d2e",
  "#2e7de8",
  "#7e4de8",
  "#e84e8a",
  "#2ec4b6",
  "#e8a62e",
  "#4caf50",
];

function memberColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return MEMBER_AVATAR_COLORS[Math.abs(hash) % MEMBER_AVATAR_COLORS.length];
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function cardCreatedDate(cardId) {
  const ts = parseInt(cardId.substring(0, 8), 16) * 1000;
  return new Date(ts);
}

// FIX #6: use prefix-based check everywhere instead of loose keyword match
const TRACKER_PREFIXES = [
  "📌 assigned to me",
  "📅 due this week",
  "⚠️ overdue cards",
  "👤 unassigned cards",
  "🏷️ cards with label",
  "💤 stale cards",
  "✨ created today",
  "📋 cards in list",
];

// Detects tracker cards two ways: legacy full-text name prefix (old cards),
// or the hidden meta tag in the description (new cards, which now have
// minimal emoji-only names so Trello doesn't show duplicate title text).
const isTrackerCard = (card) => {
  if (!card) return false;
  const name = (card.name || "").toLowerCase();
  const matchesPrefix = TRACKER_PREFIXES.some((p) =>
    name.startsWith(p.toLowerCase()),
  );
  if (matchesPrefix) return true;
  return /\[_\]: cardlytics:mode:/.test(card.desc || "");
};

// isTrackerCardDisplay is now identical to isTrackerCard — kept as alias for clarity
const isTrackerCardDisplay = isTrackerCard;

const STAT_LABELS = {
  assigned: "Assigned to Me",
  dueThisWeek: "Due This Week",
  overdue: "Overdue Cards",
  unassigned: "Unassigned Cards",
  withLabel: "Cards With Label",
  stale: "Stale Cards",
  createdToday: "Created Today",
  cardsInList: "Cards in List",
  custom: "Custom Card",
  all: "All Cards",
};

const DEFAULT_STAT_CONFIG = {
  // `name` = minimal Trello card name (emoji only) — keeps the board view
  // from showing a duplicate text title under our custom cover image.
  // `label` = the descriptive text baked into the cover image itself.
  assigned: { name: "📌", label: "📌 Assigned to Me", cover: "blue" },
  dueThisWeek: { name: "📅", label: "📅 Due This Week", cover: "yellow" },
  overdue: { name: "⚠️", label: "⚠️ Overdue Cards", cover: "red" },
  unassigned: { name: "👤", label: "👤 Unassigned Cards", cover: "purple" },
  withLabel: { name: "🏷️", label: "🏷️ Cards With Label", cover: "orange" },
  stale: { name: "💤", label: "💤 Stale Cards", cover: "black" },
  createdToday: { name: "✨", label: "✨ Created Today", cover: "green" },
  cardsInList: { name: "📋", label: "📋 Cards in List", cover: "sky" },
  custom: { name: "🛠️", label: "🛠️ Custom Card", cover: "blue" },
};

const STAT_EMOJIS = {
  assigned: "📌",
  dueThisWeek: "📅",
  overdue: "⚠️",
  unassigned: "👤",
  withLabel: "🏷️",
  stale: "💤",
  createdToday: "✨",
  cardsInList: "📋",
  custom: "🛠️",
};

const COVER_BG_COLORS = {
  blue: "#1565c0",
  yellow: "#f57f17",
  red: "#b71c1c",
  purple: "#6a1b9a",
  orange: "#e65100",
  green: "#1b5e20",
  black: "#212121",
  sky: "#0277bd",
};

// ── Cover color map used by refreshTrackerCards ───────────────────────────────
const STAT_COVER_COLOR_MAP = {
  assigned: "blue",
  dueThisWeek: "yellow",
  overdue: "red",
  unassigned: "purple",
  withLabel: "orange",
  stale: "black",
  createdToday: "green",
  cardsInList: "sky",
  custom: "blue",
};

// ── Generate cover image canvas ───────────────────────────────────────────────
function generateStatCoverImage(count, colorName, bgImageDataUrl = null, avatarInitials = null, avatarColor = "#4ea1ff") {
  return new Promise((resolve) => {
    const W = 800,
      H = 320;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    function drawAvatar() {
      if (!avatarInitials) return;
      const r = 38, cx = W - 60, cy = 60; // top-right, matching Trello's badge position
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = avatarColor;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.stroke();
      ctx.font = `800 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(avatarInitials, cx, cy + 1);
    }

    function drawNumber() {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W, H);
      const numStr = String(count);
      const fontSize = numStr.length > 3 ? 90 : numStr.length > 2 ? 110 : 130;
      ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 28;
      ctx.fillText(numStr, W / 2, H / 2);
      drawAvatar();
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    }

    if (bgImageDataUrl) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.max(W / img.width, H / img.height);
        const sw = img.width * scale, sh = img.height * scale;
        ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
        drawNumber(true); // dark overlay only needed for legibility over a busy photo
      };
      img.onerror = () => {
        ctx.fillStyle = COVER_BG_COLORS[colorName] || "#1565c0";
        ctx.fillRect(0, 0, W, H);
        drawNumber(false);
      };
      img.src = bgImageDataUrl;
    } else {
      ctx.fillStyle = COVER_BG_COLORS[colorName] || "#1565c0";
      ctx.fillRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "rgba(255,255,255,0.12)");
      grad.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      drawNumber(false); // plain color cards: no blanket black layer, just the natural shade
    }
  });
}
// ── Generate cover image from a styled DOM node (matches LiveStylePreview) ───
async function generateStyledCoverImage({
  count,
  cover,
  customHex,
  textColor,
  customTextHex,
  layout,
  title,
  subtitle,
  coverImage,
  avatarInitials,
  avatarColor,
}) {
  const COVER_COLORS_MAP = {
    blue: "#0052cc",
    sky: "#29b6f6",
    green: "#1a7a4a",
    yellow: "#e6a817",
    orange: "#e67e22",
    red: "#c0392b",
    purple: "#7e57c2",
    pink: "#e91e8c",
    black: "#374151",
  };
  const COVER_GRADIENTS_MAP = {
    "grad-blue-sky": "linear-gradient(135deg,#0052cc,#29b6f6)",
    "grad-green-sky": "linear-gradient(135deg,#1a7a4a,#29b6f6)",
    "grad-orange-pink": "linear-gradient(135deg,#e67e22,#e91e8c)",
    "grad-purple-pink": "linear-gradient(135deg,#7e57c2,#e91e8c)",
    "grad-yellow-orange": "linear-gradient(135deg,#e6a817,#e67e22)",
    "grad-red-purple": "linear-gradient(135deg,#c0392b,#7e57c2)",
    "grad-slate-blue": "linear-gradient(135deg,#374151,#0052cc)",
    "grad-multi": "linear-gradient(135deg,#0052cc,#7e57c2,#e91e8c)",
  };
  const TEXT_COLORS_MAP = {
    white: "#FFFFFF",
    light: "#E5E7EB",
    muted: "#9CA3AF",
    dark: "#374151",
    blue: "#3B82F6",
    green: "#10B981",
    yellow: "#FBBF24",
    gradient: "#FFFFFF", // html2canvas can't render CSS gradients on text; fall back to white
  };

  const cardBg =
    cover === "custom" && customHex
      ? customHex
      : COVER_GRADIENTS_MAP[cover] || COVER_COLORS_MAP[cover] || "#0052cc";
  const resolvedTextColor =
    textColor === "custom" && customTextHex
      ? customTextHex
      : TEXT_COLORS_MAP[textColor] || "#FFFFFF";

  // Build a hidden node that mirrors LiveStylePreview exactly
  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "fixed",
    top: "-9999px",
    left: "-9999px",
    width: "800px",
    height: "320px",
    borderRadius: "0",
    overflow: "hidden",
    background: cardBg,
    zIndex: -1,
  });

  // Overlay (same as LiveStylePreview)
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    background: "rgba(0,0,0,0.08)",
  });
  wrapper.appendChild(overlay);

  const numStyle = `font-size:96px;font-weight:800;color:${resolvedTextColor};line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;`;
  const lblStyle = `font-size:46px;font-weight:700;color:${resolvedTextColor};line-height:1.25;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;`;
  const subStyle = `font-size:32px;color:${resolvedTextColor};opacity:0.8;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;`;
  let innerHtml = "";
  if (layout === "center") {
    innerHtml = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:32px;">
      <span style="${numStyle}">${count}</span>
      <span style="${lblStyle}">${title}</span>
      <span style="${subStyle}">${subtitle}</span>
    </div>`;
  } else if (layout === "bottomLeft") {
    innerHtml = `<div style="position:absolute;bottom:32px;left:32px;display:flex;flex-direction:column;gap:6px;">
      <span style="${numStyle}">${count}</span>
      <span style="${lblStyle}">${title}</span>
      <span style="${subStyle}">${subtitle}</span>
    </div>`;
  } else if (layout === "bottomRight") {
    innerHtml = `<div style="position:absolute;bottom:32px;right:32px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
      <span style="${numStyle}">${count}</span>
      <span style="${lblStyle}">${title}</span>
      <span style="${subStyle}">${subtitle}</span>
    </div>`;
  } else if (layout === "topBottom") {
    innerHtml = `
      <div style="position:absolute;top:32px;right:32px;text-align:right;">
        <span style="${numStyle}">${count}</span>
        <span style="${lblStyle};display:block;">${title}</span>
      </div>
      <div style="position:absolute;bottom:24px;left:32px;">
        <span style="${subStyle}">${subtitle}</span>
      </div>`;
  }

  const content = document.createElement("div");
  content.style.position = "relative";
  content.style.zIndex = "1";
  content.style.width = "100%";
  content.style.height = "100%";
  content.innerHTML = innerHtml;
  wrapper.appendChild(content);

  if (avatarInitials) {
    const avatarEl = document.createElement("div");
    Object.assign(avatarEl.style, {
      position: "absolute",
      bottom: "24px",
      right: "24px",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      background: avatarColor || "#4ea1ff",
      border: "3px solid rgba(255,255,255,0.9)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontWeight: "700",
      fontSize: "22px",
      fontFamily: "-apple-system, BlinkMacSystemFont,'Segoe UI',sans-serif",
      zIndex: "2",
    });
    avatarEl.textContent = avatarInitials;
    wrapper.appendChild(avatarEl);
  }

  document.body.appendChild(wrapper);
  try {
    const canvas = await html2canvas(wrapper, {
      backgroundColor: null,
      scale: 1,
      useCORS: true,
      width: 800,
      height: 320,
      logging: false,
    });
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const icon =
    toast.type === "success" ? "✅" : toast.type === "premium" ? "⭐" : "❌";
  return (
    <div className={`toast toast-${toast.type}`}>
      <span className="toast-icon">{icon}</span>
      <span className="toast-msg">{toast.message}</span>
    </div>
  );
}

function TrashIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        fontFamily: "'DM Sans', sans-serif",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1c2128",
          border: "1px solid #30363d",
          borderRadius: 12,
          width: 360,
          padding: "20px 22px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#e6edf3",
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#8b949e",
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          {message}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "1px solid #30363d",
              borderRadius: 7,
              padding: "7px 16px",
              color: "#c9d1d9",
              fontSize: 13,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: "#f85149",
              border: "none",
              borderRadius: 7,
              padding: "7px 16px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared helper: build the statFilterMap used in refresh loops ──────────────
function buildStatFilterMap(memberId, resolvedListId) {
  const now = new Date();
  const { startOfWeek, endOfWeek } = getWeekBounds(now);
  const fourteenAgo = new Date(now.getTime() - 14 * 86400000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  return {
    assigned: (c) => c.idMembers?.includes(memberId),
    dueThisWeek: (c) =>
      c.due && new Date(c.due) >= startOfWeek && new Date(c.due) < endOfWeek,
    overdue: (c) => c.due && new Date(c.due) < now && !c.dueComplete,
    unassigned: (c) => !c.idMembers || c.idMembers.length === 0,
    withLabel: (c) => c.labels?.length > 0,
    stale: (c) =>
      c.dateLastActivity && new Date(c.dateLastActivity) < fourteenAgo,
    createdToday: (c) =>
      parseInt(c.id.substring(0, 8), 16) * 1000 >= todayStart.getTime(),
    // FIX #2: cardsInList scoped to the list recorded in the meta tag
    cardsInList: (c) => (resolvedListId ? c.idList === resolvedListId : true),
  };
}

// ── Shared tracker-card refresh logic ────────────────────────────────────────
// Used by both CardBackView and the main App refreshTrackerCards function
async function runTrackerRefresh(key, tkn, trelloContext) {
  const board = await trelloContext.board("id");
  const boardId = board.id;

  const allLists = await getBoardLists(key, tkn, boardId);
  const cardlyticsList = allLists.find(
    (l) => l.name.toLowerCase() === "cardlytics",
  );
  if (!cardlyticsList) return;

  const trackerCards = await getListCards(key, tkn, cardlyticsList.id);
  const allBoardCards = await getBoardCards(key, tkn, boardId);
  const memberId = await getMemberId(key, tkn);

  const filteredCards = allBoardCards.filter(
    (c) => !isTrackerCard(c) && c.idList !== cardlyticsList.id,
  );

  for (const card of trackerCards) {
    const statMatch = card.desc?.match(
      /\[_\]: cardlytics:mode:(board|list)(?::listId:([a-f0-9]+))?:statType:(\w+)(?::filters:([^\s]+))?/,
    );
    if (!statMatch) continue;

    const resolvedListId = statMatch[2] || null;
    const statType = statMatch[3];
    const filtersRaw = statMatch[4];

    let cardFilters = null;
    if (filtersRaw) {
      try {
        cardFilters = JSON.parse(decodeURIComponent(filtersRaw));
      } catch (_) {}
    }

    let newCount;
    if (cardFilters) {
      newCount = applyFilters(filteredCards, cardFilters, memberId).length;
    } else {
      const statFilterMap = buildStatFilterMap(memberId, resolvedListId);
      const statFn = statFilterMap[statType];
      newCount =
        statFn && statType !== "cardsInList" && statType !== "all"
          ? filteredCards.filter(statFn).length
          : filteredCards.length;
    }

    const oldCountMatch = card.desc?.match(/(\d+) card\(s\) tracked/);
    const oldCount = oldCountMatch ? parseInt(oldCountMatch[1]) : null;
    if (oldCount === newCount) continue;

    const coverColor = STAT_COVER_COLOR_MAP[statType] || "blue";

    // Load saved style (written at card-creation time)
    let savedStyle = null;
    try {
      const raw = localStorage.getItem(`cardlytics:style:${card.id}`);
      if (raw) savedStyle = JSON.parse(raw);
    } catch (_) {}

    let existingBgDataUrl = null;
    try {
      const local = localStorage.getItem(`cardlytics:customBg:${card.id}`);
      if (local) {
        existingBgDataUrl = local;
      } else {
        existingBgDataUrl = await trelloContext.get(
          "board",
          "shared",
          `customBg:${card.id}`,
        );
      }
    } catch (_) {}

    let avatarInfo = null;
    try {
      const raw = localStorage.getItem(`cardlytics:avatar:${card.id}`);
      if (raw) avatarInfo = JSON.parse(raw);
    } catch (_) {}

    // Delete old attachments
    const attachRes = await fetch(
      `${TRELLO_BASE}/cards/${card.id}/attachments?key=${key}&token=${tkn}`,
    );
    if (attachRes.ok) {
      const attachments = await attachRes.json();
      for (const att of attachments) {
        await fetch(
          `${TRELLO_BASE}/cards/${card.id}/attachments/${att.id}?key=${key}&token=${tkn}`,
          { method: "DELETE" },
        );
      }
    }

    const newCoverDataUrl = savedStyle
      ? await generateStyledCoverImage({
          count: newCount,
          cover: savedStyle.cover || coverColor,
          customHex: savedStyle.customHex || null,
          textColor: savedStyle.textColor || "white",
          customTextHex: savedStyle.customTextHex || null,
          layout: savedStyle.layout || "center",
          title: savedStyle.title || card.name,
          subtitle: savedStyle.subtitle || "",
          coverImage: existingBgDataUrl,
          avatarInitials: avatarInfo?.avatarInitials || null,
          avatarColor: avatarInfo?.avatarColor || null,
        })
      : await generateStatCoverImage(
          newCount,
          coverColor,
          existingBgDataUrl,
          avatarInfo?.avatarInitials || null,
          avatarInfo?.avatarColor || null,
        );

    const blob = dataUrlToBlob(newCoverDataUrl);
    const formData = new FormData();
    formData.append("key", key);
    formData.append("token", tkn);
    formData.append("file", blob, "cover.jpg");
    formData.append("setCover", "false");

    const uploadRes = await fetch(
      `${TRELLO_BASE}/cards/${card.id}/attachments`,
      { method: "POST", body: formData },
    );
    if (!uploadRes.ok) continue;
    const newAttachment = await uploadRes.json();

    const newDesc = card.desc.replace(
      /\d+ card\(s\) tracked/,
      `${newCount} card(s) tracked`,
    );
    await fetch(`${TRELLO_BASE}/cards/${card.id}?key=${key}&token=${tkn}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        desc: newDesc,
        cover: {
          idAttachment: newAttachment.id,
          brightness: "dark",
          size: "full",
        },
      }),
    });
  }
}

// ── Build a short, human-readable summary of a tracker card's active filters ─
// Mirrors the same meta-tag regex used elsewhere (runTrackerRefresh, handleOpenDetails),
// so the card-back view stays in sync with however the card was actually created.
function parseCardFilterSummary(desc, boardMembers = [], boardLabels = [], boardLists = []) {
  if (!desc) return [];
  const statMatch = desc.match(
    /\[_\]: cardlytics:mode:(board|list)(?::listId:([a-f0-9]+))?:statType:(\w+)(?::filters:([^\s]+))?/,
  );
  const filtersRaw = statMatch?.[4];
  if (!filtersRaw) return [];

  let filters;
  try {
    filters = JSON.parse(decodeURIComponent(filtersRaw));
  } catch {
    return [];
  }

  const chips = [];

  if (filters.members?.length) {
    const wantsUnassigned = filters.members.includes("unassigned");
    const namedIds = filters.members.filter((id) => id !== "unassigned");
    const names = namedIds.map(
      (id) => boardMembers.find((m) => m.id === id)?.fullName || id
    );
    const parts = [...(wantsUnassigned ? ["Unassigned"] : []), ...names];
    chips.push({ label: "Assigned To", value: parts.join(", ") });
  }
  if (filters.due?.length) {
    const DUE_LABELS = {
      thisWeek: "This week",
      "1week": "In 1 week",
      "2weeks": "In 2 weeks",
      "1month": "In 1 month",
      overdue: "Overdue",
      nodate: "No due date",
      custom:
        filters.customDateFrom && filters.customDateTo
          ? `${filters.customDateFrom} → ${filters.customDateTo}`
          : filters.customDateFrom
          ? `From ${filters.customDateFrom}`
          : filters.customDateTo
          ? `Until ${filters.customDateTo}`
          : "Custom range",
    };
    const values = filters.due.map((d) => DUE_LABELS[d] || d);
    chips.push({ label: "Due Date", value: values.join(", ") });
  }
  if (filters.labels?.length) {
    const names = filters.labels.map((id) => {
      const lbl = boardLabels.find((l) => l.id === id);
      return lbl ? lbl.name || lbl.color : id;
    });
    chips.push({ label: "Label", value: names.join(", ") });
  }
  if (filters.lists?.length) {
    const names = filters.lists.map(
      (id) => boardLists.find((l) => l.id === id)?.name || id
    );
    chips.push({ label: "List", value: names.join(", ") });
  }
  if (filters.status?.length) {
    const STATUS_LABELS = {
      complete: "Complete",
      incomplete: "Incomplete",
      overdue: "Overdue",
    };
    const values = filters.status.map((s) => STATUS_LABELS[s] || s);
    chips.push({ label: "Status", value: values.join(", ") });
  }
  if (filters.activity?.length) {
    const ACTIVITY_LABELS = {
      "1day":   "Active in last 1 day",
      "3days":  "Active in last 3 days",
      "7days":  "Active in last 7 days",
      "14days": "Active in last 14 days",
      "30days": "Active in last 30 days",
      stale14:  "Stale 14+ days",
      stale30:  "Stale 30+ days",
    };
    const values = filters.activity.map((a) => ACTIVITY_LABELS[a] || a);
    chips.push({ label: "Activity", value: values.join(", ") });
  }
 if (filters.createdDate?.length) {
    const CREATED_LABELS = {
      today:     "Today",
      yesterday: "Yesterday",
      "7days":   "Last 7 days",
      "30days":  "Last 30 days",
    };
    const values = filters.createdDate.map((d) => CREATED_LABELS[d] || d);
    chips.push({ label: "Created", value: values.join(", ") });
  }

  return chips;
}

// ─── CARD BACK VIEW ──────────────────────────────────────────────────────────
function CardBackView() {
  const [isTracker, setIsTracker] = useState(false);
  const [cardDesc, setCardDesc] = useState("");
  const [boardMembers, setBoardMembers] = useState([]);
  const [boardLabels, setBoardLabels] = useState([]);
  const [boardLists, setBoardLists] = useState([]);
  const [boardDataLoaded, setBoardDataLoaded] = useState(false);

  useEffect(() => {
    if (!trelloT) return;
    trelloT.card("name", "idList", "desc").then((card) => {
      setCardDesc(card.desc || "");
      if (isTrackerCard(card)) {
        setIsTracker(true);
        // still need to fetch members/labels/lists for chip resolution
        trelloT.board("id").then((board) => {
          const key = TRELLO_API_KEY;
          const token = getStoredToken();
          Promise.all([
            fetch(`${TRELLO_BASE}/boards/${board.id}/members?key=${key}&token=${token}&fields=id,fullName`).then((r) => r.json()),
            fetch(`${TRELLO_BASE}/boards/${board.id}/labels?key=${key}&token=${token}&fields=id,name,color&limit=200`).then((r) => r.json()),
            fetch(`${TRELLO_BASE}/boards/${board.id}/lists?key=${key}&token=${token}&fields=id,name`).then((r) => r.json()),
          ])
            .then(([members, labels, lists]) => {
              setBoardMembers(members || []);
              setBoardLabels(labels || []);
              setBoardLists(lists || []);
              setBoardDataLoaded(true);
            })
            .catch(() => {});
        });
        return;
      }

      trelloT.board("id").then((board) => {
        const key = TRELLO_API_KEY;
        const token = getStoredToken();
        fetch(
          `${TRELLO_BASE}/boards/${board.id}/lists?key=${key}&token=${token}&fields=id,name`,
        )
          .then((r) => r.json())
          .then((lists) => {
            const cardlyticsListIds = lists
              .filter((l) => l.name.toLowerCase() === "cardlytics")
              .map((l) => l.id);
            setIsTracker(cardlyticsListIds.includes(card.idList));
            Promise.all([
              fetch(`${TRELLO_BASE}/boards/${board.id}/members?key=${key}&token=${token}&fields=id,fullName`).then((r) => r.json()),
              fetch(`${TRELLO_BASE}/boards/${board.id}/labels?key=${key}&token=${token}&fields=id,name,color&limit=200`).then((r) => r.json()),
              fetch(`${TRELLO_BASE}/boards/${board.id}/lists?key=${key}&token=${token}&fields=id,name`).then((r) => r.json()),
            ])
              .then(([members, labels, lists]) => {
                setBoardMembers(members || []);
                setBoardLabels(labels || []);
                setBoardLists(lists || []);
              })
              .catch(() => {});
          })
          .catch(() => setIsTracker(false));
      });
    });
  }, []);

  useEffect(() => {
    const key = TRELLO_API_KEY;
    const tkn = getStoredToken();
    if (!tkn || !trelloT) return;

    // cardsInList handled, dueThisWeek uses calendar week
    runTrackerRefresh(key, tkn, trelloT).catch((err) =>
      console.error("CardBackView cover refresh error:", err),
    );
  }, []);

  function handleOpenDetails() {
    if (!trelloT) return;
    trelloT.card("id", "idList", "name", "desc").then((card) => {
      const statMatch = card.desc?.match(
        /\[_\]: cardlytics:mode:(board|list)(?::listId:([a-f0-9]+))?:statType:(\w+)(?::filters:([^\s]+))?/,
      );

      let statType = "all";
      let cardMode = "board";
      let resolvedListId = card.idList;
      const filtersRaw = statMatch?.[4] ?? null;

      if (statMatch) {
        cardMode = statMatch[1];
        resolvedListId = statMatch[2] || card.idList;
        statType = statMatch[3];
      } else {
        const nameMap = [
          { prefix: "📌 Assigned to Me", type: "assigned" },
          { prefix: "📅 Due This Week", type: "dueThisWeek" },
          { prefix: "⚠️ Overdue Cards", type: "overdue" },
          { prefix: "👤 Unassigned Cards", type: "unassigned" },
          { prefix: "🏷️ Cards With Label", type: "withLabel" },
          { prefix: "💤 Stale Cards", type: "stale" },
          { prefix: "✨ Created Today", type: "createdToday" },
          { prefix: "📋 Cards in List", type: "cardsInList" },
        ];
        statType =
          nameMap.find((m) =>
            card.name.toLowerCase().startsWith(m.prefix.toLowerCase()),
          )?.type || "all";

        const metaMatch = card.desc?.match(
          /\[_\]: cardlytics:mode:(board|list)(?::listId:([a-f0-9]+))?/,
        );
        cardMode = metaMatch ? metaMatch[1] : "board";
        resolvedListId = metaMatch ? metaMatch[2] || card.idList : card.idList;
      }

      trelloT.board("id").then((board) => {
        trelloT.modal({
          title: "Cardlytics",
          url: `./index.html?view=card-details&listId=${resolvedListId}&boardId=${board.id}&statType=${statType}&mode=${cardMode}${filtersRaw ? `&filters=${filtersRaw}` : ""}&cardName=${encodeURIComponent(card.name)}`,
          fullscreen: true,
        });
      });
    });
  }

  function handleStartTracking() {
    if (!trelloT) return;
    trelloT.board("id").then((board) => {
      trelloT.modal({
        title: "Cardlytics",
        url: `./index.html?boardId=${board.id}`,
        fullscreen: false,
        height: 860,
      });
    });
  }

  const filterChips = isTracker && boardDataLoaded ? parseCardFilterSummary(cardDesc, boardMembers, boardLabels, boardLists) : [];

  return (
    <div
      className="cb-root"
      style={{ flexDirection: "column", gap: 8, alignItems: "stretch" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: "#e0e0e0" }}>
          Cardlytics
        </span>
        {isTracker ? (
          <button
            className="cb-btn-primary"
            style={{ width: "auto", padding: "7px 16px", flexShrink: 0 }}
            onClick={handleOpenDetails}
          >
            View Details
          </button>
        ) : (
          <button
            className="cb-btn-primary"
            style={{
              width: "auto",
              padding: "7px 16px",
              flexShrink: 0,
              background: "#0052cc",
            }}
            onClick={handleStartTracking}
          >
            Start Tracking
          </button>
        )}
      </div>

      {filterChips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {filterChips.map((chip, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                color: "#9CA3AF",
                background: "#21262d",
                border: "1px solid #30363d",
                borderRadius: 6,
                padding: "3px 8px",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: "#79c0ff", fontWeight: 600 }}>
                {chip.label}:
              </span>{" "}
              {chip.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CARD DETAILS VIEW ────────────────────────────────────────────────────────
function CardDetailsView() {
  const params = useRef(new URLSearchParams(window.location.search));
  const listId = params.current.get("listId");
  const boardId = params.current.get("boardId");
  const statType = params.current.get("statType") || "all";
  const mode = params.current.get("mode") || "board";

  const [cards, setCards] = useState([]);
  const [listName, setListName] = useState("List");
  const [boardName, setBoardName] = useState("Board");
  const [listMap, setListMap] = useState({});
  const [detailStats, setDetailStats] = useState({
    labelCounts: {},
    dueThisWeek: 0,
    withLabel: 0,
    total: 0,
  });
  const [fullStats, setFullStats] = useState({
    assigned: 0,
    dueThisWeek: 0,
    overdue: 0,
    unassigned: 0,
    withLabel: 0,
    stale: 0,
    createdToday: 0,
    allCards: 0,
  });
  const [memberMap, setMemberMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("table");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [leftTab, setLeftTab] = useState(() =>
    params.current.get("cardName") ? "personalized" : "general",
  );
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [personalizedViews, setPersonalizedViews] = useState(() => {
    // Pre-populate from localStorage so sidebar isn't blank on first render,
    // but these will be pruned/validated inside load()
    if (!boardId) return [];
    try {
      return JSON.parse(
        localStorage.getItem(`cardlytics:personalized:${boardId}`) || "[]",
      ).map((v) => ({ ...v, count: 0 }));
    } catch {
      return [];
    }
  });

  const key = TRELLO_API_KEY;
  const token = getStoredToken();

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Immediately clear stale personalized views so sidebar doesn't show deleted cards
      if (boardId) {
        const existing = JSON.parse(
          localStorage.getItem(`cardlytics:personalized:${boardId}`) || "[]",
        );
        setPersonalizedViews(existing.map((v) => ({ ...v, count: 0 })));
      } else {
        setPersonalizedViews([]);
      }

      try {
        const isListScoped = mode === "list" || statType === "cardsInList";

        const [rawBoardCards, mid, allBoardLists] = await Promise.all([
          boardId ? getBoardCards(key, token, boardId) : Promise.resolve([]),
          getMemberId(key, token),
          getBoardLists(key, token, boardId),
        ]);

        const activeBoardCards = rawBoardCards.filter((c) => !c.closed);

        let allCards;
        if (isListScoped && listId) {
          allCards = await getListCards(key, token, listId);
        } else {
          allCards = activeBoardCards;
        }

        const cardlyticsListIds = allBoardLists
          .filter((l) => l.name.toLowerCase() === "cardlytics")
          .map((l) => l.id);

        allCards = allCards.filter(
          (c) =>
            !isTrackerCardDisplay(c) && !cardlyticsListIds.includes(c.idList),
        );

        const now = new Date();
        const { startOfWeek, endOfWeek } = getWeekBounds(now);
        const fourteenAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const filterMap = {
          assigned: (c) => c.idMembers?.includes(mid),
          dueThisWeek: (c) =>
            c.due &&
            new Date(c.due) >= startOfWeek &&
            new Date(c.due) < endOfWeek,
          overdue: (c) => c.due && new Date(c.due) < now && !c.dueComplete,
          unassigned: (c) => !c.idMembers || c.idMembers.length === 0,
          withLabel: (c) => c.labels?.length > 0,
          stale: (c) =>
            c.dateLastActivity && new Date(c.dateLastActivity) < fourteenAgo,
          createdToday: (c) => cardCreatedDate(c.id) >= todayStart,
          cardsInList: () => true,
          all: () => true,
        };

        const filtersParam = params.current.get("filters");
        let savedFilters = null;
        if (filtersParam) {
          try {
            savedFilters = JSON.parse(decodeURIComponent(filtersParam));
          } catch (_) {}
        }

        const fn = filterMap[statType] || (() => true);
        const filteredCards = allCards
          .filter((c) => !isTrackerCard(c))
          .filter((c) => {
            // If user configured explicit filters, use ONLY those — skip the stat's own filter
            if (savedFilters) {
              return applyFilters([c], savedFilters, mid).length > 0;
            }
            // No saved filters — apply the stat's default filter
            return fn(c);
          });

        setCards(filteredCards);
        setDetailStats(computeDetailStats(filteredCards));

        const computed = computeStats(
          allCards.filter((c) => !isTrackerCard(c)),
          mid,
        );
        computed.cardsInList = isListScoped
          ? allCards.filter((c) => !isTrackerCard(c)).length
          : 0;

        const boardWideCards = activeBoardCards.filter(
          (c) =>
            !isTrackerCardDisplay(c) &&
            !cardlyticsListIds.includes(c.idList) &&
            !isTrackerCard(c),
        );
        computed.allCards = boardWideCards.length;

        setFullStats(computed);

        // Prune personalized views whose underlying tracker card no longer
        // exists on the board, then compute a live count for what's left
        if (!boardId) return;

        const savedViews = JSON.parse(
          localStorage.getItem(`cardlytics:personalized:${boardId}`) || "[]",
        );

        // Fetch only the cards still alive in the Cardlytics list
        const cardlyticsListsOnBoard = allBoardLists.filter(
          (l) => l.name.toLowerCase() === "cardlytics",
        );
        const cardlyticsCardArrays = await Promise.all(
          cardlyticsListsOnBoard.map((l) => getListCards(key, token, l.id)),
        );
        const liveTrackerCardIds = new Set(
          cardlyticsCardArrays.flat().map((c) => c.id),
        );

        // A view is valid only if its tracker card still exists in the Cardlytics list
        const stillValidViews = savedViews.filter(
          (view) => !view.cardId || liveTrackerCardIds.has(view.cardId),
        );

        if (stillValidViews.length !== savedViews.length) {
          localStorage.setItem(
            `cardlytics:personalized:${boardId}`,
            JSON.stringify(stillValidViews),
          );
        }

        const viewsWithCounts = stillValidViews.map((view) => {
          const scopedCards =
            view.mode === "list" && view.listId
              ? boardWideCards.filter((c) => c.idList === view.listId)
              : boardWideCards;

          const f = view.filters || {};
          const hasFilters =
            f.due?.length > 0 ||
            f.members?.length > 0 ||
            f.labels?.length > 0 ||
            f.lists?.length > 0 ||
            f.status?.length > 0 ||
            f.activity?.length > 0 ||
            f.createdDate?.length > 0 ||
            !!f.customDateFrom ||
            !!f.customDateTo;

          let count;
          if (hasFilters) {
            count = applyFilters(scopedCards, f, mid).length;
          } else {
            const statFilterMap = buildStatFilterMap(mid, view.listId || null);
            const statFn = statFilterMap[view.statType];
            count =
              statFn &&
              view.statType !== "cardsInList" &&
              view.statType !== "all"
                ? scopedCards.filter(statFn).length
                : scopedCards.length;
          }

          return { ...view, count };
        });
        setPersonalizedViews(viewsWithCounts);

        if (listId) {
          const listRes = await fetch(
            `${TRELLO_BASE}/lists/${listId}?key=${key}&token=${token}&fields=name,idBoard`,
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            setListName(listData.name);
            const resolvedBoardId = boardId || listData.idBoard;
            const boardRes = await fetch(
              `${TRELLO_BASE}/boards/${resolvedBoardId}?key=${key}&token=${token}&fields=name`,
            );
            if (boardRes.ok) setBoardName((await boardRes.json()).name);
          }
        } else if (boardId) {
          const boardRes = await fetch(
            `${TRELLO_BASE}/boards/${boardId}?key=${key}&token=${token}&fields=name`,
          );
          if (boardRes.ok) setBoardName((await boardRes.json()).name);
        }

        const lmap = {};
        allBoardLists.forEach((l) => (lmap[l.id] = l.name));
        setListMap(lmap);

        const allMemberIds = [
          ...new Set(filteredCards.flatMap((c) => c.idMembers || [])),
        ];
        const details = {};
        await Promise.all(
          allMemberIds.map(async (id) => {
            const m = await getMemberDetails(key, token, id);
            if (m) details[id] = m;
          }),
        );
        setMemberMap(details);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [listId, boardId, statType]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = cards
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let va, vb;
      if (sortCol === "name") {
        va = a.name;
        vb = b.name;
      } else if (sortCol === "due") {
        va = a.due || "";
        vb = b.due || "";
      } else if (sortCol === "created") {
        va = cardCreatedDate(a.id).getTime();
        vb = cardCreatedDate(b.id).getTime();
      } else if (sortCol === "modified") {
        va = a.dateLastActivity || "";
        vb = b.dateLastActivity || "";
      } else {
        va = "";
        vb = "";
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

  async function handleExport(format) {
    const rows = filtered;

    if (format === "csv") {
      const headers = [
        "Name",
        "Assigned",
        "Board",
        "Done",
        "Created",
        "Due",
        "Last Modified",
        "List",
      ];
      const csvRows = [
        headers.join(","),
        ...rows.map((c) =>
          [
            `"${c.name.replace(/"/g, '""')}"`,
            `"${(c.idMembers || []).map((mid) => memberMap[mid]?.fullName || mid).join("; ")}"`,
            `"${boardName}"`,
            c.dueComplete ? "Yes" : "No",
            formatDate(cardCreatedDate(c.id).toISOString()),
            c.due ? formatDate(c.due) : "",
            formatDate(c.dateLastActivity),
            `"${listMap[c.idList] || listName}"`,
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvRows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cardlytics-${statType}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "json") {
      const data = rows.map((c) => ({
        id: c.id,
        name: c.name,
        assigned: (c.idMembers || []).map(
          (mid) => memberMap[mid]?.fullName || mid,
        ),
        board: boardName,
        list: listMap[c.idList] || listName,
        done: c.dueComplete || false,
        created: cardCreatedDate(c.id).toISOString(),
        due: c.due || null,
        lastModified: c.dateLastActivity || null,
        labels: (c.labels || []).map((l) => ({ name: l.name, color: l.color })),
      }));

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cardlytics-${statType}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "pdf") {
      document.getElementById("export-menu").style.display = "none";

      const target = document.querySelector(".cd-right");
      if (!target) return;

      const canvas = await html2canvas(target, {
        backgroundColor: "#111111",
        scale: 2,
        useCORS: true,
        scrollY: -window.scrollY,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width / 2, canvas.height / 2],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`cardlytics-${statType}-${Date.now()}.pdf`);
    }
  }

  function comingSoon(label = "") {
    const msg = label
      ? `${label} — coming soon! Stay tuned 🚧`
      : "Coming soon! Stay tuned 🚧";
    const existing = document.getElementById("cs-toast");
    if (existing) existing.remove();
    const el = document.createElement("div");
    el.id = "cs-toast";
    el.style.cssText = `
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%);
    background: #1e1e1e; border: 1px solid #333; color: #ccc;
    padding: 9px 18px; border-radius: 8px; font-size: 12px;
    font-family: 'DM Sans', sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5); z-index: 9999;
    display: flex; align-items: center; gap: 8px;
    animation: fadeInUp 0.2s ease; white-space: nowrap;
  `;
    el.innerHTML = `<span>🚧</span><span>${msg}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function handleSort(col) {
    if (sortCol === col) setSortAsc((s) => !s);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
  }

  async function toggleDone(cardId, currentDone) {
    const key = TRELLO_API_KEY;
    const tkn = getStoredToken();
    const newValue = !currentDone;

    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, dueComplete: newValue } : c)),
    );

    try {
      await fetch(`${TRELLO_BASE}/cards/${cardId}?key=${key}&token=${tkn}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueComplete: newValue }),
      });
      if (trelloT) {
        runTrackerRefresh(key, tkn, trelloT).catch((err) =>
          console.error(
            "Immediate tracker refresh after toggleDone failed:",
            err,
          ),
        );
      }
    } catch (err) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, dueComplete: currentDone } : c,
        ),
      );
      console.error("Failed to update dueComplete:", err);
    }
  }

  function handleDeletePersonalizedView(view, e) {
    e.stopPropagation(); // don't trigger the card's own onClick (opening it)
    setDeleteTarget(view);
  }

  async function confirmDeletePersonalizedView() {
    const view = deleteTarget;
    if (!view) return;
    setDeleteTarget(null);

    if (view.cardId) {
      try {
        await fetch(
          `${TRELLO_BASE}/cards/${view.cardId}?key=${key}&token=${token}`,
          { method: "DELETE" },
        );
      } catch (err) {
        console.error("Failed to delete tracker card:", err);
      }
    }

    setPersonalizedViews((prev) => prev.filter((v) => v.id !== view.id));

    if (boardId) {
      const saved = JSON.parse(
        localStorage.getItem(`cardlytics:personalized:${boardId}`) || "[]",
      );
      localStorage.setItem(
        `cardlytics:personalized:${boardId}`,
        JSON.stringify(saved.filter((v) => v.id !== view.id)),
      );
    }
  }

  function SortArrow({ col }) {
    if (sortCol !== col)
      return <span style={{ color: "#444", marginLeft: 3 }}>↕</span>;
    return (
      <span style={{ color: "#4ea1ff", marginLeft: 3 }}>
        {sortAsc ? "↑" : "↓"}
      </span>
    );
  }

  function DueChip({ due, dueComplete }) {
    if (!due) return <span style={{ color: "#555" }}>—</span>;
    const now = new Date();
    const d = new Date(due);
    const cls = dueComplete ? "done" : d < now ? "overdue" : "upcoming";
    return <span className={`cb-due ${cls}`}>{formatDate(due)}</span>;
  }

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', sans-serif",
          gap: 10,
          color: "#666",
          fontSize: 13,
        }}
      >
        <div className="cb-spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  const isListScoped = mode === "list" || statType === "cardsInList";
  const leftStats = [
    {
      value: fullStats.allCards,
      label: "All cards",
      accent: "#4ea1ff",
      statType: "all",
    },
    {
      value: detailStats.total,
      label: "In this view",
      accent: "#4caf50",
      statType: null,
    },
    {
      value: fullStats.assigned,
      label: "Assigned to me",
      accent: "#4ea1ff",
      statType: "assigned",
    },
    {
      value: fullStats.dueThisWeek,
      label: "Due this week",
      accent: "#f9c74f",
      statType: "dueThisWeek",
    },
    {
      value: fullStats.overdue,
      label: "Overdue cards",
      accent: "#ff5252",
      statType: "overdue",
    },
    {
      value: fullStats.unassigned,
      label: "Unassigned cards",
      accent: "#ab47bc",
      statType: "unassigned",
    },
    {
      value: fullStats.withLabel,
      label: "Cards with a label",
      accent: "#ff9800",
      statType: "withLabel",
    },
    {
      value: fullStats.stale,
      label: "Stale (14+ days inactive)",
      accent: "#888",
      statType: "stale",
    },
    {
      value: fullStats.createdToday,
      label: "Created today",
      accent: "#2ec4b6",
      statType: "createdToday",
    },
  ];

  return (
    <div className="cd-root">
      <div className="cd-left">
        <div className="cd-left-tabs">
          <button
            className={`cd-left-tab ${leftTab === "general" ? "active" : ""}`}
            onClick={() => setLeftTab("general")}
          >
            General
          </button>
          <button
            className={`cd-left-tab ${leftTab === "personalized" ? "active" : ""}`}
            onClick={() => setLeftTab("personalized")}
          >
            Personalized
          </button>
        </div>

        <div className="cd-list-label">
          {isListScoped ? listName : boardName}
        </div>

        {leftTab === "general" &&
          leftStats.map((s, i) => (
            <div
              key={i}
              className="cd-stat-card"
              style={{
                borderLeft: `3px solid ${s.accent}`,
                cursor: s.statType ? "pointer" : "default",
                opacity: statType === s.statType ? 1 : 0.85,
                background: statType === s.statType ? "#1e1e1e" : "transparent",
              }}
              onClick={() => {
                if (!s.statType || !trelloT) return;
                trelloT.board("id").then((board) => {
                  trelloT.modal({
                    title: `Cardlytics — ${s.label}`,
                    url: `./index.html?view=card-details&boardId=${board.id}&statType=${s.statType}&mode=board`,
                    fullscreen: true,
                  });
                });
              }}
            >
              <div
                className="cd-stat-num"
                style={{ color: s.value > 0 ? s.accent : "#666" }}
              >
                {s.value}
              </div>
              <div className="cd-stat-lbl">{s.label}</div>
            </div>
          ))}

        {leftTab === "general" && (
          <div
            className="add-filter-card"
            style={{ marginTop: 4 }}
            onClick={() => comingSoon("Add filter")}
          >
            + Add filter
          </div>
        )}

        {leftTab === "personalized" && (
          <>
            {personalizedViews.length === 0 ? (
              <div className="cd-personalized-empty">
                <div className="cd-personalized-icon">👤</div>
                <div className="cd-personalized-title">Your custom views</div>
                <div className="cd-personalized-desc">
                  Customize a stat card to save views here.
                </div>
              </div>
            ) : (
              personalizedViews.map((view) => (
                <div
                  key={view.id}
                  className="cd-stat-card"
                  style={{
                    borderLeft: `3px solid ${COVER_BG_COLORS[view.cover] || "#4ea1ff"}`,
                    cursor: "pointer",
                    opacity: statType === view.statType ? 1 : 0.85,
                    background:
                      statType === view.statType ? "#1e1e1e" : "transparent",
                    position: "relative",
                  }}
                  onClick={() => {
                    if (!trelloT) return;
                    trelloT.board("id").then((board) => {
                      const filtersStr = encodeURIComponent(
                        JSON.stringify(view.filters),
                      );
                      trelloT.modal({
                        title: `Cardlytics — ${view.cardName}`,
                        url: `./index.html?view=card-details&boardId=${board.id}&statType=${view.statType}&mode=${view.mode}${view.listId ? `&listId=${view.listId}` : ""}&filters=${filtersStr}&cardName=${encodeURIComponent(view.cardName)}`,
                        fullscreen: true,
                      });
                    });
                  }}
                >
                  <button
                    onClick={(e) => handleDeletePersonalizedView(view, e)}
                    title="Remove this view"
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      background: "transparent",
                      border: "none",
                      color: "#666",
                      cursor: "pointer",
                      padding: 5,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 0.15s ease, color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255, 82, 82, 0.12)";
                      e.currentTarget.style.color = "#ff5252";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#666";
                    }}
                  >
                    <TrashIcon size={13} />
                  </button>
                  <div
                    className="cd-stat-num"
                    style={{
                      color:
                        view.count > 0
                          ? COVER_BG_COLORS[view.cover] || "#4ea1ff"
                          : "#666",
                    }}
                  >
                    {view.count ?? 0}
                  </div>
                  <div className="cd-stat-lbl">{view.cardName}</div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      <div className="cd-right">
        <div className="cd-banner">
          <div className="cd-banner-count">{detailStats.total}</div>
          <div>
            <div className="cd-banner-title">
              {params.current.get("cardName")
                ? decodeURIComponent(params.current.get("cardName"))
                : STAT_LABELS[statType] || "Cards"}
            </div>
            <div className="cd-banner-sub">
              {isListScoped ? `In list: ${listName}` : `Board: ${boardName}`}
            </div>
          </div>
        </div>

        <div className="cd-tabs">
          {["table", "metrics", "history", "alerts"].map((tab) => (
            <div
              key={tab}
              className={`cd-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "table" && (
                <span className="cd-tab-count">{detailStats.total}</span>
              )}
            </div>
          ))}
        </div>

        <div className="cd-toolbar">
          <span className="cd-toolbar-label">Active filters</span>
          <div className="cd-filter-pill">
            <span className="pill-key">Board</span>
            <span className="pill-sep">is</span>
            <span className="pill-val blue">{boardName}</span>
          </div>
          {isListScoped && (
            <div className="cd-filter-pill">
              <span className="pill-key">List</span>
              <span className="pill-sep">is</span>
              <span className="pill-val teal">{listName}</span>
            </div>
          )}
          <div className="cd-toolbar-actions">
            <button
              className="cd-action-btn"
              onClick={() => comingSoon("Edit filters")}
            >
              ✏ Edit filters
            </button>
            <button
              className="cd-action-btn"
              onClick={() => comingSoon("Clone")}
            >
              ⊡ Clone
            </button>
          </div>
        </div>

        <div
          className="cd-toolbar"
          style={{ borderTop: "none", paddingTop: 6 }}
        >
          <div className="cd-search">
            <span style={{ color: "#555", fontSize: 13 }}>🔍</span>
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="cd-search-input"
            />
          </div>
          <button
            className="cd-action-btn"
            onClick={() => comingSoon("Columns")}
          >
            Columns
          </button>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              className="cd-action-btn"
              onClick={() => {
                const menu = document.getElementById("export-menu");
                menu.style.display =
                  menu.style.display === "block" ? "none" : "block";
              }}
            >
              Export ▾
            </button>
            <div
              id="export-menu"
              style={{
                display: "none",
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                background: "#1e1e1e",
                border: "1px solid #333",
                borderRadius: 6,
                zIndex: 100,
                minWidth: 120,
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              {["csv", "json", "pdf"].map((fmt) => (
                <div
                  key={fmt}
                  onClick={() => {
                    handleExport(fmt);
                    document.getElementById("export-menu").style.display =
                      "none";
                  }}
                  style={{
                    padding: "8px 14px",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "#ccc",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#2a2a2a")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {fmt.toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cd-created-by">
          <div className="cd-mini-avatar" style={{ background: "#e85d2e" }}>
            SR
          </div>
          <span>Created by</span>
          <span className="cd-created-name">Cardlytics</span>
        </div>

        {activeTab === "table" && (
          <div className="cd-table-wrap">
            <table className="cd-table">
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: "center" }}>Status</th>
                  <th onClick={() => handleSort("name")}>
                    Name <SortArrow col="name" />
                  </th>
                  <th>Assigned</th>
                  <th>Board</th>
                  <th onClick={() => handleSort("created")}>
                    Created <SortArrow col="created" />
                  </th>
                  <th onClick={() => handleSort("due")}>
                    Due <SortArrow col="due" />
                  </th>
                  <th onClick={() => handleSort("modified")}>
                    Last Modified <SortArrow col="modified" />
                  </th>
                  <th>List</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: "center",
                        color: "#555",
                        padding: "20px",
                      }}
                    >
                      No cards found
                    </td>
                  </tr>
                )}
                {filtered.map((card) => (
                  <tr key={card.id}>
                    <td style={{ textAlign: "center" }}>
                      <span
                        onClick={() => toggleDone(card.id, card.dueComplete)}
                        style={{
                          width: 16,
                          height: 16,
                          border: `1px solid ${card.dueComplete ? "#4caf50" : "#444"}`,
                          borderRadius: 3,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: card.dueComplete
                            ? "#0a3d0a"
                            : "transparent",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {card.dueComplete && (
                          <span style={{ color: "#4caf50", fontSize: 10 }}>
                            ✓
                          </span>
                        )}
                      </span>
                    </td>

                    <td className="td-name">
                      {card.labels?.length > 0 && (
                        <span
                          style={{
                            display: "inline-flex",
                            gap: 3,
                            marginRight: 6,
                          }}
                        >
                          {card.labels.map((lbl, i) => (
                            <span
                              key={i}
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: LABEL_COLORS[lbl.color] || "#888",
                                display: "inline-block",
                                verticalAlign: "middle",
                              }}
                            />
                          ))}
                        </span>
                      )}
                      {card.name}
                    </td>

                    <td>
                      {card.idMembers?.length > 0 ? (
                        <div style={{ display: "flex", gap: 3 }}>
                          {card.idMembers.map((mid) => {
                            const m = memberMap[mid];
                            return (
                              <div
                                key={mid}
                                className="cd-mini-avatar"
                                style={{ background: memberColor(mid) }}
                              >
                                {m?.initials || mid.slice(0, 2).toUpperCase()}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ color: "#555" }}>—</span>
                      )}
                    </td>

                    <td className="td-board">● {boardName}</td>

                    <td className="td-date">
                      {formatDate(cardCreatedDate(card.id).toISOString())}
                    </td>

                    <td>
                      <DueChip due={card.due} dueComplete={card.dueComplete} />
                    </td>

                    <td className="td-date">
                      {formatDate(card.dateLastActivity)}
                    </td>

                    <td>
                      <span className="td-list-tag">
                        {listMap[card.idList] || listName}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab !== "table" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#555",
              fontSize: 13,
            }}
          >
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} — coming
            soon
          </div>
        )}

        <div className="cd-bottom-nav">
          <button className="cd-nav-btn" onClick={() => comingSoon("Inbox")}>
            📥 Inbox
          </button>
          <button className="cd-nav-btn" onClick={() => comingSoon("Planner")}>
            📅 Planner
          </button>
          <button className="cd-nav-btn active">⊞ Board</button>
          <button
            className="cd-nav-btn switch"
            onClick={() => comingSoon("Switch boards")}
          >
            ⇄ Switch boards
          </button>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Remove this view?"
          message={
            deleteTarget.cardId
              ? `Remove "${deleteTarget.cardName}"? This will also delete its tracker card from the board.`
              : `Remove "${deleteTarget.cardName}" from your personalized views?`
          }
          onConfirm={confirmDeletePersonalizedView}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const view = params.get("view");
  const listId = params.get("listId");

  const [token, setToken] = useState(() => getStoredToken());
  const [stats, setStats] = useState({
    assigned: 0,
    dueThisWeek: 0,
    overdue: 0,
    unassigned: 0,
    withLabel: 0,
    stale: 0,
    createdToday: 0,
    cardsInList: 0,
  });
  const [selectedStats, setSelectedStats] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(
    new Date().toLocaleTimeString(),
  );
  const [lists, setLists] = useState([]);
  const [trackingListName, setTrackingListName] = useState("");
  const [toast, setToast] = useState(null);
  const [memberFullName, setMemberFullName] = useState("");
  const [boardMembers, setBoardMembers] = useState([]);
  const [showCustomize, setShowCustomize] = useState(false);
  const [customizeBlankStart, setCustomizeBlankStart] = useState(false);
  const [scopeListId, setScopeListId] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const m = p.get("mode");
    const l = p.get("listId");
    return m === "list" && l ? l : "board";
  });
  const [customizeStat, setCustomizeStat] = useState(null);
  const [cardConfig, setCardConfig] = useState({});
  const [isTracking, setIsTracking] = useState(false);
  const [boardCards, setBoardCards] = useState([]);
  const [allBoardCards, setAllBoardCards] = useState([]);
  const [currentMemberId, setCurrentMemberId] = useState(null);
  const [boardLabels, setBoardLabels] = useState([]);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [currentBoardName, setCurrentBoardName] = useState("");
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  const [currentWorkspaceName, setCurrentWorkspaceName] = useState("");

  const scopeListIdRef = useRef(
    (() => {
      const p = new URLSearchParams(window.location.search);
      const m = p.get("mode");
      const l = p.get("listId");
      return m === "list" && l ? l : "board";
    })(),
  );
  useEffect(() => {
    scopeListIdRef.current = scopeListId;
  }, [scopeListId]);

  // ── 1. refreshTrackerCards ────────────────────────────────────────────────
  async function refreshTrackerCards() {
    const key = TRELLO_API_KEY;
    const tkn = getStoredToken();
    if (!tkn || !trelloT) return;
    try {
      await runTrackerRefresh(key, tkn, trelloT);
    } catch (err) {
      console.error("refreshTrackerCards error:", err);
    }
  }

  async function fetchAllWorkspaces() {
    if (_workspacesCache) return _workspacesCache;
    const key = TRELLO_API_KEY;
    const tkn = getStoredToken();
    const res = await fetch(
      `${TRELLO_BASE}/members/me/organizations?key=${key}&token=${tkn}&fields=id,displayName`,
    );
    const data = res.ok ? await res.json() : [];
    _workspacesCache = data;
    return data;
  }

  // ── 2. fetchData ──────────────────────────────────────────────────────────
  async function fetchData(overrideScope) {
    try {
      const key = TRELLO_API_KEY;
      const tkn = getStoredToken();
      if (!tkn) return;

      const boardId = trelloT
        ? (await trelloT.board("id")).id
        : new URLSearchParams(window.location.search).get("boardId");
      if (!boardId) return;
      setCurrentBoardId(boardId);

      // FIX #9: use ref so interval calls always get the current scope
      const resolvedScope = overrideScope ?? scopeListIdRef.current;
      const activeScope = resolvedScope !== "board" ? resolvedScope : null;

      // Fetch full board cards once — reused for both stats scope and customize preview
      const fullBoardCards = await getBoardCards(key, tkn, boardId);

      const cards =
        mode === "list" && listId
          ? await getListCards(key, tkn, listId)
          : activeScope
            ? await getListCards(key, tkn, activeScope)
            : fullBoardCards; // ✅ reuse instead of fetching again

      const allLists = await getBoardLists(key, tkn, boardId);
      const cardlyticsListIds = allLists
        .filter((l) => l.name.toLowerCase() === "cardlytics")
        .map((l) => l.id);

      const filteredForStats = cards.filter(
        (c) => !isTrackerCard(c) && !cardlyticsListIds.includes(c.idList),
      );
      const memberId = await getMemberId(key, tkn);
      setCurrentMemberId(memberId);

      // Full board cards for customize preview — already fetched above, no extra call
      const fullFiltered = fullBoardCards.filter(
        (c) => !isTrackerCard(c) && !cardlyticsListIds.includes(c.idList),
      );
      setAllBoardCards(fullFiltered);

      if (trelloT) {
        trelloT
          .set("member", "private", "cardlyticsConnected", true)
          .catch(() => {});
      }

      if (memberId) {
        const memberDetails = await getMemberDetails(key, tkn, memberId);
        setMemberFullName(memberDetails?.fullName || "");
        const membersRes = await fetch(
          `${TRELLO_BASE}/boards/${boardId}/members?key=${key}&token=${tkn}&fields=id,fullName,initials`,
        );
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setBoardMembers(membersData);
        }
      }
      const boardInfo = await getBoard(key, tkn, boardId);
      setCurrentBoardName(boardInfo?.name || "");

      const orgId = boardInfo?.idOrganization || null;
      setCurrentWorkspaceId(orgId);
      if (orgId) {
        const orgRes = await fetch(
          `${TRELLO_BASE}/organizations/${orgId}?key=${key}&token=${tkn}&fields=displayName`,
        );
        if (orgRes.ok)
          setCurrentWorkspaceName((await orgRes.json()).displayName);
      } else {
        setCurrentWorkspaceName("My Workspace");
      }

      const labels = await getBoardLabels(key, tkn, boardId);
      const usedLabelIds = new Set(
        fullBoardCards.flatMap((c) => (c.labels || []).map((l) => l.id)),
      );
      setBoardLabels(labels.filter((l) => usedLabelIds.has(l.id)));

      const computed = computeStats(filteredForStats, memberId);
      computed.cardsInList = mode === "list" ? filteredForStats.length : 0;
      setBoardCards(filteredForStats);
      setStats(computed);
      setLastUpdated(new Date().toLocaleTimeString());

      setLists(allLists);

      if (mode === "list" && listId) {
        const listRes = await fetch(
          `${TRELLO_BASE}/lists/${listId}?key=${key}&token=${tkn}&fields=name`,
        );
        if (listRes.ok) setTrackingListName((await listRes.json()).name);
      } else {
        const existing = allLists.find(
          (l) => l.name.toLowerCase() === "cardlytics",
        );
        setTrackingListName(existing?.name || allLists[0]?.name || "");
      }

      await refreshTrackerCards();
    } catch (err) {
      console.error(err);
    }
  }

  // ── 3. useEffect — Trello render lifecycle + polling ──────────────────────
  useEffect(() => {
    if (!token) return;

    if (trelloT) {
      trelloT.render(() => {
        fetchData();
      });
    }

    fetchData();

    const intervalId = setInterval(() => {
      fetchData();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [token]);
  if (!token)
    return (
      <LoginScreen
        onAuth={async (t) => {
          storeToken(t);
          setToken(t);
          if (trelloT) await trelloT.set("member", "private", "token", t);
        }}
      />
    );
  if (view === "card") return <CardBackView />;
  if (view === "card-details") return <CardDetailsView />;

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const handleStatClick = (type) =>
    setSelectedStats((prev) =>
      prev.includes(type) ? prev.filter((i) => i !== type) : [...prev, type],
    );

  const handleTrack = async (statsOverride, configOverride) => {
    const statsToTrack = statsOverride ?? selectedStats;
    const configToUse = configOverride ?? cardConfig;

    if (statsToTrack.length === 0) {
      showToast("Please select at least one stat to track", "error");
      return;
    }

    setIsTracking(true);
    if (trelloT) {
      trelloT
        .set("member", "private", "cardlyticsTrackingInProgress", true)
        .catch(() => {});
    }

    try {
      const key = TRELLO_API_KEY;
      const tkn = getStoredToken();
      if (!tkn) {
        showToast("Not authorized", "error");
        return;
      }
      if (!trelloT) return;

      const board = await trelloT.board("id");
      const boardId = board.id;

      let targetListId;
      if (mode === "list" && listId) {
        targetListId = listId;
      } else {
        const boardLists = await getBoardLists(key, tkn, boardId);
        let cardlyticsList = boardLists.find((l) => l.name === "Cardlytics");
        if (!cardlyticsList) {
          cardlyticsList = await createList(key, tkn, boardId, "Cardlytics");
        }
        targetListId = cardlyticsList.id;
        setTrackingListName("Cardlytics");
      }
      if (!targetListId) {
        showToast("List not found", "error");
        return;
      }

      const createdCards = await Promise.all(
        statsToTrack.map(async (stat) => {
          const defaults = DEFAULT_STAT_CONFIG[stat];
          const saved = configToUse[stat];

          const filterConfig = saved
            ? {
                due: saved.due || [],
                members: saved.members || [],
                labels: saved.labels || [],
                lists: saved.lists || [],
                status: saved.status || [],
                activity: saved.activity || [],
                createdDate: saved.createdDate || [],
                customDateFrom: saved.customDateFrom || "",
                customDateTo: saved.customDateTo || "",
              }
            : null;

          // Resolve which members should be assigned to the tracker card itself.
          // If the user filtered by specific people, mirror that on the card.
          // Otherwise default to the current member (so "my" trackers show your avatar).
          const cardMemberIds = (() => {
            const filterMembers = (filterConfig?.members || []).filter(
              (id) => id !== "unassigned",
            );
            if (filterMembers.length > 0) return filterMembers;
            return currentMemberId ? [currentMemberId] : [];
          })();

          const avatarMemberId = cardMemberIds[0] || null;
          const avatarInitials = avatarMemberId
            ? boardMembers.find((m) => m.id === avatarMemberId)?.initials || null
            : null;
          const avatarColor = avatarMemberId ? memberColor(avatarMemberId) : null;

          const count = (() => {
            const hasExplicitFilters =
              filterConfig &&
              (filterConfig.due.length > 0 ||
                filterConfig.members.length > 0 ||
                filterConfig.labels.length > 0 ||
                filterConfig.lists.length > 0 ||
                filterConfig.status?.length > 0 ||
                filterConfig.activity?.length > 0 ||
                filterConfig.createdDate?.length > 0 ||
                filterConfig.customDateFrom !== "" ||
                filterConfig.customDateTo !== "");

            if (hasExplicitFilters) {
              // User configured filters — apply ONLY those
              return applyFilters(allBoardCards, filterConfig, currentMemberId)
                .length;
            }

            // No filters — apply stat's own base filter
            const statFn = buildStatFilterMap(currentMemberId, null)[stat];
            if (!statFn || stat === "cardsInList" || stat === "all") {
              return allBoardCards.length;
            }
            return allBoardCards.filter(statFn).length;
          })();

          // FIX #7: also include filterStr when only customDate range is set
          const hasActiveFilters =
            filterConfig &&
            (filterConfig.due.length > 0 ||
              filterConfig.members.length > 0 ||
              filterConfig.labels.length > 0 ||
              filterConfig.lists.length > 0 ||
              filterConfig.status?.length > 0 ||
              filterConfig.activity?.length > 0 ||
              filterConfig.createdDate?.length > 0 ||
              filterConfig.customDateFrom !== "" ||
              filterConfig.customDateTo !== "");

          const filterStr = hasActiveFilters
            ? `:filters:${encodeURIComponent(JSON.stringify(filterConfig))}`
            : "";

          const metaTag =
            mode === "list" && listId
              ? `\n\n[_]: cardlytics:mode:list:listId:${listId}:statType:${stat}${filterStr}`
              : `\n\n[_]: cardlytics:mode:board:statType:${stat}${filterStr}`;

          const coverTitle = saved?.cardName || defaults.label;

          // Customized cards (styled image) → use a minimal emoji-only Trello
          // name, since the descriptive text is already baked into the cover
          // image. Plain "Track" cards have no image overlay, so they keep
          // the full native name (e.g. "📌 Assigned to Me") as before.
          const trelloCardName = saved ? defaults.name : defaults.label;

          const desc = `${count} card(s) tracked by Cardlytics.${metaTag}`;
          const cover = saved?.cover || defaults.cover;

          const coverImageDataUrl = saved
            ? await generateStyledCoverImage({
                count,
                cover: saved?.cover || defaults.cover,
                customHex: saved?.customHex || null,
                textColor: saved?.textColor || "white",
                customTextHex: saved?.customTextHex || null,
                layout: saved?.layout || "center",
                title: coverTitle,
                subtitle: saved?.subtitle || "",
                coverImage: saved?.coverImage || null,
                avatarInitials,
                avatarColor,
              })
            : // Plain (non-customized) cards: just the number on a plain color
              // background — no title/subtitle baked in, since the card keeps
              // its native Trello name for that.
              await generateStatCoverImage(count, cover, null, avatarInitials, avatarColor);

          const newCard = await createCard(
            key,
            tkn,
            targetListId,
            trelloCardName,
            desc,
            cover,
            coverImageDataUrl,
            [], // no real Trello member assignment — avatar is baked into the cover image instead
          );

          if (saved?.coverImage && trelloT) {
            try {
              localStorage.setItem(
                `cardlytics:customBg:${newCard.id}`,
                saved.coverImage,
              );

              const stylePayload = {
                cover: saved.cover || defaults.cover,
                customHex: saved.customHex || null,
                textColor: saved.textColor || "white",
                customTextHex: saved.customTextHex || null,
                layout: saved.layout || "center",
                title: saved.cardName || defaults.label,
                subtitle: saved.subtitle || "",
              };
              localStorage.setItem(
                `cardlytics:style:${newCard.id}`,
                JSON.stringify(stylePayload),
              );

              const tiny = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = 60;
                  canvas.height = 24;
                  canvas.getContext("2d").drawImage(img, 0, 0, 60, 24);
                  resolve(canvas.toDataURL("image/jpeg", 0.5));
                };
                img.src = saved.coverImage;
              });
              await trelloT.set(
                "board",
                "shared",
                `customBg:${newCard.id}`,
                tiny,
              );
            } catch (err) {
              console.error("❌ customBg save failed", err);
            }
          }

          if (avatarInitials) {
            localStorage.setItem(
              `cardlytics:avatar:${newCard.id}`,
              JSON.stringify({ avatarInitials, avatarColor }),
            );
          }

          return { stat, cardId: newCard.id };
        }),
      );

      showToast(
        `${statsToTrack.length} card(s) added to "${trackingListName}" ✅`,
      );

      const boardPersonalized = JSON.parse(
        localStorage.getItem(`cardlytics:personalized:${boardId}`) || "[]",
      );
      const newViews = statsToTrack.map((stat) => {
        const saved = configToUse[stat];
        const defaults = DEFAULT_STAT_CONFIG[stat];
        return {
          id: `${stat}-${Date.now()}`,
          cardId: createdCards.find((c) => c.stat === stat)?.cardId || null,
          statType: stat,
          cardName: saved?.cardName || defaults.label,
          cover: saved?.cover || defaults.cover,
          filters: {
            due: saved?.due || [],
            members: saved?.members || [],
            labels: saved?.labels || [],
            lists: saved?.lists || [],
            status: saved?.status || [],
            activity: saved?.activity || [],
            createdDate: saved?.createdDate || [],
            customDateFrom: saved?.customDateFrom || "",
            customDateTo: saved?.customDateTo || "",
          },
          createdAt: new Date().toISOString(),
          boardId,
          mode: mode === "list" && listId ? "list" : "board",
          listId: mode === "list" ? listId : null,
        };
      });
      localStorage.setItem(
        `cardlytics:personalized:${boardId}`,
        JSON.stringify([...boardPersonalized, ...newViews]),
      );

      setSelectedStats([]);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (trelloT) trelloT.closeModal();
    } catch (err) {
      console.error("Trello API Error:", err);
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setIsTracking(false);
      if (trelloT) {
        trelloT
          .set("member", "private", "cardlyticsTrackingInProgress", false)
          .catch(() => {});
      }
    }
  };

  return (
    <div className="popup">
      <Toast toast={toast} />

      <CustomizeFlow
        show={showCustomize}
        lists={lists}
        stats={stats}
        memberName={memberFullName}
        members={boardMembers}
        boardLabels={boardLabels}
        customizeStat={customizeStat}
        setCustomizeStat={setCustomizeStat}
        currentUserId={currentMemberId}
        blankStart={customizeBlankStart}
        onSave={async (type, cfg) => {
          const newConfig = { ...cardConfig, [type]: cfg };
          setCardConfig(newConfig);
          setShowCustomize(false);
          setCustomizeStat(null);
          setCustomizeBlankStart(false);
          // Clear the draft BEFORE handleTrack runs, since handleTrack calls
          // trelloT.closeModal() on success — once that fires the iframe starts
          // tearing down and a remove() call queued after it can lose the race
          // and never actually delete the draft from Trello's storage.
          if (trelloT) {
            await trelloT
              .remove("board", "shared", `cardlytics_draft:${type}`)
              .catch(() => {});
          }
          await handleTrack([type], newConfig);
        }}
        onClose={() => {
          setShowCustomize(false);
          setCustomizeStat(null);
          setCustomizeBlankStart(false);
        }}
        computeFilteredCount={(statType, filters) => {
          const cards = allBoardCards.length > 0 ? allBoardCards : boardCards;

          const hasExplicitFilters =
            filters.due?.length > 0 ||
            filters.members?.length > 0 ||
            filters.labels?.length > 0 ||
            filters.lists?.length > 0 ||
            filters.status?.length > 0 ||
            filters.activity?.length > 0 ||
            filters.createdDate?.length > 0 ||
            !!filters.customDateFrom ||
            !!filters.customDateTo;

          if (hasExplicitFilters) {
            // User has configured filters — apply ONLY those, ignore stat's own filter
            return applyFilters(cards, filters, currentMemberId).length;
          }

          // No filters set — apply the stat's own base filter (default behavior)
          const statFn = buildStatFilterMap(currentMemberId, null)[statType];
          if (!statFn || statType === "cardsInList" || statType === "all") {
            return cards.length;
          }
          return cards.filter(statFn).length;
        }}
        boardId={currentBoardId}
        boardName={currentBoardName}
        workspaceId={currentWorkspaceId}
        workspaceName={currentWorkspaceName}
        fetchWorkspaces={fetchAllWorkspaces}
        fetchWorkspaceBoards={async () => {
          if (_workspaceBoardsCache) return _workspaceBoardsCache;
          const key = TRELLO_API_KEY;
          const tkn = getStoredToken();
          const boards = await getWorkspaceBoards(key, tkn);
          _workspaceBoardsCache = boards;
          return boards;
        }}
        fetchBoardScopedData={async (targetBoardId, boards) => {
          const key = TRELLO_API_KEY;
          const tkn = getStoredToken();
          return getBoardScopedData(key, tkn, targetBoardId, boards);
        }}
        trelloT={trelloT}
      />
      <div
        className="header"
        style={{
          flexDirection: "column",
          alignItems: "stretch",
          gap: 0,
          paddingBottom: 10,
          borderBottom: "1px solid #333",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div className="header-left">
            <div className="trello-icon">T</div>
            <h3 style={{ whiteSpace: "nowrap" }}>Cardlytics — Track</h3>
          </div>
          <div className="header-actions">
            <button
              className="btn-customize"
              onClick={() => {
                if (trelloT) {
                  trelloT.board("id").then((board) => {
                    trelloT.modal({
                      title: "Cardlytics — All Cards",
                      url: `./index.html?view=card-details&boardId=${board.id}&statType=all&mode=board`,
                      fullscreen: true,
                    });
                  });
                }
              }}
            >
              All Cards
            </button>
            <button
              className="btn-customize"
              onClick={() => {
                setCustomizeBlankStart(false);
                setShowCustomize(true);
              }}
            >
              Customize
            </button>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #333", margin: "8px 16px" }} />

        <div className="scope-row">
          <span className="scope-label">📋 Board</span>
          <select
            value={scopeListId}
            onChange={(e) => {
              const newScope = e.target.value;
              setScopeListId(newScope);
              fetchData(newScope);
            }}
            className="list-dropdown"
            style={{
              fontSize: 12,
              padding: "4px 10px",
              maxWidth: 160,
              borderRadius: 6,
            }}
          >
            <option value="board">Throughout the board</option>
            {lists
              .filter((l) => l.name.toLowerCase() !== "cardlytics")
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="body">
        {mode === "list" && trackingListName && (
          <div className="list-context-badge">
            <span className="badge-scope">Scope</span>
            <span className="badge-divider" />
            <span className="badge-name">{trackingListName}</span>
          </div>
        )}

        <Section title="MY WORK">
          <StatCard
            value={stats.assigned}
            label="Assigned to me across workspace"
            tag="live"
            type="assigned"
            onClick={handleStatClick}
            selected={selectedStats}
          />
          <StatCard
            value={stats.dueThisWeek}
            label={`Due this week · ${mode === "list" && trackingListName ? trackingListName : "this board"}`}
            type="dueThisWeek"
            onClick={handleStatClick}
            selected={selectedStats}
          />
          <StatCard
            value={stats.overdue}
            label={`Overdue · ${mode === "list" && trackingListName ? trackingListName : "this board"}`}
            tag="hot"
            type="overdue"
            onClick={handleStatClick}
            selected={selectedStats}
          />
        </Section>

        <Section title="BOARD INSIGHTS">
          <StatCard
            value={stats.unassigned}
            label={`Unassigned · ${mode === "list" && trackingListName ? trackingListName : "this board"}`}
            type="unassigned"
            onClick={handleStatClick}
            selected={selectedStats}
          />
          <StatCard
            value={stats.withLabel}
            label={`With a label · ${mode === "list" && trackingListName ? trackingListName : "this board"}`}
            type="withLabel"
            onClick={handleStatClick}
            selected={selectedStats}
          />
          <StatCard
            value={stats.stale}
            label={`Stale · ${mode === "list" && trackingListName ? trackingListName : "this board"}`}
            type="stale"
            onClick={handleStatClick}
            selected={selectedStats}
          />
        </Section>

        <Section title="ACTIVITY">
          <StatCard
            value={stats.createdToday}
            label={`Created today · ${mode === "list" && trackingListName ? trackingListName : "this board"}`}
            type="createdToday"
            onClick={handleStatClick}
            selected={selectedStats}
          />

          {mode === "list" && (
            <StatCard
              value={stats.cardsInList}
              label="Cards in this list"
              type="cardsInList"
              onClick={handleStatClick}
              selected={selectedStats}
            />
          )}

          <div
            className="add-filter-card"
            onClick={() => {
              setCustomizeBlankStart(true);
              setShowCustomize(true);
            }}
          >
            + Add filter
          </div>
        </Section>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "8px 12px",
        }}
      >
        <button
          className="btn-customize"
          onClick={() => handleTrack()}
          disabled={selectedStats.length === 0 || isTracking}
          style={{
            background: selectedStats.length > 0 ? "#1d4ed8" : undefined,
            borderColor: selectedStats.length > 0 ? "#3B82F6" : undefined,
            color: selectedStats.length > 0 ? "#fff" : undefined,
            cursor:
              selectedStats.length === 0 || isTracking
                ? "not-allowed"
                : "pointer",
            opacity: selectedStats.length === 0 ? 0.5 : 1,
            padding: "7px 24px",
            fontSize: "13px",
          }}
        >
          {isTracking ? "Creating..." : "Track"}
        </button>
      </div>

      <div className="footer">
        <div className="footer-tracking">
          <span className="footer-tracking-icon">📌</span>
          <span className="footer-tracking-text">
            Tracking to: <strong>{trackingListName || "..."}</strong>
          </span>
        </div>
        <div className="footer-right">
          <span className="footer-text">Updated: {lastUpdated}</span>
          <button className="btn-refresh" onClick={fetchData}>
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="section">
      <p className="section-title">{title}</p>
      <div className="grid">{children}</div>
    </div>
  );
}

function StatCard({ value, label, tag, type, onClick, selected }) {
  return (
    <div
      className={`card ${selected.includes(type) ? "selected" : ""}`}
      onClick={() => onClick(type)}
    >
      {tag === "live" && <span className="tag live">Live</span>}
      {tag === "hot" && <span className="tag hot">Hot</span>}
      <div className="card-value">{value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}
