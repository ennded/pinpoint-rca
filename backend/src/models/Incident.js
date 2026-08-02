const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
  {
    // Which build/pipeline run this incident came from
    buildId: { type: String, required: true },
    service: { type: String, required: true },

    // Raw + parsed error data
    rawLog: { type: String, required: true },
    errorType: { type: String, required: true },
    keyLine: { type: String, required: true },

    // Vector embedding of the parsed error text (text-embedding-3-small -> 1536 dims)
    embedding: { type: [Number], required: true },

    // LLM output
    explanation: { type: String, required: true },
    fix: { type: String, required: true },

    // Link back to the past incident this one matched against, if any
    matchedIncident: { type: mongoose.Schema.Types.ObjectId, ref: "Incident", default: null },
    matchScore: { type: Number, default: null },

    // Phase 3: LLM-assigned root-cause category and impact severity.
    // Populated when the severity/tagging pipeline is wired up; null until then.
    category: {
      type: String,
      enum: ["database", "config", "dependency", "network", "build", "test", "infrastructure", null],
      default: null,
    },
    severity: { type: String, enum: ["low", "medium", "high", null], default: null },

    // Phase 2: feedback loop on explanation quality, used to deprioritize
    // unhelpful past incidents in future similarity search ranking.
    feedback: {
      helpful: { type: Number, default: 0 },
      notHelpful: { type: Number, default: 0 },
    },

    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
    // Minutes between creation and being marked resolved — feeds the
    // Phase 3 "similar issues took ~N min to fix" estimate.
    resolutionTimeMinutes: { type: Number, default: null },

    // Thread/conversation reference for each platform this incident was
    // posted to, so an inbound reply can be mapped back to this incident.
    notifications: {
      slack: { ref: { type: String, default: null } },
      teams: { ref: { type: String, default: null } },
    },
  },
  { timestamps: true }
);

// Embeddings are large and never queried by value directly (similarity search
// pulls them into memory and compares in JS), so keep them out of default
// find() results to avoid bloating list views.
incidentSchema.path("embedding").select(false);

module.exports = mongoose.model("Incident", incidentSchema);
