const express = require("express");
const Incident = require("../models/Incident");

const router = express.Router();

// Failure count per service, per day, for the last N days — feeds the
// dashboard trend chart. Shape: { days: ["2026-06-21", ...], services: ["payment-service", ...],
// data: [{ date: "2026-06-21", "payment-service": 2, "checkout-service": 0 }, ...] }
router.get("/trend", async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
    // Work entirely in UTC-day terms so this lines up with $dateToString's
    // default UTC timezone — mixing local-midnight Dates with UTC-formatted
    // day strings silently drops "today" (and shifts everything) depending
    // on the server's local offset.
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const since = new Date(todayUTC.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const rows = await Incident.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            service: "$service",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const services = [...new Set(rows.map((r) => r._id.service))].sort();

    const dayKeys = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      dayKeys.push(d.toISOString().slice(0, 10));
    }

    const countByDayService = {};
    for (const row of rows) {
      countByDayService[`${row._id.day}|${row._id.service}`] = row.count;
    }

    const data = dayKeys.map((day) => {
      const entry = { date: day };
      for (const service of services) {
        entry[service] = countByDayService[`${day}|${service}`] || 0;
      }
      return entry;
    });

    res.json({ days: dayKeys, services, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
