import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

// ── Theme tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:          "#1a1a1a",
  bgDeep:      "#1e1e1e",
  bgItem:      "#2a2a2a",
  surface:     "#252525",
  border:      "#3a3a3a",
  borderLight: "#2e2e2e",
  text:        "#e0e0e0",
  textSub:     "#ccc",
  textMuted:   "#aaa",
  accent:      "#4c8fff",
  accentHover: "#6aa3ff",
  pillBg:      "#2a2a2a",
  pillBorder:  "#3a3a3a",
  pillText:    "#8aaeff",
  pillVal:     "#c8d8ff",
  danger:      "#e05555",
};

// ── Cover palette ─────────────────────────────────────────────────────────────
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

const COVER_GRADIENTS = [
  { id: "grad-blue-sky",      css: "linear-gradient(135deg,#0052cc,#29b6f6)",          label: "Blue → Sky"              },
  { id: "grad-green-sky",     css: "linear-gradient(135deg,#1a7a4a,#29b6f6)",          label: "Green → Sky"             },
  { id: "grad-orange-pink",   css: "linear-gradient(135deg,#e67e22,#e91e8c)",          label: "Orange → Pink"           },
  { id: "grad-purple-pink",   css: "linear-gradient(135deg,#7e57c2,#e91e8c)",          label: "Purple → Pink"           },
  { id: "grad-yellow-orange", css: "linear-gradient(135deg,#e6a817,#e67e22)",          label: "Yellow → Orange"         },
  { id: "grad-red-purple",    css: "linear-gradient(135deg,#c0392b,#7e57c2)",          label: "Red → Purple"            },
  { id: "grad-slate-blue",    css: "linear-gradient(135deg,#374151,#0052cc)",          label: "Slate → Blue"            },
  { id: "grad-multi",         css: "linear-gradient(135deg,#0052cc,#7e57c2,#e91e8c)", label: "Blue → Purple → Pink"    },
];

function resolveCoverBackground(id) {
  const g = COVER_GRADIENTS.find((x) => x.id === id);
  if (g) return g.css;
  return COVER_COLORS.find((x) => x.id === id)?.hex || "#0052cc";
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TRELLO_LABEL_COLORS = {
  red:"#c0392b", orange:"#e67e22", yellow:"#e6a817", green:"#1a7a4a",
  blue:"#0052cc", purple:"#7e57c2", pink:"#e91e8c", sky:"#29b6f6",
  lime:"#51e898", black:"#374151", null:"#888888",
};

const STAT_EMOJIS   = { assigned:"📌", dueThisWeek:"📅", overdue:"⚠️", unassigned:"👤", withLabel:"🏷️", stale:"💤", createdToday:"✨"};
const DEFAULT_COVER = { assigned:"blue", dueThisWeek:"yellow", overdue:"red", unassigned:"purple", withLabel:"orange", stale:"black", createdToday:"green"};
const DEFAULT_NAMES = {
  assigned:    "Assigned to me on all Workspace boards",
  dueThisWeek: "Due this week",
  overdue:     "Overdue cards",
  unassigned:  "Unassigned cards",
  withLabel:   "Cards with a label",
  stale:       "Stale cards (14+ days)",
  createdToday:"Created today",
};

const STAT_LIST = [
  { type:"assigned",     label:"Assigned to Me",   emoji:"📌" },
  { type:"dueThisWeek", label:"Due This Week",     emoji:"📅" },
  { type:"overdue",     label:"Overdue Cards",     emoji:"⚠️" },
  { type:"unassigned",  label:"Unassigned Cards",  emoji:"👤" },
  { type:"withLabel",   label:"Cards With Label",  emoji:"🏷️" },
  { type:"stale",       label:"Stale Cards",       emoji:"💤" },
  { type:"createdToday",label:"Created Today",     emoji:"✨" },
];

const DUE_OPTIONS = [
  { value:"2days",   label:"Due in 2 days"  },
  { value:"1week",   label:"Due in 1 week"  },
  { value:"2weeks",  label:"Due in 2 weeks" },
  { value:"1month",  label:"Due in 1 month" },
  { value:"overdue", label:"Overdue"        },
  { value:"nodate",  label:"No due date"    },
];

const DUE_RANGE_ORDER = ["overdue","nodate","2days","1week","2weeks","1month"];

// Filter definitions — icon + label shown in the pill
const FILTER_DEFS = {
  due:      { icon:"📅", label:"Due date",  valueKey:"due"      },
  member:   { icon:"👤", label:"Member",    valueKey:"members"  },
  list:     { icon:"☰",  label:"List",      valueKey:"lists"    },
  label:    { icon:"🏷", label:"Label",     valueKey:"labels"   },
  status:   { icon:"📋", label:"Status",    valueKey:"status"   },
  activity: { icon:"🕐", label:"Activity",  valueKey:"activity" },
};

const ADDABLE_FILTERS = [
  { key:"due",        icon:"📅", label:"Due date",   premium:false },
  { key:"member",     icon:"👤", label:"Member",     premium:false },
  { key:"label",      icon:"🏷", label:"Label",      premium:false },
  { key:"list",       icon:"☰",  label:"List",       premium:false },
  { key:"status",     icon:"📋", label:"Status",     premium:false },
  { key:"activity",   icon:"🕐", label:"Activity",   premium:false },
  { key:"unassigned", icon:"👤", label:"Unassigned", premium:false },
  { key:"attachment", icon:"📎", label:"Attachment", premium:true  },
  { key:"comments",   icon:"💬", label:"Comments",   premium:true  },
];

const DEFAULT_FILTERS = {
  assigned:    ["due","member","label","list"],
  dueThisWeek: ["due","member","label","list"],
  overdue:     ["due","member","label","list"],
  unassigned:  ["due","member","label","list"],
  withLabel:   ["due","member","label","list"],
  stale:       ["due","member","label","list"],
  createdToday:["due","member","label","list"],
};

// ── Tiny shared components ────────────────────────────────────────────────────
function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, letterSpacing:"0.09em", textTransform:"uppercase", marginBottom:6, ...style }}>
      {children}
    </div>
  );
}
function Divider() {
  return <div style={{ borderTop:`1px solid ${T.borderLight}`, margin:"2px 0" }} />;
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
        setCoords({ top: r.top + scrollY - h - 4, left: r.left + scrollX, width: Math.max(r.width, 220), maxHeight: h, up: true });
      } else {
        const h = Math.min(maxH, Math.max(spaceBelow, 80));
       setCoords({
  top: r.bottom + scrollY + 4,
  left: r.left + scrollX, width: Math.max(r.width, 220), maxHeight: h, up: false });
      }
    }
    measure();
    if (!open) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [open, anchorRef]);

  if (!open || !coords) return null;
  return createPortal(
    <div ref={portalRef} style={{
      position:"absolute", top:coords.top, left:coords.left, width:coords.width,
      background:"#1a1a1a", border:`1px solid ${T.border}`, borderRadius:10,
      zIndex:2147483647,
      boxShadow: coords.up ? "0 -6px 24px rgba(0,0,0,0.7)" : "0 6px 24px rgba(0,0,0,0.7)",
      overflow:"visible", maxHeight:coords.maxHeight, overflowY:"auto",
      scrollbarWidth:"thin", scrollbarColor:`${T.border} transparent`,
    }}>
      {children}
    </div>,
    document.body
  );
}

// ── Dropdown item ─────────────────────────────────────────────────────────────
function DropdownItem({ children, checked, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
        cursor:"pointer", fontSize:13, color: hover ? T.text : "#b0bdd4",
        background: hover ? "#2a2a2a" : "transparent", transition:"background 0.1s",
      }}>
      {checked !== undefined && (
        <div style={{
          width:16, height:16, borderRadius:4, flexShrink:0,
          border: checked ? `1.5px solid ${T.accent}` : `1.5px solid ${T.textMuted}`,
          background: checked ? T.accent : "transparent",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:10, color:"#fff", fontWeight:700,
        }}>{checked && "✓"}</div>
      )}
      <span style={{ flex:1, minWidth:0 }}>{children}</span>
    </div>
  );
}

// ── Value picker content for each filter type ─────────────────────────────────
function FilterValuePicker({ filterKey, selected, onChange, lists, members, boardLabels }) {
  if (filterKey === "due") return (
    <>{DUE_OPTIONS.map((opt) => (
      <DropdownItem key={opt.value} checked={selected.includes(opt.value)}
        onClick={() => onChange(selected.includes(opt.value) ? selected.filter(v=>v!==opt.value) : [...selected,opt.value])}>
        {opt.label}
      </DropdownItem>
    ))}</>
  );

  if (filterKey === "member") {
    const opts = members || [];
    if (!opts.length) return <div style={{ padding:"12px 14px", fontSize:12, color:T.textMuted }}>No members found</div>;
    return <>{opts.map((m) => {
      const initials = m.fullName.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
      const checked = selected.includes(m.id);
      return (
        <DropdownItem key={m.id} checked={checked}
          onClick={() => onChange(checked ? selected.filter(v=>v!==m.id) : [...selected,m.id])}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{
              width:24, height:24, borderRadius:"50%", background: m.avatarColor||"#0052cc",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:9, fontWeight:700, color:"#fff", flexShrink:0,
            }}>{initials}</div>
            <span>{m.fullName}</span>
          </div>
        </DropdownItem>
      );
    })}</>;
  }

  if (filterKey === "label") {
    const opts = boardLabels || [];
    if (!opts.length) return <div style={{ padding:"12px 14px", fontSize:12, color:T.textMuted }}>No labels found</div>;
    return <>{opts.map((lbl) => {
      const hex = TRELLO_LABEL_COLORS[lbl.color] || "#888";
      const name = lbl.name?.trim() || lbl.color || "Unnamed";
      const checked = selected.includes(lbl.id);
      return (
        <DropdownItem key={lbl.id} checked={checked}
          onClick={() => onChange(checked ? selected.filter(v=>v!==lbl.id) : [...selected,lbl.id])}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:32, height:14, borderRadius:3, background:hex, display:"inline-block", flexShrink:0 }} />
            <span style={{ color: name===lbl.color ? T.textMuted : T.text }}>{name}</span>
          </div>
        </DropdownItem>
      );
    })}</>;
  }

  if (filterKey === "list") {
    const opts = lists || [];
    if (!opts.length) return <div style={{ padding:"12px 14px", fontSize:12, color:T.textMuted }}>No lists found</div>;
    return <>{opts.map((l) => {
      const checked = selected.includes(l.id);
      return (
        <DropdownItem key={l.id} checked={checked}
          onClick={() => onChange(checked ? selected.filter(v=>v!==l.id) : [...selected,l.id])}>
          {l.name}
        </DropdownItem>
      );
    })}</>;
  }

 if (filterKey === "status") {
    const STATUS_OPTIONS = [
      { value:"incomplete", label:"Incomplete" },
      { value:"complete",   label:"Complete"   },
      { value:"overdue",    label:"Overdue"    },
    ];
    return <>{STATUS_OPTIONS.map((opt) => {
      const isSelected = selected.includes(opt.value);
      return (
        <DropdownItem key={opt.value} checked={isSelected}
          onClick={() => onChange(isSelected ? [] : [opt.value])}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{
              width:10, height:10, borderRadius:"50%", flexShrink:0, display:"inline-block",
              background: opt.value==="complete" ? "#4caf50" : opt.value==="overdue" ? "#ff5252" : "#f9c74f",
            }}/>
            {opt.label}
          </div>
        </DropdownItem>
      );
    })}</>;
  }

 if (filterKey === "activity") {
    const ACTIVITY_OPTIONS = [
      { value:"1day",    label:"Active in last 1 day"   },
      { value:"3days",   label:"Active in last 3 days"  },
      { value:"7days",   label:"Active in last 7 days"  },
      { value:"14days",  label:"Active in last 14 days" },
      { value:"30days",  label:"Active in last 30 days" },
      { value:"stale14", label:"Stale — 14+ days"       },
      { value:"stale30", label:"Stale — 30+ days"       },
    ];
    return <>{ACTIVITY_OPTIONS.map((opt) => {
      const isSelected = selected.includes(opt.value);
      return (
        <DropdownItem key={opt.value} checked={isSelected}
          onClick={() => onChange(isSelected ? [] : [opt.value])}>
          {opt.label}
        </DropdownItem>
      );
    })}</>;
  }

  return null;
}

// ── Filter Pill ───────────────────────────────────────────────────────────────
function FilterPill({ filterKey, values, onValuesChange, onRemove, lists, members, boardLabels }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef();
  const portalRef  = useRef();
  const wrapRef    = useRef();

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (wrapRef.current?.contains(e.target) || portalRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const def = FILTER_DEFS[filterKey];
  if (!def) return null;
  const hasValuePicker = ["due","member","label","list","status","activity"].includes(filterKey);

  const STATUS_OPTIONS = [
    { value:"incomplete", label:"Incomplete" },
    { value:"complete",   label:"Complete"   },
    { value:"overdue",    label:"Overdue"    },
  ];

  const ACTIVITY_OPTIONS = [
    { value:"1day",    label:"Active in last 1 day"   },
    { value:"3days",   label:"Active in last 3 days"  },
    { value:"7days",   label:"Active in last 7 days"  },
    { value:"14days",  label:"Active in last 14 days" },
    { value:"30days",  label:"Active in last 30 days" },
    { value:"stale14", label:"Stale — 14+ days"       },
    { value:"stale30", label:"Stale — 30+ days"       },
  ];

  function pillValue() {
    if (!values || !values.length) return null;
    if (filterKey === "due") {
      if (values.length === 1) return DUE_OPTIONS.find(o=>o.value===values[0])?.label || values[0];
      return `${values.length} dates`;
    }
    if (filterKey === "member") {
      if (values.length === 1) { const m=(members||[]).find(x=>x.id===values[0]); return m?m.fullName.split(" ")[0]:values[0]; }
      return `${values.length} members`;
    }
    if (filterKey === "label") {
      if (values.length === 1) { const l=(boardLabels||[]).find(x=>x.id===values[0]); return l?.name?.trim()||l?.color||values[0]; }
      return `${values.length} labels`;
    }
    if (filterKey === "list") {
      if (values.length === 1) return (lists||[]).find(l=>l.id===values[0])?.name||values[0];
      return `${values.length} lists`;
    }
    if (filterKey === "status") {
      if (values.length === 1) return STATUS_OPTIONS.find(o=>o.value===values[0])?.label || values[0];
      return `${values.length} statuses`;
    }
    if (filterKey === "activity") {
      if (values.length === 1) return ACTIVITY_OPTIONS.find(o=>o.value===values[0])?.label || values[0];
      return `${values.length} ranges`;
    }
    return null;
  }

  const val = pillValue();
  const [hover, setHover] = useState(false);

  const pillKeyLabel = {
    due:      "Due date",
    member:   "Member",
    list:     "List",
    label:    "Label",
    status:   "Status",
    activity: "Activity",
  }[filterKey] || def.label;

  return (
    <div ref={wrapRef} style={{ display:"inline-flex", position:"relative", flexShrink:0 }}>
      <div
        ref={triggerRef}
        onClick={() => hasValuePicker && setOpen(o=>!o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display:"inline-flex", alignItems:"center", gap:0,
          background: hover || open ? "#333" : T.pillBg,
          border:`1px solid ${open ? T.accent : T.pillBorder}`,
          borderRadius:20, overflow:"hidden",
          fontSize:12, cursor: hasValuePicker ? "pointer" : "default",
          userSelect:"none", transition:"all 0.15s",
          whiteSpace:"nowrap",
        }}
      >
        <span style={{
          padding:"5px 8px 5px 10px", fontSize:13, lineHeight:1,
          borderRight:`1px solid ${T.pillBorder}`,
          display:"flex", alignItems:"center",
        }}>{def.icon}</span>

        <span style={{ padding:"5px 6px", color:T.pillText, fontWeight:600 }}>
          {pillKeyLabel}
        </span>

        {val ? (
          <>
            <span style={{ color:T.textMuted, fontSize:11 }}>:</span>
            <span style={{ padding:"5px 4px 5px 4px", color:T.pillVal, fontWeight:500 }}>{val}</span>
          </>
        ) : hasValuePicker ? (
          <>
            <span style={{ color:T.textMuted, fontSize:11 }}>:</span>
            <span style={{ padding:"5px 4px 5px 4px", color:T.textMuted }}>any</span>
          </>
        ) : null}

        {hasValuePicker && (
          <span style={{ padding:"5px 6px 5px 2px", color:T.textMuted, fontSize:9 }}>{open?"▲":"▼"}</span>
        )}

        <span
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            padding:"5px 10px 5px 4px", color:T.textMuted, fontSize:13,
            cursor:"pointer", lineHeight:1, display:"flex", alignItems:"center",
          }}
          onMouseEnter={e => e.currentTarget.style.color=T.danger}
          onMouseLeave={e => e.currentTarget.style.color=T.textMuted}
        >×</span>
      </div>

      {hasValuePicker && (
        <PortalDropdown anchorRef={triggerRef} open={open} portalRef={portalRef}>
          <div style={{ padding:"8px 14px 6px", borderBottom:`1px solid ${T.border}` }}>
            <span style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Filter by {pillKeyLabel}
            </span>
          </div>
          <div style={{ padding:"4px 0" }}>
            <FilterValuePicker
              filterKey={filterKey} selected={values||[]}
              onChange={onValuesChange}
              lists={lists} members={members} boardLabels={boardLabels}
            />
          </div>
        </PortalDropdown>
      )}
    </div>
  );
}

// ── Add filter dropdown ───────────────────────────────────────────────────────
function AddFilterDropdown({ activeKeys, onAdd, isPremium, onUpgradeClick }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef();

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const available = ADDABLE_FILTERS.filter(f => !activeKeys.includes(f.key));

  return (
    <div ref={wrapRef} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        fontSize:12, color: open ? T.accentHover : T.accent,
        background:"none", border:"none", cursor:"pointer",
        fontFamily:"'DM Sans',sans-serif", padding:0, display:"flex", alignItems:"center", gap:4,
        whiteSpace:"nowrap",
      }}>
        <span style={{ fontSize:14, lineHeight:1 }}>+</span> Add filter
      </button>

      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", right:0,
          width:220, background:T.bgDeep, border:`1px solid ${T.border}`,
          borderRadius:10, zIndex:100,
          boxShadow:"0 6px 24px rgba(0,0,0,0.7)",
          overflow:"hidden",
        }}>
          <div style={{ padding:"8px 14px 6px", borderBottom:`1px solid ${T.border}` }}>
            <span style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Add a filter
            </span>
          </div>
          <div style={{ padding:"4px 0" }}>
            {available.length === 0
              ? <div style={{ padding:"12px 14px", fontSize:13, color:T.textMuted }}>All filters added</div>
              : available.map((f) => (
                <div key={f.key}
                  onClick={() => { if (f.premium && !isPremium) { onUpgradeClick?.(); return; } onAdd(f.key); setOpen(false); }}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", cursor:"pointer", fontSize:13, color:"#b0bdd4", transition:"background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background="#2a2a2a"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:15, color:T.textMuted }}>{f.icon}</span>
                    {f.label}
                  </div>
                  {f.premium && (
                    <span style={{ fontSize:9, fontWeight:700, color:"#c89a30", background:"#2e2200", borderRadius:4, padding:"2px 7px", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                      Premium
                    </span>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
// ── Left sidebar active filters summary ───────────────────────────────────────
function ActiveFiltersSummary({ activeFilters, filterValues, lists, members, boardLabels }) {
  const active = activeFilters.filter(k => (filterValues[k]||[]).length > 0);
  if (!active.length) return null;

  function chip(key, val) {
    if (key === "due")    return DUE_OPTIONS.find(o=>o.value===val)?.label || val;
    if (key === "member") { const m=(members||[]).find(x=>x.id===val); return m?.fullName.split(" ")[0]||val; }
    if (key === "list")   return (lists||[]).find(l=>l.id===val)?.name || val;
    if (key === "label") {
      const lbl=(boardLabels||[]).find(l=>l.id===val);
      const hex=TRELLO_LABEL_COLORS[lbl?.color]||"#888";
      const name=lbl?.name?.trim()||lbl?.color||val;
      return <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
        <span style={{ width:8, height:8, borderRadius:"50%", background:hex, display:"inline-block", flexShrink:0 }} />{name}
      </span>;
    }
    return val;
  }

  return (
    <div style={{ background:T.bgDeep, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 10px 6px" }}>
      <div style={{ fontSize:9, fontWeight:700, color:T.textMuted, letterSpacing:"0.09em", textTransform:"uppercase", marginBottom:8 }}>
        Active filters
      </div>
      {active.map(k => {
        const def = FILTER_DEFS[k] || {};
        return (
          <div key={k} style={{ display:"flex", alignItems:"flex-start", gap:6, marginBottom:6 }}>
            <span style={{ fontSize:11, flexShrink:0, lineHeight:"18px", color:T.textMuted }}>{def.icon||"•"}</span>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, flex:1 }}>
              {(filterValues[k]||[]).map(v => (
                <span key={v} style={{
                  display:"inline-flex", alignItems:"center", gap:3,
                  background:"#2a2a2a", border:`1px solid ${T.pillBorder}`,
                  borderRadius:4, padding:"2px 7px", fontSize:10, color:T.pillVal,
                  lineHeight:"16px", maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>{chip(k,v)}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Member badges on card cover ───────────────────────────────────────────────
function MemberBadges({ memberIds, allMembers }) {
  if (!memberIds?.length) return null;
  const visible = memberIds.slice(0, 3);
  const MC = ["#0052cc","#7e57c2","#1a7a4a","#e67e22","#c0392b","#e91e8c"];
  return (
    <div style={{ position:"absolute", bottom:7, right:8, display:"flex", zIndex:1 }}>
      {visible.map((id,i) => {
        const m = allMembers?.find(x=>x.id===id);
        const init = m ? m.fullName.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) : id.slice(0,2).toUpperCase();
        return (
          <div key={id} title={m?.fullName||id} style={{
            width:22, height:22, borderRadius:"50%", background: m?.avatarColor||MC[i%MC.length],
            border:"2px solid rgba(0,0,0,0.4)", display:"flex", alignItems:"center",
            justifyContent:"center", fontSize:8, fontWeight:700, color:"#fff",
            marginLeft: i===0?0:-6, flexShrink:0,
          }}>{init}</div>
        );
      })}
      {memberIds.length > 3 && (
        <div style={{ width:22, height:22, borderRadius:"50%", background:"#2a2a2a", border:"2px solid rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:"#aaa", marginLeft:-6 }}>
          +{memberIds.length-3}
        </div>
      )}
    </div>
  );
}

// ── Color swatch picker ───────────────────────────────────────────────────────
function ColorSwatchPicker({ selected, onChange, isPremium, onUpgradeClick }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
        {COVER_COLORS.map(({ id, hex, label }) => (
          <button key={id} title={label} onClick={() => onChange(id)} style={{
            width:28, height:28, borderRadius:6, background:hex, border: selected===id?"2px solid #fff":"2px solid transparent",
            outline: selected===id?`2px solid ${hex}`:"none", cursor:"pointer", padding:0,
            transform: selected===id?"scale(1.15)":"scale(1)", transition:"transform 0.1s", position:"relative",
          }}>
            {selected===id && <span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:13, fontWeight:700, textShadow:"0 1px 2px rgba(0,0,0,0.5)" }}>✓</span>}
          </button>
        ))}
      </div>
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <SectionLabel style={{ marginBottom:0 }}>Gradients</SectionLabel>
          {!isPremium && <span style={{ fontSize:9, fontWeight:700, color:"#c89a30", background:"#2e2200", borderRadius:4, padding:"2px 7px", textTransform:"uppercase", letterSpacing:"0.05em" }}>Premium</span>}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {COVER_GRADIENTS.map(({ id, css, label }) => (
            <button key={id} title={isPremium?label:`${label} — Premium`}
              onClick={() => { if (!isPremium){onUpgradeClick?.();return;} onChange(id); }}
              style={{
                width:28, height:28, borderRadius:6, background:css,
                border: selected===id?"2px solid #fff":"2px solid transparent",
                outline: selected===id?"2px solid #888":"none", cursor:"pointer", padding:0,
                transform: selected===id?"scale(1.15)":"scale(1)", transition:"transform 0.1s",
                position:"relative", opacity: isPremium?1:0.5,
              }}>
              {selected===id&&isPremium&&<span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:13, fontWeight:700, textShadow:"0 1px 2px rgba(0,0,0,0.5)" }}>✓</span>}
              {!isPremium&&<span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff" }}>🔒</span>}
            </button>
          ))}
        </div>
        {!isPremium && (
          <div onClick={onUpgradeClick} style={{ marginTop:8, fontSize:11, color:T.accent, cursor:"pointer", textDecoration:"underline" }}>
            Unlock gradient covers with Premium →
          </div>
        )}
      </div>
    </div>
  );
}

// ── Image upload ──────────────────────────────────────────────────────────────
function ImageUpload({ imageUrl, onImageChange }) {
  const fileRef = useRef();
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
        onChange={e => { const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>onImageChange(ev.target.result); r.readAsDataURL(f); }} />
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <button onClick={() => fileRef.current?.click()} style={{
          background:T.bgDeep, border:`1px solid ${T.border}`, borderRadius:6,
          padding:"6px 12px", color:"#ccc", fontSize:12, fontFamily:"'DM Sans',sans-serif",
          cursor:"pointer", display:"flex", alignItems:"center", gap:6,
        }}>🖼 {imageUrl?"Change image":"Upload image"}</button>
        {imageUrl && <button onClick={() => onImageChange(null)} style={{
          background:"none", border:`1px solid ${T.border}`, borderRadius:6,
          padding:"6px 10px", color:"#888", fontSize:12, fontFamily:"'DM Sans',sans-serif", cursor:"pointer",
        }}>Remove</button>}
      </div>
      {imageUrl && <div style={{ width:"100%", height:48, borderRadius:6, overflow:"hidden", border:`1px solid ${T.border}` }}>
        <img src={imageUrl} alt="Cover preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      </div>}
    </div>
  );
}

// ── Stat picker (step 1) ──────────────────────────────────────────────────────
function StatPicker({ onSelect, onClose }) {
  return (
    <div className="customize-overlay" onClick={onClose}>
      <div className="customize-modal" style={{ width:280 }} onClick={e=>e.stopPropagation()}>
        <div className="customize-header">
          <span>Customize a stat card</span>
          <button className="customize-close" onClick={onClose}>✕</button>
        </div>
        <p className="customize-sub">Select a stat to configure</p>
        {STAT_LIST.map(({ type, label, emoji }) => (
          <div key={type} className="customize-row" onClick={() => onSelect(type)} style={{ justifyContent:"space-between" }}>
            <span className="customize-emoji">{emoji}</span>
            <span className="customize-label">{label}</span>
            <span style={{ color:"#555", fontSize:14 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card config modal (step 2) ────────────────────────────────────────────────
function CardConfigModal({
  statType, statValue, lists, memberName, members, boardLabels,
  isPremium, computeFilteredCount, onSave, onBack, onClose, onUpgradeClick,
  boardName, boardId, workspaceBoards = [], fetchWorkspaceBoards, fetchBoardScopedData,
}){
  const [activeTab,          setActiveTab]          = useState("filters");
  const [cardName,           setCardName]           = useState(DEFAULT_NAMES[statType]||"");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [coverColor,         setCoverColor]         = useState(DEFAULT_COVER[statType]||"blue");
  const [coverImage,         setCoverImage]         = useState(null);
  const [alertOn,            setAlertOn]            = useState(true);
  const [boardScope,         setBoardScope]         = useState("this");
  const [memberScope, setMemberScope] = useState("anyone");
  const [boardDropOpen, setBoardDropOpen] = useState(false);
  const boardDropRef = useRef();

  // ── Workspace boards: fetch list of board names on mount ──────────────────
  const [boards, setBoards] = useState(workspaceBoards);
  const [boardsLoading, setBoardsLoading] = useState(false);

  useEffect(() => {
    if (workspaceBoards && workspaceBoards.length) { setBoards(workspaceBoards); return; }
    if (!fetchWorkspaceBoards) return;
    setBoardsLoading(true);
    fetchWorkspaceBoards()
      .then(list => setBoards(Array.isArray(list) ? list : []))
      .catch(() => setBoards([]))
      .finally(() => setBoardsLoading(false));
  }, [fetchWorkspaceBoards]);

  // ── Scoped data: refetch lists/members/labels when boardScope changes ─────
  const [scopedLists,   setScopedLists]   = useState(lists || []);
  const [scopedMembers, setScopedMembers] = useState(members || []);
  const [scopedLabels,  setScopedLabels]  = useState(boardLabels || []);
  const [scopeLoading,  setScopeLoading]  = useState(false);

  useEffect(() => {
    if (boardScope === "this") {
      setScopedLists(lists || []);
      setScopedMembers(members || []);
      setScopedLabels(boardLabels || []);
      return;
    }
    if (!fetchBoardScopedData) return;
    const targetBoardId = boardScope === "all" ? null : boardScope;
    setScopeLoading(true);
    fetchBoardScopedData(targetBoardId, boards)
      .then(data => {
        setScopedLists(data?.lists || []);
        setScopedMembers(data?.members || []);
        setScopedLabels(data?.boardLabels || []);
      })
      .catch(() => {
        setScopedLists([]); setScopedMembers([]); setScopedLabels([]);
      })
      .finally(() => setScopeLoading(false));
  }, [boardScope, boards, fetchBoardScopedData, lists, members, boardLabels]);

  // close board dropdown on outside click
  useEffect(() => {
    if (!boardDropOpen) return;
    function onDown(e) {
      if (boardDropRef.current?.contains(e.target)) return;
      setBoardDropOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [boardDropOpen]);

  const [activeFilters, setActiveFilters] = useState(() => DEFAULT_FILTERS[statType] || ["due","member","label","list"]);
  const [filterValues,  setFilterValues]  = useState({ due:[], member:[], label:[], list:[], status:[], activity:[], unassigned:[], customDateFrom:"", customDateTo:"" });

  function setFilterValue(key, vals) { setFilterValues(p => ({ ...p, [key]: vals })); }
  function addFilter(key)   { if (!activeFilters.includes(key)) setActiveFilters(p=>[...p,key]); }
  function removeFilter(key){ setActiveFilters(p=>p.filter(k=>k!==key)); setFilterValues(p=>({...p,[key]:[]})); }


// ── Resolve memberScope to a real ID and sync filterValues.member atomically
  // ── Resolve memberScope to a real ID and sync filterValues.member atomically
  const initializedScopeRef = useRef(null);

  useEffect(() => {
  if (!scopedMembers?.length) return;
  if (initializedScopeRef.current === boardScope) return;

  initializedScopeRef.current = boardScope;

  // ✅ Always default to neutral state
  setMemberScope("anyone");

  setFilterValues(prev => ({
    ...prev,
    member: [],
  }));

}, [scopedMembers, boardScope]);

  const emoji     = STAT_EMOJIS[statType] || "📌";
  const resolvedBg = coverImage ? null : resolveCoverBackground(coverColor);
  const selectedMembers = filterValues.member || [];

  const liveCount = computeFilteredCount
    ? computeFilteredCount(statType, {
        due:            filterValues.due                                          || [],
        members:        activeFilters.includes("member") ? (filterValues.member || []) : [],
        labels:         filterValues.label                                        || [],
        lists:          filterValues.list                                         || [],
        status:         activeFilters.includes("status")   ? (filterValues.status   || []) : [],
        activity:       activeFilters.includes("activity") ? (filterValues.activity || []) : [],
        customDateFrom: filterValues.customDateFrom || "",
        customDateTo:   filterValues.customDateTo   || "",
      })
    : statValue ?? 0;

 function buildSmartName() {
    if (filterValues.due?.length) {
      if (filterValues.due.length === 1) {
        const opt = DUE_OPTIONS.find(o => o.value === filterValues.due[0]);
        if (opt) return opt.label;
      } else {
        const broadest = filterValues.due.reduce((a, b) =>
          DUE_RANGE_ORDER.indexOf(b) > DUE_RANGE_ORDER.indexOf(a) ? b : a
        );
        const opt = DUE_OPTIONS.find(o => o.value === broadest);
        if (opt) return opt.label;
      }
    }
    if (filterValues.status?.length === 1) {
      const statusLabel = { complete: "Completed", incomplete: "Incomplete", overdue: "Overdue" }[filterValues.status[0]];
      if (statusLabel) return statusLabel + " cards";
    }
    if (filterValues.label?.length > 0 && !filterValues.due?.length) {
      return "Cards with label";
    }
    if (filterValues.member?.length > 0 && !filterValues.due?.length) {
      return "Assigned cards";
    }
    return DEFAULT_NAMES[statType];
  }

  const smartName   = buildSmartName();
  const previewName = nameManuallyEdited ? cardName : smartName;
  

  function handleSave() {
  onSave(statType, {
    cardName:   previewName,
    cover:      coverColor,
    coverImage,
    due:        filterValues.due    || [],
    members:    activeFilters.includes("member")   ? (filterValues.member   || []) : [],
    labels:     filterValues.label  || [],
    lists:      filterValues.list   || [],
    status:     activeFilters.includes("status")   ? (filterValues.status   || []) : [],
    activity:   activeFilters.includes("activity") ? (filterValues.activity || []) : [],
    boardScope,
    memberScope,
    count:      liveCount,
  });
}

  const selectStyle = {
    background:T.bgDeep, border:`1px solid ${T.border}`, borderRadius:6,
    color:T.text, fontSize:12, padding:"7px 28px 7px 10px",
    fontFamily:"'DM Sans',sans-serif", outline:"none", cursor:"pointer",
    width:"100%", appearance:"none", WebkitAppearance:"none",
  };

  const TABS = ["Filters","Style"];

  // Label shown on the Board dropdown trigger
  function boardScopeLabel() {
    if (boardScope === "this") return boardName || "This board";
    if (boardScope === "all")  return "All boards";
    const b = boards.find(b => b.id === boardScope);
    return b?.name || "Select board";
  }

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:9999, fontFamily:"'DM Sans',sans-serif",
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:T.surface, border:`1px solid ${T.border}`, borderRadius:14,
        width:700, maxWidth:"95vw", maxHeight:"92vh",
        display:"flex", flexDirection:"column", overflow:"hidden",
        boxShadow:"0 20px 60px rgba(0,0,0,0.7)",
      }}>

        {/* ── Header ── */}
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"13px 18px", borderBottom:`1px solid ${T.borderLight}`, flexShrink:0,
          background:T.bg,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={onBack} style={{ background:"none", border:"none", color:T.textSub, fontSize:22, cursor:"pointer", padding:"0 4px", fontFamily:"inherit", lineHeight:1 }}>‹</button>
            <span style={{ fontSize:14, fontWeight:600, color:T.text }}>Dashcards — Track</span>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.textMuted, fontSize:18, cursor:"pointer", padding:"2px 6px", borderRadius:4 }}>✕</button>
        </div>

        {/* ── Body ── */}
        <div style={{ display:"flex", overflow:"hidden", flex:1, minHeight:0 }}>

          {/* Left panel */}
          <div style={{
            width:200, flexShrink:0, padding:14, borderRight:`1px solid ${T.borderLight}`,
            display:"flex", flexDirection:"column", gap:10, overflowY:"auto",
            background:T.bg,
          }}>
            {/* Card preview */}
            <div style={{ background:T.bgDeep, border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden" }}>
              <div style={{
                background: coverImage?"transparent":resolvedBg, height:80,
                display:"flex", alignItems:"flex-end", padding:"8px 10px",
                position:"relative", overflow:"hidden",
              }}>
                {coverImage && <img src={coverImage} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />}
                <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.22)" }} />
                <div style={{ position:"relative", zIndex:1 }}>
                  <div style={{ fontSize:24, fontWeight:700, color:"#fff", lineHeight:1 }}>{liveCount}</div>
                </div>
                <div style={{ position:"absolute", top:8, right:8, fontSize:18, zIndex:1 }}>{emoji}</div>
                <MemberBadges memberIds={selectedMembers} allMembers={scopedMembers} />
              </div>
              <div style={{ padding:"8px 10px 10px" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#ccc", lineHeight:1.4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                  {previewName}
                </div>
              </div>
            </div>
            <div style={{ fontSize:10, color:T.textMuted, textAlign:"center" }}>Preview</div>

            <ActiveFiltersSummary activeFilters={activeFilters} filterValues={filterValues} lists={scopedLists} members={scopedMembers} boardLabels={scopedLabels} />
          </div>

          {/* Right panel */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:T.surface }}>

            {/* Tabs */}
            <div style={{ display:"flex", borderBottom:`1px solid ${T.borderLight}`, flexShrink:0, paddingLeft:4 }}>
              {TABS.map(t => {
                const k = t.toLowerCase();
                const active = activeTab===k;
                return (
                  <button key={k} onClick={() => setActiveTab(k)} style={{
                    padding:"12px 20px", fontSize:13, fontWeight: active?600:400,
                    cursor:"pointer", color: active?T.accent:T.textSub,
                    background:"none", border:"none",
                    borderBottom: active?`2px solid ${T.accent}`:"2px solid transparent",
                    fontFamily:"inherit", marginBottom:-1, transition:"all 0.15s",
                  }}>{t}</button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:16 }}>

              {/* ── FILTERS TAB ── */}
              {activeTab==="filters" && <>
                {/* Name */}
                <div>
                  <SectionLabel>Card name</SectionLabel>
                  <input
                    type="text"
                    value={nameManuallyEdited?cardName:smartName}
                    onChange={e => { setCardName(e.target.value); setNameManuallyEdited(true); }}
                    placeholder={DEFAULT_NAMES[statType]}
                    style={{
                      width:"100%", background:T.bgDeep, border:`1px solid ${T.border}`,
                      borderRadius:7, padding:"8px 11px", color:T.text,
                      fontSize:13, fontFamily:"'DM Sans',sans-serif",
                      outline:"none", boxSizing:"border-box", transition:"border-color 0.15s",
                    }}
                    onFocus={e=>e.target.style.borderColor=T.accent}
                    onBlur={e=>e.target.style.borderColor=T.border}
                  />
                
                </div>

                <Divider />

                {/* Scope */}
                <div>
                  <SectionLabel>Scope</SectionLabel>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                   <div>
  <div style={{ fontSize:11, color:T.textMuted, marginBottom:5 }}>Board</div>
  <div ref={boardDropRef} style={{ position:"relative" }}>
    <div
      onClick={() => setBoardDropOpen(o=>!o)}
      style={{ ...selectStyle, display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", userSelect:"none" }}
    >
      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {boardsLoading ? "Loading boards…" : boardScopeLabel()}
      </span>
      <span style={{ fontSize:10, color:T.textMuted, flexShrink:0, marginLeft:6 }}>{boardDropOpen?"▴":"▾"}</span>
    </div>
    {boardDropOpen && (
      <div style={{
        position:"absolute", top:"calc(100% + 4px)", left:0, right:0,
        background:T.bgDeep, border:`1px solid ${T.accent}`,
        borderRadius:6, zIndex:200, overflow:"hidden", overflowY:"auto", maxHeight:240,
        boxShadow:"0 6px 20px rgba(0,0,0,0.5)",
      }}>
        {[
          { v:"this", l: boardName || "This board" },
          { v:"all",  l: "All boards" },
          ...boards
            .filter(b => b.id !== boardId)
            .map(b => ({ v:b.id, l:b.name })),
        ].map(opt => (
          <div key={opt.v}
            onClick={() => { setBoardScope(opt.v); setBoardDropOpen(false); }}
            style={{
              padding:"8px 12px", fontSize:12, cursor:"pointer",
              background: boardScope===opt.v ? "#1a3a6a" : "transparent",
              color: boardScope===opt.v ? "#fff" : T.textSub,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            }}
            onMouseEnter={e => e.currentTarget.style.background="#2a2a2a"}
            onMouseLeave={e => e.currentTarget.style.background=boardScope===opt.v?"#1a3a6a":"transparent"}
          >{opt.l}</div>
        ))}
        {boards.length === 0 && !boardsLoading && (
          <div style={{ padding:"8px 12px", fontSize:12, color:T.textMuted }}>No other boards found</div>
        )}
      </div>
    )}
  </div>
</div>
<div>
  <div style={{ fontSize:11, color:T.textMuted, marginBottom:5 }}>Member</div>
  <div style={{ position:"relative" }}>
    <select
      value={memberScope}
      onChange={e => {
        const val = e.target.value;
        setMemberScope(val);
        setFilterValues(prev => ({
          ...prev,
          member: val !== "anyone" ? [val] : [],
        }));
      }}
      style={selectStyle}
    >
      <option value="anyone">Anyone</option>
      {(scopedMembers||[]).map(m => (
        <option key={m.id} value={m.id}>
          {m.fullName}{m.fullName === memberName ? " (you)" : ""}
        </option>
      ))}
    </select>
    <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:10, color:T.textMuted, pointerEvents:"none" }}>▾</span>
  </div>
</div>
                  </div>
                  {scopeLoading && (
                    <div style={{ fontSize:11, color:T.textMuted, marginTop:6 }}>Loading members, labels and lists…</div>
                  )}
                </div>

                <Divider />

                {/* ── FILTERS SECTION ── */}
                <div>
                  {/* Header row: label + Add filter button */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <SectionLabel style={{ marginBottom:0 }}>Filters</SectionLabel>
                    <AddFilterDropdown
                      activeKeys={activeFilters}
                      onAdd={addFilter}
                      isPremium={isPremium}
                      onUpgradeClick={onUpgradeClick}
                    />
                  </div>

                  {/* Pills — wrap freely, each pill is flex-shrink:0 so it never truncates */}
                  {activeFilters.length > 0 && (
                    <div style={{
                      display:"flex",
                      flexWrap:"wrap",
                      gap:6,
                      marginBottom:12,
                      // No overflow:hidden here — let pills wrap naturally
                    }}>
                      {activeFilters.map(key => (
                        <FilterPill
                          key={key}
                          filterKey={key}
                          values={filterValues[key]||[]}
                          onValuesChange={vals => setFilterValue(key, vals)}
                          onRemove={() => removeFilter(key)}
                          lists={scopedLists}
                          members={scopedMembers}
                          boardLabels={scopedLabels}
                        />
                      ))}
                    </div>
                  )}

                  {/* Matching count */}
                  <div style={{
                    display:"flex", alignItems:"center", gap:8,
                    background:T.bgDeep, border:`1px solid ${T.border}`,
                    borderRadius:8, padding:"9px 14px",
                  }}>
                    <span style={{ fontSize:14 }}>⧖</span>
                    <span style={{ fontSize:13, color:T.textSub }}>Matching</span>
                    <span style={{ fontSize:14, fontWeight:700, color:T.accent }}>{liveCount}</span>
                    <span style={{ fontSize:13, color:T.textSub }}>cards</span>
                  </div>
                </div>

                 </>}  {/* ← closes the filters tab */}


              {/* ── STYLE TAB ── */}
              {activeTab==="style" && <>
                <div>
                  <SectionLabel>Cover color</SectionLabel>
                  <ColorSwatchPicker
                    selected={coverImage?null:coverColor}
                    onChange={id=>{ setCoverColor(id); setCoverImage(null); }}
                    isPremium={isPremium} onUpgradeClick={onUpgradeClick}
                  />
                </div>
                <Divider />
                <div>
                  <SectionLabel>
                    Cover image{" "}
                    <span style={{ color:T.textMuted, fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optional — overrides color)</span>
                  </SectionLabel>
                  <ImageUpload imageUrl={coverImage} onImageChange={setCoverImage} />
                </div>
              </>}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display:"flex", justifyContent:"flex-end", gap:10,
          padding:"13px 18px", borderTop:`1px solid ${T.borderLight}`, flexShrink:0,
          background:T.bg,
        }}>
          <button onClick={onClose} style={{
            background:"none", border:`1px solid ${T.border}`, borderRadius:7,
            padding:"7px 20px", color:T.textSub, fontSize:13, fontFamily:"inherit", cursor:"pointer",
          }}>Cancel</button>
          <button onClick={handleSave}
            style={{ background:T.accent, border:"none", borderRadius:7, padding:"7px 22px", color:"#fff", fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}
            onMouseEnter={e=>e.currentTarget.style.background=T.accentHover}
            onMouseLeave={e=>e.currentTarget.style.background=T.accent}
          >Start tracking</button>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function CustomizeFlow({
  show, lists, stats, memberName, members, boardLabels, customizeStat, setCustomizeStat,
  onSave, onClose, isPremium, onUpgradeClick, computeFilteredCount,
  boardName, boardId, workspaceBoards, fetchWorkspaceBoards, fetchBoardScopedData,
}){
  if (!show) return null;
  if (!customizeStat) return <StatPicker onSelect={type=>setCustomizeStat(type)} onClose={onClose} />;
  return (
    <CardConfigModal
      statType={customizeStat} statValue={stats?.[customizeStat]??0}
      lists={lists} memberName={memberName} members={members} boardLabels={boardLabels}
      isPremium={isPremium} computeFilteredCount={computeFilteredCount}
      onSave={onSave} onBack={()=>setCustomizeStat(null)} onClose={onClose} onUpgradeClick={onUpgradeClick}
      boardName={boardName} boardId={boardId} workspaceBoards={workspaceBoards}
      fetchWorkspaceBoards={fetchWorkspaceBoards}
      fetchBoardScopedData={fetchBoardScopedData}
    />
  );
}

