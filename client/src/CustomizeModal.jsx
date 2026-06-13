import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// ── Cover color palette ───────────────────────────────────────────────────────
const COVER_COLORS = [
  { id: "blue", hex: "#0052cc", label: "Blue" },
  { id: "sky", hex: "#29b6f6", label: "Sky" },
  { id: "green", hex: "#1a7a4a", label: "Green" },
  { id: "yellow", hex: "#e6a817", label: "Yellow" },
  { id: "orange", hex: "#e67e22", label: "Orange" },
  { id: "red", hex: "#c0392b", label: "Red" },
  { id: "purple", hex: "#7e57c2", label: "Purple" },
  { id: "pink", hex: "#e91e8c", label: "Pink" },
  { id: "black", hex: "#374151", label: "Slate" },
];

// Trello's label color name → display hex
// Used as fallback when a board label has a color but no custom name.
const TRELLO_LABEL_COLORS = {
  red: "#c0392b",
  orange: "#e67e22",
  yellow: "#e6a817",
  green: "#1a7a4a",
  blue: "#0052cc",
  purple: "#7e57c2",
  pink: "#e91e8c",
  sky: "#29b6f6",
  lime: "#51e898",
  black: "#374151",
  null: "#888888", // labels with no color
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
};

const DEFAULT_COVER = {
  assigned: "blue",
  dueThisWeek: "yellow",
  overdue: "red",
  unassigned: "purple",
  withLabel: "orange",
  stale: "black",
  createdToday: "green",
  cardsInList: "sky",
};

const DEFAULT_NAMES = {
  assigned: "Assigned to me on all Workspace boards",
  dueThisWeek: "Due this week",
  overdue: "Overdue cards",
  unassigned: "Unassigned cards",
  withLabel: "Cards with a label",
  stale: "Stale cards (14+ days)",
  createdToday: "Created today",
  cardsInList: "Cards in list",
};

const STAT_LIST = [
  { type: "assigned", label: "Assigned to Me", emoji: "📌" },
  { type: "dueThisWeek", label: "Due This Week", emoji: "📅" },
  { type: "overdue", label: "Overdue Cards", emoji: "⚠️" },
  { type: "unassigned", label: "Unassigned Cards", emoji: "👤" },
  { type: "withLabel", label: "Cards With Label", emoji: "🏷️" },
  { type: "stale", label: "Stale Cards", emoji: "💤" },
  { type: "createdToday", label: "Created Today", emoji: "✨" },
  { type: "cardsInList", label: "Cards in List", emoji: "📋" },
];

const DUE_OPTIONS = [
  { value: "2days", label: "Due in 2 days" },
  { value: "1week", label: "Due in 1 week" },
  { value: "2weeks", label: "Due in 2 weeks" },
  { value: "1month", label: "Due in 1 month" },
  { value: "overdue", label: "Overdue" },
  { value: "nodate", label: "No due date" },
  { value: "custom", label: "Custom range…" },
];

// LABEL_OPTIONS is now built dynamically from the `boardLabels` prop.
// Shape expected: [{ id, name, color }]  — same as Trello REST /boards/:id/labels

// Which filter is shown first for each stat type
const PRIMARY_FILTER = {
  assigned: "assigned",
  dueThisWeek: "due",
  overdue: "due",
  unassigned: "assigned",
  withLabel: "labels",
  stale: "activity",
  createdToday: "activity",
  cardsInList: "list",
};

// ── MultiSelect dropdown ──────────────────────────────────────────────────────
// Generic multi-select with checkbox options.
// Props:
//   options: [{ value, label, render? }]  — render() overrides label for the row
//   selected: string[]
//   onChange: (newSelected: string[]) => void
//   placeholder: string
//   chipLabel: (value) => string | ReactNode   — label shown inside a chip
//   footer?: ReactNode                         — extra content below options (e.g. date pickers)
function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  chipLabel,
  footer,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const triggerRef = useRef();
  const dropdownRef = useRef();  // FIX #2: ref on the portal node
  const [dropdownStyle, setDropdownStyle] = useState({});

  // FIX #2: include dropdownRef in the outside-click check
  useEffect(() => {
    function handleClick(e) {
      if (
        ref.current && !ref.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // FIX #1 + #3: recalc on scroll/resize too, and flip upward if near bottom
  useEffect(() => {
    function calcPosition() {
      if (!open || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = 200;
      const spaceBelow = window.innerHeight - rect.bottom;

      setDropdownStyle({
        position: "fixed",
        top: spaceBelow > dropdownHeight
          ? rect.bottom + 6
          : rect.top - dropdownHeight - 6,  // flip upward
        left: rect.left,
        width: Math.max(rect.width, 180),
        zIndex: 9999,
      });
    }

    calcPosition();
    window.addEventListener("scroll", calcPosition, true);
    window.addEventListener("resize", calcPosition);
    return () => {
      window.removeEventListener("scroll", calcPosition, true);
      window.removeEventListener("resize", calcPosition);
    };
  }, [open]);

  function toggle(value) {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  }

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      {/* Trigger */}
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
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(v);
                }}
                style={{ color: "#555", cursor: "pointer", fontSize: 10 }}
              >
                ✕
              </span>
            </span>
          ))
        )}
        <span style={{ marginLeft: "auto", color: "#444", fontSize: 10 }}>
          ▼
        </span>
      </div>

      {/* Dropdown — rendered in a portal to escape overflow:hidden */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}  // FIX #2: attach ref here
            style={{
              ...dropdownStyle,
              background: "#1a1a1a",
              border: "1px solid #3a3a3a",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              overflow: "hidden",
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {options.map((opt) => (
              <div
                key={opt.value}
                onClick={() => toggle(opt.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#bbb",
                  background: "transparent",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#252525")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 3,
                    border: selected.includes(opt.value)
                      ? "1.5px solid #0052cc"
                      : "1.5px solid #444",
                    background: selected.includes(opt.value)
                      ? "#0052cc"
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 9,
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {selected.includes(opt.value) && "✓"}
                </div>
                {opt.render ? opt.render() : <span>{opt.label}</span>}
              </div>
            ))}
            {footer && (
              <>
                <div style={{ borderTop: "1px solid #2a2a2a" }} />
                {footer}
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

// ── Member avatars shown on the card cover ────────────────────────────────────
// Shows up to 3 stacked circles, then a +N badge.
function MemberBadges({ memberIds, allMembers }) {
  if (!memberIds || memberIds.length === 0) return null;
  const visible = memberIds.slice(0, 3);
  const overflow = memberIds.length - visible.length;
  const MEMBER_COLORS = [
    "#0052cc",
    "#7e57c2",
    "#1a7a4a",
    "#e67e22",
    "#c0392b",
    "#e91e8c",
  ];

  return (
    <div
      style={{
        position: "absolute",
        bottom: 7,
        right: 8,
        display: "flex",
        zIndex: 1,
      }}
    >
      {visible.map((id, idx) => {
        const m = allMembers?.find((x) => x.id === id);
        const initials = m
          ? m.fullName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          : id.slice(0, 2).toUpperCase();
        const color =
          m?.avatarColor || MEMBER_COLORS[idx % MEMBER_COLORS.length];
        return (
          <div
            key={id}
            title={m?.fullName || id}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: color,
              border: "2px solid rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              fontWeight: 700,
              color: "#fff",
              marginLeft: idx === 0 ? 0 : -6,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#333",
            border: "2px solid rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            fontWeight: 700,
            color: "#aaa",
            marginLeft: -6,
            flexShrink: 0,
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
          <button className="customize-close" onClick={onClose}>
            ✕
          </button>
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
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "10px 0 4px",
      }}
    >
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
            border:
              selected === id ? "2px solid #fff" : "2px solid transparent",
            outline: selected === id ? `2px solid ${hex}` : "none",
            cursor: "pointer",
            padding: 0,
            transition: "transform 0.1s",
            transform: selected === id ? "scale(1.15)" : "scale(1)",
            position: "relative",
          }}
        >
          {selected === id && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              ✓
            </span>
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
        <div
          style={{
            width: "100%",
            height: 48,
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid #3a3a3a",
          }}
        >
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
function CardConfigModal({
  statType,
  statValue,
  lists,
  memberName,
  members,
  boardLabels,
  onSave,
  onBack,
  onClose,
}) {
  const [cardName, setCardName] = useState(DEFAULT_NAMES[statType] || "");
  const [coverColor, setCoverColor] = useState(
    DEFAULT_COVER[statType] || "blue",
  );
  const [coverImage, setCoverImage] = useState(null);

  // ── Multi-select filter state (all arrays now) ───────────────────────────
  const [selectedDue, setSelectedDue] = useState([]); // e.g. ["1week", "overdue"]
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]); // member ids
  const [selectedLabels, setSelectedLabels] = useState([]); // color names
  const [selectedLists, setSelectedLists] = useState([]); // list ids

  const resolvedCoverHex = coverImage
    ? null
    : COVER_COLORS.find((c) => c.id === coverColor)?.hex || "#0052cc";

  const emoji = STAT_EMOJIS[statType] || "📌";
  const primary = PRIMARY_FILTER[statType];

  // ── Build member options from prop (falls back to memberName if no list) ──
  const memberOptions = (
    members && members.length > 0
      ? members
      : memberName
        ? [{ id: "me", fullName: memberName, avatarColor: "#0052cc" }]
        : []
  ).map((m) => ({
    value: m.id,
    label: m.fullName,
    render: () => {
      const initials = m.fullName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      return (
        <>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: m.avatarColor || "#0052cc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <span>{m.fullName}</span>
        </>
      );
    },
  }));

  // ── Chip label renderers ─────────────────────────────────────────────────
  function dueChipLabel(v) {
    return DUE_OPTIONS.find((o) => o.value === v)?.label || v;
  }

  function memberChipLabel(id) {
    const m = (members || []).find((x) => x.id === id);
    if (m) {
      return m.fullName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return id === "me"
      ? memberName
        ? memberName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "ME"
      : id;
  }

  function labelChipLabel(id) {
    const lbl = (boardLabels || []).find((l) => l.id === id);
    const hex = TRELLO_LABEL_COLORS[lbl?.color] || "#888";
    const name = lbl?.name?.trim() || lbl?.color || id;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: hex,
            flexShrink: 0,
          }}
        />
        {name}
      </span>
    );
  }

  function listChipLabel(id) {
    return (lists || []).find((l) => l.id === id)?.name || id;
  }

  // ── Label options built from real board labels ────────────────────────────
  // boardLabels shape: [{ id, name, color }]  (Trello REST response)
  // Falls back to a "no labels on this board" placeholder if empty.
  const labelOptions = (
    boardLabels && boardLabels.length > 0 ? boardLabels : []
  ).map((lbl) => {
    const hex = TRELLO_LABEL_COLORS[lbl.color] || "#888";
    const displayName = lbl.name?.trim() || lbl.color || "Unnamed label";
    return {
      value: lbl.id,
      label: displayName,
      render: () => (
        <>
          <span
            style={{
              width: 28,
              height: 14,
              borderRadius: 3,
              background: hex,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span style={{ color: displayName === lbl.color ? "#888" : "#ccc" }}>
            {displayName}
          </span>
        </>
      ),
    };
  });

  const listOptions = (lists || []).map((l) => ({
    value: l.id,
    label: l.name,
  }));

  // ── Custom date range footer shown when "custom" is selected ─────────────
  const dueDateFooter = selectedDue.includes("custom") ? (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        padding: "8px 12px",
      }}
    >
      <input
        type="date"
        value={customDateFrom}
        onChange={(e) => setCustomDateFrom(e.target.value)}
        style={{
          flex: 1,
          background: "#222",
          border: "1px solid #3a3a3a",
          borderRadius: 5,
          color: "#aaa",
          fontSize: 11,
          padding: "4px 6px",
          fontFamily: "inherit",
          outline: "none",
        }}
      />
      <span style={{ fontSize: 11, color: "#555", flexShrink: 0 }}>→</span>
      <input
        type="date"
        value={customDateTo}
        onChange={(e) => setCustomDateTo(e.target.value)}
        style={{
          flex: 1,
          background: "#222",
          border: "1px solid #3a3a3a",
          borderRadius: 5,
          color: "#aaa",
          fontSize: 11,
          padding: "4px 6px",
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </div>
  ) : null;

  function handleSave() {
    onSave(statType, {
      cardName,
      cover: coverColor,
      coverImage,
      due: selectedDue,
      customDateFrom,
      customDateTo,
      members: selectedMembers,
      labels: selectedLabels,
      lists: selectedLists,
    });
  }

  // ── Filter rows ──────────────────────────────────────────────────────────
  const DueFilter = (
    <FilterRow label="Due" icon="🕐" key="due">
      <MultiSelect
        options={DUE_OPTIONS}
        selected={selectedDue}
        onChange={setSelectedDue}
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
        onChange={setSelectedMembers}
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
        onChange={setSelectedLabels}
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
        onChange={setSelectedLists}
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

  // Ordered: primary filter first, board second, rest below
  const allFilters = {
    assigned: AssignedFilter,
    due: DueFilter,
    labels: LabelsFilter,
    list: ListFilter,
  };
  const secondaryKeys = Object.keys(allFilters).filter((k) => k !== primary);
  const orderedFilters = [
    primary ? allFilters[primary] : null,
    BoardFilter,
    ...secondaryKeys.map((k) => allFilters[k]),
  ].filter(Boolean);

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "13px 16px",
            borderBottom: "1px solid #333",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={onBack}
              style={{
                background: "none",
                border: "none",
                color: "#888",
                fontSize: 18,
                cursor: "pointer",
                padding: "0 4px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ‹
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>
              Dashcards — Track
            </span>
          </div>
          <button className="customize-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{ display: "flex", overflow: "hidden", flex: 1, minHeight: 0 }}
        >
          {/* Left: card preview */}
          <div
            style={{
              width: 190,
              flexShrink: 0,
              padding: 14,
              borderRight: "1px solid #2e2e2e",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {/* Cover with member badges */}
              <div
                style={{
                  background: coverImage ? "transparent" : resolvedCoverHex,
                  height: 78,
                  display: "flex",
                  alignItems: "flex-end",
                  padding: "8px 10px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {coverImage && (
                  <img
                    src={coverImage}
                    alt=""
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.25)",
                  }}
                />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: "#fff",
                      lineHeight: 1,
                    }}
                  >
                    {statValue ?? 0}
                  </div>
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    fontSize: 18,
                    zIndex: 1,
                  }}
                >
                  {emoji}
                </div>
                {/* ── Member badges on card cover (change 4) ── */}
                <MemberBadges
                  memberIds={selectedMembers}
                  allMembers={members}
                />
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#ccc",
                    lineHeight: 1.35,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {cardName || DEFAULT_NAMES[statType]}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#555", textAlign: "center" }}>
              Preview
            </div>
          </div>

          {/* Right: form (scrollable) */}
          <div
            style={{
              flex: 1,
              padding: 14,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
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
                onBlur={(e) => (e.target.style.borderColor = "#3a3a3a")}
              />
            </div>

            <Divider />

            {/* Cover color */}
            <div>
              <SectionLabel>Cover color</SectionLabel>
              <ColorSwatchPicker
                selected={coverImage ? null : coverColor}
                onChange={(id) => {
                  setCoverColor(id);
                  setCoverImage(null);
                }}
              />
            </div>

            {/* Cover image */}
            <div>
              <SectionLabel>
                Cover image{" "}
                <span
                  style={{
                    color: "#555",
                    fontWeight: 400,
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  (optional — overrides color)
                </span>
              </SectionLabel>
              <ImageUpload
                imageUrl={coverImage}
                onImageChange={setCoverImage}
              />
            </div>

            <Divider />

            <div>
              <SectionLabel>Filters</SectionLabel>
            </div>

            {orderedFilters}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "12px 16px",
            borderTop: "1px solid #2e2e2e",
            flexShrink: 0,
          }}
        >
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

// ── Small helpers ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "#666",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #2e2e2e" }} />;
}

function FilterRow({ label, icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: 76,
          flexShrink: 0,
          fontSize: 12,
          color: "#777",
          paddingTop: 7,
        }}
      >
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
  members, // [{ id, fullName, avatarColor }]
  boardLabels, // [{ id, name, color }]  — fetch via t.board("get", "labels")
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
      members={members}
      boardLabels={boardLabels}
      onSave={onSave}
      onBack={() => setCustomizeStat(null)}
      onClose={onClose}
    />
  );
}
