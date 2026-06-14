import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const COVER_COLORS = [
  { id: "blue",   hex: "#2563eb" },
  { id: "sky",    hex: "#38bdf8" },
  { id: "green",  hex: "#22c55e" },
  { id: "yellow", hex: "#facc15" },
  { id: "orange", hex: "#f97316" },
  { id: "red",    hex: "#ef4444" },
  { id: "purple", hex: "#a855f7" },
  { id: "pink",   hex: "#ec4899" },
  { id: "slate",  hex: "#94a3b8" },
];

const COVER_GRADIENTS = [
  { id: "grad-1", css: "linear-gradient(135deg,#667eea,#764ba2)", label: "Violet" },
  { id: "grad-2", css: "linear-gradient(135deg,#f6d365,#fda085)", label: "Peach"  },
  { id: "grad-3", css: "linear-gradient(135deg,#84fab0,#8fd3f4)", label: "Mint"   },
  { id: "grad-4", css: "linear-gradient(135deg,#ff9a9e,#fecfef)", label: "Rose"   },
];

function resolveCover(id, imageUrl) {
  if (imageUrl) return null;
  const g = COVER_GRADIENTS.find((x) => x.id === id);
  if (g) return g.css;
  return COVER_COLORS.find((x) => x.id === id)?.hex ?? "#2563eb";
}

const TRELLO_LABEL_COLORS = {
  red: "#ef4444", orange: "#f97316", yellow: "#facc15", green: "#22c55e",
  blue: "#2563eb", purple: "#a855f7", pink: "#ec4899", sky: "#38bdf8",
  lime: "#a3e635", black: "#475569", null: "#94a3b8",
};

const STAT_ICONS = {
  assigned:     "ti-pin",
  dueThisWeek:  "ti-calendar",
  overdue:      "ti-alert-triangle",
  unassigned:   "ti-user",
  withLabel:    "ti-tag",
  stale:        "ti-moon",
  createdToday: "ti-sparkles",
  cardsInList:  "ti-layout-list",
};

const DEFAULT_COVER = {
  assigned: "blue", dueThisWeek: "yellow", overdue: "red",
  unassigned: "purple", withLabel: "orange", stale: "slate",
  createdToday: "green", cardsInList: "sky",
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
  { type: "assigned",     label: "Assigned to Me",   icon: "ti-pin"            },
  { type: "dueThisWeek", label: "Due This Week",     icon: "ti-calendar"       },
  { type: "overdue",     label: "Overdue Cards",     icon: "ti-alert-triangle" },
  { type: "unassigned",  label: "Unassigned Cards",  icon: "ti-user"           },
  { type: "withLabel",   label: "Cards With Label",  icon: "ti-tag"            },
  { type: "stale",       label: "Stale Cards",       icon: "ti-moon"           },
  { type: "createdToday",label: "Created Today",     icon: "ti-sparkles"       },
  { type: "cardsInList", label: "Cards in List",     icon: "ti-layout-list"    },
];

// Filter definitions — label shown in chip, options array, whether multi-select
const FILTER_DEFS = {
  due: {
    icon: "ti-calendar", label: "Due date", multi: false,
    opts: ["No due date", "Overdue", "Due today", "Due this week", "Due next week"],
  },
  member: {
    icon: "ti-user", label: "Member", multi: false,
    opts: [], // populated from props.members at render time
  },
  list: {
    icon: "ti-layout-list", label: "List", multi: true,
    opts: [], // populated from props.lists
  },
  label: {
    icon: "ti-tag", label: "Label", multi: true,
    opts: [], // populated from props.boardLabels
  },
  status: {
    icon: "ti-checkbox", label: "Status", multi: false,
    opts: ["Not done", "Done", "Has checklist", "No checklist"],
  },
  activity: {
    icon: "ti-clock-hour-4", label: "Activity", multi: false,
    opts: ["Active in 7 days", "Stale: 7+ days", "Stale: 14+ days", "Stale: 30+ days"],
  },
  unassigned: {
    icon: "ti-users", label: "Unassigned", multi: false,
    opts: ["Show only unassigned", "Exclude unassigned"],
  },
  attachment: {
    icon: "ti-paperclip", label: "Attachment", multi: false, premium: true,
    opts: ["Has attachment", "No attachment"],
  },
  comments: {
    icon: "ti-message", label: "Comments", multi: false, premium: true,
    opts: ["Has comments", "No comments"],
  },
};

const DEFAULT_FILTERS = {
  assigned:     ["due", "member"],
  dueThisWeek:  ["due", "member"],
  overdue:      ["due"],
  unassigned:   ["member", "list"],
  withLabel:    ["label"],
  stale:        ["list"],
  createdToday: ["member"],
  cardsInList:  ["list"],
};

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────

function useOutsideClick(refs, onOutside, active) {
  useEffect(() => {
    if (!active) return;
    function handler(e) {
      if (refs.every((r) => !r.current?.contains(e.target))) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, ...refs]);
}

// ─────────────────────────────────────────────────────────────
// Filter chip dropdown (portal-based)
// ─────────────────────────────────────────────────────────────

function FilterDropdown({ filterKey, values, onChange, onRemove, lists, members, boardLabels, anchorRef, onClose }) {
  const dropRef = useRef();
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useOutsideClick([dropRef, anchorRef], onClose, true);

  useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 5, left: r.left + window.scrollX });
  }, [anchorRef]);

  // Resolve dynamic options
  const def = FILTER_DEFS[filterKey];
  if (!def) return null;

  let opts = def.opts;
  if (filterKey === "member") opts = (members || []).map((m) => m.fullName || m.username || m.id);
  if (filterKey === "list")   opts = (lists || []).map((l) => l.name);
  if (filterKey === "label")  opts = (boardLabels || []).map((l) => l.name?.trim() || l.color || l.id);

  function toggle(opt) {
    if (def.multi) {
      onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
    } else {
      onChange([opt]);
      onClose();
    }
  }

  const content = (
    <div
      ref={dropRef}
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-secondary)",
        borderRadius: "var(--border-radius-md)",
        padding: 8,
        minWidth: 200,
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, padding: "0 4px" }}>
        {def.label}
      </div>

      {opts.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", padding: "6px 8px" }}>No options available</div>
      )}

      {opts.map((opt) => {
        const sel = values.includes(opt);
        return (
          <DdOption key={opt} selected={sel} multi={def.multi} onClick={() => toggle(opt)}>
            {/* label dot for label filter */}
            {filterKey === "label" && (() => {
              const lbl = (boardLabels || []).find((l) => (l.name?.trim() || l.color || l.id) === opt);
              const hex = TRELLO_LABEL_COLORS[lbl?.color] || "#94a3b8";
              return <span style={{ width: 28, height: 12, borderRadius: 3, background: hex, display: "inline-block", flexShrink: 0, marginRight: 4 }} />;
            })()}
            {/* avatar for member filter */}
            {filterKey === "member" && (() => {
              const m = (members || []).find((x) => (x.fullName || x.username || x.id) === opt);
              const initials = opt.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
              return (
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: m?.avatarColor || "#2563eb",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 500, color: "#fff", flexShrink: 0, marginRight: 4,
                }}>{initials}</span>
              );
            })()}
            {opt}
          </DdOption>
        );
      })}

      <hr style={{ border: "none", borderTop: "0.5px solid var(--color-border-tertiary)", margin: "6px 0" }} />
      <DdOption danger onClick={() => { onRemove(); onClose(); }}>
        <i className="ti ti-x" style={{ fontSize: 13 }} aria-hidden="true" />
        Clear filter
      </DdOption>
    </div>
  );

  return createPortal(content, document.body);
}

function DdOption({ children, selected, multi, danger, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 8px",
        borderRadius: "var(--border-radius-md)", fontSize: 13, cursor: "pointer",
        color: danger ? "var(--color-text-danger)" : selected ? "#2563eb" : "var(--color-text-primary)",
        fontWeight: selected && !danger ? 500 : 400,
        background: hover ? "var(--color-background-secondary)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      {multi && !danger && (
        <div style={{
          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
          border: selected ? "0.5px solid #2563eb" : "0.5px solid var(--color-border-secondary)",
          background: selected ? "#2563eb" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {selected && <i className="ti ti-check" style={{ fontSize: 10, color: "#fff" }} aria-hidden="true" />}
        </div>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Filter chip
// ─────────────────────────────────────────────────────────────

function FilterChip({ filterKey, values, onChange, onRemove, lists, members, boardLabels, isOpen, onToggle }) {
  const chipRef = useRef();
  const def = FILTER_DEFS[filterKey];
  if (!def) return null;

  function chipLabel() {
    if (!values.length) return def.label;
    if (values.length === 1) return `${def.label}: ${values[0]}`;
    return `${def.label}: ${values.slice(0, 2).join(", ")}${values.length > 2 ? ` +${values.length - 2}` : ""}`;
  }

  return (
    <>
      <div
        ref={chipRef}
        onClick={(e) => { if (!e.target.closest("[data-rm]")) onToggle(); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: isOpen ? "#EFF6FF" : "var(--color-background-secondary)",
          border: isOpen ? "0.5px solid #2563eb" : "0.5px solid var(--color-border-secondary)",
          borderRadius: 20, padding: "5px 10px 5px 9px",
          fontSize: 12, color: isOpen ? "#1D4ED8" : "var(--color-text-primary)",
          cursor: "pointer", userSelect: "none", transition: "all 0.12s",
        }}
      >
        <i className={`ti ${def.icon}`} style={{ fontSize: 13, color: isOpen ? "#2563eb" : "var(--color-text-secondary)" }} aria-hidden="true" />
        <span>{chipLabel()}</span>
        <i className="ti ti-chevron-down" style={{ fontSize: 11, color: "var(--color-text-tertiary)" }} aria-hidden="true" />
        <i
          data-rm="1"
          className="ti ti-x"
          aria-hidden="true"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ fontSize: 11, color: "var(--color-text-tertiary)", cursor: "pointer", marginLeft: 1 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text-danger)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-tertiary)")}
        />
      </div>

      {isOpen && (
        <FilterDropdown
          filterKey={filterKey} values={values} onChange={onChange}
          onRemove={onRemove} anchorRef={chipRef} onClose={onToggle}
          lists={lists} members={members} boardLabels={boardLabels}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Add-filter dropdown
// ─────────────────────────────────────────────────────────────

function AddFilterMenu({ activeKeys, onAdd, isPremium, onUpgradeClick }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef();
  const menuRef = useRef();
  useOutsideClick([btnRef, menuRef], () => setOpen(false), open);

  const available = Object.keys(FILTER_DEFS).filter((k) => !activeKeys.includes(k));

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        style={{
          fontSize: 12, color: "#2563eb", background: "none", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
          fontFamily: "inherit", padding: 0,
        }}
      >
        <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" />
        Add filter
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 400,
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--border-radius-md)",
            padding: 8, minWidth: 210,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", padding: "2px 6px 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Add a filter
          </div>

          {available.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", padding: "4px 8px" }}>All filters added</div>
          )}

          {available.map((k) => {
            const def = FILTER_DEFS[k];
            const blocked = def.premium && !isPremium;
            return (
              <AddMenuRow
                key={k}
                icon={def.icon}
                label={def.label}
                premium={def.premium}
                onClick={() => {
                  if (blocked) { onUpgradeClick?.(); return; }
                  onAdd(k);
                  setOpen(false);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddMenuRow({ icon, label, premium, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 8px",
        borderRadius: "var(--border-radius-md)", fontSize: 13,
        color: "var(--color-text-primary)", cursor: "pointer",
        background: hover ? "var(--color-background-secondary)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 14, color: "var(--color-text-secondary)" }} aria-hidden="true" />
      <span style={{ flex: 1 }}>{label}</span>
      {premium && (
        <span style={{ fontSize: 10, background: "var(--color-background-warning)", color: "var(--color-text-warning)", padding: "1px 6px", borderRadius: 20, display: "flex", alignItems: "center", gap: 3 }}>
          <i className="ti ti-lock" style={{ fontSize: 9 }} aria-hidden="true" /> Premium
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sidebar active-filters summary
// ─────────────────────────────────────────────────────────────

function SidebarFilters({ activeFilters, filterValues }) {
  const active = activeFilters.filter((k) => (filterValues[k] || []).length > 0);
  if (!active.length) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 7 }}>
        Active filters
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {active.map((k) => {
          const def = FILTER_DEFS[k];
          const vals = filterValues[k] || [];
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--color-text-secondary)" }}>
              <i className={`ti ${def?.icon || "ti-filter"}`} style={{ fontSize: 12 }} aria-hidden="true" />
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                {vals.length ? vals.join(", ") : "Any"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Color swatch picker
// ─────────────────────────────────────────────────────────────

function ColorSwatchPicker({ selected, onChange, isPremium, onUpgradeClick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {COVER_COLORS.map(({ id, hex }) => {
          const picked = selected === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              title={id}
              style={{
                width: 26, height: 26, borderRadius: "50%", background: hex,
                border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
                outline: picked ? `2.5px solid ${hex}` : "none",
                outlineOffset: picked ? 2 : 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "transform 0.1s",
                transform: picked ? "scale(1.1)" : "scale(1)",
              }}
            >
              {picked && <i className="ti ti-check" style={{ fontSize: 12, color: "#fff" }} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Gradients</span>
          {!isPremium && (
            <span style={{ fontSize: 10, fontWeight: 500, background: "var(--color-background-warning)", color: "var(--color-text-warning)", padding: "2px 8px", borderRadius: "var(--border-radius-md)" }}>
              Premium
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COVER_GRADIENTS.map(({ id, css, label }) => {
            const picked = selected === id;
            return (
              <button
                key={id}
                title={isPremium ? label : `${label} — Premium`}
                onClick={() => { if (!isPremium) { onUpgradeClick?.(); return; } onChange(id); }}
                style={{
                  width: 26, height: 26, borderRadius: "50%", background: css,
                  border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
                  opacity: isPremium ? 1 : 0.45,
                  outline: picked && isPremium ? "2.5px solid #888" : "none",
                  outlineOffset: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "transform 0.1s",
                  transform: picked ? "scale(1.1)" : "scale(1)",
                }}
              >
                {!isPremium && <i className="ti ti-lock" style={{ fontSize: 11, color: "#fff" }} aria-hidden="true" />}
                {picked && isPremium && <i className="ti ti-check" style={{ fontSize: 12, color: "#fff" }} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {!isPremium && (
          <button
            onClick={onUpgradeClick}
            style={{ marginTop: 8, fontSize: 12, color: "#2563eb", background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            Unlock with Premium →
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card preview (left panel)
// ─────────────────────────────────────────────────────────────

function CardPreview({ statType, count, cardName, coverColor, coverImage }) {
  const bg = resolveCover(coverColor, coverImage);
  const icon = STAT_ICONS[statType] || "ti-pin";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          borderRadius: "var(--border-radius-md)",
          overflow: "hidden",
          position: "relative",
          minHeight: 88,
          background: bg || "transparent",
        }}
      >
        {coverImage && (
          <img src={coverImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} />
        <div style={{ position: "relative", zIndex: 1, padding: "14px 12px" }}>
          <i className={`ti ${icon}`} style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", position: "absolute", top: 9, right: 9 }} aria-hidden="true" />
          <div style={{ fontSize: 22, fontWeight: 500, color: "#fff" }}>{count}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 5, lineHeight: 1.4 }}>{cardName}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center" }}>Preview</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat picker (step 1)
// ─────────────────────────────────────────────────────────────

function StatPicker({ onSelect, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, fontFamily: "inherit",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-secondary)",
          borderRadius: "var(--border-radius-lg)",
          width: 300, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Dashcards — Track</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: 0 }}>
            <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" />
          </button>
        </div>
        <div style={{ padding: "10px 8px 12px" }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "4px 8px 10px" }}>Select a stat to configure</div>
          {STAT_LIST.map(({ type, label, icon }) => (
            <StatPickerRow key={type} icon={icon} label={label} onClick={() => onSelect(type)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatPickerRow({ icon, label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 8px", borderRadius: "var(--border-radius-md)", cursor: "pointer",
        background: hover ? "var(--color-background-secondary)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 16, color: "var(--color-text-secondary)" }} aria-hidden="true" />
        <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{label}</span>
      </div>
      <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--color-text-tertiary)" }} aria-hidden="true" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card config modal (step 2)
// ─────────────────────────────────────────────────────────────

const TABS = ["Filters", "Alerts", "Style"];

function CardConfigModal({
  statType, statValue, lists, memberName, members, boardLabels,
  isPremium, computeFilteredCount,
  onSave, onBack, onClose, onUpgradeClick,
}) {
  const [tab,                setTab]                = useState("filters");
  const [cardName,           setCardName]           = useState(DEFAULT_NAMES[statType] || "");
  const [nameEdited,         setNameEdited]         = useState(false);
  const [coverColor,         setCoverColor]         = useState(DEFAULT_COVER[statType] || "blue");
  const [coverImage,         setCoverImage]         = useState(null);
  const [alertOn,            setAlertOn]            = useState(true);
  const [boardScope,         setBoardScope]         = useState("this");
  const [memberScope,        setMemberScope]        = useState("me");
  const [activeFilters,      setActiveFilters]      = useState(() => DEFAULT_FILTERS[statType] || ["due"]);
  const [filterValues,       setFilterValues]       = useState({ due: [], member: [], list: [], label: [], status: [], activity: [], unassigned: [] });
  const [openChip,           setOpenChip]           = useState(null);
  const fileRef = useRef();

  function setFV(key, vals) { setFilterValues((p) => ({ ...p, [key]: vals })); }
  function addFilter(key)    { setActiveFilters((p) => [...p, key]); setOpenChip(key); }
  function removeFilter(key) { setActiveFilters((p) => p.filter((k) => k !== key)); setFV(key, []); setOpenChip(null); }

  // Smart auto-name
  const smartName = (() => {
    const { due, member: mems, label: labs, list: lsts } = filterValues;
    const parts = [];
    if (due.length === 1)    parts.push(due[0]);
    else if (due.length > 1) parts.push(`${due.length} due filters`);
    if (mems.length === 1)    parts.push(`· ${mems[0].split(" ")[0]}`);
    else if (mems.length > 1) parts.push(`· ${mems.length} members`);
    if (labs.length === 1)    parts.push(`· ${labs[0]}`);
    else if (labs.length > 1) parts.push(`· ${labs.length} labels`);
    if (lsts.length === 1)    parts.push(`· ${lsts[0]}`);
    else if (lsts.length > 1) parts.push(`· ${lsts.length} lists`);
    return parts.length ? parts.join(" ") : DEFAULT_NAMES[statType];
  })();

  const displayName = nameEdited ? cardName : smartName;
  const hasVals = Object.values(filterValues).some((v) => v.length > 0);

  const liveCount = computeFilteredCount
    ? computeFilteredCount(statType, { due: filterValues.due, members: filterValues.member, labels: filterValues.label, lists: filterValues.list })
    : (statValue ?? 0);

  function handleSave() {
    onSave(statType, {
      cardName: displayName, cover: coverColor, coverImage,
      due: filterValues.due, members: filterValues.member,
      labels: filterValues.label, lists: filterValues.list,
    });
  }

  const selectStyle = {
    width: "100%", fontSize: 12, padding: "7px 10px",
    borderRadius: "var(--border-radius-md)",
    border: "0.5px solid var(--color-border-secondary)",
    background: "var(--color-background-secondary)",
    color: "var(--color-text-primary)",
    fontFamily: "inherit", cursor: "pointer",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, fontFamily: "inherit",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-secondary)",
          borderRadius: "var(--border-radius-lg)",
          width: 640, maxWidth: "95vw", maxHeight: "92vh",
          display: "flex", flexDirection: "column", overflow: "visible",
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: "0.5px solid var(--color-border-tertiary)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: 0, display: "flex" }}>
              <i className="ti ti-arrow-left" style={{ fontSize: 18 }} aria-hidden="true" />
            </button>
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Dashcards — Track</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: 0 }}>
            <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "175px 1fr", flex: 1, overflow: "hidden", minHeight: 0 }}>

          {/* Left panel */}
          <div style={{
            background: "var(--color-background-secondary)",
            padding: "14px 12px", borderRight: "0.5px solid var(--color-border-tertiary)",
            display: "flex", flexDirection: "column", gap: 10, overflowY: "auto",
          }}>
            <CardPreview
              statType={statType} count={liveCount}
              cardName={displayName} coverColor={coverColor} coverImage={coverImage}
            />
            <SidebarFilters activeFilters={activeFilters} filterValues={filterValues} />
          </div>

          {/* Right panel */}
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", flexShrink: 0 }}>
              {TABS.map((t) => {
                const k = t.toLowerCase();
                const active = tab === k;
                return (
                  <button
                    key={k}
                    onClick={() => { setTab(k); if (k !== "filters") setOpenChip(null); }}
                    style={{
                      flex: 1, padding: "11px 8px", fontSize: 13, fontWeight: active ? 500 : 400,
                      background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                      borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                      color: active ? "#2563eb" : "var(--color-text-secondary)",
                      transition: "all 0.12s",
                    }}
                  >{t}</button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>

              {/* ── FILTERS TAB ── */}
              {tab === "filters" && <>
                {/* Name */}
                <div>
                  <label style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => { setCardName(e.target.value); setNameEdited(true); }}
                    placeholder={DEFAULT_NAMES[statType]}
                    style={{
                      width: "100%", boxSizing: "border-box", fontSize: 13,
                      padding: "8px 10px", borderRadius: "var(--border-radius-md)",
                      border: "0.5px solid var(--color-border-secondary)",
                      background: "var(--color-background-secondary)",
                      color: "var(--color-text-primary)", fontFamily: "inherit",
                      outline: "none",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--color-border-secondary)")}
                  />
                  {!nameEdited && hasVals && (
                    <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>
                      Auto-generated from filters —{" "}
                      <span style={{ color: "#2563eb", cursor: "pointer" }} onClick={() => { setCardName(smartName); setNameEdited(true); }}>edit</span>
                    </div>
                  )}
                </div>

                {/* Scope */}
                <div>
                  <label style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                    Scope
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { lbl: "Board", val: boardScope, set: setBoardScope, opts: [{ v: "this", l: "This board" }, { v: "all", l: "All workspace boards" }] },
                      { lbl: "Member", val: memberScope, set: setMemberScope, opts: [{ v: "me", l: `Me (${memberName?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "SB"})` }, { v: "anyone", l: "Any member" }] },
                    ].map(({ lbl, val, set, opts }) => (
                      <div key={lbl}>
                        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>{lbl}</div>
                        <select value={val} onChange={(e) => set(e.target.value)} style={selectStyle}>
                          {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filters */}
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                    <label style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Filters
                    </label>
                    <AddFilterMenu
                      activeKeys={activeFilters} onAdd={addFilter}
                      isPremium={isPremium} onUpgradeClick={onUpgradeClick}
                    />
                  </div>

                  {activeFilters.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
                      {activeFilters.map((key) => (
                        <FilterChip
                          key={key} filterKey={key}
                          values={filterValues[key] || []}
                          onChange={(vals) => setFV(key, vals)}
                          onRemove={() => removeFilter(key)}
                          isOpen={openChip === key}
                          onToggle={() => setOpenChip((c) => c === key ? null : key)}
                          lists={lists} members={members} boardLabels={boardLabels}
                        />
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                    <i className="ti ti-filter" style={{ fontSize: 13 }} aria-hidden="true" />
                    Matching{" "}
                    <strong style={{ color: "var(--color-text-primary)", margin: "0 2px" }}>{liveCount}</strong>
                    {" "}cards
                  </div>
                </div>
              </>}

              {/* ── ALERTS TAB ── */}
              {tab === "alerts" && <>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
                  Get notified when this stat hits a threshold.
                </p>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "var(--color-background-secondary)",
                  border: "0.5px solid var(--color-border-tertiary)",
                  borderRadius: "var(--border-radius-md)", padding: "10px 12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <i className="ti ti-bell" style={{ fontSize: 16, color: "var(--color-text-warning)" }} aria-hidden="true" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Count exceeds 5</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>Notify via Trello notification</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setAlertOn((v) => !v)}
                    aria-label={alertOn ? "Disable alert" : "Enable alert"}
                    style={{
                      width: 34, height: 18, borderRadius: 20, border: "none",
                      background: alertOn ? "#2563eb" : "var(--color-border-secondary)",
                      cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: "absolute", width: 12, height: 12, background: "#fff",
                      borderRadius: "50%", top: 3, left: alertOn ? 19 : 3, transition: "left 0.2s",
                    }} />
                  </button>
                </div>
                <button style={{
                  display: "flex", alignItems: "center", gap: 6, fontSize: 13,
                  color: "#2563eb", background: "none",
                  border: "0.5px dashed var(--color-border-secondary)",
                  borderRadius: "var(--border-radius-md)", padding: "10px 12px",
                  cursor: "pointer", width: "100%", fontFamily: "inherit",
                }}>
                  <i className="ti ti-plus" style={{ fontSize: 15 }} aria-hidden="true" /> Add alert
                </button>
                <div style={{
                  background: "var(--color-background-warning)",
                  borderRadius: "var(--border-radius-md)", padding: "10px 12px",
                  fontSize: 12, color: "var(--color-text-warning)",
                  display: "flex", gap: 8, lineHeight: 1.55,
                }}>
                  <i className="ti ti-info-circle" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                  <span>Alerts fire at most once per day. Upgrade to Pro for real-time alerts and email delivery.</span>
                </div>
              </>}

              {/* ── STYLE TAB ── */}
              {tab === "style" && <>
                <div>
                  <label style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                    Cover color
                  </label>
                  <ColorSwatchPicker
                    selected={coverImage ? null : coverColor}
                    onChange={(id) => { setCoverColor(id); setCoverImage(null); }}
                    isPremium={isPremium} onUpgradeClick={onUpgradeClick}
                  />
                </div>

                <hr style={{ border: "none", borderTop: "0.5px solid var(--color-border-tertiary)", margin: "2px 0" }} />

                <div>
                  <label style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                    Cover image{" "}
                    <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                      (optional — overrides color)
                    </span>
                  </label>
                  <input
                    ref={fileRef} type="file" accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = (ev) => setCoverImage(ev.target.result);
                      r.readAsDataURL(f);
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => fileRef.current?.click()}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, fontSize: 13,
                        padding: "8px 14px", borderRadius: "var(--border-radius-md)",
                        border: "0.5px solid var(--color-border-secondary)",
                        background: "var(--color-background-secondary)",
                        color: "var(--color-text-primary)", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      <i className="ti ti-upload" style={{ fontSize: 15 }} aria-hidden="true" />
                      {coverImage ? "Change image" : "Upload image"}
                    </button>
                    {coverImage && (
                      <button
                        onClick={() => setCoverImage(null)}
                        style={{
                          fontSize: 13, padding: "8px 12px", borderRadius: "var(--border-radius-md)",
                          border: "0.5px solid var(--color-border-secondary)",
                          background: "none", color: "var(--color-text-secondary)",
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >Remove</button>
                    )}
                  </div>
                  {coverImage && (
                    <div style={{ marginTop: 8, width: "100%", height: 48, borderRadius: "var(--border-radius-md)", overflow: "hidden", border: "0.5px solid var(--color-border-secondary)" }}>
                      <img src={coverImage} alt="Cover preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                </div>
              </>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "12px 16px", borderTop: "0.5px solid var(--color-border-tertiary)", flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{ fontSize: 13, padding: "8px 16px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "none", color: "var(--color-text-secondary)", cursor: "pointer", fontFamily: "inherit" }}
          >Cancel</button>
          <button
            onClick={handleSave}
            style={{ fontSize: 13, padding: "8px 20px", borderRadius: "var(--border-radius-md)", background: "#2563eb", color: "#fff", border: "none", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1D4ED8")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
          >Start tracking</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────

export function CustomizeFlow({
  show, lists, stats, memberName, members, boardLabels,
  customizeStat, setCustomizeStat,
  onSave, onClose,
  isPremium, onUpgradeClick,
  computeFilteredCount,
}) {
  if (!show) return null;
  if (!customizeStat) {
    return <StatPicker onSelect={(type) => setCustomizeStat(type)} onClose={onClose} />;
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