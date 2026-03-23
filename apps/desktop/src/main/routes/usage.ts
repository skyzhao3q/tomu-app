import { Router, type Router as RouterType } from "express";
import { sqlite } from "../db.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageRow {
  input_tokens: number;
  output_tokens: number;
  requests: number;
}

interface UsageByDay extends UsageRow {
  date: string;
}

interface UsageByModel extends UsageRow {
  model_id: string;
  provider_id: string;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Get usage with filtering
router.get("/usage", (req, res) => {
  const days = Number(req.query.days) || 30;
  const providerId = req.query.provider_id as string | undefined;
  const modelId = req.query.model_id as string | undefined;

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  // Build WHERE clause
  const conditions = ["timestamp >= ?"];
  const params: unknown[] = [sinceStr];

  if (providerId) {
    conditions.push("provider = ?");
    params.push(providerId);
  }
  if (modelId) {
    conditions.push("model = ?");
    params.push(modelId);
  }

  const where = conditions.join(" AND ");

  // Total aggregates
  const totals = sqlite
    .prepare(
      `SELECT
        COALESCE(SUM(input_tokens), 0) AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COUNT(*) AS requests
      FROM usage_logs WHERE ${where}`,
    )
    .get(...params) as UsageRow;

  // By day
  const byDay = sqlite
    .prepare(
      `SELECT
        DATE(timestamp) AS date,
        COALESCE(SUM(input_tokens), 0) AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COUNT(*) AS requests
      FROM usage_logs WHERE ${where}
      GROUP BY DATE(timestamp)
      ORDER BY date`,
    )
    .all(...params) as UsageByDay[];

  // By model
  const byModel = sqlite
    .prepare(
      `SELECT
        model AS model_id,
        provider AS provider_id,
        COALESCE(SUM(input_tokens), 0) AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COUNT(*) AS requests
      FROM usage_logs WHERE ${where}
      GROUP BY model, provider
      ORDER BY requests DESC`,
    )
    .all(...params) as UsageByModel[];

  res.json({
    total_input_tokens: totals.input_tokens,
    total_output_tokens: totals.output_tokens,
    total_requests: totals.requests,
    by_day: byDay,
    by_model: byModel,
  });
});

// Summary across all time
router.get("/usage/summary", (_req, res) => {
  const totals = sqlite
    .prepare(
      `SELECT
        COALESCE(SUM(input_tokens), 0) AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COUNT(*) AS requests
      FROM usage_logs`,
    )
    .get() as UsageRow;

  res.json({
    total_input_tokens: totals.input_tokens,
    total_output_tokens: totals.output_tokens,
    total_requests: totals.requests,
  });
});

export default router;
