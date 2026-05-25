import { useState } from "react";

const COVER_COLORS = {
  assigned:     "#0052cc",
  dueThisWeek:  "#e6a817",
  overdue:      "#c0392b",
  unassigned:   "#7e57c2",
  withLabel:    "#e67e22",
  stale:        "#555555",
  createdToday: "#1a7a4a",
  cardsInList:  "#0288d1",
};

const STAT_EMOJIS = {
  assigned:     "📌",
  dueThisWeek:  "📅",
  overdue:      "⚠️",
  unassigned:   "👤",
  withLabel:    "🏷️",
  stale:        "💤",
  createdToday: "✨",
  cardsInList:  "📋",
};

const DEFAULT_NAMES = {
  assigned:     "Assigned to me on all Workspace boards",
  dueThisWeek:  "Due this week",
  overdue:      "Overdue cards",
  unassigned:   "Unassigned cards",
  withLabel:    "Cards with a label",
  stale:        "Stale cards (14+ days)",
  createdToday: "Created today",
  cardsInList:  "Cards in list",
};

const STAT_LIST = [
  { type: "assigned",     label: "Assigned to Me",     emoji: "📌" },
  { type: "dueThisWeek",  label: "Due This Week",      emoji: "📅" },
  { type: "overdue",      label: "Overdue Cards",      emoji: "⚠️" },
  { type: "unassigned",   label: "Unassigned Cards",   emoji: "👤" },
  { type: "withLabel",    label: "Cards With Label",   emoji: "🏷️" },
  { type: "stale",        label: "Stale Cards",        emoji: "💤" },
  { type: "createdToday", label: "Created Today",      emoji: "✨" },
  { type: "cardsInList",  label: "Cards in List",      emoji: "📋" },
];

// ── Step 1: pick which stat to configure ─────────────────────────────────────
function StatPicker({ onSelect, onClose }) {
  return (
    <div className="customize-overlay" onClick={onClose}>
      <div
        className="customize-modal"
        style={{ width: 280 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="customize-header">
          <span>Customize a stat card</span>
          <button className="customize-close" onClick={onClose}>✕</button>
        </div>
        <p className="customize-sub">Select a stat to configure</p>
        {STAT_LIST.map(({ type, label, emoji }) => (
          <div
            key={type}
            className="customize-row"
            onClick={() => onSelect(type)}
            style={{ justifyContent: "space-between" }}
          >
            <span className="customize-emoji">{emoji}</span>
            <span className="customize-label">{label}</span>
            <span style={{ color: "#555", fontSize: 14 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: card config form ──────────────────────────────────────────────────
function CardConfigModal({ statType, statValue, lists, memberName, onSave, onBack, onClose }) {
  const [cardName, setCardName] = useState(DEFAULT_NAMES[statType] || "");
  const [board,    setBoard]    = useState("any");
  const [list,     setList]     = useState("any");
  const [due,      setDue]      = useState("");
  const [labels,   setLabels]   = useState("");
  const [showMore, setShowMore] = useState(false);

  const coverColor = COVER_COLORS[statType] || "#0052cc";
  const emoji      = STAT_EMOJIS[statType]  || "📌";

  function handleSave() {
    onSave(statType, { cardName, board, list, due, labels });
  }

  return (
    <div className="customize-overlay" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#252525",
          border: "1px solid #3a3a3a",
          borderRadius: 12,
          width: 520,
          maxWidth: "92vw",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "13px 16px",
          borderBottom: "1px solid #333",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={onBack}
              style={{
                background: "none", border: "none", color: "#888",
                fontSize: 18, cursor: "pointer", padding: "0 4px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >‹</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>
              Dashcards — Track
            </span>
          </div>
          <button className="customize-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: "flex" }}>

          {/* Left: card preview */}
          <div style={{
            width: 190,
            flexShrink: 0,
            padding: 14,
            borderRight: "1px solid #2e2e2e",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <div style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 8,
              overflow: "hidden",
            }}>
              {/* Cover with stat number */}
              <div style={{
                background: coverColor,
                height: 78,
                display: "flex",
                alignItems: "flex-end",
                padding: "8px 10px",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,0.2)",
                }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                    {statValue ?? 0}
                  </div>
                </div>
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  fontSize: 18, zIndex: 1,
                }}>{emoji}</div>
              </div>
              {/* Card name preview */}
              <div style={{ padding: "8px 10px" }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#ccc",
                  lineHeight: 1.35,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {cardName || DEFAULT_NAMES[statType]}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#555", textAlign: "center" }}>Preview</div>
          </div>

          {/* Right: form */}
          <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>

            {/* Name field */}
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#666",
                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5,
              }}>Name</div>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                style={{
                  width: "100%",
                  background: "#1e1e1e",
                  border: "1px solid #3a3a3a",
                  borderRadius: 6,
                  padding: "7px 10px",
                  color: "#e0e0e0",
                  fontSize: 12,
                  fontFamily: "'DM Sans', sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#555")}
                onBlur={(e)  => (e.target.style.borderColor = "#3a3a3a")}
              />
            </div>

            <div style={{ borderTop: "1px solid #2e2e2e" }} />

            {/* Appearance label (matches image 2) */}
            <div style={{
              fontSize: 10, fontWeight: 700, color: "#666",
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>Appearance</div>
            <button
              style={{
                background: "#2e2e2e",
                border: "1px solid #3a3a3a",
                borderRadius: 6,
                padding: "6px 12px",
                color: "#ccc",
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
                marginTop: -6,
              }}
            >
              🖼 Change background
            </button>

            <div style={{ borderTop: "1px solid #2e2e2e" }} />

            {/* Filter rows */}
            <FilterRow label="Board" icon="⊞">
              <select value={board} onChange={(e) => setBoard(e.target.value)} className="list-dropdown" style={{ maxWidth: 160 }}>
                <option value="any">any</option>
                <option value="this">this board</option>
              </select>
            </FilterRow>

            <FilterRow label="List" icon="☰">
              <select value={list} onChange={(e) => setList(e.target.value)} className="list-dropdown" style={{ maxWidth: 160 }}>
                <option value="any">any</option>
                {(lists || []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </FilterRow>

            {/* Assigned — shows current member chip */}
            <FilterRow label="Assigned" icon="👤">
              <div style={{ fontSize: 11, color: "#777", whiteSpace: "nowrap", marginRight: 6 }}>
                includes any of
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#1e1e1e", border: "1px solid #3a3a3a",
                borderRadius: 6, padding: "4px 8px",
                fontSize: 11, color: "#ccc", flex: 1,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#0052cc",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>
                  {(memberName || "Me").slice(0, 2).toUpperCase()}
                </div>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10 }}>
                  {memberName || "includes any of"}
                </span>
                <span style={{ color: "#555", cursor: "pointer" }}>✕</span>
                <span style={{ color: "#555", cursor: "pointer", fontSize: 9 }}>▾</span>
              </div>
            </FilterRow>

            <FilterRow label="Due" icon="🕐">
              <select value={due} onChange={(e) => setDue(e.target.value)} className="list-dropdown" style={{ maxWidth: 160 }}>
                <option value="">select</option>
                <option value="overdue">overdue</option>
                <option value="today">today</option>
                <option value="week">this week</option>
                <option value="month">this month</option>
                <option value="none">no due date</option>
              </select>
            </FilterRow>

            <FilterRow label="Labels" icon="🏷">
              <select value={labels} onChange={(e) => setLabels(e.target.value)} className="list-dropdown" style={{ maxWidth: 160 }}>
                <option value="">select</option>
                <option value="any">any label</option>
                <option value="none">no label</option>
                <option value="red">red</option>
                <option value="orange">orange</option>
                <option value="yellow">yellow</option>
                <option value="green">green</option>
                <option value="blue">blue</option>
                <option value="purple">purple</option>
              </select>
            </FilterRow>

            {/* More filters (expandable) */}
            {showMore && (
              <>
                <FilterRow label="Priority" icon="⚡">
                  <select className="list-dropdown" style={{ maxWidth: 160 }}>
                    <option value="">select</option>
                    <option>high</option>
                    <option>medium</option>
                    <option>low</option>
                  </select>
                </FilterRow>
                <FilterRow label="Activity" icon="📊">
                  <select className="list-dropdown" style={{ maxWidth: 160 }}>
                    <option value="">select</option>
                    <option>stale (14+ days)</option>
                    <option>active today</option>
                  </select>
                </FilterRow>
              </>
            )}

            <button
              onClick={() => setShowMore((s) => !s)}
              style={{
                background: "none",
                border: "1px solid #333",
                borderRadius: 6,
                padding: "5px 10px",
                color: "#4ea1ff",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 4,
                alignSelf: "flex-start",
              }}
            >
              <span>{showMore ? "−" : "+"}</span>
              {showMore ? "Fewer filters" : "More filters"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          padding: "12px 16px",
          borderTop: "1px solid #2e2e2e",
        }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid #3a3a3a",
              borderRadius: 6,
              padding: "7px 18px",
              color: "#aaa",
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: "#0052cc",
              border: "none",
              borderRadius: 6,
              padding: "7px 18px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#0065ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#0052cc")}
          >
            Start tracking
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared filter row layout ──────────────────────────────────────────────────
function FilterRow({ label, icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        width: 76, flexShrink: 0,
        fontSize: 12, color: "#777",
      }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

// ── Main export: two-step flow (picker → config) ──────────────────────────────
export function CustomizeFlow({
  show,
  lists,
  stats,
  memberName,
  customizeStat,
  setCustomizeStat,
  onSave,
  onClose,
}) {
  if (!show) return null;

  if (!customizeStat) {
    return (
      <StatPicker
        onSelect={(type) => setCustomizeStat(type)}
        onClose={onClose}
      />
    );
  }

  return (
    <CardConfigModal
      statType={customizeStat}
      statValue={stats?.[customizeStat] ?? 0}
      lists={lists}
      memberName={memberName}
      onSave={onSave}
      onBack={() => setCustomizeStat(null)}
      onClose={onClose}
    />
  );
}