import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { getTrend, seedDemoData } from "../api";

const SERIES_COLORS = ["#aa3bff", "#17875a", "#d33f3f", "#2563eb", "#d97706", "#0891b2"];

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TrendChart({ onDataChanged }) {
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTrend(30);
      setTrend(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDemoData(25);
      await load();
      onDataChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSeeding(false);
    }
  };

  const totalFailures = trend?.data.reduce(
    (sum, day) => sum + trend.services.reduce((s, svc) => s + day[svc], 0),
    0
  );

  return (
    <section className="card trend-card">
      <div className="card__header">
        <h2>Failures per service — last 30 days</h2>
        <button className="btn btn--secondary" onClick={handleSeed} disabled={seeding}>
          {seeding ? "Seeding…" : "Seed demo history"}
        </button>
      </div>
      <div className="card__body">
        {error && <p className="feedback-thanks">{error}</p>}
        {loading && <p>Loading trend…</p>}
        {!loading && trend && trend.services.length === 0 && (
          <p>No incidents in the last 30 days yet. Paste an error log to analyze one, or seed demo history.</p>
        )}
        {!loading && trend && trend.services.length > 0 && (
          <div className="trend-chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trend.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={formatDateLabel} stroke="var(--text)" fontSize={11} />
                <YAxis allowDecimals={false} stroke="var(--text)" fontSize={11} />
                <Tooltip labelFormatter={formatDateLabel} contentStyle={{ background: "var(--bg)", border: "1px solid var(--border)" }} />
                <Legend />
                {trend.services.map((service, i) => (
                  <Area
                    key={service}
                    type="monotone"
                    dataKey={service}
                    stackId="1"
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                    fillOpacity={0.35}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            <p className="trend-total">{totalFailures} total failures across {trend.services.length} services</p>
          </div>
        )}
      </div>
    </section>
  );
}
