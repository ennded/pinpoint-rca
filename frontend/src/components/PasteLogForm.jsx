import { useState } from "react";

export default function PasteLogForm({ onAnalyze, analyzing }) {
  const [rawLog, setRawLog] = useState("");
  const [service, setService] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!rawLog.trim() || analyzing) return;
    onAnalyze(rawLog, service.trim() || undefined);
  };

  return (
    <form className="card paste-log" onSubmit={handleSubmit}>
      <div className="card__header">
        <h2>Analyze a real error log</h2>
      </div>
      <div className="card__body">
        <textarea
          className="paste-log__textarea"
          placeholder="Paste a build failure log, stack trace, or `kubectl describe pod` output…"
          value={rawLog}
          onChange={(e) => setRawLog(e.target.value)}
          rows={10}
        />
        <input
          className="paste-log__service"
          placeholder="Service name (optional — inferred from the log if omitted)"
          value={service}
          onChange={(e) => setService(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={!rawLog.trim() || analyzing}>
          {analyzing ? "Analyzing…" : "Get root cause & fix"}
        </button>
      </div>
    </form>
  );
}
