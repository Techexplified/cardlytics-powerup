import "./index.css";

export default function App() {
  return (
    <div className="overlay">
      <div className="popup">

        {/* HEADER */}
        <div className="header">
          <h3>Cardlytics — Track</h3>
          <div className="actions">
            <button className="btn">Customize</button>
            <span className="close">✕</span>
          </div>
        </div>

        {/* MY WORK */}
        <Section title="MY WORK">
          <Card value="4" title="Assigned to me across workspace" tag="Live" />
          <Card value="2" title="Due this week on this board" />
          <Card value="1" title="Overdue cards on this board" tag="Hot" />
        </Section>

        {/* BOARD INSIGHTS */}
        <Section title="BOARD INSIGHTS">
          <Card value="7" title="Unassigned cards on this board" />
          <Card value="3" title="With a label on this board" />
          <Card value="0" title="Stale cards on this board" />
        </Section>

        {/* ACTIVITY */}
        <Section title="ACTIVITY">
          <Card value="0" title="Created today on this board" />
          <Card value="2" title="Cards in this list" />
          <div className="card add">+ Add filter</div>
        </Section>

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

function Card({ value, title, tag }) {
  return (
    <div className="card">
      {tag && <span className="tag">{tag}</span>}
      <h2>{value}</h2>
      <p>{title}</p>
    </div>
  );
}