const CATEGORIES = ["database", "config", "dependency", "network", "build", "test", "infrastructure"];

function StatusDot({ status }) {
  return <span className={`status-dot status-dot--${status}`} />;
}

function SeverityBadge({ severity }) {
  if (!severity) return null;
  return <span className={`severity-badge severity-badge--${severity}`}>{severity}</span>;
}

export default function Sidebar({ builds, selectedId, onSelect, category, onCategoryChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__title-row">
        <div className="sidebar__title">Recent builds</div>
        <select
          className="sidebar__category-filter"
          value={category || ""}
          onChange={(e) => onCategoryChange(e.target.value || null)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {builds.length === 0 && <div className="sidebar__empty">No builds match — clear the filter, or seed demo history.</div>}
      <ul className="sidebar__list">
        {builds.map((build) => (
          <li key={build._id}>
            <button
              className={`sidebar__item ${build._id === selectedId ? "sidebar__item--active" : ""}`}
              onClick={() => onSelect(build._id)}
            >
              <StatusDot status={build.status} />
              <span className="sidebar__item-main">
                <span className="sidebar__service">{build.service}</span>
                <span className="sidebar__build-id">{build.buildId}</span>
              </span>
              <span className="sidebar__item-badges">
                <SeverityBadge severity={build.severity} />
                <span className={`badge badge--${build.status}`}>{build.status}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
