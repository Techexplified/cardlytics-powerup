import { useState, useRef } from "react";

// ── Cover color palette (Trello-supported colors + display hex) ───────────────
const COVER_COLORS = [
  { id: "blue",   hex: "#0052cc", label: "Blue"   },
  { id: "sky",    hex: "#29b6f6", label: "Sky"    },
  { id: "green",  hex: "#1a7a4a", label: "Green"  },
  { id: "yellow", hex: "#e6a817", label: "Yellow" },
  { id: "orange", hex: "#e67e22", label: "Orange" },
  { id: "red",    hex: "#c0392b", label: "Red"    },
  { id: "purple", hex: "#7e57c2", label: "Purple" },
  { id: "pink",   hex: "#e91e8c", label: "Pink"   },
  { id: "black",  hex: "#374151", label: "Slate"  },
];

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

const DEFAULT_COVER = {
  assigned:     "blue",
  dueThisWeek:  "yellow",
  overdue:      "red",
  unassigned:   "purple",
  withLabel:    "orange",
  stale:        "black",
  createdToday: "green",
  cardsInList:  "sky",
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

// ── Step 1: Stat picker ───────────────────────────────────────────────────────
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

// ── Color Swatch Picker ───────────────────────────────────────────────────────
function ColorSwatchPicker({ selected, onChange }) {
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      padding: "10px 0 4px",
    }}>
      {COVER_COLORS.map(({ id, hex, label }) => (
        <button
          key={id}
          title={label}
          onClick={() => onChange(id)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: hex,
            border: selected === id
              ? "2px solid #fff"
              : "2px solid transparent",
            outline: selected === id ? `2px solid ${hex}` : "none",
            cursor: "pointer",
            padding: 0,
            transition: "transform 0.1s",
            transform: selected === id ? "scale(1.15)" : "scale(1)",
            position: "relative",
          }}
        >
          {selected === id && (
            <span style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}>✓</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Image Upload Preview ──────────────────────────────────────────────────────
function ImageUpload({ imageUrl, onImageChange }) {
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onImageChange(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => fileRef.current?.click()}
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
          }}
        >
          🖼 {imageUrl ? "Change image" : "Upload image"}
        </button>
        {imageUrl && (
          <button
            onClick={() => onImageChange(null)}
            style={{
              background: "none",
              border: "1px solid #3a3a3a",
              borderRadius: 6,
              padding: "6px 10px",
              color: "#888",
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        )}
      </div>
      {imageUrl && (
        <div style={{
          width: "100%",
          height: 48,
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid #3a3a3a",
        }}>
          <img
            src={imageUrl}
            alt="Cover preview"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
    </div>
  );
}

// ── Card Config Modal ─────────────────────────────────────────────────────────
function CardConfigModal({ statType, statValue, lists, memberName, onSave, onBack, onClose }) {
  const [cardName,   setCardName]   = useState(DEFAULT_NAMES[statType] || "");
  const [coverColor, setCoverColor] = useState(DEFAULT_COVER[statType] || "blue");
  const [coverImage, setCoverImage] = useState(null);
  const [board,      setBoard]      = useState("any");
  const [list,       setList]       = useState("any");
  const [due,        setDue]        = useState("");
  const [labels,     setLabels]     = useState("");
  const [showMore,   setShowMore]   = useState(false);

  const resolvedCoverHex = coverImage
    ? null
    : (COVER_COLORS.find(c => c.id === coverColor)?.hex || "#0052cc");

  const emoji = STAT_EMOJIS[statType] || "📌";

  // initials from full name
  const initials = memberName
    ? memberName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "ME";

  function handleSave() {
    onSave(statType, { cardName, cover: coverColor, coverImage, board, list, due, labels });
  }

  return (
    <div className="customize-overlay" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#252525",
          border: "1px solid #3a3a3a",
          borderRadius: 12,
          width: 540,
          maxWidth: "94vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "13px 16px",
          borderBottom: "1px solid #333",
          flexShrink: 0,
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

        {/* ── Body (scrollable) ── */}
        <div style={{ display: "flex", overflow: "hidden", flex: 1, minHeight: 0 }}>

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
              {/* Cover */}
              <div style={{
                background: coverImage ? "transparent" : resolvedCoverHex,
                height: 78,
                display: "flex",
                alignItems: "flex-end",
                padding: "8px 10px",
                position: "relative",
                overflow: "hidden",
              }}>
                {coverImage && (
                  <img
                    src={coverImage}
                    alt=""
                    style={{
                      position: "absolute", inset: 0,
                      width: "100%", height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,0.25)",
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
              {/* Card name */}
              <div style={{ padding: "8px 10px" }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "#ccc",
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

          {/* Right: form (scrollable) */}
          <div style={{ flex: 1, padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Name */}
            <div>
              <SectionLabel>Name</SectionLabel>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder={DEFAULT_NAMES[statType]}
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

            <Divider />

            {/* Appearance: color swatches + optional image upload */}
            <div>
              <SectionLabel>Cover color</SectionLabel>
              <ColorSwatchPicker
                selected={coverImage ? null : coverColor}
                onChange={(id) => { setCoverColor(id); setCoverImage(null); }}
              />
            </div>

            <div>
              <SectionLabel>Cover image <span style={{ color: "#555", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional — overrides color)</span></SectionLabel>
              <ImageUpload imageUrl={coverImage} onImageChange={setCoverImage} />
            </div>

            <Divider />

            {/* Filters */}
            <div>
              <SectionLabel>Filters</SectionLabel>
            </div>

            <FilterRow label="Board" icon="⊞">
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className="list-dropdown"
                style={{ maxWidth: 160 }}
              >
                <option value="any">any</option>
                <option value="this">this board</option>
              </select>
            </FilterRow>

            <FilterRow label="List" icon="☰">
              <select
                value={list}
                onChange={(e) => setList(e.target.value)}
                className="list-dropdown"
                style={{ maxWidth: 160 }}
              >
                <option value="any">any</option>
                {(lists || []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </FilterRow>

            {/* Assigned — full name, no truncation */}
            <FilterRow label="Assigned" icon="👤">
              <div style={{
                fontSize: 11, color: "#777",
                whiteSpace: "nowrap", marginRight: 6, flexShrink: 0,
              }}>
                includes
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "#1e1e1e", border: "1px solid #3a3a3a",
                borderRadius: 6, padding: "5px 9px",
                fontSize: 12, color: "#ccc", flex: 1, minWidth: 0,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: "#0052cc", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, color: "#fff",
                }}>
                  {initials}
                </div>
                {/* Full name — wraps instead of truncating */}
                <span style={{
                  flex: 1,
                  fontSize: 11,
                  color: "#d0d0d0",
                  wordBreak: "break-word",
                  lineHeight: 1.3,
                }}>
                  {memberName || "me"}
                </span>
                <span
                  title="Remove"
                  style={{ color: "#555", cursor: "pointer", flexShrink: 0, fontSize: 11 }}
                >✕</span>
              </div>
            </FilterRow>

            <FilterRow label="Due" icon="🕐">
              <select
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="list-dropdown"
                style={{ maxWidth: 160 }}
              >
                <option value="">any</option>
                <option value="overdue">overdue</option>
                <option value="today">today</option>
                <option value="week">this week</option>
                <option value="month">this month</option>
                <option value="none">no due date</option>
              </select>
            </FilterRow>

            <FilterRow label="Labels" icon="🏷">
              <select
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                className="list-dropdown"
                style={{ maxWidth: 160 }}
              >
                <option value="">any</option>
                <option value="any">has any label</option>
                <option value="none">no label</option>
                <option value="red">red</option>
                <option value="orange">orange</option>
                <option value="yellow">yellow</option>
                <option value="green">green</option>
                <option value="blue">blue</option>
                <option value="purple">purple</option>
              </select>
            </FilterRow>

            {showMore && (
              <>
                <FilterRow label="Priority" icon="⚡">
                  <select className="list-dropdown" style={{ maxWidth: 160 }}>
                    <option value="">any</option>
                    <option>high</option>
                    <option>medium</option>
                    <option>low</option>
                  </select>
                </FilterRow>
                <FilterRow label="Activity" icon="📊">
                  <select className="list-dropdown" style={{ maxWidth: 160 }}>
                    <option value="">any</option>
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

        {/* ── Footer ── */}
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          padding: "12px 16px",
          borderTop: "1px solid #2e2e2e",
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid #3a3a3a",
              borderRadius: 6, padding: "7px 18px",
              color: "#aaa", fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: "#0052cc", border: "none",
              borderRadius: 6, padding: "7px 18px",
              color: "#fff", fontSize: 13, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
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

// ── Small helpers ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "#666",
      letterSpacing: "0.08em", textTransform: "uppercase",
      marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #2e2e2e" }} />;
}

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

// ── Main export ───────────────────────────────────────────────────────────────
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