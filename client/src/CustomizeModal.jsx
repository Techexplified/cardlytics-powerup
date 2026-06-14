import { useState, useRef, useEffect, useCallback } from "react";
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

function resolveCoverBackground(coverId) {
  const grad = COVER_GRADIENTS.find((g) => g.id === coverId);
  if (grad) return grad.css;
  const solid = COVER_COLORS.find((c) => c.id === coverId);
  return solid?.hex || "#0052cc";
}

const TRELLO_LABEL_COLORS = {
  red: "#c0392b", orange: "#e67e22", yellow: "#e6a817", green: "#1a7a4a",
  blue: "#0052cc", purple: "#7e57c2", pink: "#e91e8c", sky: "#29b6f6",
  lime: "#51e898", black: "#374151", null: "#888888",
};

const STAT_EMOJIS = {
  assigned: "📌", dueThisWeek: "📅", overdue: "⚠️", unassigned: "👤",
  withLabel: "🏷️", stale: "💤", createdToday: "✨", cardsInList: "📋",
};

const DEFAULT_COVER = {
  assigned: "blue", dueThisWeek: "yellow", overdue: "red", unassigned: "purple",
  withLabel: "orange", stale: "black", createdToday: "green", cardsInList: "sky",
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
  { type: "assigned",      label: "Assigned to Me",   emoji: "📌" },
  { type: "dueThisWeek",  label: "Due This Week",     emoji: "📅" },
  { type: "overdue",      label: "Overdue Cards",     emoji: "⚠️" },
  { type: "unassigned",   label: "Unassigned Cards",  emoji: "👤" },
  { type: "withLabel",    label: "Cards With Label",  emoji: "🏷️" },
  { type: "stale",        label: "Stale Cards",       emoji: "💤" },
  { type: "createdToday", label: "Created Today",     emoji: "✨" },
  { type: "cardsInList",  label: "Cards in List",     emoji: "📋" },
];

const DUE_OPTIONS = [
  { value: "2days",   label: "Due in 2 days" },
  { value: "1week",   label: "Due in 1 week" },
  { value: "2weeks",  label: "Due in 2 weeks" },
  { value: "1month",  label: "Due in 1 month" },
  { value: "overdue", label: "Overdue" },
  { value: "nodate",  label: "No due date" },
  { value: "custom",  label: "Custom range…" },
];

// Filter type definitions — determines what picker opens for each filter
const FILTER_TYPES = {
  due:        { icon: "🕐", label: "Due date",  valueKey: "due",     multi: true  },
  member:     { icon: "👤", label: "Member",     valueKey: "members", multi: true  },
  list:       { icon: "☰",  label: "List",       valueKey: "lists",   multi: true  },
  label:      { icon: "🏷", label: "Label",      valueKey: "labels",  multi: true  },
  status:     { icon: "📋", label: "Status",     valueKey: null,      multi: false },
  activity:   { icon: "🕐", label: "Activity",   valueKey: null,      multi: false },
  unassigned: { icon: "👤", label: "Unassigned", valueKey: null,      multi: false },
};

// Extra filters accessible via "+ Add filter" (free vs premium)
const ADDABLE_FILTERS = [
  { key: "status",     icon: "📋", label: "Status",     premium: false },
  { key: "activity",   icon: "🕐", label: "Activity",   premium: false },
  { key: "unassigned", icon: "👤", label: "Unassigned", premium: false },
  { key: "attachment", icon: "📎", label: "Attachment", premium: true  },
  { key: "comments",   icon: "💬", label: "Comments",   premium: true  },
];

// ── Small helpers ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "#555",
      letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #252930" }} />;
}

// ── Portal helper ─────────────────────────────────────────────────────────────
function PortalDropdown({ anchorRef, open, children, portalRef }) {
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    function measure() {
      const rect = anchorRef.current.getBoundingClientRect();
      const maxHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUpward = spaceBelow < 140 && spaceAbove > spaceBelow;
      if (openUpward) {
        const h = Math.min(maxHeight, Math.max(spaceAbove, 80));
        setCoords({ top: rect.top - h - 4, left: rect.left, width: rect.width, maxHeight: h, openUpward: true });
      } else {
        const h = Math.min(maxHeight, Math.max(spaceBelow, 80));
        setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight: h, openUpward: false });
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
        position: "fixed", top: coords.top, left: coords.left, width: Math.max(coords.width, 200),
        background: "#1e2128", border: "1px solid #2e3340", borderRadius: 8,
        zIndex: 2147483647,
        boxShadow: coords.openUpward ? "0 -4px 20px rgba(0,0,0,0.7)" : "0 4px 20px rgba(0,0,0,0.7)",
        overflow: "hidden", maxHeight: coords.maxHeight, overflowY: "auto",
        scrollbarWidth: "thin", scrollbarColor: "#3a3a3a transparent",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

// ── FilterValuePicker — dropdown to pick a value for a pill ──────────────────
function FilterValuePicker({ filterKey, selected, onChange, lists, members, boardLabels, onClose }) {
  if (filterKey === "due") {
    return (
      <>
        {DUE_OPTIONS.map((opt) => (
          <DropdownItem
            key={opt.value}
            checked={selected.includes(opt.value)}
            onClick={() => {
              const next = selected.includes(opt.value)
                ? selected.filter((v) => v !== opt.value)
                : [...selected, opt.value];
              onChange(next);
            }}
          >
            {opt.label}
          </DropdownItem>
        ))}
      </>
    );
  }
  if (filterKey === "member") {
    const opts = members && members.length > 0
      ? members
      : [];
    if (opts.length === 0) return <div style={{ padding: "10px 14px", fontSize: 12, color: "#555" }}>No members</div>;
    return (
      <>
        {opts.map((m) => {
          const initials = m.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
          return (
            <DropdownItem
              key={m.id}
              checked={selected.includes(m.id)}
              onClick={() => {
                const next = selected.includes(m.id)
                  ? selected.filter((v) => v !== m.id)
                  : [...selected, m.id];
                onChange(next);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: m.avatarColor || "#0052cc",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>{initials}</div>
                {m.fullName}
              </div>
            </DropdownItem>
          );
        })}
      </>
    );
  }
  if (filterKey === "label") {
    const opts = boardLabels || [];
    if (opts.length === 0) return <div style={{ padding: "10px 14px", fontSize: 12, color: "#555" }}>No labels</div>;
    return (
      <>
        {opts.map((lbl) => {
          const hex = TRELLO_LABEL_COLORS[lbl.color] || "#888";
          const name = lbl.name?.trim() || lbl.color || "Unnamed";
          return (
            <DropdownItem
              key={lbl.id}
              checked={selected.includes(lbl.id)}
              onClick={() => {
                const next = selected.includes(lbl.id)
                  ? selected.filter((v) => v !== lbl.id)
                  : [...selected, lbl.id];
                onChange(next);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 28, height: 14, borderRadius: 3, background: hex, display: "inline-block", flexShrink: 0 }} />
                <span style={{ color: name === lbl.color ? "#888" : "#ccc" }}>{name}</span>
              </div>
            </DropdownItem>
          );
        })}
      </>
    );
  }
  if (filterKey === "list") {
    const opts = lists || [];
    if (opts.length === 0) return <div style={{ padding: "10px 14px", fontSize: 12, color: "#555" }}>No lists</div>;
    return (
      <>
        {opts.map((l) => (
          <DropdownItem
            key={l.id}
            checked={selected.includes(l.id)}
            onClick={() => {
              const next = selected.includes(l.id)
                ? selected.filter((v) => v !== l.id)
                : [...selected, l.id];
              onChange(next);
            }}
          >
            {l.name}
          </DropdownItem>
        ))}
      </>
    );
  }
  return null;
}

function DropdownItem({ children, checked, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 14px", cursor: "pointer", fontSize: 12,
        color: "#bbb", background: "transparent", transition: "background 0.12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#252a35")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {checked !== undefined && (
        <div style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          border: checked ? "1.5px solid #0052cc" : "1.5px solid #5a5a5a",
          background: checked ? "#0052cc" : "#1e1e1e",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, color: "#fff", fontWeight: 700,
        }}>
          {checked && "✓"}
        </div>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}

// ── FilterPill — single active filter chip with inline value picker ───────────
function FilterPill({ filterKey, values, onValuesChange, onRemove, lists, members, boardLabels }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef();
  const portalRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current?.contains(e.target) || portalRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const def = FILTER_TYPES[filterKey];
  if (!def) return null;

  // Build display label for the pill value
  function valueLabel() {
    if (!values || values.length === 0) return null;
    if (filterKey === "due") {
      if (values.length === 1) return DUE_OPTIONS.find((o) => o.value === values[0])?.label || values[0];
      return `${values.length} dates`;
    }
    if (filterKey === "member") {
      if (values.length === 1) {
        const m = (members || []).find((x) => x.id === values[0]);
        return m ? m.fullName.split(" ")[0] : values[0];
      }
      return `${values.length} members`;
    }
    if (filterKey === "label") {
      if (values.length === 1) {
        const lbl = (boardLabels || []).find((l) => l.id === values[0]);
        return lbl?.name?.trim() || lbl?.color || values[0];
      }
      return `${values.length} labels`;
    }
    if (filterKey === "list") {
      if (values.length === 1) {
        return (lists || []).find((l) => l.id === values[0])?.name || values[0];
      }
      return `${values.length} lists`;
    }
    return null;
  }

  const hasValuePicker = ["due", "member", "label", "list"].includes(filterKey);
  const label = valueLabel();

  return (
    <div ref={containerRef} style={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
      <div
        ref={triggerRef}
        onClick={() => hasValuePicker && setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "#1a1d24", border: `1px solid ${open ? "#3a4050" : "#2e3340"}`,
          borderRadius: 6, padding: "5px 8px 5px 10px",
          fontSize: 12, color: "#c0c6d4",
          cursor: hasValuePicker ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 13 }}>{def.icon}</span>
        <span style={{ color: "#888" }}>{def.label}:</span>
        {label && (
          <>
            <span style={{ color: "#e0e0e0", fontWeight: 600 }}>{label}</span>
            {hasValuePicker && <span style={{ fontSize: 10, color: "#444" }}>›</span>}
          </>
        )}
        {!label && hasValuePicker && (
          <span style={{ color: "#666", fontSize: 10 }}>any ›</span>
        )}
        <span
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ fontSize: 11, color: "#444", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
        >✕</span>
      </div>

      {hasValuePicker && (
        <PortalDropdown anchorRef={triggerRef} open={open} portalRef={portalRef}>
          <div style={{ padding: "6px 0" }}>
            <FilterValuePicker
              filterKey={filterKey}
              selected={values || []}
              onChange={onValuesChange}
              lists={lists}
              members={members}
              boardLabels={boardLabels}
              onClose={() => setOpen(false)}
            />
          </div>
        </PortalDropdown>
      )}
    </div>
  );
}

// ── AddFilterDropdown — "+ Add filter" button with dropdown ──────────────────
function AddFilterDropdown({ activeKeys, onAdd, isPremium, onUpgradeClick }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef();
  const portalRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current?.contains(e.target) || portalRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const available = ADDABLE_FILTERS.filter((f) => !activeKeys.includes(f.key));

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: 12, color: "#5a9fff", background: "none", border: "none",
          cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0,
        }}
      >
        + Add filter
      </button>
      <PortalDropdown anchorRef={triggerRef} open={open} portalRef={portalRef}>
        <div style={{ padding: "6px 0" }}>
          <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Add a filter
          </div>
          {available.length === 0 && (
            <div style={{ padding: "10px 14px", fontSize: 12, color: "#555" }}>All filters added</div>
          )}
          {available.map((f) => (
            <div
              key={f.key}
              onClick={() => {
                if (f.premium && !isPremium) { onUpgradeClick?.(); return; }
                onAdd(f.key);
                setOpen(false);
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 14px", cursor: "pointer", fontSize: 13, color: "#bbb",
                background: "transparent", transition: "background 0.12s",
                opacity: f.premium && !isPremium ? 0.8 : 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#252a35")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, color: "#666" }}>{f.icon}</span>
                {f.label}
              </div>
              {f.premium && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: "#a0620a",
                  background: "#3d2a00", borderRadius: 4, padding: "2px 6px",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}>
                  Premium
                </span>
              )}
            </div>
          ))}
        </div>
      </PortalDropdown>
    </div>
  );
}

// ── ActiveFiltersSummary (left sidebar) ──────────────────────────────────────
function ActiveFiltersSummary({ activeFilters, filterValues, lists, members, boardLabels }) {
  const groups = activeFilters.filter((k) => {
    const vals = filterValues[k];
    return vals && vals.length > 0;
  });
  if (groups.length === 0) return null;

  function renderChip(key, val) {
    if (key === "due") return DUE_OPTIONS.find((o) => o.value === val)?.label || val;
    if (key === "member") {
      const m = (members || []).find((x) => x.id === val);
      return m ? m.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : val;
    }
    if (key === "label") {
      const lbl = (boardLabels || []).find((l) => l.id === val);
      const hex = TRELLO_LABEL_COLORS[lbl?.color] || "#888";
      const name = lbl?.name?.trim() || lbl?.color || val;
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: hex, display: "inline-block", flexShrink: 0 }} />
          {name}
        </span>
      );
    }
    if (key === "list") return (lists || []).find((l) => l.id === val)?.name || val;
    return val;
  }

  return (
    <div style={{
      background: "#141720", border: "1px solid #252930",
      borderRadius: 8, padding: "10px",
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
        Active filters
      </div>
      {groups.map((k) => {
        const def = FILTER_TYPES[k];
        const vals = filterValues[k] || [];
        if (!def) return null;
        return (
          <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, flexShrink: 0, lineHeight: "20px", color: "#777" }}>{def.icon}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
              {vals.map((v) => (
                <span key={v} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "#1e2128", border: "1px solid #2e3340",
                  borderRadius: 4, padding: "2px 7px", fontSize: 10, color: "#bbb",
                  lineHeight: "16px", maxWidth: "100%",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {renderChip(k, v)}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MemberBadges ──────────────────────────────────────────────────────────────
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
          <div key={id} title={m?.fullName || id} style={{
            width: 22, height: 22, borderRadius: "50%", background: color,
            border: "2px solid rgba(0,0,0,0.4)", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#fff",
            marginLeft: idx === 0 ? 0 : -6, flexShrink: 0,
          }}>
            {initials}
          </div>
        );
      })}
      {overflow > 0 && (
        <div style={{
          width: 22, height: 22, borderRadius: "50%", background: "#333",
          border: "2px solid rgba(0,0,0,0.4)", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#aaa",
          marginLeft: -6, flexShrink: 0,
        }}>
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ── StatPicker ────────────────────────────────────────────────────────────────
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
// ── ColorSwatchPicker ─────────────────────────────────────────────────────────
function ColorSwatchPicker({ selected, onChange, isPremium, onUpgradeClick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 0 4px" }}>
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
              transform: selected === id ? "scale(1.15)" : "scale(1)", position: "relative",
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
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>Gradients</span>
          {!isPremium && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#1a1a1a",
              background: "linear-gradient(135deg, #e6a817, #e67e22)",
              borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em", textTransform: "uppercase",
            }}>Premium</span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {COVER_GRADIENTS.map(({ id, css, label }) => (
            <button
              key={id}
              title={isPremium ? label : `${label} — Premium feature`}
              onClick={() => { if (!isPremium) { onUpgradeClick?.(); return; } onChange(id); }}
              style={{
                width: 28, height: 28, borderRadius: 6, background: css,
                border: selected === id ? "2px solid #fff" : "2px solid transparent",
                outline: selected === id ? "2px solid #888" : "none",
                cursor: "pointer", padding: 0, transition: "transform 0.1s",
                transform: selected === id ? "scale(1.15)" : "scale(1)",
                position: "relative", opacity: isPremium ? 1 : 0.55,
              }}
            >
              {selected === id && isPremium && (
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>✓</span>
              )}
              {!isPremium && (
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>🔒</span>
              )}
            </button>
          ))}
        </div>
        {!isPremium && (
          <div onClick={onUpgradeClick} style={{ marginTop: 6, fontSize: 11, color: "#29b6f6", cursor: "pointer", textDecoration: "underline", display: "inline-block" }}>
            Unlock gradient covers with Premium →
          </div>
        )}
      </div>
    </div>
  );
}

// ── ImageUpload ───────────────────────────────────────────────────────────────
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
            background: "#1a1d24", border: "1px solid #2e3340", borderRadius: 6,
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
              background: "none", border: "1px solid #2e3340", borderRadius: 6,
              padding: "6px 10px", color: "#888", fontSize: 12,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            }}
          >Remove</button>
        )}
      </div>
      {imageUrl && (
        <div style={{ width: "100%", height: 48, borderRadius: 6, overflow: "hidden", border: "1px solid #2e3340" }}>
          <img src={imageUrl} alt="Cover preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
    </div>
  );
}

// ── CardConfigModal ───────────────────────────────────────────────────────────
function CardConfigModal({
  statType, statValue, lists, memberName, members, boardLabels,
  isPremium, computeFilteredCount, onSave, onBack, onClose, onUpgradeClick,
}) {
  const [activeTab, setActiveTab] = useState("filters");
  const [cardName, setCardName] = useState(DEFAULT_NAMES[statType] || "");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [coverColor, setCoverColor] = useState(DEFAULT_COVER[statType] || "blue");
  const [coverImage, setCoverImage] = useState(null);
  const [alertOn, setAlertOn] = useState(true);

  // Board / Member scope
  const [boardScope, setBoardScope] = useState("this");
  const [memberScope, setMemberScope] = useState("me");

  // Active filter keys (ordered list of which pills are showing)
  // Seeded with default filters based on stat type
  const defaultActiveFilters = useCallback(() => {
    const defaults = {
      assigned:      ["due", "member"],
      dueThisWeek:   ["due", "member"],
      overdue:       ["due"],
      unassigned:    ["member", "list"],
      withLabel:     ["label"],
      stale:         ["list"],
      createdToday:  ["member"],
      cardsInList:   ["list"],
    };
    return defaults[statType] || ["due"];
  }, [statType]);

  const [activeFilters, setActiveFilters] = useState(defaultActiveFilters);

  // Values for each filter type
  const [filterValues, setFilterValues] = useState({
    due: [], member: [], label: [], list: [],
    status: [], activity: [], unassigned: [],
  });

  function setFilterValue(key, vals) {
    setFilterValues((prev) => ({ ...prev, [key]: vals }));
  }

  function addFilter(key) {
    if (!activeFilters.includes(key)) {
      setActiveFilters((prev) => [...prev, key]);
    }
  }

  function removeFilter(key) {
    setActiveFilters((prev) => prev.filter((k) => k !== key));
    setFilterValues((prev) => ({ ...prev, [key]: [] }));
  }

  // Compute matching count
  const selectedMembers = filterValues.member || [];
  const resolvedCoverBg = coverImage ? null : resolveCoverBackground(coverColor);
  const emoji = STAT_EMOJIS[statType] || "📌";

  const liveCount = computeFilteredCount
    ? computeFilteredCount(statType, {
        due: filterValues.due,
        members: filterValues.member,
        labels: filterValues.label,
        lists: filterValues.list,
      })
    : statValue ?? 0;

  // Auto-generate card name from active filters
  function buildSmartName() {
    const parts = [];
    const due = filterValues.due;
    const mems = filterValues.member;
    const labs = filterValues.label;
    const lsts = filterValues.list;

    if (due.length === 1 && due[0] !== "custom") {
      const dueLbl = DUE_OPTIONS.find((o) => o.value === due[0])?.label;
      if (dueLbl) parts.push(dueLbl);
    } else if (due.length > 1) {
      parts.push(`${due.length} due filters`);
    }
    if (mems.length === 1) {
      const m = (members || []).find((x) => x.id === mems[0]);
      if (m) parts.push(`· ${m.fullName.split(" ")[0]}`);
    } else if (mems.length > 1) {
      parts.push(`· ${mems.length} members`);
    }
    if (labs.length === 1) {
      const lbl = (boardLabels || []).find((l) => l.id === labs[0]);
      if (lbl?.name) parts.push(`· ${lbl.name}`);
    } else if (labs.length > 1) {
      parts.push(`· ${labs.length} labels`);
    }
    if (lsts.length === 1) {
      const lst = (lists || []).find((l) => l.id === lsts[0]);
      if (lst?.name) parts.push(`· ${lst.name}`);
    } else if (lsts.length > 1) {
      parts.push(`· ${lsts.length} lists`);
    }
    return parts.length > 0 ? parts.join(" ") : DEFAULT_NAMES[statType];
  }

  const smartName = buildSmartName();
  const previewName = nameManuallyEdited ? cardName : smartName;

  const hasAnyValues = Object.values(filterValues).some((v) => v.length > 0);

  function handleSave() {
    onSave(statType, {
      cardName: previewName,
      cover: coverColor,
      coverImage,
      due: filterValues.due,
      members: filterValues.member,
      labels: filterValues.label,
      lists: filterValues.list,
    });
  }

  const TABS = ["Filters", "Alerts", "Style"];

  const selectStyle = {
    background: "#141720", border: "1px solid #2e3340", borderRadius: 6,
    color: "#ccc", fontSize: 12, padding: "7px 10px",
    fontFamily: "'DM Sans', sans-serif", outline: "none", cursor: "pointer",
    width: "100%", appearance: "none",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, fontFamily: "'DM Sans', sans-serif",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#1e2128", border: "1px solid #2e3340", borderRadius: 12,
        width: 660, maxWidth: "94vw", maxHeight: "90vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif",
      }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px", borderBottom: "1px solid #252930", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer", padding: "0 4px", fontFamily: "inherit" }}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>Dashcards — Track</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer", padding: "2px 6px", borderRadius: 4 }}>✕</button>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", overflow: "hidden", flex: 1, minHeight: 0 }}>

          {/* Left: preview + active filters */}
          <div style={{
            width: 196, flexShrink: 0, padding: 14,
            borderRight: "1px solid #252930", display: "flex",
            flexDirection: "column", gap: 10, overflowY: "auto",
            background: "#1a1d24",
          }}>
            {/* Card preview */}
            <div style={{ background: "#141720", border: "1px solid #2e3340", borderRadius: 8, overflow: "hidden" }}>
              <div style={{
                background: coverImage ? "transparent" : resolvedCoverBg,
                height: 78, display: "flex", alignItems: "flex-end",
                padding: "8px 10px", position: "relative", overflow: "hidden",
              }}>
                {coverImage && <img src={coverImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{liveCount}</div>
                </div>
                <div style={{ position: "absolute", top: 8, right: 8, fontSize: 18, zIndex: 1 }}>{emoji}</div>
                <MemberBadges memberIds={selectedMembers} allMembers={members} />
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "#ccc", lineHeight: 1.4,
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {previewName}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#444", textAlign: "center" }}>Preview</div>

            {/* Active filters sidebar */}
            <ActiveFiltersSummary
              activeFilters={activeFilters}
              filterValues={filterValues}
              lists={lists}
              members={members}
              boardLabels={boardLabels}
            />
          </div>

          {/* Right: tabs + content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #252930", flexShrink: 0 }}>
              {TABS.map((t) => {
                const key = t.toLowerCase();
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    style={{
                      padding: "11px 20px", fontSize: 13, fontWeight: 500,
                      cursor: "pointer", color: isActive ? "#5a9fff" : "#666",
                      background: "none", border: "none",
                      borderBottom: isActive ? "2px solid #5a9fff" : "2px solid transparent",
                      fontFamily: "inherit", marginBottom: -1, transition: "color 0.15s",
                    }}
                  >{t}</button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── FILTERS TAB ── */}
              {activeTab === "filters" && (
                <>
                  {/* Name */}
                  <div>
                    <SectionLabel>Name</SectionLabel>
                    <input
                      type="text"
                      value={nameManuallyEdited ? cardName : smartName}
                      onChange={(e) => { setCardName(e.target.value); setNameManuallyEdited(true); }}
                      placeholder={DEFAULT_NAMES[statType]}
                      style={{
                        width: "100%", background: "#141720", border: "1px solid #2e3340",
                        borderRadius: 6, padding: "7px 10px", color: "#e0e0e0",
                        fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                        outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#3a4050")}
                      onBlur={(e) => (e.target.style.borderColor = "#2e3340")}
                    />
                    {!nameManuallyEdited && hasAnyValues && (
                      <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                        Auto-generated from filters —{" "}
                        <span
                          style={{ color: "#29b6f6", cursor: "pointer" }}
                          onClick={() => { setCardName(smartName); setNameManuallyEdited(true); }}
                        >edit</span>
                      </div>
                    )}
                  </div>

                  <Divider />

                  {/* Scope */}
                  <div>
                    <SectionLabel>Scope</SectionLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>Board</div>
                        <div style={{ position: "relative" }}>
                          <select
                            value={boardScope}
                            onChange={(e) => setBoardScope(e.target.value)}
                            style={selectStyle}
                          >
                            <option value="this">This board</option>
                            <option value="all">All boards</option>
                          </select>
                          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#555", pointerEvents: "none" }}>▾</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>Member</div>
                        <div style={{ position: "relative" }}>
                          <select
                            value={memberScope}
                            onChange={(e) => setMemberScope(e.target.value)}
                            style={selectStyle}
                          >
                            <option value="me">Me ({memberName ? memberName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) : "SB"})</option>
                            <option value="anyone">Anyone</option>
                          </select>
                          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#555", pointerEvents: "none" }}>▾</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Divider />

                  {/* Filters section */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <SectionLabel>Filters</SectionLabel>
                      <AddFilterDropdown
                        activeKeys={activeFilters}
                        onAdd={addFilter}
                        isPremium={isPremium}
                        onUpgradeClick={onUpgradeClick}
                      />
                    </div>

                    {/* Filter pills */}
                    {activeFilters.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {activeFilters.map((key) => (
                          <FilterPill
                            key={key}
                            filterKey={key}
                            values={filterValues[key] || []}
                            onValuesChange={(vals) => setFilterValue(key, vals)}
                            onRemove={() => removeFilter(key)}
                            lists={lists}
                            members={members}
                            boardLabels={boardLabels}
                          />
                        ))}
                      </div>
                    )}

                    {/* Matching count */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, color: "#555" }}>⧖</span>
                      <span style={{ fontSize: 12, color: "#666" }}>Matching</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#5a9fff" }}>{liveCount}</span>
                      <span style={{ fontSize: 12, color: "#666" }}>cards</span>
                    </div>
                  </div>

                  {/* Down arrow */}
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "#141720", border: "1px solid #252930",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#444", fontSize: 13,
                    }}>↓</div>
                  </div>
                </>
              )}

              {/* ── ALERTS TAB ── */}
              {activeTab === "alerts" && (
                <>
                  <p style={{ fontSize: 13, color: "#666", margin: "0 0 4px" }}>
                    Get notified when this stat hits a threshold.
                  </p>

                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "#141720", border: "1px solid #252930",
                    borderRadius: 8, padding: "11px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>🔔</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#d0d0d0" }}>Count exceeds 5</div>
                        <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>Notify via Trello notification</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setAlertOn((v) => !v)}
                      style={{
                        width: 36, height: 20, borderRadius: 10, border: "none",
                        cursor: "pointer", position: "relative",
                        background: alertOn ? "#0052cc" : "#333",
                        transition: "background 0.2s", flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 3, left: alertOn ? 19 : 3,
                        width: 14, height: 14, borderRadius: "50%", background: "#fff",
                        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                      }} />
                    </button>
                  </div>

                  <button style={{
                    width: "100%", background: "none", border: "1px dashed #2e3340",
                    borderRadius: 8, padding: "10px", color: "#555", fontSize: 13,
                    fontFamily: "inherit", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                    <span>+</span><span>Add alert</span>
                  </button>

                  <div style={{
                    background: "#1e1800", border: "1px solid #3d3000", borderRadius: 8,
                    padding: "10px 14px", fontSize: 12, color: "#b89a40",
                    display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5,
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>ⓘ</span>
                    <span>Alerts fire at most once per day. Upgrade to Pro for real-time alerts and email delivery.</span>
                  </div>
                </>
              )}

              {/* ── STYLE TAB ── */}
              {activeTab === "style" && (
                <>
                  <div>
                    <SectionLabel>Cover color</SectionLabel>
                    <ColorSwatchPicker
                      selected={coverImage ? null : coverColor}
                      onChange={(id) => { setCoverColor(id); setCoverImage(null); }}
                      isPremium={isPremium}
                      onUpgradeClick={onUpgradeClick}
                    />
                  </div>

                  <Divider />

                  <div>
                    <SectionLabel>
                      Cover image{" "}
                      <span style={{ color: "#444", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                        (optional — overrides color)
                      </span>
                    </SectionLabel>
                    <ImageUpload imageUrl={coverImage} onImageChange={setCoverImage} />
                  </div>
                </>
              )}

            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 10,
          padding: "12px 16px", borderTop: "1px solid #252930", flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid #2e3340", borderRadius: 6,
              padding: "7px 18px", color: "#aaa", fontSize: 13,
              fontFamily: "inherit", cursor: "pointer",
            }}
          >Cancel</button>
          <button
            onClick={handleSave}
            style={{
              background: "#0052cc", border: "none", borderRadius: 6,
              padding: "7px 18px", color: "#fff", fontSize: 13,
              fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
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

// ── Main export ───────────────────────────────────────────────────────────────
export function CustomizeFlow({
  show, lists, stats, memberName, members, boardLabels,
  customizeStat, setCustomizeStat, onSave, onClose, isPremium,
  onUpgradeClick, computeFilteredCount,
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