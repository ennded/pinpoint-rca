export default function ActionButtons({ incident, onResolve, onNotify, busy }) {
  return (
    <div className="action-row">
      <button
        className="btn btn--success"
        onClick={onResolve}
        disabled={busy || incident.resolved}
      >
        {incident.resolved ? "Resolved" : "Mark as resolved"}
      </button>
      <button className="btn btn--secondary" onClick={() => onNotify("slack")} disabled={busy}>
        Post to Slack
      </button>
      <button className="btn btn--secondary" onClick={() => onNotify("teams")} disabled={busy}>
        Post to Teams
      </button>
    </div>
  );
}
