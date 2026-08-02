export default function ErrorLogCard({ incident }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2>Raw error log</h2>
        <div className="tag-row">
          {incident.severity && (
            <span className={`severity-badge severity-badge--${incident.severity}`}>{incident.severity}</span>
          )}
          <span className="tag">{incident.errorType}</span>
          <span className="tag tag--muted">{incident.service}</span>
          {incident.category && <span className="tag tag--muted">{incident.category}</span>}
        </div>
      </div>
      <div className="card__body">
        <div className="key-line">
          <span className="key-line__label">Key line</span>
          <code>{incident.keyLine}</code>
        </div>
        <pre className="log-block">{incident.rawLog}</pre>
      </div>
    </section>
  );
}
