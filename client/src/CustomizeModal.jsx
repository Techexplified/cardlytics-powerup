import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// ── Cover color palette ───────────────────────────────────────────────────────
const COVER_COLORS = [
  { id: "blue",   hex: "#0052cc", label: "Blue" },
  { id: "sky",    hex: "#29b6f6", label: "Sky" },
  { id: "green",  hex: "#1a7a4a", label: "Green" },
  { id: "yellow", hex: "#e6a817", label: "Yellow" },
  { id: "orange", hex: "#e67e22", label: "Orange" },
  { id: "red",    hex: "#c0392b", label: "Red" },
  { id: "purple", hex: "#7e57c2", label: "Purple" },
  { id: "pink",   hex: "#e91e8c", label: "Pink" },
  { id: "black",  hex: "#374151", label: "Slate" },
];

// Premium-only gradient covers, built from the same palette for visual consistency
const COVER_GRADIENTS = [
  { id: "grad-blue-sky",      css: "linear-gradient(135deg, #0052cc 0%, #29b6f6 100%)", label: "Blue → Sky" },
  { id: "grad-green-sky",     css: "linear-gradient(135deg, #1a7a4a 0%, #29b6f6 100%)", label: "Green → Sky" },
  { id: "grad-orange-pink",   css: "linear-gradient(135deg, #e67e22 0%, #e91e8c 100%)", label: "Orange → Pink" },
  { id: "grad-purple-pink",   css: "linear-gradient(135deg, #7e57c2 0%, #e91e8c 100%)", label: "Purple → Pink" },
  { id: "grad-yellow-orange", css: "linear-gradient(135deg, #e6a817 0%, #e67e22 100%)", label: "Yellow → Orange" },
  { id: "grad-red-purple",    css: "linear-gradient(135deg, #c0392b 0%, #7e57c2 100%)", label: "Red → Purple" },
  { id: "grad-slate-blue",    css: "linear-gradient(135deg, #374151 0%, #0052cc 100%)", label: "Slate → Blue" },
  { id: "grad-multi",         css: "linear-gradient(135deg, #0052cc 0%, #7e57c2 50%, #e91e8c 100%)", label: "Blue → Purple → Pink" },
];

// Resolves a cover id (solid color or gradient) to a CSS background value
function resolveCoverBackground(coverId) {
  const grad = COVER_GRADIENTS.find((g) => g.id === coverId);
  if (grad) return grad.css;
  const solid = COVER_COLORS.find((c) => c.id === coverId);
  return solid?.hex || "#0052cc";
}

// Trello's label color name → display hex
const TRELLO_LABEL_COLORS = {
  red:       "#c0392b",
  orange:    "#e67e22",
  yellow:    "#e6a817",
  green:     "#1a7a4a",
  blue:      "#0052cc",
  purple:    "#7e57c2",
  pink:      "#e91e8c",
  sky:       "#29b6f6",
  lime:      "#51e898",
  black:     "#374151",
  null:      "#888888",
};

const STAT_EMOJIS = {
  assigned:    "📌",
  dueThisWeek: "📅",
  overdue:     "⚠️",
  unassigned:  "👤",
  withLabel:   "🏷️",
  stale:       "💤",
  createdToday:"✨",
  cardsInList: "📋",
};

const DEFAULT_COVER = {
  assigned:    "blue",
  dueThisWeek: "yellow",
  overdue:     "red",
  unassigned:  "purple",
  withLabel:   "orange",
  stale:       "black",
  createdToday:"green",
  cardsInList: "sky",
};

const DEFAULT_NAMES = {
  assigned:    "Assigned to me on all Workspace boards",
  dueThisWeek: "Due this week",
  overdue:     "Overdue cards",
  unassigned:  "Unassigned cards",
  withLabel:   "Cards with a label",
  stale:       "Stale cards (14+ days)",
  createdToday:"Created today",
  cardsInList: "Cards in list",
};

const STAT_LIST = [
  { type: "assigned",    label: "Assigned to Me",   emoji: "📌" },
  { type: "dueThisWeek",label: "Due This Week",     emoji: "📅" },
  { type: "overdue",     label: "Overdue Cards",     emoji: "⚠️" },
  { type: "unassigned",  label: "Unassigned Cards",  emoji: "👤" },
  { type: "withLabel",   label: "Cards With Label",  emoji: "🏷️" },
  { type: "stale",       label: "Stale Cards",       emoji: "💤" },
  { type: "createdToday",label: "Created Today",     emoji: "✨" },
  { type: "cardsInList", label: "Cards in List",     emoji: "📋" },
];

const DUE_OPTIONS = [
  { value: "2days",  label: "Due in 2 days" },
  { value: "1week",  label: "Due in 1 week" },
  { value: "2weeks", label: "Due in 2 weeks" },
  { value: "1month", label: "Due in 1 month" },
  { value: "overdue",label: "Overdue" },
  { value: "nodate", label: "No due date" },
  { value: "custom", label: "Custom range…" },
];

// Which filter is shown first for each stat type
const PRIMARY_FILTER = {
  assigned:    "assigned",
  dueThisWeek: "due",
  overdue:     "due",
  unassigned:  "assigned",
  withLabel:   "labels",
  stale:       "activity",
  createdToday:"activity",
  cardsInList: "list",
};

// ── Smart name derivation ─────────────────────────────────────────────────────
function deriveSmartName(statType, due, members, labels, lists, memberName, boardLabels, listData, membersData) {
  const parts = [];

  if (due.length === 1 && due[0] !== "custom") {
    const dueLbl = DUE_OPTIONS.find((o) => o.value === due[0])?.label;
    if (dueLbl) parts.push(dueLbl);
  } else if (due.length > 1) {
    parts.push(`${due.length} due filters`);
  }

  if (members.length === 1) {
    const memberObj = (membersData || []).find((m) => m.id === members[0]);
    const displayName = memberObj
      ? memberObj.fullName.split(" ")[0]
      : members[0] === "me" && memberName
        ? memberName.split(" ")[0]
        : null;
    if (displayName) parts.push(`· ${displayName}`);
  } else if (members.length > 1) {
    parts.push(`· ${members.length} members`);
  }

  if (labels.length === 1) {
    const lbl = (boardLabels || []).find((l) => l.id === labels[0]);
    if (lbl?.name) parts.push(`· ${lbl.name}`);
  } else if (labels.length > 1) {
    parts.push(`· ${labels.length} labels`);
  }

  if (lists.length === 1) {
    const lst = (listData || []).find((l) => l.id === lists[0]);
    if (lst?.name) parts.push(`· ${lst.name}`);
  } else if (lists.length > 1) {
    parts.push(`· ${lists.length} lists`);
  }

  return parts.length > 0 ? parts.join(" ") : DEFAULT_NAMES[statType];
}

// ── Portal dropdown ───────────────────────────────────────────────────────────
function PortalDropdown({ anchorRef, open, children, portalRef }) {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;

    function measure() {
      const rect = anchorRef.current.getBoundingClientRect();
      const maxHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const clampedHeight = Math.min(maxHeight, Math.max(spaceBelow, 120));
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: clampedHeight,
      });
    }

    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={portalRef}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        width: coords.width,
        background: "#1e1e1e",
        border: "1px solid #3a3a3a",
        borderRadius: 8,
        zIndex: 9999,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        overflow: "hidden",
        maxHeight: coords.maxHeight || 260,
        overflowY: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "#3a3a3a transparent",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

// ── MultiSelect dropdown ──────────────────────────────────────────────────────
function MultiSelect({ options, selected, onChange, placeholder, chipLabel, footer }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef();
  const containerRef = useRef();
  const portalRef = useRef();   // unique ref per instance — fixes shared-id bug

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (
        containerRef.current?.contains(e.target) ||
        portalRef.current?.contains(e.target)   // use ref instead of getElementById
      ) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(value) {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  }

  return (
    <div ref={containerRef} style={{ flex: 1 }}>
      <div
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 5,
          background: "#1e1e1e",
          border: `1px solid ${open ? "#555" : "#3a3a3a"}`,
          borderRadius: 6,
          padding: "5px 9px",
          cursor: "pointer",
          minHeight: 32,
        }}
      >
        {selected.length === 0 ? (
          <span style={{ fontSize: 12, color: "#555" }}>{placeholder}</span>
        ) : (
          selected.map((v) => (
            <span
              key={v}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "#2a2a2a",
                border: "1px solid #3a3a3a",
                borderRadius: 4,
                padding: "1px 6px",
                fontSize: 11,
                color: "#d0d0d0",
              }}
            >
              {chipLabel ? chipLabel(v) : v}
              <span
                onClick={(e) => { e.stopPropagation(); toggle(v); }}
                style={{ color: "#555", cursor: "pointer", fontSize: 10 }}
              >
                ✕
              </span>
            </span>
          ))
        )}
        <span style={{ marginLeft: "auto", color: "#444", fontSize: 10 }}>
          {open ? "▲" : "▼"}
        </span>
      </div>

      <PortalDropdown anchorRef={triggerRef} open={open} portalRef={portalRef}>
        <div>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => toggle(opt.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                cursor: "pointer",
                fontSize: 12,
                color: "#bbb",
                background: "transparent",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#252525")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: selected.includes(opt.value) ? "1.5px solid #0052cc" : "1.5px solid #5a5a5a",
                  background: selected.includes(opt.value) ? "#0052cc" : "#1e1e1e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 10,
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {selected.includes(opt.value) && "✓"}
              </div>
              {opt.render
                ? opt.render()
                : <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.label}</span>}
            </div>
          ))}
          {footer && (
            <>
              <div style={{ borderTop: "1px solid #2a2a2a" }} />
              {footer}
            </>
          )}
        </div>
      </PortalDropdown>
    </div>
  );
}

// ── Member avatars shown on the card cover ────────────────────────────────────
function MemberBadges({ memberIds, allMembers }) {
  if (!memberIds || memberIds.length === 0) return null;
  const visible = memberIds.slice(0, 3);
  const overflow = memberIds.length - visible.length;
  const MEMBER_COLORS = ["#0052cc", "#7e57c2", "#1a7a4a", "#e67e22", "#c0392b", "#e91e8c"];

  return (
    <div style={{ position: "absolute", bottom: 7, right: 8, display: "flex", zIndex: 1 }}>
      {visible.map((id, idx) => {
        const m = allMembers?.find((x) => x.id === id);
        const initials = m
          ? m.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
          : id.slice(0, 2).toUpperCase();
        const color = m?.avatarColor || MEMBER_COLORS[idx % MEMBER_COLORS.length];
        return (
          <div
            key={id}
            title={m?.fullName || id}
            style={{
              width: 22, height: 22, borderRadius: "50%", background: color,
              border: "2px solid rgba(0,0,0,0.4)", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 8, fontWeight: 700, color: "#fff",
              marginLeft: idx === 0 ? 0 : -6, flexShrink: 0,
            }}
          >
            {initials}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          style={{
            width: 22, height: 22, borderRadius: "50%", background: "#333",
            border: "2px solid rgba(0,0,0,0.4)", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 700, color: "#aaa", marginLeft: -6, flexShrink: 0,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

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
function ColorSwatchPicker({ selected, onChange, isPremium, onUpgradeClick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Solid colors */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 0 4px" }}>
        {COVER_COLORS.map(({ id, hex, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => onChange(id)}
            style={{
              width: 28, height: 28, borderRadius: 6, background: hex,
              border: selected === id ? "2px solid #fff" : "2px solid transparent",
              outline: selected === id ? `2px solid ${hex}` : "none",
              cursor: "pointer", padding: 0, transition: "transform 0.1s",
              transform: selected === id ? "scale(1.15)" : "scale(1)",
              position: "relative",
            }}
          >
            {selected === id && (
              <span style={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 13, fontWeight: 700,
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Gradients (premium) */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Gradients
          </span>
          {!isPremium && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#1a1a1a",
              background: "linear-gradient(135deg, #e6a817, #e67e22)",
              borderRadius: 4, padding: "2px 6px",
              letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              Premium
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {COVER_GRADIENTS.map(({ id, css, label }) => (
            <button
              key={id}
              title={isPremium ? label : `${label} — Premium feature`}
              onClick={() => {
                if (!isPremium) { onUpgradeClick?.(); return; }
                onChange(id);
              }}
              style={{
                width: 28, height: 28, borderRadius: 6, background: css,
                border: selected === id ? "2px solid #fff" : "2px solid transparent",
                outline: selected === id ? "2px solid #888" : "none",
                cursor: "pointer", padding: 0, transition: "transform 0.1s",
                transform: selected === id ? "scale(1.15)" : "scale(1)",
                position: "relative",
                opacity: isPremium ? 1 : 0.55,
              }}
            >
              {selected === id && isPremium && (
                <span style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                }}>✓</span>
              )}
              {!isPremium && (
                <span style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "#fff",
                  textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                }}>🔒</span>
              )}
            </button>
          ))}
        </div>
        {!isPremium && (
          <div
            onClick={onUpgradeClick}
            style={{
              marginTop: 6, fontSize: 11, color: "#29b6f6",
              cursor: "pointer", textDecoration: "underline", display: "inline-block",
            }}
          >
            Unlock gradient covers with Premium →
          </div>
        )}
      </div>
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
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            background: "#2e2e2e", border: "1px solid #3a3a3a", borderRadius: 6,
            padding: "6px 12px", color: "#ccc", fontSize: 12,
            fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          🖼 {imageUrl ? "Change image" : "Upload image"}
        </button>
        {imageUrl && (
          <button
            onClick={() => onImageChange(null)}
            style={{
              background: "none", border: "1px solid #3a3a3a", borderRadius: 6,
              padding: "6px 10px", color: "#888", fontSize: 12,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            }}
          >
            Remove
          </button>
        )}
      </div>
      {imageUrl && (
        <div style={{ width: "100%", height: 48, borderRadius: 6, overflow: "hidden", border: "1px solid #3a3a3a" }}>
          <img src={imageUrl} alt="Cover preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
    </div>
  );
}

// ── Card Config Modal ─────────────────────────────────────────────────────────
function CardConfigModal({ statType, statValue, lists, memberName, members, boardLabels, isPremium, computeFilteredCount, onSave, onBack, onClose, onUpgradeClick }) {
  const [cardName, setCardName] = useState(DEFAULT_NAMES[statType] || "");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [coverColor, setCoverColor] = useState(DEFAULT_COVER[statType] || "blue");
  const [coverImage, setCoverImage] = useState(null);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [selectedDue, setSelectedDue] = useState([]);
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [selectedLists, setSelectedLists] = useState([]);

  // ── Save-filters state ───────────────────────────────────────────────────
  const [savedFilters, setSavedFilters] = useState(null);
  const [filtersDirty, setFiltersDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // ── Dirty-aware setters ──────────────────────────────────────────────────
  function setDue(v)      { setSelectedDue(v);      setFiltersDirty(true); setJustSaved(false); }
  function setMembers(v)  { setSelectedMembers(v);   setFiltersDirty(true); setJustSaved(false); }
  function setLabels(v)   { setSelectedLabels(v);    setFiltersDirty(true); setJustSaved(false); }
  function setListsSel(v) { setSelectedLists(v);     setFiltersDirty(true); setJustSaved(false); }

  // ── Derived name ─────────────────────────────────────────────────────────
  const smartName = deriveSmartName(
    statType, selectedDue, selectedMembers, selectedLabels,
    selectedLists, memberName, boardLabels, lists, members
  );
  const previewName = nameManuallyEdited ? cardName : smartName;

  const resolvedCoverBg = coverImage ? null : resolveCoverBackground(coverColor);

  // Live filtered count
  const liveCount = computeFilteredCount
    ? computeFilteredCount(statType, {
        due: selectedDue,
        members: selectedMembers,
        labels: selectedLabels,
        lists: selectedLists,
        customDateFrom,
        customDateTo,
      })
    : statValue ?? 0;
  const emoji = STAT_EMOJIS[statType] || "📌";
  const primary = PRIMARY_FILTER[statType];

  // ── Member options ───────────────────────────────────────────────────────
  const memberOptions = (members && members.length > 0
    ? members
    : memberName
      ? [{ id: "me", fullName: memberName, avatarColor: "#0052cc" }]
      : []
  ).map((m) => ({
    value: m.id,
    label: m.fullName,
    render: () => {
      const initials = m.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            background: m.avatarColor || "#0052cc",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 12, color: "#ccc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {m.fullName}
          </span>
        </div>
      );
    },
  }));

  // ── Chip label renderers ─────────────────────────────────────────────────
  function dueChipLabel(v) {
    return DUE_OPTIONS.find((o) => o.value === v)?.label || v;
  }

  function memberChipLabel(id) {
    const m = (members || []).find((x) => x.id === id);
    if (m) return m.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    return id === "me"
      ? (memberName ? memberName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "ME")
      : id;
  }

  function labelChipLabel(id) {
    const lbl = (boardLabels || []).find((l) => l.id === id);
    const hex = TRELLO_LABEL_COLORS[lbl?.color] || "#888";
    const name = lbl?.name?.trim() || lbl?.color || id;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: hex, flexShrink: 0 }} />
        {name}
      </span>
    );
  }

  function listChipLabel(id) {
    return (lists || []).find((l) => l.id === id)?.name || id;
  }

  // ── Label options ────────────────────────────────────────────────────────
  const labelOptions = (boardLabels && boardLabels.length > 0 ? boardLabels : []).map((lbl) => {
    const hex = TRELLO_LABEL_COLORS[lbl.color] || "#888";
    const displayName = lbl.name?.trim() || lbl.color || "Unnamed label";
    return {
      value: lbl.id,
      label: displayName,
      render: () => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
          <span style={{ width: 28, height: 14, borderRadius: 3, background: hex, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: displayName === lbl.color ? "#888" : "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </span>
        </div>
      ),
    };
  });

  const listOptions = (lists || []).map((l) => ({ value: l.id, label: l.name }));

  // ── Custom date range footer ─────────────────────────────────────────────
  const dueDateFooter = selectedDue.includes("custom") ? (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 12px" }}>
      <input
        type="date" value={customDateFrom}
        onChange={(e) => setCustomDateFrom(e.target.value)}
        style={{ flex: 1, background: "#222", border: "1px solid #3a3a3a", borderRadius: 5, color: "#aaa", fontSize: 11, padding: "4px 6px", fontFamily: "inherit", outline: "none" }}
      />
      <span style={{ fontSize: 11, color: "#555", flexShrink: 0 }}>→</span>
      <input
        type="date" value={customDateTo}
        onChange={(e) => setCustomDateTo(e.target.value)}
        style={{ flex: 1, background: "#222", border: "1px solid #3a3a3a", borderRadius: 5, color: "#aaa", fontSize: 11, padding: "4px 6px", fontFamily: "inherit", outline: "none" }}
      />
    </div>
  ) : null;

  // ── Save filters handler ─────────────────────────────────────────────────
  function handleSaveFilters() {
    const snapshot = {
      due: selectedDue,
      members: selectedMembers,
      labels: selectedLabels,
      lists: selectedLists,
      customDateFrom,
      customDateTo,
    };
    setSavedFilters(snapshot);
    setFiltersDirty(false);
    setJustSaved(true);
    if (!nameManuallyEdited) {
      setCardName(smartName);
    }
    setTimeout(() => setJustSaved(false), 2000);
  }

  // ── Final save ───────────────────────────────────────────────────────────
  function handleSave() {
    const filters = savedFilters || {
      due: selectedDue, members: selectedMembers,
      labels: selectedLabels, lists: selectedLists,
      customDateFrom, customDateTo,
    };
    onSave(statType, {
      cardName: previewName,
      cover: coverColor,
      coverImage,
      ...filters,
    });
  }

  // ── Filter rows ──────────────────────────────────────────────────────────
  const DueFilter = (
    <FilterRow label="Due" icon="🕐" key="due">
      <MultiSelect
        options={DUE_OPTIONS}
        selected={selectedDue}
        onChange={setDue}
        placeholder="any"
        chipLabel={dueChipLabel}
        footer={dueDateFooter}
      />
    </FilterRow>
  );

  const AssignedFilter = (
    <FilterRow label="Assigned" icon="👤" key="assigned">
      <MultiSelect
        options={memberOptions}
        selected={selectedMembers}
        onChange={setMembers}
        placeholder="any member"
        chipLabel={memberChipLabel}
      />
    </FilterRow>
  );

  const LabelsFilter = (
    <FilterRow label="Labels" icon="🏷" key="labels">
      <MultiSelect
        options={labelOptions}
        selected={selectedLabels}
        onChange={setLabels}
        placeholder="any label"
        chipLabel={labelChipLabel}
      />
    </FilterRow>
  );

  const ListFilter = (
    <FilterRow label="List" icon="☰" key="list">
      <MultiSelect
        options={listOptions}
        selected={selectedLists}
        onChange={setListsSel}
        placeholder="any list"
        chipLabel={listChipLabel}
      />
    </FilterRow>
  );

  const BoardFilter = (
    <FilterRow label="Board" icon="⊞" key="board">
      <select className="list-dropdown" style={{ maxWidth: 160 }}>
        <option value="this">this board</option>
        <option value="any">any board</option>
      </select>
    </FilterRow>
  );

  const allFilters = { assigned: AssignedFilter, due: DueFilter, labels: LabelsFilter, list: ListFilter };
  const secondaryKeys = Object.keys(allFilters).filter((k) => k !== primary);
  const orderedFilters = [
    primary ? allFilters[primary] : null,
    BoardFilter,
    ...secondaryKeys.map((k) => allFilters[k]),
  ].filter(Boolean);

  const hasActiveFilters =
    selectedDue.length > 0 ||
    selectedMembers.length > 0 ||
    selectedLabels.length > 0 ||
    selectedLists.length > 0;

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
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "13px 16px", borderBottom: "1px solid #333", flexShrink: 0,
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
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>Dashcards — Track</span>
          </div>
          <button className="customize-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", overflow: "hidden", flex: 1, minHeight: 0 }}>
          {/* Left: card preview */}
          <div style={{
            width: 190, flexShrink: 0, padding: 14,
            borderRight: "1px solid #2e2e2e",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, overflow: "hidden" }}>
              {/* Cover */}
              <div style={{
                background: coverImage ? "transparent" : resolvedCoverBg,
                height: 78, display: "flex", alignItems: "flex-end",
                padding: "8px 10px", position: "relative", overflow: "hidden",
              }}>
                {coverImage && (
                  <img src={coverImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                    {liveCount}
                  </div>
                </div>
                <div style={{ position: "absolute", top: 8, right: 8, fontSize: 18, zIndex: 1 }}>
                  {emoji}
                </div>
                <MemberBadges memberIds={selectedMembers} allMembers={members} />
              </div>
              {/* Card name in preview */}
              <div style={{ padding: "8px 10px" }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "#ccc",
                  lineHeight: 1.35,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {previewName}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#555", textAlign: "center" }}>Preview</div>

            {/* Active filters summary */}
            <ActiveFiltersSummary
              due={selectedDue}
              members={selectedMembers}
              labels={selectedLabels}
              lists={selectedLists}
              dueChipLabel={dueChipLabel}
              memberChipLabel={memberChipLabel}
              labelChipLabel={labelChipLabel}
              listChipLabel={listChipLabel}
            />

            {/* Saved badge */}
            {savedFilters && !filtersDirty && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 10px",
                background: "#1a2a1a",
                border: "1px solid #2a4a2a",
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 13 }}>✅</span>
                <span style={{ fontSize: 11, color: "#5a9a5a" }}>Filters saved</span>
              </div>
            )}
          </div>

          {/* Right: form (scrollable) */}
          <div style={{
            flex: 1, padding: 14, overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            {/* Name */}
            <div>
              <SectionLabel>Name</SectionLabel>
              <input
                type="text"
                value={nameManuallyEdited ? cardName : smartName}
                onChange={(e) => {
                  setCardName(e.target.value);
                  setNameManuallyEdited(true);
                }}
                placeholder={DEFAULT_NAMES[statType]}
                style={{
                  width: "100%", background: "#1e1e1e",
                  border: "1px solid #3a3a3a", borderRadius: 6,
                  padding: "7px 10px", color: "#e0e0e0", fontSize: 12,
                  fontFamily: "'DM Sans', sans-serif", outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#555")}
                onBlur={(e) => (e.target.style.borderColor = "#3a3a3a")}
              />
              {!nameManuallyEdited && hasActiveFilters && (
                <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                  Auto-generated from filters —{" "}
                  <span
                    style={{ color: "#29b6f6", cursor: "pointer" }}
                    onClick={() => { setCardName(smartName); setNameManuallyEdited(true); }}
                  >
                    edit
                  </span>
                </div>
              )}
            </div>

            <Divider />

            {/* Cover color */}
            <div>
              <SectionLabel>Cover color</SectionLabel>
              <ColorSwatchPicker
                selected={coverImage ? null : coverColor}
                onChange={(id) => { setCoverColor(id); setCoverImage(null); }}
                isPremium={isPremium}
                onUpgradeClick={onUpgradeClick}
              />
            </div>

            {/* Cover image */}
            <div>
              <SectionLabel>
                Cover image{" "}
                <span style={{ color: "#555", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  (optional — overrides color)
                </span>
              </SectionLabel>
              <ImageUpload imageUrl={coverImage} onImageChange={setCoverImage} />
            </div>

            <Divider />

            <div>
              <SectionLabel>Filters</SectionLabel>
            </div>

            {orderedFilters}

            {/* ── Save filters button ── */}
            {hasActiveFilters && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
                <button
                  onClick={handleSaveFilters}
                  style={{
                    background: justSaved
                      ? "#1a3a1a"
                      : filtersDirty
                        ? "#0052cc"
                        : "#1e2e1e",
                    border: `1px solid ${justSaved ? "#2a5a2a" : filtersDirty ? "#0052cc" : "#2a4a2a"}`,
                    borderRadius: 6,
                    padding: "7px 14px",
                    color: justSaved ? "#5a9a5a" : filtersDirty ? "#fff" : "#5a7a5a",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: filtersDirty ? "pointer" : "default",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {justSaved ? "✓ Saved!" : filtersDirty ? "Save filters" : "✓ Filters saved"}
                </button>
                {filtersDirty && (
                  <span style={{ fontSize: 11, color: "#666" }}>
                    Save to update the card count
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 10,
          padding: "12px 16px", borderTop: "1px solid #2e2e2e", flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid #3a3a3a", borderRadius: 6,
              padding: "7px 18px", color: "#aaa", fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: "#0052cc", border: "none", borderRadius: 6,
              padding: "7px 18px", color: "#fff", fontSize: 13, fontWeight: 600,
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
      letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #2e2e2e" }} />;
}

// ── Active filters summary ────────────────────────────────────────────────────
function ActiveFiltersSummary({ due, members, labels, lists, dueChipLabel, memberChipLabel, labelChipLabel, listChipLabel }) {
  const groups = [
    { key: "due",     icon: "🕐", values: due,     render: (v) => dueChipLabel(v) },
    { key: "members", icon: "👤", values: members,  render: (v) => memberChipLabel(v) },
    { key: "labels",  icon: "🏷", values: labels,   render: (v) => labelChipLabel(v) },
    { key: "lists",   icon: "☰", values: lists,    render: (v) => listChipLabel(v) },
  ].filter((g) => g.values && g.values.length > 0);

  if (groups.length === 0) return null;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      padding: "10px 10px", background: "#1a1a1a",
      border: "1px solid #2e2e2e", borderRadius: 8,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: "#666",
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2,
      }}>
        Active filters
      </div>
      {groups.map((g) => (
        <div key={g.key} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span style={{ fontSize: 11, flexShrink: 0, lineHeight: "20px" }}>{g.icon}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1, minWidth: 0 }}>
            {g.values.map((v) => (
              <span
                key={v}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "#252525", border: "1px solid #3a3a3a",
                  borderRadius: 4, padding: "2px 7px", fontSize: 11, color: "#ccc",
                  lineHeight: "16px", maxWidth: "100%",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {g.render(v)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterRow({ label, icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        width: 76, flexShrink: 0, fontSize: 12, color: "#777", paddingTop: 7,
      }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>{children}</div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function CustomizeFlow({
  show,
  lists,
  stats,
  memberName,
  members,
  boardLabels,
  customizeStat,
  setCustomizeStat,
  onSave,
  onClose,
  isPremium,
  onUpgradeClick,
  computeFilteredCount,
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
      members={members}
      boardLabels={boardLabels}
      isPremium={isPremium}
      computeFilteredCount={computeFilteredCount}
      onSave={onSave}
      onBack={() => setCustomizeStat(null)}
      onClose={onClose}
      onUpgradeClick={onUpgradeClick}
    />
  );
}