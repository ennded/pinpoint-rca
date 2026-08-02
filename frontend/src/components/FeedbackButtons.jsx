import { useState } from "react";
import { submitFeedback } from "../api";

export default function FeedbackButtons({ incidentId }) {
  const [voted, setVoted] = useState(null);
  const [busy, setBusy] = useState(false);

  const castVote = async (helpful) => {
    if (busy || voted !== null) return;
    setBusy(true);
    try {
      await submitFeedback(incidentId, helpful);
      setVoted(helpful ? "helpful" : "not-helpful");
    } finally {
      setBusy(false);
    }
  };

  if (voted) {
    return <p className="feedback-thanks">Thanks for the feedback — marked as {voted.replace("-", " ")}.</p>;
  }

  return (
    <div className="feedback-row">
      <span className="feedback-row__label">Was this explanation helpful?</span>
      <button className="btn btn--ghost" disabled={busy} onClick={() => castVote(true)}>
        👍 Helpful
      </button>
      <button className="btn btn--ghost" disabled={busy} onClick={() => castVote(false)}>
        👎 Not helpful
      </button>
    </div>
  );
}
