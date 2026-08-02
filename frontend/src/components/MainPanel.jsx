import ErrorLogCard from "./ErrorLogCard";
import ExplanationCard from "./ExplanationCard";
import MatchedIncidentCard from "./MatchedIncidentCard";
import ActionButtons from "./ActionButtons";
import TrendChart from "./TrendChart";
import PasteLogForm from "./PasteLogForm";

export default function MainPanel({ detail, loading, onResolve, onNotify, actionBusy, actionMessage, onDataChanged, onAnalyze, analyzing }) {
  if (loading) {
    return (
      <main className="main-panel main-panel--empty">
        <p>Loading build…</p>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="main-panel">
        <p className="dashboard-hint">Paste a real error log below, or select a past build from the sidebar.</p>
        <PasteLogForm onAnalyze={onAnalyze} analyzing={analyzing} />
        <TrendChart onDataChanged={onDataChanged} />
      </main>
    );
  }

  const { build, incident, matchedIncident, timeToFix } = detail;

  if (!incident) {
    return (
      <main className="main-panel main-panel--empty">
        <p>
          <strong>{build.buildId}</strong> ({build.service}) passed — nothing to root-cause.
        </p>
      </main>
    );
  }

  return (
    <main className="main-panel">
      <ErrorLogCard incident={incident} />
      <ExplanationCard incident={incident} timeToFix={timeToFix} />
      <MatchedIncidentCard matchedIncident={matchedIncident} />
      <ActionButtons
        incident={incident}
        onResolve={onResolve}
        onNotify={onNotify}
        busy={actionBusy}
      />
      {actionMessage && <p className="action-message">{actionMessage}</p>}
    </main>
  );
}
