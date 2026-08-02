export default function MatchedIncidentCard({ matchedIncident }) {
  if (!matchedIncident) return null;

  const date = new Date(matchedIncident.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const percent = Math.round((matchedIncident.score ?? 0) * 100);

  return (
    <section className="card card--match">
      <div className="card__header">
        <h2>Matches past incident</h2>
        <span className="confidence-badge">{percent}% similar</span>
      </div>
      <div className="card__body">
        <p>
          <strong>{percent}% similar</strong> to a <strong>{matchedIncident.errorType}</strong> in{" "}
          <strong>{matchedIncident.service}</strong> from {date}.
        </p>
        <div className="fix-block">
          <span className="fix-block__label">What worked last time</span>
          <p>{matchedIncident.fix}</p>
        </div>
      </div>
    </section>
  );
}
