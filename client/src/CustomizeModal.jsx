import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// ── Theme tokens ──────────────────────────────────────────────────────────────
const T = {
  bg: "#161b22",
  bgDeep: "#0d1117",
  bgItem: "#21262d",
  bgSection: "#1c2128",
  surface: "#161b22",
  border: "#30363d",
  borderLight: "#21262d",
  text: "#e6edf3",
  textSub: "#c9d1d9",
  textMuted: "#8b949e",
  accent: "#4c8fff",
  accentHover: "#6aa3ff",
  accentDim: "rgba(76,143,255,0.15)",
  pillBg: "#21262d",
  pillBorder: "#30363d",
  pillText: "#79c0ff",
  pillVal: "#cae8ff",
  danger: "#f85149",
  success: "#3fb950",
  successDim: "rgba(63,185,80,0.15)",
  warning: "#d29922",
  sectionNum: "#79c0ff",
};

// ── SVG icon set for filter grid (clean line icons) ──────────────────────────
const FilterIcons = {
  assignedTo: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8v1H4v-1z" />
    </svg>
  ),
  dueDate: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 4h-1V3a1 1 0 1 0-2 0v1H8V3a1 1 0 1 0-2 0v1H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM5 10h14v9H5v-9z" />
    </svg>
  ),
  label: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .53.21 1.04.59 1.41l9 9c.78.78 2.05.78 2.83 0l7-7c.78-.79.78-2.05-.01-2.83zM6.5 8A1.5 1.5 0 1 1 6.5 5a1.5 1.5 0 0 1 0 3z" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="5" width="3" height="3" rx="0.5" />
      <rect x="3" y="10.5" width="3" height="3" rx="0.5" />
      <rect x="3" y="16" width="3" height="3" rx="0.5" />
      <rect x="9" y="5.5" width="12" height="2" rx="1" />
      <rect x="9" y="11" width="12" height="2" rx="1" />
      <rect x="9" y="16.5" width="12" height="2" rx="1" />
    </svg>
  ),
  status: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8 12.5l2.8 2.8L16.5 9" />
    </svg>
  ),
  cardActivity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </svg>
  ),
  createdDate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
};

// ── Cover palette ─────────────────────────────────────────────────────────────
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

const COVER_GRADIENTS = [
  { id: "grad-blue-sky", css: "linear-gradient(135deg,#0052cc,#29b6f6)", label: "Blue → Sky" },
  { id: "grad-green-sky", css: "linear-gradient(135deg,#1a7a4a,#29b6f6)", label: "Green → Sky" },
  { id: "grad-orange-pink", css: "linear-gradient(135deg,#e67e22,#e91e8c)", label: "Orange → Pink" },
  { id: "grad-purple-pink", css: "linear-gradient(135deg,#7e57c2,#e91e8c)", label: "Purple → Pink" },
  { id: "grad-yellow-orange", css: "linear-gradient(135deg,#e6a817,#e67e22)", label: "Yellow → Orange" },
  { id: "grad-red-purple", css: "linear-gradient(135deg,#c0392b,#7e57c2)", label: "Red → Purple" },
  { id: "grad-slate-blue", css: "linear-gradient(135deg,#374151,#0052cc)", label: "Slate → Blue" },
  { id: "grad-multi", css: "linear-gradient(135deg,#0052cc,#7e57c2,#e91e8c)", label: "Blue → Purple → Pink" },
  { id: "grad-violet", css: "linear-gradient(135deg,#a78bfa,#6d28d9)", label: "Violet" },
  { id: "grad-indigo", css: "linear-gradient(135deg,#6366f1,#3730a3)", label: "Indigo" },
  { id: "grad-crimson", css: "linear-gradient(135deg,#ef4444,#7f1d1d)", label: "Crimson" },
  { id: "grad-amethyst", css: "linear-gradient(135deg,#a78bfa,#5b21b6)", label: "Amethyst" },
  { id: "grad-deep-purple", css: "linear-gradient(135deg,#7c3aed,#4338ca)", label: "Deep Purple" },
  { id: "grad-navy", css: "linear-gradient(135deg,#4f63d2,#1e3a8a)", label: "Navy" },
];

function resolveCoverBackground(id, customHex) {
  if (id === "custom" && customHex) return customHex;
  const g = COVER_GRADIENTS.find((x) => x.id === id);
  if (g) return g.css;
  return COVER_COLORS.find((x) => x.id === id)?.hex || "#0052cc";
}

// ── Text color options ────────────────────────────────────────────────────────
const TEXT_COLORS = [
  { id: "white", hex: "#FFFFFF", label: "White" },
  { id: "light", hex: "#E5E7EB", label: "Light" },
  { id: "muted", hex: "#9CA3AF", label: "Muted" },
  { id: "dark", hex: "#374151", label: "Dark" },
  { id: "blue", hex: "#3B82F6", label: "Blue" },
  { id: "green", hex: "#10B981", label: "Green" },
  { id: "yellow", hex: "#FBBF24", label: "Yellow" },
  {
    id: "gradient",
    css: "linear-gradient(90deg,#F472B6,#818CF8)",
    label: "Gradient",
  },
];

// ── Layout options ────────────────────────────────────────────────────────────
const LAYOUTS = [
  { id: "center", label: "Center" },
  { id: "bottomLeft", label: "Bottom Left" },
  { id: "bottomRight", label: "Bottom Right" },
  { id: "topBottom", label: "Top & Bottom" },
];

// ── Constants ─────────────────────────────────────────────────────────────────
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
  null: "#888888",
};

const STAT_EMOJIS = {
  assigned: "📌",
  dueThisWeek: "📅",
  overdue: "⚠️",
  unassigned: "👤",
  withLabel: "🏷️",
  stale: "💤",
  createdToday: "✨",
  custom: "🛠️",
};
const DEFAULT_COVER = {
  assigned: "blue",
  unassigned: "grad-violet",
  createdToday: "grad-indigo",
  overdue: "grad-crimson",
  stale: "grad-amethyst",
  dueThisWeek: "grad-deep-purple",
  withLabel: "grad-navy",
};
const DEFAULT_NAMES = {
  assigned: "Assigned to Me",
  dueThisWeek: "Due This Week",
  overdue: "Overdue Cards",
  unassigned: "Unassigned Cards",
  withLabel: "Cards With Label",
  stale: "Stale Cards",
  createdToday: "Created Today",
  custom: "Custom Card",
};

const STAT_LIST = [
  { type: "assigned", label: "Assigned to Me", emoji: "📌" },
  { type: "dueThisWeek", label: "Due This Week", emoji: "📅" },
  { type: "overdue", label: "Overdue Cards", emoji: "⚠️" },
  { type: "unassigned", label: "Unassigned Cards", emoji: "👤" },
  { type: "withLabel", label: "Cards With Label", emoji: "🏷️" },
  { type: "stale", label: "Stale Cards", emoji: "💤" },
  { type: "createdToday", label: "Created Today", emoji: "✨" },
];

const DUE_OPTIONS = [
  { value: "thisWeek", label: "Due this week" },
  { value: "2weeks", label: "Due in 2 weeks" },
  { value: "1month", label: "Due in 1 month" },
  { value: "overdue", label: "Overdue" },
  { value: "nodate", label: "No due date" },
  { value: "custom", label: "Custom range…" },
];

const CREATED_DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7days", label: "Last 7 days" },
  { value: "30days", label: "Last 30 days" },
];

const CARD_ACTIVITY_OPTIONS = [
  { value: "1day", label: "Active within 1 day" },
  { value: "3days", label: "Active within 3 days" },
  { value: "7days", label: "Active within 7 days" },
  { value: "14days", label: "Active within 14 days" },
  { value: "30days", label: "Active within 30 days" },
  { value: "stale14", label: "Stale — 14+ days" },
  { value: "stale30", label: "Stale — 30+ days" },
];

const FILTER_GRID_ITEMS = [
  {
    key: "assignedTo",
    iconKey: "assignedTo",
    label: "Assigned To",
    sub: "Filter by card assignee",
    color: "#7e57c2",
  },
  {
    key: "dueDate",
    iconKey: "dueDate",
    label: "Due Date",
    sub: "Filter by due dates",
    color: "#1565c0",
  },
  {
    key: "label",
    iconKey: "label",
    label: "Label",
    sub: "Filter by labels",
    color: "#e6a817",
  },
  {
    key: "list",
    iconKey: "list",
    label: "List",
    sub: "Filter by lists",
    color: "#4c8fff",
  },
  {
    key: "status",
    iconKey: "status",
    label: "Status",
    sub: "Filter by card status",
    color: "#3fb950",
  },
  {
    key: "cardActivity",
    iconKey: "cardActivity",
    label: "Card Activity",
    sub: "Filter by activity dates",
    color: "#8b949e",
  },
  {
    key: "createdDate",
    iconKey: "createdDate",
    label: "Created Date",
    sub: "Filter by card creation date",
    color: "#2ec4b6",
  },
];

const FILTER_DEFS = {
  assignedTo: { icon: "👤", label: "Assigned To", valueKey: "members" },
  dueDate: { icon: "📅", label: "Due Date", valueKey: "due" },
  label: { icon: "🏷", label: "Label", valueKey: "labels" },
  list: { icon: "☰", label: "List", valueKey: "lists" },
  status: { icon: "✅", label: "Status", valueKey: "status" },
  cardActivity: { icon: "🕐", label: "Card Activity", valueKey: "activity" },
  createdDate: { icon: "✨", label: "Created Date", valueKey: "createdDate" },
};

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function SectionNumber({ n }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: 4,
        background: T.accentDim,
        color: T.sectionNum,
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {n}
    </span>
  );
}

function SectionHeader({ number, title, style }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
        ...style,
      }}
    >
      <SectionNumber n={number} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: T.textMuted,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div style={{ borderTop: `1px solid ${T.borderLight}`, margin: "0" }} />
  );
}

function SectionLabel({ n, title }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: T.text,
          letterSpacing: "0.01em",
        }}
      >
        {n}. {title.toUpperCase()}
      </span>
    </div>
  );
}

function SectionSub({ children }) {
  return (
    <p
      style={{
        fontSize: 12,
        color: T.textMuted,
        margin: "0 0 14px",
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  );
}

function StyleDivider() {
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, margin: "20px 0" }} />
  );
}

// ── Live results banner (between tab content and footer) ──────────────────────
function LiveResultsSection({ liveCount, collapsed, onToggle }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "6px 20px" : "9px 20px",
        borderTop: `1px solid ${T.border}`,
        background: T.bg,
        flexShrink: 0,
        transition: "padding 0.15s",
      }}
    >
      <button
        onClick={onToggle}
        title={collapsed ? "Show live results" : "Hide live results"}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: T.textMuted,
          fontSize: 11,
          padding: 2,
          display: "flex",
          alignItems: "center",
          transition: "color 0.15s, transform 0.15s",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = T.accent)}
        onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}
      >
        ▾
      </button>
      {collapsed ? (
        <span style={{ fontSize: 11, color: T.textMuted }}>
          Live results:{" "}
          <strong style={{ color: T.success }}>{liveCount} match</strong>
        </span>
      ) : (
        <>
          <span style={{ fontSize: 12, color: T.textMuted }}>
            Live results:
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: T.success,
              background: T.successDim,
              borderRadius: 6,
              padding: "2px 10px",
            }}
          >
            {liveCount} cards match
          </span>
          <span style={{ fontSize: 11, color: T.textMuted }}>
            based on current filters and scope
          </span>
        </>
      )}
    </div>
  );
}

// ── Portal dropdown ───────────────────────────────────────────────────────────
function PortalDropdown({ anchorRef, open, children, portalRef }) {
  const [coords, setCoords] = useState(null);
  useEffect(() => {
    if (!anchorRef.current) return;
    function measure() {
      const r = anchorRef.current.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const spaceAbove = r.top - 8;
      const maxH = 280;
      const up = spaceBelow < 140 && spaceAbove > spaceBelow;
      if (up) {
        const h = Math.min(maxH, Math.max(spaceAbove, 80));
        setCoords({
          top: r.top + scrollY - h - 4,
          left: r.left + scrollX,
          width: Math.max(r.width, 220),
          maxHeight: h,
          up: true,
        });
      } else {
        const h = Math.min(maxH, Math.max(spaceBelow, 80));
        setCoords({
          top: r.bottom + scrollY + 4,
          left: r.left + scrollX,
          width: Math.max(r.width, 220),
          maxHeight: h,
          up: false,
        });
      }
    }
    measure();
    if (!open) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, anchorRef]);
  if (!open || !coords) return null;
  return createPortal(
    <div
      ref={portalRef}
      style={{
        position: "absolute",
        top: coords.top,
        left: coords.left,
        width: coords.width,
        background: T.bgDeep,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        zIndex: 2147483647,
        boxShadow: coords.up
          ? "0 -6px 24px rgba(0,0,0,0.8)"
          : "0 6px 24px rgba(0,0,0,0.8)",
        overflow: "visible",
        maxHeight: coords.maxHeight,
        overflowY: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: `${T.border} transparent`,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

function DropdownItem({ children, checked, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 14px",
        cursor: "pointer",
        fontSize: 13,
        color: hover ? T.text : T.textSub,
        background: hover ? T.bgItem : "transparent",
        transition: "background 0.1s",
      }}
    >
      {checked !== undefined && (
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            flexShrink: 0,
            border: checked
              ? `1.5px solid ${T.accent}`
              : `1.5px solid ${T.textMuted}`,
            background: checked ? T.accent : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          {checked && "✓"}
        </div>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}

// ── Value picker content for each filter type ─────────────────────────────────
function FilterValuePicker({
  filterKey,
  selected,
  onChange,
  lists,
  members,
  boardLabels,
  customDateFrom,
  customDateTo,
  onCustomDateChange,
}) {
  if (filterKey === "dueDate")
    return (
      <>
        {DUE_OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <DropdownItem
              key={opt.value}
              checked={isSelected}
              // Due Date is single-choice: picking a new option replaces the
              // previous one, rather than combining ("this week" OR "custom"),
              // which would silently widen the match set and inflate counts.
              onClick={() => onChange(isSelected ? [] : [opt.value])}
            >
              {opt.label}
            </DropdownItem>
          );
        })}
        {selected.includes("custom") && (
          <div
            style={{
              padding: "10px 14px 12px",
              borderTop: `1px solid ${T.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 10.5,
                  color: T.textMuted,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                From
              </label>
              <input
                type="date"
                value={customDateFrom || ""}
                onChange={(e) => onCustomDateChange?.("from", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: T.text,
                  fontSize: 12,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                  colorScheme: "dark",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 10.5,
                  color: T.textMuted,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                To
              </label>
              <input
                type="date"
                value={customDateTo || ""}
                onChange={(e) => onCustomDateChange?.("to", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: T.text,
                  fontSize: 12,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                  colorScheme: "dark",
                }}
              />
            </div>
          </div>
        )}
      </>
    );
  if (filterKey === "assignedTo") {
    const opts = members || [];
    const unassignedChecked = selected.includes("unassigned");
    return (
      <>
        <DropdownItem
          checked={unassignedChecked}
          onClick={() =>
            onChange(
              unassignedChecked
                ? selected.filter((v) => v !== "unassigned")
                : [...selected, "unassigned"],
            )
          }
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: T.bgItem,
                border: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              👤
            </div>
            <span>Unassigned</span>
          </div>
        </DropdownItem>
        {opts.length > 0 && (
          <div
            style={{ borderTop: `1px solid ${T.border}`, margin: "4px 0" }}
          />
        )}
        {opts.map((m) => {
          const initials = m.fullName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
          const checked = selected.includes(m.id);
          return (
            <DropdownItem
              key={m.id}
              checked={checked}
              onClick={() =>
                onChange(
                  checked
                    ? selected.filter((v) => v !== m.id)
                    : [...selected, m.id],
                )
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: m.avatarColor || "#0052cc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <span>{m.fullName}</span>
              </div>
            </DropdownItem>
          );
        })}
      </>
    );
  }
  if (filterKey === "cardActivity")
    return (
      <>
        {CARD_ACTIVITY_OPTIONS.map((opt) => (
          <DropdownItem
            key={opt.value}
            checked={selected.includes(opt.value)}
            onClick={() =>
              onChange(
                selected.includes(opt.value)
                  ? selected.filter((v) => v !== opt.value)
                  : [...selected, opt.value],
              )
            }
          >
            {opt.label}
          </DropdownItem>
        ))}
      </>
    );
  if (filterKey === "createdDate")
    return (
      <>
        {CREATED_DATE_OPTIONS.map((opt) => (
          <DropdownItem
            key={opt.value}
            checked={selected.includes(opt.value)}
            onClick={() =>
              onChange(
                selected.includes(opt.value)
                  ? selected.filter((v) => v !== opt.value)
                  : [...selected, opt.value],
              )
            }
          >
            {opt.label}
          </DropdownItem>
        ))}
      </>
    );
  if (filterKey === "label") {
    const opts = boardLabels || [];
    if (!opts.length)
      return (
        <div style={{ padding: "12px 14px", fontSize: 12, color: T.textMuted }}>
          No labels found
        </div>
      );
    return (
      <>
        {opts.map((lbl) => {
          const hex = TRELLO_LABEL_COLORS[lbl.color] || "#888";
          const name = lbl.name?.trim() || lbl.color || "Unnamed";
          const checked = selected.includes(lbl.id);
          return (
            <DropdownItem
              key={lbl.id}
              checked={checked}
              onClick={() =>
                onChange(
                  checked
                    ? selected.filter((v) => v !== lbl.id)
                    : [...selected, lbl.id],
                )
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 32,
                    height: 14,
                    borderRadius: 3,
                    background: hex,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{ color: name === lbl.color ? T.textMuted : T.text }}
                >
                  {name}
                </span>
              </div>
            </DropdownItem>
          );
        })}
      </>
    );
  }
  if (filterKey === "list") {
    const opts = lists || [];
    if (!opts.length)
      return (
        <div style={{ padding: "12px 14px", fontSize: 12, color: T.textMuted }}>
          No lists found
        </div>
      );
    return (
      <>
        {opts.map((l) => {
          const checked = selected.includes(l.id);
          return (
            <DropdownItem
              key={l.id}
              checked={checked}
              onClick={() =>
                onChange(
                  checked
                    ? selected.filter((v) => v !== l.id)
                    : [...selected, l.id],
                )
              }
            >
              {l.name}
            </DropdownItem>
          );
        })}
      </>
    );
  }
  if (filterKey === "status") {
    const STATUS_OPTIONS = [
      { value: "incomplete", label: "Incomplete" },
      { value: "complete", label: "Complete" },
      { value: "overdue", label: "Overdue" },
    ];
    return (
      <>
        {STATUS_OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <DropdownItem
              key={opt.value}
              checked={isSelected}
              onClick={() => onChange(isSelected ? [] : [opt.value])}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "inline-block",
                    background:
                      opt.value === "complete"
                        ? "#3fb950"
                        : opt.value === "overdue"
                          ? "#f85149"
                          : "#d29922",
                  }}
                />
                {opt.label}
              </div>
            </DropdownItem>
          );
        })}
      </>
    );
  }
  return null;
}

// ── Active filter row ─────────────────────────────────────────────────────────
function ActiveFilterRow({
  filterKey,
  values,
  onValuesChange,
  onRemove,
  lists,
  members,
  boardLabels,
  currentUserId,
  customDateFrom,
  customDateTo,
  onCustomDateChange,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef();
  const portalRef = useRef();
  const wrapRef = useRef();

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (
        wrapRef.current?.contains(e.target) ||
        portalRef.current?.contains(e.target)
      )
        return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const def = FILTER_DEFS[filterKey];
  if (!def) return null;

  function pillValue() {
    if (filterKey === "assignedTo") {
      if (!values || !values.length) return null; // shows "Any"
      if (values.length === 1) {
        if (values[0] === "unassigned") return "Unassigned";
        const m = (members || []).find((x) => x.id === values[0]);
        if (!m) return "Selected";
        return values[0] === currentUserId ? `Me (${m.fullName})` : m.fullName;
      }
      return `${values.length} selected`;
    }
    if (!values || !values.length) return null;
    if (filterKey === "dueDate") {
      if (values.length === 1) {
        if (values[0] === "custom") {
          if (customDateFrom && customDateTo)
            return `${customDateFrom} → ${customDateTo}`;
          return "Custom range…";
        }
        return (
          DUE_OPTIONS.find((o) => o.value === values[0])?.label || values[0]
        );
      }
      return `${values.length} dates`;
    }
    if (filterKey === "label") {
      if (values.length === 1) {
        const l = (boardLabels || []).find((x) => x.id === values[0]);
        return l?.name?.trim() || l?.color || values[0];
      }
      return `${values.length} labels`;
    }
    if (filterKey === "list") {
      if (values.length === 1)
        return (lists || []).find((l) => l.id === values[0])?.name || values[0];
      return `${values.length} lists`;
    }
    if (filterKey === "status") {
      if (values.length === 1)
        return (
          {
            complete: "Complete",
            incomplete: "Incomplete",
            overdue: "Overdue",
          }[values[0]] || values[0]
        );
    }
    if (filterKey === "cardActivity") {
      if (values.length === 1)
        return (
          CARD_ACTIVITY_OPTIONS.find((o) => o.value === values[0])?.label ||
          values[0]
        );
      return `${values.length} selected`;
    }
    if (filterKey === "createdDate") {
      if (values.length === 1)
        return (
          CREATED_DATE_OPTIONS.find((o) => o.value === values[0])?.label ||
          values[0]
        );
      return `${values.length} selected`;
    }
    return null;
  }
  const val = pillValue();

  const iconBg =
    {
      assignedTo: "#7e57c2",
      dueDate: "#1565c0",
      label: "#e6a817",
      list: "#1565c0",
      status: "#3fb950",
      cardActivity: "#4c8fff",
      createdDate: "#2ec4b6",
    }[filterKey] || T.accent;

  return (
    <div
      ref={wrapRef}
      style={{ display: "flex", alignItems: "center", gap: 10 }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          background: iconBg + "33",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 16, height: 16, color: iconBg, display: "flex" }}>
          {FilterIcons[filterKey]}
        </span>
      </div>

      <div
        style={{
          flex: "0 0 100px",
          fontSize: 12,
          color: T.textSub,
          fontWeight: 500,
        }}
      >
        {def.label}
      </div>

      <div
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: T.bgDeep,
          border: `1px solid ${open ? T.accent : T.border}`,
          borderRadius: 6,
          padding: "6px 10px",
          cursor: "pointer",
          fontSize: 13,
          color: T.text,
          transition: "border-color 0.15s",
          userSelect: "none",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: val ? T.text : T.textMuted,
          }}
        >
          {val || "Any"}
        </span>
        <span
          style={{
            fontSize: 9,
            color: T.textMuted,
            flexShrink: 0,
            marginLeft: 6,
          }}
        >
          {open ? "▲" : "▼"}
        </span>
      </div>

      <button
        onClick={onRemove}
        title="Remove filter"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: T.textMuted,
          width: 26,
          height: 26,
          borderRadius: 6,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s ease, color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(248,81,73,0.12)";
          e.currentTarget.style.color = T.danger;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = T.textMuted;
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>

      <PortalDropdown anchorRef={triggerRef} open={open} portalRef={portalRef}>
        <div
          style={{
            padding: "8px 14px 6px",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: T.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Filter by {def.label}
          </span>
        </div>
        <div style={{ padding: "4px 0" }}>
          <FilterValuePicker
            filterKey={filterKey}
            selected={values || []}
            onChange={onValuesChange}
            lists={lists}
            members={members}
            boardLabels={boardLabels}
            customDateFrom={customDateFrom}
            customDateTo={customDateTo}
            onCustomDateChange={onCustomDateChange}
          />
        </div>
      </PortalDropdown>
    </div>
  );
}

// ── Filter grid item ──────────────────────────────────────────────────────────
function FilterGridItem({ item, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 11,
        padding: "13px 14px",
        borderRadius: 10,
        cursor: "pointer",
        background: active
          ? "rgba(76,143,255,0.08)"
          : hover
            ? T.bgItem
            : T.bgDeep,
        border: `1px solid ${active ? T.accent : hover ? T.borderLight : T.border}`,
        boxShadow: active ? `0 0 0 1px ${T.accent}33` : "none",
        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
        minWidth: 0,
        width: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          flexShrink: 0,
          background: active ? item.color + "26" : item.color + "1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s",
        }}
      >
        <span
          style={{ width: 18, height: 18, color: item.color, display: "flex" }}
        >
          {FilterIcons[item.iconKey]}
        </span>
      </div>
      <div style={{ minWidth: 0, flex: 1, overflow: "hidden", paddingTop: 1 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: active ? T.accent : T.text,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: T.textMuted,
            marginTop: 2,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.sub}
        </div>
      </div>
      {active && (
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            flexShrink: 0,
            marginTop: 2,
            background: T.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          ✓
        </span>
      )}
    </div>
  );
}

// ── Stat card preview (left panel, Filters tab) ──────────────────────────────
function StatCardPreview({
  statType,
  liveCount,
  cardName,
  coverColor,
  coverImage,
  customHex,
}) {
  const emoji = STAT_EMOJIS[statType] || "📌";
  return (
    <div
      style={{
        background: resolveCoverBackground(coverColor, customHex),
        borderRadius: 12,
        overflow: "hidden",
        width: "100%",
        position: "relative",
        minHeight: 110,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
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
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          fontSize: 22,
          zIndex: 1,
        }}
      >
        {emoji}
      </div>
      <div
        style={{ position: "relative", zIndex: 1, padding: "20px 16px 14px" }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1,
          }}
        >
          {liveCount}
        </div>
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "10px 16px 14px",
          background: "rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.4,
          }}
        >
          {cardName}
        </div>
      </div>
    </div>
  );
}

// ── Live styled preview (left panel, Style tab) ──────────────────────────────
function LiveStylePreview({
  count,
  title,
  subtitle,
  textColor,
  customTextHex,
  cardBg,
  layout,
}) {
  const resolvedTextColor =
    textColor === "custom" && customTextHex
      ? customTextHex
      : TEXT_COLORS.find((t) => t.id === textColor)?.css ||
        TEXT_COLORS.find((t) => t.id === textColor)?.hex ||
        "#FFFFFF";

  const numStyle = {
    fontSize: 26,
    fontWeight: 800,
    color: resolvedTextColor,
    lineHeight: 1,
  };
  const lblStyle = {
    fontSize: 13,
    fontWeight: 700,
    color: resolvedTextColor,
    lineHeight: 1.4,
  };
  const subStyle = {
    fontSize: 11,
    color: resolvedTextColor,
    opacity: 0.75,
    lineHeight: 1.3,
  };

  function LayoutContent() {
    if (layout === "center")
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: 16,
          }}
        >
          <span style={numStyle}>{count}</span>
          <span style={lblStyle}>{title}</span>
          <span style={subStyle}>{subtitle}</span>
        </div>
      );
    if (layout === "bottomLeft")
      return (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <span style={numStyle}>{count}</span>
          <span style={lblStyle}>{title}</span>
          <span style={subStyle}>{subtitle}</span>
        </div>
      );
    if (layout === "bottomRight")
      return (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 3,
          }}
        >
          <span style={numStyle}>{count}</span>
          <span style={lblStyle}>{title}</span>
          <span style={subStyle}>{subtitle}</span>
        </div>
      );
    if (layout === "topBottom")
      return (
        <>
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              textAlign: "right",
            }}
          >
            <span style={numStyle}>{count}</span>
            <span style={{ ...lblStyle, display: "block" }}>{title}</span>
          </div>
          <div style={{ position: "absolute", bottom: 12, left: 16 }}>
            <span style={subStyle}>{subtitle}</span>
          </div>
        </>
      );
    return null;
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: 110,
        aspectRatio: "3/2",
        background: cardBg,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.08)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          fontSize: 20,
          zIndex: 1,
        }}
      >
        📌
      </div>
      <LayoutContent />
    </div>
  );
}

// ── Mini card layout preview (Style tab, layout picker) ──────────────────────
function LayoutMini({
  layout,
  count,
  title,
  subtitle,
  textColor,
  customTextHex,
  cardBg,
  selected,
  onClick,
}) {
  const resolvedTextColor =
    textColor === "custom" && customTextHex
      ? customTextHex
      : TEXT_COLORS.find((t) => t.id === textColor)?.hex || "#FFFFFF";

  const baseCard = {
    width: "100%",
    aspectRatio: "4/3",
    background: cardBg,
    borderRadius: 8,
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  };

  const numStyle = {
    fontSize: 20,
    fontWeight: 800,
    color: resolvedTextColor,
    lineHeight: 1,
  };
  const lblStyle = {
    fontSize: 8,
    fontWeight: 600,
    color: resolvedTextColor,
    opacity: 0.9,
    lineHeight: 1.3,
  };
  const subStyle = {
    fontSize: 7,
    color: resolvedTextColor,
    opacity: 0.7,
    lineHeight: 1.3,
  };

  function Content() {
    if (layout === "center")
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: 10,
          }}
        >
          <span style={numStyle}>{count}</span>
          <span style={lblStyle}>{title}</span>
          <span style={subStyle}>{subtitle}</span>
        </div>
      );
    if (layout === "bottomLeft")
      return (
        <div
          style={{
            padding: "0 10px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span style={numStyle}>{count}</span>
          <span style={lblStyle}>{title}</span>
          <span style={subStyle}>{subtitle}</span>
        </div>
      );
    if (layout === "bottomRight")
      return (
        <div
          style={{
            padding: "0 10px 10px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
          }}
        >
          <span style={numStyle}>{count}</span>
          <span style={lblStyle}>{title}</span>
          <span style={subStyle}>{subtitle}</span>
        </div>
      );
    if (layout === "topBottom")
      return (
        <>
          <div style={{ position: "absolute", top: 10, right: 10 }}>
            <span style={numStyle}>{count}</span>
            <span style={{ ...lblStyle, display: "block", textAlign: "right" }}>
              {title}
            </span>
          </div>
          <div style={{ padding: "0 10px 8px" }}>
            <span
              style={{
                ...subStyle,
                fontSize: 7,
                opacity: 0.6,
                textDecoration: "line-through",
              }}
            >
              {subtitle}
            </span>
          </div>
        </>
      );
    return null;
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          ...baseCard,
          border: selected ? `2px solid ${T.accent}` : `2px solid ${T.border}`,
          transition: "border-color 0.15s",
        }}
      >
        {selected && (
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              zIndex: 2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: T.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>
              ✓
            </span>
          </div>
        )}
        <Content />
      </div>
      <span
        style={{
          fontSize: 11,
          textAlign: "center",
          color: selected ? T.accent : T.textMuted,
          fontWeight: selected ? 600 : 400,
        }}
      >
        {LAYOUTS.find((l) => l.id === layout)?.label}
      </span>
    </div>
  );
}

// ── Color swatch button (Style tab) ───────────────────────────────────────────
function Swatch({ bg, selected, onClick, size = 32 }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: bg,
        border: selected ? "2px solid #fff" : "2px solid transparent",
        outline: selected ? `2px solid ${T.accent}` : "2px solid transparent",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transform: selected ? "scale(1.15)" : "scale(1)",
        transition: "transform 0.12s, outline 0.12s",
        position: "relative",
      }}
    >
      {selected && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            textShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}
        >
          ✓
        </span>
      )}
    </button>
  );
}

// ── Custom hex input (Style tab) ──────────────────────────────────────────────
function CustomHexInput({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: T.bgDeep,
        border: `1px solid ${focused ? T.accent : T.border}`,
        borderRadius: 8,
        padding: "9px 14px",
        transition: "border-color 0.15s",
        cursor: "text",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: value,
          flexShrink: 0,
          border: `1px solid ${T.border}`,
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          background: "none",
          border: "none",
          outline: "none",
          color: T.text,
          fontSize: 13,
          fontFamily: "'DM Mono', monospace",
          letterSpacing: "0.04em",
        }}
      />
      <span style={{ color: T.textMuted, fontSize: 14, cursor: "pointer" }}>
        ✏️
      </span>
    </div>
  );
}

// ── Character-counted text input (Style tab) ──────────────────────────────────
function LimitedInput({ label, value, onChange, max, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ flex: 1 }}>
      <label
        style={{
          fontSize: 11,
          color: T.textMuted,
          fontWeight: 500,
          display: "block",
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      <div
        style={{
          position: "relative",
          background: T.bgDeep,
          border: `1px solid ${focused ? T.accent : T.border}`,
          borderRadius: 8,
          transition: "border-color 0.15s",
        }}
      >
        <input
          type="text"
          value={value}
          maxLength={max}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            background: "none",
            border: "none",
            outline: "none",
            color: T.text,
            fontSize: 13,
            fontFamily: "inherit",
            padding: "9px 52px 9px 12px",
            boxSizing: "border-box",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 11,
            color: T.textMuted,
            pointerEvents: "none",
          }}
        >
          {value.length}/{max}
        </span>
      </div>
    </div>
  );
}

// ── Scope selectors ───────────────────────────────────────────────────────────
function ScopeSelect({
  label,
  value,
  onChange,
  options,
  loading,
  icon,
  iconBg,
}) {
  return (
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 11,
          color: T.textMuted,
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div style={{ position: "relative" }}>
        {icon && (
          <span
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              width: 18,
              height: 18,
              borderRadius: 4,
              background: (iconBg || T.accent) + "33",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              pointerEvents: "none",
            }}
          >
            {icon}
          </span>
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          style={{
            width: "100%",
            background: T.bgDeep,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            color: loading ? T.textMuted : T.text,
            fontSize: 13,
            padding: icon ? "8px 32px 8px 34px" : "8px 32px 8px 10px",
            fontFamily: "inherit",
            outline: "none",
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = T.accent)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        >
          {loading && <option>Loading…</option>}
          {!loading &&
            options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
        <span
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 10,
            color: T.textMuted,
            pointerEvents: "none",
          }}
        >
          ▾
        </span>
      </div>
    </div>
  );
}

// ── Stat picker (step 1) ──────────────────────────────────────────────────────
function StatPicker({ onSelect, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'DM Sans',sans-serif",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.bgSection,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          width: 300,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: `1px solid ${T.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
            Create Stat Card
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: T.textMuted,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "8px 0 12px" }}>
          {STAT_LIST.map(({ type, label, emoji }) => (
            <div
              key={type}
              onClick={() => onSelect(type)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 18px",
                cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = T.bgItem)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span style={{ fontSize: 18 }}>{emoji}</span>
              <span style={{ fontSize: 13, color: T.textSub }}>{label}</span>
              <span
                style={{ marginLeft: "auto", color: T.textMuted, fontSize: 14 }}
              >
                ›
              </span>
            </div>
          ))}

          <div
            style={{ borderTop: `1px solid ${T.border}`, margin: "6px 0" }}
          />

          <div
            onClick={() => onSelect("custom")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 18px",
              cursor: "pointer",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.bgItem)}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <span style={{ fontSize: 18 }}>🛠️</span>
            <span style={{ fontSize: 13, color: T.textSub, fontWeight: 600 }}>
              Create Custom Card
            </span>
            <span
              style={{ marginLeft: "auto", color: T.textMuted, fontSize: 14 }}
            >
              ›
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Default active filters per stat type — applied when Customize opens ──────
// Each entry defines which filter row(s) are active by default and what
// value(s) they're pre-set to, so the modal opens already reflecting the
// stat's natural meaning (e.g. "Unassigned Cards" opens with Assigned To →
// Unassigned, not the current user).
const DEFAULT_FILTERS_BY_STAT = {
  assigned: {
    active: ["assignedTo"],
    values: (uid) => ({ assignedTo: uid ? [uid] : [] }),
  },
  unassigned: {
    active: ["assignedTo"],
    values: () => ({ assignedTo: ["unassigned"] }),
  },
  dueThisWeek: {
    active: ["dueDate"],
    values: () => ({ dueDate: ["thisWeek"] }),
  },
  overdue: { active: ["dueDate"], values: () => ({ dueDate: ["overdue"] }) },
  stale: {
    active: ["cardActivity"],
    values: () => ({ cardActivity: ["stale30"] }),
  },
  createdToday: {
    active: ["createdDate"],
    values: () => ({ createdDate: ["today"] }),
  },
  withLabel: { active: ["label"], values: () => ({ label: [] }) }, // left open — user picks the label
  cardsInList: { active: [], values: () => ({}) },
};

// ── Main CardConfigModal ──────────────────────────────────────────────────────
function CardConfigModal({
  statType,
  statValue,
  lists,
  memberName,
  members,
  boardLabels,
  isPremium,
  computeFilteredCount,
  onSave,
  onBack,
  onClose,
  onUpgradeClick,
  boardName,
  boardId,
  workspaceBoards = [],
  fetchWorkspaceBoards,
  fetchBoardScopedData,
  currentUserId,
  trelloT,
  blankStart,
}) {
  const [activeTab, setActiveTab] = useState("filters");
  const [cardName, setCardName] = useState(
  blankStart ? "" : DEFAULT_NAMES[statType] || ""
);
  const [boardScope, setBoardScope] = useState("this");
  const [filterSearch, setFilterSearch] = useState("");

  const [coverColor, setCoverColor] = useState(
  DEFAULT_COVER[statType] || "grad-multi",
);
  const [coverImage, setCoverImage] = useState(null);
  const [styleSubtitle, setStyleSubtitle] = useState("");
  const [textColor, setTextColor] = useState("white");
  const [layout, setLayout] = useState("center");
  const [customHex, setCustomHex] = useState("#3B82F6");
  const [customTextHex, setCustomTextHex] = useState("#FFFFFF");
  const [liveResultsOpen, setLiveResultsOpen] = useState(true);

  const [activeFilters, setActiveFilters] = useState(() => {
    if (blankStart || statType === "custom") return [];
    const preset = DEFAULT_FILTERS_BY_STAT[statType];
    return preset && preset.active.length ? preset.active : ["assignedTo"];
  });
  const [filterValues, setFilterValues] = useState(() => {
    const base = {
      assignedTo: [],
      dueDate: [],
      label: [],
      list: [],
      status: [],
      cardActivity: [],
      createdDate: [],
    };
    if (blankStart || statType === "custom") return base;
    const preset = DEFAULT_FILTERS_BY_STAT[statType];
    return { ...base, ...(preset ? preset.values(currentUserId) : {}) };
  });
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

  function handleCustomDateChange(which, value) {
    if (which === "from") setCustomDateFrom(value);
    else setCustomDateTo(value);
  }

  function setFilterValue(key, vals) {
    setFilterValues((p) => ({ ...p, [key]: vals }));
  }
  function addFilter(key) {
    if (!activeFilters.includes(key)) setActiveFilters((p) => [...p, key]);
  }
  function removeFilter(key) {
    setActiveFilters((p) => p.filter((k) => k !== key));
    setFilterValues((p) => ({ ...p, [key]: [] }));
  }

  const [boards, setBoards] = useState(workspaceBoards);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [scopedLists, setScopedLists] = useState(lists || []);
  const [scopedMembers, setScopedMembers] = useState(members || []);
  const [scopedLabels, setScopedLabels] = useState(boardLabels || []);

  useEffect(() => {
    setScopedLists(lists || []);
  }, [lists]);
  useEffect(() => {
    setScopedMembers(members || []);
  }, [members]);
  useEffect(() => {
    setScopedLabels(boardLabels || []);
  }, [boardLabels]);

  useEffect(() => {
    if (workspaceBoards?.length) {
      setBoards(workspaceBoards);
      return;
    }
    if (!fetchWorkspaceBoards) return;
    setBoardsLoading(true);
    fetchWorkspaceBoards()
      .then((list) => setBoards(Array.isArray(list) ? list : []))
      .catch(() => setBoards([]))
      .finally(() => setBoardsLoading(false));
  }, [fetchWorkspaceBoards]);

  const liveCount =
    statType === "custom" && activeFilters.length === 0
      ? 0
      : computeFilteredCount
        ? computeFilteredCount(statType, {
            members: filterValues.assignedTo || [],
            due: filterValues.dueDate || [],
            labels: filterValues.label || [],
            lists: filterValues.list || [],
            status: filterValues.status || [],
            activity: filterValues.cardActivity || [],
            createdDate: filterValues.createdDate || [],
            customDateFrom: customDateFrom,
            customDateTo: customDateTo,
          })
        : (statValue ?? 24);

  const previewName = cardName.trim()
    ? cardName
    : DEFAULT_NAMES[statType] || "Untitled Card";

  const workspaceOptions = [{ value: "my-workspace", label: "My Workspace" }];
  const boardOptions = [
    { value: "all", label: "All Boards" },
    { value: "this", label: boardName || "This Board" },
    ...boards
      .filter((b) => b.id !== boardId)
      .map((b) => ({ value: b.id, label: b.name })),
  ];

  const filteredGridItems = FILTER_GRID_ITEMS.filter(
    (item) =>
      !filterSearch ||
      item.label.toLowerCase().includes(filterSearch.toLowerCase()) ||
      item.sub.toLowerCase().includes(filterSearch.toLowerCase()),
  );

  const cardBg = resolveCoverBackground(coverColor, customHex);

  function handleSave() {
    onSave(statType, {
      cardName: previewName,
      cover: coverColor,
      coverImage,
      customHex,
      subtitle: styleSubtitle,
      textColor,
      customTextHex,
      layout,
      members: filterValues.assignedTo || [],
      due: filterValues.dueDate || [],
      labels: filterValues.label || [],
      lists: filterValues.list || [],
      status: filterValues.status || [],
      activity: filterValues.cardActivity || [],
      createdDate: filterValues.createdDate || [],
      customDateFrom,
      customDateTo,
      boardScope,
      count: liveCount,
    });
  }

  const TABS = [
    { key: "filters", label: "Filters" },
    { key: "style", label: "Style" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'DM Sans', -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          background: T.bgSection,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Header (title + template badge — close button removed, Trello's popup chrome already has one) ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 20px",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
            background: T.bg,
          }}
        >
          <button
            onClick={onBack}
            title="Back"
            style={{
              background: "none",
              border: "none",
              borderRadius: 7,
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.textMuted,
              cursor: "pointer",
              flexShrink: 0,
              fontSize: 19,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.bgItem;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            ‹
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
            Create Stat Card
          </span>
          <span
            style={{
              fontSize: 11,
              color: T.accent,
              background: T.accentDim,
              border: `1px solid ${T.accent}44`,
              borderRadius: 20,
              padding: "2px 10px",
              fontWeight: 600,
            }}
          >
            Template: {previewName}
          </span>
        </div>

        {/* ── Body ── */}
        <div
          style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          {/* Left Panel */}
          <div
            style={{
              width: 200,
              flexShrink: 0,
              padding: 12,
              borderRight: `1px solid ${T.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              overflowY: "auto",
              background: T.bg,
            }}
          >
            {activeTab === "filters" ? (
              <StatCardPreview
                statType={statType}
                liveCount={liveCount}
                cardName={previewName}
                coverColor={coverColor}
                coverImage={coverImage}
                customHex={customHex}
              />
            ) : (
              <LiveStylePreview
                count={liveCount}
                title={previewName}
                subtitle={styleSubtitle}
                textColor={textColor}
                customTextHex={customTextHex}
                cardBg={cardBg}
                layout={layout}
              />
            )}
            <div
              style={{ fontSize: 10, color: T.textMuted, textAlign: "center" }}
            >
              {activeTab === "filters"
                ? "This is a live preview of your card based on the selected scope and filters."
                : "This is a live preview. Changes you make in style will appear here."}
            </div>
            <div
              style={{
                background: T.bgDeep,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 13, color: T.accent }}>ℹ</span>
                <span
                  style={{ fontSize: 11, fontWeight: 700, color: T.textSub }}
                >
                  {activeTab === "filters" ? "About this card" : "About style"}
                </span>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: T.textMuted,
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {activeTab === "filters"
                  ? "Counts all cards that are assigned to you based on the selected scope and filters."
                  : "Customize how your card looks on your dashboard. You can always change this later."}
              </p>
            </div>
          </div>

          {/* Right Panel */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: `1px solid ${T.border}`,
                flexShrink: 0,
                paddingLeft: 8,
                background: T.bg,
              }}
            >
              {TABS.map(({ key, label }) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    style={{
                      padding: "12px 22px",
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                      color: active ? T.accent : T.textMuted,
                      background: "none",
                      border: "none",
                      borderBottom: active
                        ? `2px solid ${T.accent}`
                        : "2px solid transparent",
                      fontFamily: "inherit",
                      marginBottom: -1,
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                background: T.surface,
                scrollbarWidth: "thin",
                scrollbarColor: `${T.border} transparent`,
              }}
            >
              {/* ── FILTERS TAB ── */}
              {activeTab === "filters" && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {/* Row 1: Card Details + Scope side by side */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 0,
                    }}
                  >
                    {/* Section 1: Card Details */}
                    <div
                      style={{
                        padding: "14px 16px",
                        borderRight: `1px solid ${T.border}`,
                      }}
                    >
                      <SectionHeader number="1" title="Card Details" />
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                        }}
                      >
                        <div>
                          <label
                            style={{
                              fontSize: 11,
                              color: T.textMuted,
                              fontWeight: 500,
                              display: "block",
                              marginBottom: 5,
                            }}
                          >
                            Card Name
                          </label>
                          <input
                            type="text"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            placeholder={DEFAULT_NAMES[statType] || "Card name"}
                            style={{
                              width: "100%",
                              background: T.bgDeep,
                              border: `1px solid ${T.border}`,
                              borderRadius: 6,
                              padding: "8px 11px",
                              color: T.text,
                              fontSize: 13,
                              fontFamily: "inherit",
                              outline: "none",
                              boxSizing: "border-box",
                              transition: "border-color 0.15s",
                            }}
                            onFocus={(e) =>
                              (e.target.style.borderColor = T.accent)
                            }
                            onBlur={(e) =>
                              (e.target.style.borderColor = T.border)
                            }
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: 11,
                              color: T.textMuted,
                              fontWeight: 500,
                              display: "block",
                              marginBottom: 5,
                            }}
                          >
                            Description (optional)
                          </label>
                          <input
                            type="text"
                            value={styleSubtitle}
                            onChange={(e) => setStyleSubtitle(e.target.value)}
                            maxLength={30}
                            placeholder="Add a short description for this card..."
                            style={{
                              width: "100%",
                              background: T.bgDeep,
                              border: `1px solid ${T.border}`,
                              borderRadius: 6,
                              padding: "8px 11px",
                              color: T.text,
                              fontSize: 13,
                              fontFamily: "inherit",
                              outline: "none",
                              boxSizing: "border-box",
                              transition: "border-color 0.15s",
                            }}
                            onFocus={(e) =>
                              (e.target.style.borderColor = T.accent)
                            }
                            onBlur={(e) =>
                              (e.target.style.borderColor = T.border)
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Scope */}
                    <div style={{ padding: "14px 16px" }}>
                      <SectionHeader number="2" title="Scope" />
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <ScopeSelect
                          label="Workspace"
                          value="my-workspace"
                          onChange={() => {}}
                          options={workspaceOptions}
                          icon="👤"
                          iconBg="#7e57c2"
                        />
                        <ScopeSelect
                          label="Board"
                          value={boardScope}
                          onChange={setBoardScope}
                          options={boardOptions}
                          loading={boardsLoading}
                          icon="🗂"
                          iconBg="#1565c0"
                        />
                      </div>
                    </div>
                  </div>

                  <Divider />

                  {/* Section 3: Active Filters (full width) */}
                  <div style={{ padding: "14px 16px" }}>
                    <SectionHeader
                      number={activeFilters.length}
                      title="Active Filters"
                    />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {activeFilters.map((key) => (
                        <ActiveFilterRow
                          key={key}
                          filterKey={key}
                          values={filterValues[key] || []}
                          onValuesChange={(vals) => setFilterValue(key, vals)}
                          onRemove={() => removeFilter(key)}
                          lists={scopedLists}
                          members={scopedMembers}
                          boardLabels={scopedLabels}
                          currentUserId={currentUserId}
                          customDateFrom={customDateFrom}
                          customDateTo={customDateTo}
                          onCustomDateChange={handleCustomDateChange}
                        />
                      ))}
                      {activeFilters.length === 0 && (
                        <div
                          style={{
                            fontSize: 12,
                            color: T.textMuted,
                            padding: "8px 0",
                            textAlign: "center",
                          }}
                        >
                          No active filters. Add from the grid below →
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 11,
                          color: T.textMuted,
                          marginTop: 4,
                        }}
                      >
                        These filters are currently applied to your card.
                      </div>
                    </div>
                  </div>

                  <Divider />

                  {/* Section 4: Add More Filters (full width — fits in 4 columns, no inner scroll) */}
                  <div style={{ padding: "14px 16px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <SectionNumber n="4" />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: T.textMuted,
                            letterSpacing: "0.09em",
                            textTransform: "uppercase",
                          }}
                        >
                          Add More Filters
                        </span>
                      </div>
                      <div style={{ position: "relative" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: T.textMuted,
                            fontSize: 13,
                            lineHeight: 1,
                            pointerEvents: "none",
                          }}
                        >
                          ⌕
                        </span>
                        <input
                          type="text"
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          placeholder="Search filters"
                          style={{
                            background: T.bgDeep,
                            border: `1px solid ${T.border}`,
                            borderRadius: 7,
                            padding: "7px 12px 7px 30px",
                            color: T.text,
                            fontSize: 12,
                            fontFamily: "inherit",
                            outline: "none",
                            width: 200,
                            transition: "border-color 0.15s",
                          }}
                          onFocus={(e) =>
                            (e.target.style.borderColor = T.accent)
                          }
                          onBlur={(e) =>
                            (e.target.style.borderColor = T.border)
                          }
                        />
                      </div>
                    </div>
                    <p
                      style={{
                        fontSize: 11.5,
                        color: T.textMuted,
                        margin: "0 0 14px",
                        lineHeight: 1.55,
                      }}
                    >
                      Choose from the available filters to refine your results.
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 10,
                        width: "100%",
                      }}
                    >
                      {filteredGridItems.map((item) => (
                        <FilterGridItem
                          key={item.key}
                          item={item}
                          active={activeFilters.includes(item.key)}
                          onClick={() => {
                            if (activeFilters.includes(item.key))
                              removeFilter(item.key);
                            else addFilter(item.key);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── STYLE TAB ── */}
              {activeTab === "style" && (
                <div style={{ padding: "22px 28px" }}>
                  <SectionLabel n="1" title="Text Customization" />
                  <SectionSub>
                    Customize the text shown on your card.
                  </SectionSub>
                  <div style={{ display: "flex", gap: 14 }}>
                    <LimitedInput
                      label="Title (Label)"
                      value={previewName}
                      max={30}
                      onChange={(v) => {
                        setCardName(v);
                        setNameManuallyEdited(true);
                      }}
                      placeholder="Card title"
                    />
                    <LimitedInput
                      label="Subtitle (Optional)"
                      value={styleSubtitle}
                      max={30}
                      onChange={setStyleSubtitle}
                      placeholder="e.g. Across 3 boards"
                    />
                  </div>

                  <StyleDivider />

                  <SectionLabel n="2" title="Text Color" />
                  <SectionSub>
                    Choose text color for the title and subtitle.
                  </SectionSub>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    {TEXT_COLORS.map(({ id, hex, css }) => (
                      <Swatch
                        key={id}
                        bg={css || hex}
                        selected={textColor === id}
                        onClick={() => setTextColor(id)}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: T.textMuted,
                        fontWeight: 500,
                        marginBottom: 8,
                      }}
                    >
                      Custom Color
                    </div>
                    <div style={{ maxWidth: 340 }}>
                      <CustomHexInput
                        value={customTextHex}
                        onChange={(v) => {
                          setCustomTextHex(v);
                          setTextColor("custom");
                        }}
                      />
                    </div>
                  </div>

                  <StyleDivider />

                  <SectionLabel n="3" title="Card Color" />
                  <SectionSub>Choose a color for your card.</SectionSub>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    {COVER_COLORS.map(({ id, hex }) => (
                      <Swatch
                        key={id}
                        bg={hex}
                        selected={coverColor === id}
                        onClick={() => {
                          setCoverColor(id);
                          setCoverImage(null);
                        }}
                      />
                    ))}
                    {COVER_GRADIENTS.map(({ id, css }) => (
                      <Swatch
                        key={id}
                        bg={css}
                        selected={coverColor === id}
                        onClick={() => {
                          setCoverColor(id);
                          setCoverImage(null);
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: T.textMuted,
                        fontWeight: 500,
                        marginBottom: 8,
                      }}
                    >
                      Custom Color
                    </div>
                    <div style={{ maxWidth: 340 }}>
                      <CustomHexInput
                        value={customHex}
                        onChange={(v) => {
                          setCustomHex(v);
                          setCoverColor("custom");
                          setCoverImage(null);
                        }}
                      />
                    </div>
                  </div>

                  <StyleDivider />

                  <SectionLabel n="4" title="Card Layout" />
                  <SectionSub>
                    Choose where the text appears on your card.
                  </SectionSub>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 12,
                    }}
                  >
                    {LAYOUTS.map(({ id }) => (
                      <LayoutMini
                        key={id}
                        layout={id}
                        count={liveCount}
                        title={previewName}
                        subtitle={styleSubtitle}
                        textColor={textColor}
                        customTextHex={customTextHex}
                        cardBg={cardBg}
                        selected={layout === id}
                        onClick={() => setLayout(id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Live Results Banner ── */}
        <LiveResultsSection
          liveCount={liveCount}
          collapsed={!liveResultsOpen}
          onToggle={() => setLiveResultsOpen((o) => !o)}
        />

        {/* ── Footer ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "13px 20px",
            borderTop: `1px solid ${T.border}`,
            flexShrink: 0,
            background: T.bg,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: `1px solid ${T.border}`,
                borderRadius: 7,
                padding: "8px 22px",
                color: T.textSub,
                fontSize: 13,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = T.textMuted)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = T.border)
              }
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              style={{
                background: T.accent,
                border: "none",
                borderRadius: 7,
                padding: "8px 22px",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = T.accentHover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = T.accent)
              }
            >
              Create Card
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: "1.5px solid rgba(255,255,255,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                }}
              >
                ✦
              </span>
            </button>
          </div>
        </div>
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
  members,
  boardLabels,
  customizeStat,
  setCustomizeStat,
  onSave,
  onClose,
  isPremium,
  onUpgradeClick,
  computeFilteredCount,
  boardName,
  boardId,
  workspaceBoards,
  fetchWorkspaceBoards,
  fetchBoardScopedData,
  workspaceId,
  workspaceName,
  fetchWorkspaces,
  currentUserId,
  trelloT,
  blankStart,
}) {
  if (!show) return null;
  if (!customizeStat)
    return (
      <StatPicker
        onSelect={(type) => setCustomizeStat(type)}
        onClose={onClose}
      />
    );
  return (
    <CardConfigModal
      key={customizeStat}
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
      boardName={boardName}
      boardId={boardId}
      workspaceBoards={workspaceBoards}
      fetchWorkspaceBoards={fetchWorkspaceBoards}
      fetchBoardScopedData={fetchBoardScopedData}
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      fetchWorkspaces={fetchWorkspaces}
      currentUserId={currentUserId}
      trelloT={trelloT}
      blankStart={blankStart}
    />
  );
}
// ── Standalone demo ───────────────────────────────────────────────────────────
export default function App() {
  const [show, setShow] = useState(true);
  const [stat, setStat] = useState("assigned");

  return (
    <div
      style={{
        background: "#0d1117",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {!show && (
        <button
          onClick={() => setShow(true)}
          style={{
            background: "#4c8fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 24px",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Open Create Stat Card
        </button>
      )}
      <CustomizeFlow
        show={show}
        customizeStat={stat}
        setCustomizeStat={setStat}
        stats={{ assigned: 24, dueThisWeek: 7, overdue: 3 }}
        memberName="Demo User"
        members={[
          { id: "u1", fullName: "Demo User", avatarColor: "#0052cc" },
          { id: "u2", fullName: "Jane Smith", avatarColor: "#7e57c2" },
          { id: "u3", fullName: "Bob Lee", avatarColor: "#1a7a4a" },
        ]}
        lists={[
          { id: "l1", name: "To Do" },
          { id: "l2", name: "In Progress" },
          { id: "l3", name: "Done" },
        ]}
        boardLabels={[
          { id: "lb1", name: "Bug", color: "red" },
          { id: "lb2", name: "Feature", color: "blue" },
          { id: "lb3", name: "Design", color: "purple" },
        ]}
        boardName="My Trello board"
        boardId="b1"
        workspaceBoards={[
          { id: "b2", name: "Product Roadmap" },
          { id: "b3", name: "Sprint Board" },
        ]}
        onSave={(type, data) => {
          console.log("Saved:", type, data);
          setShow(false);
        }}
        onClose={() => setShow(false)}
        isPremium={false}
      />
    </div>
  );
}
