import { useState, useEffect } from "react";
import {
  getBoardCards,
  computeStats,
  computeDetailStats,
  getMemberId,
  getMemberDetails,
  getListCards,
  getBoardLists,
  createCard,
  createList,
} from "./trello";
import { CustomizeFlow } from "./CustomizeModal";
import "./index.css";

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

const isTrackerCard = (name) => {
  const lower = name.toLowerCase();
  return [
    "assigned to me",
    "due this week",
    "overdue cards",
    "unassigned cards",
    "cards with a label",
    "stale cards",
    "created today",
    "cards in list",
  ].some((p) => lower.includes(p));
};

const STAT_LABELS = {
  assigned: "Assigned to Me",
  dueThisWeek: "Due This Week",
  overdue: "Overdue Cards",
  unassigned: "Unassigned Cards",
  withLabel: "Cards With Label",
  stale: "Stale Cards",
  createdToday: "Created Today",
  cardsInList: "Cards in List",
  all: "All Cards",
};

// ─── Default stat config (cover colors + card names) ─────────────────────────
// These are the baseline values. If the user customizes via the modal,
// their saved config (cardConfig state) overrides name and cover.
const DEFAULT_STAT_CONFIG = {
  assigned: { name: "📌 Assigned to Me", cover: "blue" },
  dueThisWeek: { name: "📅 Due This Week", cover: "yellow" },
  overdue: { name: "⚠️ Overdue Cards", cover: "red" },
  unassigned: { name: "👤 Unassigned Cards", cover: "purple" },
  withLabel: { name: "🏷️ Cards With Label", cover: "orange" },
  stale: { name: "💤 Stale Cards", cover: "black" },
  createdToday: { name: "✨ Created Today", cover: "green" },
  cardsInList: { name: "📋 Cards in List", cover: "sky" },
};

// ─── TOAST ───────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type}`}>
      <span className="toast-icon">
        {toast.type === "success" ? "✅" : "❌"}
      </span>
      <span className="toast-msg">{toast.message}</span>
    </div>
  );
}

// ─── CARD BACK VIEW ──────────────────────────────────────────────────────────
function CardBackView() {
  function handleOpenCardlytics() {
    const t = window.TrelloPowerUp?.iframe?.();
    if (!t) return;
    t.card("id", "idList", "name", "desc").then((card) => {
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
      const statType =
        nameMap.find((m) =>
          card.name.toLowerCase().startsWith(m.prefix.toLowerCase()),
        )?.type || "all";
      const metaMatch = card.desc?.match(
        /\[_\]: cardlytics:mode:(board|list)(?::listId:([a-f0-9]+))?/,
      );
      const cardMode = metaMatch ? metaMatch[1] : "board";
      const resolvedListId = metaMatch ? metaMatch[2] || card.idList : null;
      t.board("id").then((board) => {
        t.modal({
          title: "Cardlytics",
          url: `./index.html?view=card-details&listId=${resolvedListId}&boardId=${board.id}&statType=${statType}&mode=${cardMode}`,
          fullscreen: true,
        });
      });
    });
  }

  return (
    <div
      className="cb-root"
      style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}
    >
      <span style={{ fontWeight: 600, fontSize: 13, color: "#e0e0e0" }}>
        Cardlytics
      </span>
      <button
        className="cb-btn-primary"
        style={{ width: "auto", padding: "7px 16px", flexShrink: 0 }}
        onClick={handleOpenCardlytics}
      >
        View Details
      </button>
    </div>
  );
}

// ─── CARD DETAILS VIEW ────────────────────────────────────────────────────────
function CardDetailsView() {
  const params = new URLSearchParams(window.location.search);
  const listId = params.get("listId");
  const boardId = params.get("boardId");
  const statType = params.get("statType") || "all";
  const mode = params.get("mode") || "board";

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
  });
  const [memberMap, setMemberMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("table");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);

  const key = import.meta.env.VITE_TRELLO_API_KEY;
  const token = import.meta.env.VITE_TRELLO_TOKEN;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const isListScoped = mode === "list" || statType === "cardsInList";
        let allCards;
        if (isListScoped && listId) {
          allCards = await getListCards(key, token, listId);
        } else if (boardId) {
          allCards = await getBoardCards(key, token, boardId);
        } else if (listId) {
          allCards = await getListCards(key, token, listId);
        } else {
          allCards = [];
        }

        const mid = await getMemberId(key, token);
        allCards = allCards.filter((c) => !isTrackerCard(c.name));

        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const fourteenAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const filterMap = {
          assigned: (c) => c.idMembers?.includes(mid),
          dueThisWeek: (c) =>
            c.due && new Date(c.due) >= now && new Date(c.due) <= weekFromNow,
          overdue: (c) => c.due && new Date(c.due) < now && !c.dueComplete,
          unassigned: (c) => !c.idMembers || c.idMembers.length === 0,
          withLabel: (c) => c.labels?.length > 0,
          stale: (c) =>
            c.dateLastActivity && new Date(c.dateLastActivity) < fourteenAgo,
          createdToday: (c) => cardCreatedDate(c.id) >= todayStart,
          cardsInList: () => true,
          all: () => true,
        };

        const fn = filterMap[statType] || (() => true);
        const filteredCards = allCards
          .filter((c) => !isTrackerCard(c.name))
          .filter(fn);

        setCards(filteredCards);
        setDetailStats(computeDetailStats(filteredCards));

        const computed = computeStats(
          allCards.filter((c) => !isTrackerCard(c.name)),
          mid,
        );
        computed.cardsInList = isListScoped
          ? allCards.filter((c) => !isTrackerCard(c.name)).length
          : 0;
        setFullStats(computed);

        if (listId) {
          const listRes = await fetch(
            `${BASE_URL}/lists/${listId}?key=${key}&token=${token}&fields=name,idBoard`,
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            setListName(listData.name);
            const resolvedBoardId = boardId || listData.idBoard;
            const boardRes = await fetch(
              `${BASE_URL}/boards/${resolvedBoardId}?key=${key}&token=${token}&fields=name`,
            );
            if (boardRes.ok) setBoardName((await boardRes.json()).name);
          }
        } else if (boardId) {
          const boardRes = await fetch(
            `${BASE_URL}/boards/${boardId}?key=${key}&token=${token}&fields=name`,
          );
          if (boardRes.ok) setBoardName((await boardRes.json()).name);
        }

        const resolvedBoardId = boardId || "p8fosANE";
        const boardLists = await getBoardLists(key, token, resolvedBoardId);
        const lmap = {};
        boardLists.forEach((l) => (lmap[l.id] = l.name));
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
  }, [listId, boardId, statType]);

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

  function handleSort(col) {
    if (sortCol === col) setSortAsc((s) => !s);
    else {
      setSortCol(col);
      setSortAsc(true);
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
    { value: detailStats.total, label: "In this view", accent: "#4caf50" },
    { value: fullStats.assigned, label: "Assigned to me", accent: "#4ea1ff" },
    { value: fullStats.dueThisWeek, label: "Due this week", accent: "#f9c74f" },
    { value: fullStats.overdue, label: "Overdue cards", accent: "#ff5252" },
    {
      value: fullStats.unassigned,
      label: "Unassigned cards",
      accent: "#ab47bc",
    },
    {
      value: fullStats.withLabel,
      label: "Cards with a label",
      accent: "#ff9800",
    },
    {
      value: fullStats.stale,
      label: "Stale (14+ days inactive)",
      accent: "#888",
    },
    {
      value: fullStats.createdToday,
      label: "Created today",
      accent: "#2ec4b6",
    },
  ];

  return (
    <div className="cd-root">
      <div className="cd-left">
        <div className="cd-list-label">
          {isListScoped ? listName : boardName}
        </div>
        {leftStats.map((s, i) => (
          <div
            key={i}
            className="cd-stat-card"
            style={{ borderLeft: `3px solid ${s.accent}` }}
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
        <div className="add-filter-card" style={{ marginTop: 4 }}>
          + Add filter
        </div>
      </div>

      <div className="cd-right">
        <div className="cd-banner">
          <div className="cd-banner-count">{detailStats.total}</div>
          <div>
            <div className="cd-banner-title">
              {STAT_LABELS[statType] || "Cards"}
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
            <button className="cd-action-btn">✏ Edit filters</button>
            <button className="cd-action-btn">⊡ Clone</button>
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
          <button className="cd-action-btn">Columns</button>
          <button className="cd-action-btn">Export</button>
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
                  <th onClick={() => handleSort("name")}>
                    Name <SortArrow col="name" />
                  </th>
                  <th>Assigned</th>
                  <th>Board</th>
                  <th>Done</th>
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
                    <td>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          border: "1px solid #444",
                          borderRadius: 3,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: card.dueComplete
                            ? "#0a3d0a"
                            : "transparent",
                        }}
                      >
                        {card.dueComplete && (
                          <span style={{ color: "#4caf50", fontSize: 10 }}>
                            ✓
                          </span>
                        )}
                      </span>
                    </td>
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
          <button className="cd-nav-btn">📥 Inbox</button>
          <button className="cd-nav-btn">📅 Planner</button>
          <button className="cd-nav-btn active">⊞ Board</button>
          <button className="cd-nav-btn switch">⇄ Switch boards</button>
        </div>
      </div>
    </div>
  );
}

const BASE_URL = "https://api.trello.com/1";

// ── Generate a cover image with the big number overlaid ──────────────────────
const COVER_BG_COLORS = {
  blue:   "#1565c0",
  yellow: "#f57f17",
  red:    "#b71c1c",
  purple: "#6a1b9a",
  orange: "#e65100",
  green:  "#1b5e20",
  black:  "#212121",
  sky:    "#0277bd",
};

function generateStatCoverImage(count, colorName, bgImageDataUrl = null) {
  return new Promise((resolve) => {
    const W = 800, H = 320;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    function drawNumber() {
      // Dark scrim so the number is readable over any background
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

      resolve(canvas.toDataURL("image/jpeg", 0.92));
    }

    if (bgImageDataUrl) {
      // Draw user's custom image as background, then overlay the number
      const img = new Image();
      img.onload = () => {
        // Cover-fit: fill canvas, center crop
        const scale = Math.max(W / img.width, H / img.height);
        const sw = img.width * scale, sh = img.height * scale;
        ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
        drawNumber();
      };
      img.onerror = () => {
        // Fallback to color background if image fails
        ctx.fillStyle = COVER_BG_COLORS[colorName] || "#1565c0";
        ctx.fillRect(0, 0, W, H);
        drawNumber();
      };
      img.src = bgImageDataUrl;
    } else {
      // Solid color background + subtle gradient
      const bg = COVER_BG_COLORS[colorName] || "#1565c0";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "rgba(255,255,255,0.07)");
      grad.addColorStop(1, "rgba(0,0,0,0.25)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      drawNumber();
    }
  });
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const view = params.get("view");
  const listId = params.get("listId");

  if (view === "card") return <CardBackView />;
  if (view === "card-details") return <CardDetailsView />;

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
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedListCount, setSelectedListCount] = useState(null);
  const [trackingListName, setTrackingListName] = useState("");
  const [toast, setToast] = useState(null);
  const [memberFullName, setMemberFullName] = useState("");

  // ── Customize state ──────────────────────────────────────────────────────
  const [showCustomize, setShowCustomize] = useState(false);
  const [customizeStat, setCustomizeStat] = useState(null);
  // cardConfig stores per-stat overrides saved from the Customize modal
  // shape: { [statType]: { cardName: string, cover: string, ... } }
  const [cardConfig, setCardConfig] = useState({});

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const handleStatClick = (type) =>
    setSelectedStats((prev) =>
      prev.includes(type) ? prev.filter((i) => i !== type) : [...prev, type],
    );

  async function fetchData() {
    try {
      const key = import.meta.env.VITE_TRELLO_API_KEY;
      const token = import.meta.env.VITE_TRELLO_TOKEN;
      const boardId = "p8fosANE";

      const cards =
        mode === "list" && listId
          ? await getListCards(key, token, listId)
          : await getBoardCards(key, token, boardId);

      const filteredForStats = cards.filter((c) => !isTrackerCard(c.name));
      const memberId = await getMemberId(key, token);

      // Fetch member full name for Customize modal avatar
      if (memberId) {
        const memberDetails = await getMemberDetails(key, token, memberId);
        setMemberFullName(memberDetails?.fullName || "");
      }

      const computed = computeStats(filteredForStats, memberId);
      computed.cardsInList = mode === "list" ? filteredForStats.length : 0;
      setStats(computed);

         // ── Auto-sync tracker cards ─────────────────────────────
try {
  const allLists = await getBoardLists(key, token, boardId);
  const cardlyticsList = allLists.find((l) => l.name === "Cardlytics");

  if (cardlyticsList) {
    const trackerCards = (await getListCards(key, token, cardlyticsList.id))
      .filter((c) => isTrackerCard(c.name));

    const nameToType = {
      "assigned to me": "assigned",
      "due this week": "dueThisWeek",
      "overdue cards": "overdue",
      "unassigned cards": "unassigned",
      "cards with a label": "withLabel",
      "stale cards": "stale",
      "created today": "createdToday",
      "cards in list": "cardsInList",
    };

    
    for (const card of trackerCards) {
      const lower = card.name.toLowerCase();
      const matchedKey = Object.keys(nameToType).find((k) =>
        lower.includes(k)
      );
      if (!matchedKey) continue;

      const type = nameToType[matchedKey];

      // 🔥 Detect board/list mode from meta
      const metaMatch = card.desc?.match(
        /\[_\]: cardlytics:mode:(board|list)(?::listId:([a-f0-9]+))?/
      );

      const cardMode = metaMatch ? metaMatch[1] : "board";
      const cardListId = metaMatch ? metaMatch[2] : null;

      let newCount = 0;

      // ✅ Handle LIST vs BOARD correctly
      if (cardMode === "list" && cardListId) {
        const listCards = await getListCards(key, token, cardListId);
        const listStats = computeStats(
          listCards.filter((c) => !isTrackerCard(c.name)),
          memberId
        );
        newCount = listStats[type] ?? 0;
      } else {
        newCount = computed[type] ?? 0;
      }

      // Skip if same count
      const oldCount = parseInt(card.desc?.match(/^(\d+)/)?.[1] ?? "-1");
      if (oldCount === newCount) continue;

      // Update description
      const metaTag =
        card.desc?.match(/\[_\]: cardlytics:mode:[^\n]+/)?.[0] || "";

      await updateCard(key, token, card.id, {
        desc: `${newCount} card(s) tracked by Cardlytics.${metaTag ? `\n\n${metaTag}` : ""}`,
      });

      // 🔥 Generate NEW image with updated count
      const newCover = await generateStatCoverImage(newCount, "blue");

      await updateCardCover(key, token, card.id, newCover);
    }
  }
} catch (err) {
  console.warn("Sync failed:", err);
}

      setLastUpdated(new Date().toLocaleTimeString());

      const boardLists = await getBoardLists(key, token, boardId);
      setLists(boardLists);

      if (mode === "list" && listId) {
        const listRes = await fetch(
          `${BASE_URL}/lists/${listId}?key=${import.meta.env.VITE_TRELLO_API_KEY}&token=${import.meta.env.VITE_TRELLO_TOKEN}&fields=name`,
        );
        if (listRes.ok) setTrackingListName((await listRes.json()).name);
      } else {
        if (boardLists.length > 0) setTrackingListName(boardLists[0].name);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleListChange(e) {
    const id = e.target.value;
    setSelectedListId(id);
    if (!id) {
      setSelectedListCount(null);
      return;
    }
    const key = import.meta.env.VITE_TRELLO_API_KEY;
    const token = import.meta.env.VITE_TRELLO_TOKEN;
    const cards = await getListCards(key, token, id);
    setSelectedListCount(cards.filter((c) => !isTrackerCard(c.name)).length);
  }

  useEffect(() => {
    fetchData();
  }, []);

  // ── TRACK ────────────────────────────────────────────────────────────────
  // statsOverride and configOverride let onSave call this directly with fresh
  // values, bypassing the stale-closure problem with React state.
  const handleTrack = async (statsOverride, configOverride) => {
    const statsToTrack = statsOverride ?? selectedStats;
    const configToUse  = configOverride ?? cardConfig;

    if (statsToTrack.length === 0) {
      showToast("Please select at least one stat to track", "error");
      return;
    }
    try {
      const key = import.meta.env.VITE_TRELLO_API_KEY;
      const token = import.meta.env.VITE_TRELLO_TOKEN;
      const boardId = "p8fosANE";

      let targetListId;
      if (mode === "list" && listId) {
        targetListId = listId;
      } else {
        const boardLists = await getBoardLists(key, token, boardId);
        let cardlyticsList = boardLists.find((l) => l.name === "Cardlytics");
        if (!cardlyticsList) {
          cardlyticsList = await createList(key, token, boardId, "Cardlytics");
        }
        targetListId = cardlyticsList.id;
        setTrackingListName("Cardlytics");
      }
      if (!targetListId) {
        showToast("List not found", "error");
        return;
      }

      const metaTag =
        mode === "list" && listId
          ? `\n\n[_]: cardlytics:mode:list:listId:${listId}`
          : `\n\n[_]: cardlytics:mode:board`;

      for (const stat of statsToTrack) {
        const defaults = DEFAULT_STAT_CONFIG[stat];
        const saved = configToUse[stat];
        const count = stats[stat];

        // Card name has NO count — the count is shown as a big number on the cover image
        const cardName = saved?.cardName || defaults.name;

        const desc = `${count} card(s) tracked by Cardlytics.${metaTag}`;

        const cover = saved?.cover || defaults.cover;

        // Always generate a cover image with the big count number.
        // If the user uploaded a custom image, use it as the background and
        // draw the number on top of it.
        const coverImageDataUrl = await generateStatCoverImage(
          count,
          cover,
          saved?.coverImage || null,
        );

        await createCard(
          key,
          token,
          targetListId,
          cardName,
          desc,
          cover,
          coverImageDataUrl,
        );
      }

      showToast(
        `${statsToTrack.length} card(s) added to "${trackingListName}" ✅`,
      );
      setSelectedStats([]);
    } catch (err) {
      console.error("Trello API Error:", err);
      showToast("Something went wrong. Please try again.", "error");
    }
  };

  return (
    <div className="popup">
      <Toast toast={toast} />

      {/* ── Customize modal (two-step: stat picker → card config) ── */}
      <CustomizeFlow
        show={showCustomize}
        lists={lists}
        stats={stats}
        memberName={memberFullName}
        customizeStat={customizeStat}
        setCustomizeStat={setCustomizeStat}
        onSave={async (type, cfg) => {
          // Build the new config synchronously so handleTrack gets fresh values
          // (setState is async — can't rely on cardConfig being updated yet)
          const newConfig = { ...cardConfig, [type]: cfg };
          setCardConfig(newConfig);
          setShowCustomize(false);
          setCustomizeStat(null);
          // Track immediately — no need to go back and click Track
          await handleTrack([type], newConfig);
        }}
        onClose={() => {
          setShowCustomize(false);
          setCustomizeStat(null);
        }}
      />

      <div className="header">
        <div className="header-left">
          <div className="trello-icon">T</div>
          <h3>Cardlytics — Track</h3>
        </div>
        <div className="header-actions">
        
          <button
            className="btn-customize"
            onClick={() => setShowCustomize(true)}
          >
            Customize
          </button>
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

          {mode === "board" && (
            <div
              className={`card list-picker ${selectedListId && selectedStats.includes("cardsInList") ? "selected" : ""}`}
              onClick={() => {
                if (selectedListId) handleStatClick("cardsInList");
              }}
            >
              <div className="list-picker-top">
                {selectedListCount !== null && (
                  <div className="card-value">{selectedListCount}</div>
                )}
                <select
                  className="list-dropdown"
                  value={selectedListId}
                  onChange={handleListChange}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Select a list</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="card-label">
                {selectedListId
                  ? "Click to select · Cards in list"
                  : "Select a list first"}
              </div>
            </div>
          )}

          {mode === "list" && (
            <StatCard
              value={stats.cardsInList}
              label="Cards in this list"
              type="cardsInList"
              onClick={handleStatClick}
              selected={selectedStats}
            />
          )}

          <div className="add-filter-card">+ Add filter</div>
        </Section>
      </div>

       <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px" }}>
  <button
    className="btn-customize"
    onClick={() => handleTrack()}
    disabled={selectedStats.length === 0}
    style={{
      background: selectedStats.length > 0 ? "#1d4ed8" : undefined,
      borderColor: selectedStats.length > 0 ? "#3B82F6" : undefined,
      color: selectedStats.length > 0 ? "#fff" : undefined,
      cursor: selectedStats.length === 0 ? "not-allowed" : "pointer",
      opacity: selectedStats.length === 0 ? 0.5 : 1,
      padding: "7px 24px",
      fontSize: "13px",
    }}
  >
    Track
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