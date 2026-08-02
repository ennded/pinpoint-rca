import { useCallback, useEffect, useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import MainPanel from "./components/MainPanel";
import { listBuilds, getBuild, analyzeLog, resolveIncident, postToPlatform } from "./api";
import "./App.css";

export default function App() {
  const [builds, setBuilds] = useState([]);
  const [category, setCategory] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [error, setError] = useState("");

  const refreshBuilds = useCallback(async (categoryOverride = category) => {
    try {
      const data = await listBuilds(categoryOverride);
      setBuilds(data);
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, [category]);

  useEffect(() => {
    refreshBuilds(category);
  }, [category, refreshBuilds]);

  const selectBuild = useCallback(async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    setActionMessage("");
    try {
      const data = await getBuild(id);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleAnalyze = useCallback(async (rawLog, service) => {
    setAnalyzing(true);
    setError("");
    setActionMessage("");
    try {
      const result = await analyzeLog(rawLog, service);
      // Ad-hoc analysis, not a CI/CD build — don't touch the builds sidebar,
      // just show the result directly.
      setSelectedId(null);
      setDetail({ build: null, incident: result.incident, matchedIncident: result.matchedIncident, timeToFix: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleResolve = useCallback(async () => {
    if (!detail?.incident) return;
    setActionBusy(true);
    setActionMessage("");
    try {
      const updated = await resolveIncident(detail.incident._id);
      setDetail((prev) => ({ ...prev, incident: { ...prev.incident, ...updated } }));
      setActionMessage("Marked as resolved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }, [detail]);

  const handleNotify = useCallback(async (platform) => {
    if (!detail?.incident) return;
    setActionBusy(true);
    setActionMessage("");
    try {
      const result = await postToPlatform(platform, detail.incident._id);
      setActionMessage(result.message || `Posted to ${platform}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }, [detail]);

  return (
    <div className="app">
      <Header />
      {error && (
        <div className="error-banner" onClick={() => setError("")}>
          {error} (click to dismiss)
        </div>
      )}
      <div className="app-body">
        <Sidebar
          builds={builds}
          selectedId={selectedId}
          onSelect={selectBuild}
          category={category}
          onCategoryChange={setCategory}
        />
        <MainPanel
          detail={detail}
          loading={detailLoading}
          onResolve={handleResolve}
          onNotify={handleNotify}
          actionBusy={actionBusy}
          actionMessage={actionMessage}
          onDataChanged={refreshBuilds}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
        />
      </div>
    </div>
  );
}
