const mongoose = require("mongoose");

const buildSchema = new mongoose.Schema(
  {
    buildId: { type: String, required: true },
    service: { type: String, required: true },
    status: { type: String, enum: ["passed", "failed"], required: true },
    incident: { type: mongoose.Schema.Types.ObjectId, ref: "Incident", default: null },

    // Mirrored from the incident at creation time so the sidebar list can
    // render severity/category badges without a join per row.
    severity: { type: String, enum: ["low", "medium", "high", null], default: null },
    category: {
      type: String,
      enum: ["database", "config", "dependency", "network", "build", "test", "infrastructure", null],
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Build", buildSchema);
