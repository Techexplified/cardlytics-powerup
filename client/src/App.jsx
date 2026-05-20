import "./index.css";

export default function App() {
 return (
  <div className="modal-center">
    <div className="popup">

      <div className="header">
        <div className="header-left">
          <div className="trello-icon">T</div>
          <h3>Cardlytics — Track</h3>
        </div>
        <div className="header-actions">
          <button className="btn-customize">Customize</button>
          <button className="close-btn">✕</button>
        </div>
      </div>

      <div className="body">

        <Section title="MY WORK">
          <StatCard value="4" label="Assigned to me across workspace" tag="live" />
          <StatCard value="2" label="Due this week on this board" />
          <StatCard value="1" label="Overdue cards on this board" tag="hot" />
        </Section>

        <Section title="BOARD INSIGHTS">
          <StatCard value="7" label="Unassigned cards on this board" />
          <StatCard value="3" label="With a label on this board" />
          <StatCard value="0" label="Stale cards on this board" />
        </Section>

        <Section title="ACTIVITY">
          <StatCard value="0" label="Created today on this board" />
          <StatCard value="2" label="Cards in this list" />
          <div className="add-filter-card">+ Add filter</div>
        </Section>

        </div>
  </div>
);

function Section({ title, children }) {
  return (
    <div className="section">
      <p className="section-title">{title}</p>
      <div className="grid">{children}</div>
    </div>
  );
}

function StatCard({ value, label, tag }) {
  return (
    <div className="card">
      {tag === "live" && <span className="tag live">Live</span>}
      {tag === "hot" && <span className="tag hot">Hot</span>}
      <div className="card-value">{value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}