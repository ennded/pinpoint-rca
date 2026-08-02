import FeedbackButtons from "./FeedbackButtons";

function TimeToFixLine({ timeToFix }) {
  if (!timeToFix) return null;
  const { averageMinutes, sampleSize, scope } = timeToFix;
  const scopeLabel = scope === "service" ? "similar issues in this service" : "similar issues";
  return (
    <p className="time-to-fix">
      ⏱ {scopeLabel} took ~{averageMinutes} min to fix on average ({sampleSize} past {sampleSize === 1 ? "case" : "cases"})
    </p>
  );
}

export default function ExplanationCard({ incident, timeToFix }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2>AI explanation</h2>
      </div>
      <div className="card__body">
        <p className="explanation-text">{incident.explanation}</p>
        <div className="fix-block">
          <span className="fix-block__label">Suggested fix</span>
          <p>{incident.fix}</p>
        </div>
        <TimeToFixLine timeToFix={timeToFix} />
        <FeedbackButtons key={incident._id} incidentId={incident._id} />
      </div>
    </section>
  );
}
