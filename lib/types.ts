import { z } from "zod";

/**
 * The LLM never writes raw SQL directly against the database.
 * Instead it emits a constrained "query plan" that our backend
 * translates to a Postgres query with vendor_id injected server-side.
 * This is the core data-isolation guarantee from the kickoff meeting:
 * the AI cannot escape its tenant, because it never touches the
 * vendor_id parameter.
 */
export const QueryPlanSchema = z.object({
  // Set to false when the question cannot be answered from available data
  // (e.g. "why did customers cancel?" — we only store reason_category,
  //  not the human explanation). The UI renders `refusal_reason` as text.
  can_answer: z.boolean(),
  refusal_reason: z.string().nullable().optional(),

  // The metric to aggregate.
  metric: z
    .enum([
      "revenue",            // SUM(order_items.quantity * order_items.unit_price)
      "units_sold",         // SUM(order_items.quantity)
      "order_count",        // COUNT(DISTINCT orders.id)
      "cancellation_count", // COUNT of cancelled orders
      "cancellation_rate",  // cancelled / total orders, as percentage
      "avg_order_value",    // AVG(order total)
    ])
    .nullable()
    .optional(),

  // How to break the metric down along the X axis / segments.
  dimension: z
    .enum([
      "product",         // group by product name
      "category",        // group by product category
      "day",             // group by order_date truncated to day
      "week",            // truncated to ISO week
      "month",           // truncated to month
      "weekday",         // Monday/Tuesday/... (used for "Tue vs Wed")
      "customer_region", // group by customer region
      "cancel_reason",   // group by reason_category
      "none",            // single aggregate number (no breakdown)
    ])
    .nullable()
    .optional(),

  // Optional time window filter. Both inclusive, ISO date strings.
  date_from: z.string().nullable().optional(),
  date_to: z.string().nullable().optional(),

  // Only include orders with these statuses. null = all.
  order_status: z
    .array(z.enum(["placed", "shipped", "delivered", "cancelled"]))
    .nullable()
    .optional(),

  // Sort direction for the results. Defaults to desc.
  sort: z.enum(["asc", "desc"]).nullable().optional(),

  // Limit number of rows returned (for "top N" questions).
  top_n: z.number().int().min(1).max(50).nullable().optional(),

  // Chart recommendation.
  chart_type: z.enum(["bar", "line", "pie", "number", "none"]).nullable().optional(),

  // Short title + summary to show above the chart.
  title: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export type QueryPlan = z.infer<typeof QueryPlanSchema>;

export type ChartRow = {
  label: string;       // X axis / slice label
  value: number;       // Y axis value
  secondary?: number;  // for future compare-two-series cases
};

export type ChatResponse = {
  kind: "answer" | "refusal" | "error";
  title?: string;
  summary?: string;
  refusal_reason?: string;
  error?: string;
  chart_type?: "bar" | "line" | "pie" | "number" | "none";
  rows?: ChartRow[];
  value_format?: "currency" | "integer" | "percent";
  debug?: {
    plan: QueryPlan;
    rowCount: number;
    ms: number;
  };
};
