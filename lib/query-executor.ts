import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ChartRow, ChatResponse, QueryPlan } from "./types";

/**
 * Execute a validated QueryPlan on behalf of `vendorId`.
 *
 * This is the security backbone: the LLM can influence WHAT we compute,
 * but it cannot influence WHICH vendor's rows we touch. Every SQL below
 * is constructed by us with vendorId hard-bound as a parameterized value.
 */
export async function executeQueryPlan(
  plan: QueryPlan,
  vendorId: string
): Promise<Omit<ChatResponse, "debug">> {
  if (!plan.can_answer) {
    return {
      kind: "refusal",
      title: plan.title || "Can't answer that one",
      refusal_reason:
        plan.refusal_reason ||
        "I don't have the data needed to answer that question.",
      chart_type: "none",
    };
  }

  const metric = plan.metric || "revenue";
  const dimension = plan.dimension || "none";
  const sort = plan.sort || "desc";
  const topN = plan.top_n ?? null;

  // Compute date filter
  const dateFrom = plan.date_from ? new Date(plan.date_from) : null;
  const dateTo = plan.date_to ? endOfDay(new Date(plan.date_to)) : null;

  // Build WHERE clause fragments. All parameters are bound, never interpolated.
  const whereFragments: Prisma.Sql[] = [Prisma.sql`p.vendor_id = ${vendorId}::uuid`];
  if (dateFrom) whereFragments.push(Prisma.sql`o.order_date >= ${dateFrom}`);
  if (dateTo) whereFragments.push(Prisma.sql`o.order_date <= ${dateTo}`);
  if (plan.order_status && plan.order_status.length) {
    whereFragments.push(
      Prisma.sql`o.status = ANY(${plan.order_status}::text[])`
    );
  }
  const whereSql = Prisma.join(whereFragments, " AND ");

  const metricExpr = metricExpression(metric);
  const valueFormat = valueFormatFor(metric);

  let rows: ChartRow[] = [];

  if (metric === "cancellation_rate") {
    rows = await runCancellationRate(vendorId, dimension, dateFrom, dateTo, sort, topN);
  } else if (metric === "cancellation_count") {
    rows = await runCancellationCount(vendorId, dimension, dateFrom, dateTo, sort, topN);
  } else {
    rows = await runStandardMetric(
      metricExpr,
      dimension,
      whereSql,
      sort,
      topN
    );
  }

  // If dimension is "none", we expect a single scalar → collapse rows
  if (dimension === "none" && rows.length > 1) {
    const total = rows.reduce((acc, r) => acc + r.value, 0);
    rows = [{ label: "Total", value: total }];
  }

  return {
    kind: "answer",
    title: plan.title || defaultTitle(metric, dimension),
    summary: plan.summary || undefined,
    chart_type: (plan.chart_type || autoChartType(dimension)) as ChatResponse["chart_type"],
    rows,
    value_format: valueFormat,
  };
}

// ---------- SQL builders -------------------------------------------------

function metricExpression(metric: string): Prisma.Sql {
  switch (metric) {
    case "revenue":
      return Prisma.sql`SUM(oi.quantity * oi.unit_price)::float`;
    case "units_sold":
      return Prisma.sql`SUM(oi.quantity)::float`;
    case "order_count":
      return Prisma.sql`COUNT(DISTINCT o.id)::float`;
    case "avg_order_value":
      return Prisma.sql`AVG(o.total_amount)::float`;
    default:
      return Prisma.sql`SUM(oi.quantity * oi.unit_price)::float`;
  }
}

function dimensionExpression(dimension: string): { select: Prisma.Sql; group: Prisma.Sql } {
  switch (dimension) {
    case "product":
      return { select: Prisma.sql`p.name AS label`, group: Prisma.sql`p.name` };
    case "category":
      return { select: Prisma.sql`p.category AS label`, group: Prisma.sql`p.category` };
    case "day":
      return {
        select: Prisma.sql`to_char(date_trunc('day', o.order_date), 'YYYY-MM-DD') AS label`,
        group: Prisma.sql`date_trunc('day', o.order_date)`,
      };
    case "week":
      return {
        select: Prisma.sql`to_char(date_trunc('week', o.order_date), 'YYYY-"W"IW') AS label`,
        group: Prisma.sql`date_trunc('week', o.order_date)`,
      };
    case "month":
      return {
        select: Prisma.sql`to_char(date_trunc('month', o.order_date), 'YYYY-MM') AS label`,
        group: Prisma.sql`date_trunc('month', o.order_date)`,
      };
    case "weekday":
      return {
        select: Prisma.sql`trim(to_char(o.order_date, 'Day')) AS label`,
        group: Prisma.sql`trim(to_char(o.order_date, 'Day')), extract(dow from o.order_date)`,
      };
    case "customer_region":
      return {
        select: Prisma.sql`c.region AS label`,
        group: Prisma.sql`c.region`,
      };
    case "cancel_reason":
      return {
        select: Prisma.sql`oc.reason_category AS label`,
        group: Prisma.sql`oc.reason_category`,
      };
    default:
      return { select: Prisma.sql`'Total' AS label`, group: Prisma.sql`1` };
  }
}

async function runStandardMetric(
  metricExpr: Prisma.Sql,
  dimension: string,
  whereSql: Prisma.Sql,
  sort: "asc" | "desc",
  topN: number | null
): Promise<ChartRow[]> {
  const { select: dimSelect, group: dimGroup } = dimensionExpression(dimension);
  const joinCustomer =
    dimension === "customer_region"
      ? Prisma.sql`JOIN customers c ON c.id = o.customer_id`
      : Prisma.empty;
  const joinCancel =
    dimension === "cancel_reason"
      ? Prisma.sql`JOIN order_cancellations oc ON oc.order_id = o.id`
      : Prisma.empty;

  const orderDirSql =
    sort === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  // For time dimensions we always sort by the date itself ascending, regardless
  // of user-supplied sort (line charts read left-to-right in time).
  const isTimeDim =
    dimension === "day" || dimension === "week" || dimension === "month";

  const orderBy = isTimeDim
    ? Prisma.sql`ORDER BY ${dimGroup} ASC`
    : Prisma.sql`ORDER BY value ${orderDirSql}`;

  const limit = topN && !isTimeDim ? Prisma.sql`LIMIT ${topN}` : Prisma.empty;

  const query = Prisma.sql`
    SELECT ${dimSelect}, ${metricExpr} AS value
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    ${joinCustomer}
    ${joinCancel}
    WHERE ${whereSql}
    GROUP BY ${dimGroup}
    ${orderBy}
    ${limit}
  `;

  const raw = await prisma.$queryRaw<{ label: string; value: number | null }[]>(query);
  return raw.map((r) => ({
    label: r.label ?? "—",
    value: Number(r.value ?? 0),
  }));
}

async function runCancellationCount(
  vendorId: string,
  dimension: string,
  dateFrom: Date | null,
  dateTo: Date | null,
  sort: "asc" | "desc",
  topN: number | null
): Promise<ChartRow[]> {
  const whereFragments: Prisma.Sql[] = [
    Prisma.sql`p.vendor_id = ${vendorId}::uuid`,
    Prisma.sql`o.status = 'cancelled'`,
  ];
  if (dateFrom) whereFragments.push(Prisma.sql`o.order_date >= ${dateFrom}`);
  if (dateTo) whereFragments.push(Prisma.sql`o.order_date <= ${dateTo}`);
  const where = Prisma.join(whereFragments, " AND ");

  const { select: dimSelect, group: dimGroup } = dimensionExpression(dimension);
  const joinCancel = Prisma.sql`JOIN order_cancellations oc ON oc.order_id = o.id`;
  const joinCustomer =
    dimension === "customer_region"
      ? Prisma.sql`JOIN customers c ON c.id = o.customer_id`
      : Prisma.empty;

  const orderDirSql = sort === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const isTimeDim = dimension === "day" || dimension === "week" || dimension === "month";
  const orderBy = isTimeDim
    ? Prisma.sql`ORDER BY ${dimGroup} ASC`
    : Prisma.sql`ORDER BY value ${orderDirSql}`;
  const limit = topN && !isTimeDim ? Prisma.sql`LIMIT ${topN}` : Prisma.empty;

  const query = Prisma.sql`
    SELECT ${dimSelect}, COUNT(DISTINCT o.id)::float AS value
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    ${joinCancel}
    ${joinCustomer}
    WHERE ${where}
    GROUP BY ${dimGroup}
    ${orderBy}
    ${limit}
  `;

  const raw = await prisma.$queryRaw<{ label: string; value: number | null }[]>(query);
  return raw.map((r) => ({ label: r.label ?? "—", value: Number(r.value ?? 0) }));
}

async function runCancellationRate(
  vendorId: string,
  dimension: string,
  dateFrom: Date | null,
  dateTo: Date | null,
  sort: "asc" | "desc",
  topN: number | null
): Promise<ChartRow[]> {
  const whereFragments: Prisma.Sql[] = [Prisma.sql`p.vendor_id = ${vendorId}::uuid`];
  if (dateFrom) whereFragments.push(Prisma.sql`o.order_date >= ${dateFrom}`);
  if (dateTo) whereFragments.push(Prisma.sql`o.order_date <= ${dateTo}`);
  const where = Prisma.join(whereFragments, " AND ");

  const { select: dimSelect, group: dimGroup } = dimensionExpression(dimension);
  const joinCustomer =
    dimension === "customer_region"
      ? Prisma.sql`JOIN customers c ON c.id = o.customer_id`
      : Prisma.empty;

  const orderDirSql = sort === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const isTimeDim = dimension === "day" || dimension === "week" || dimension === "month";
  const orderBy = isTimeDim
    ? Prisma.sql`ORDER BY ${dimGroup} ASC`
    : Prisma.sql`ORDER BY value ${orderDirSql}`;
  const limit = topN && !isTimeDim ? Prisma.sql`LIMIT ${topN}` : Prisma.empty;

  const query = Prisma.sql`
    SELECT ${dimSelect},
           (SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END)::float
             / NULLIF(COUNT(DISTINCT o.id), 0) * 100) AS value
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    ${joinCustomer}
    WHERE ${where}
    GROUP BY ${dimGroup}
    ${orderBy}
    ${limit}
  `;

  const raw = await prisma.$queryRaw<{ label: string; value: number | null }[]>(query);
  return raw.map((r) => ({ label: r.label ?? "—", value: Number(r.value ?? 0) }));
}

// ---------- Helpers ------------------------------------------------------

function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setUTCHours(23, 59, 59, 999);
  return c;
}

function valueFormatFor(metric: string): "currency" | "integer" | "percent" {
  if (metric === "revenue" || metric === "avg_order_value") return "currency";
  if (metric === "cancellation_rate") return "percent";
  return "integer";
}

function autoChartType(dimension: string): "bar" | "line" | "pie" | "number" {
  if (dimension === "day" || dimension === "week" || dimension === "month") return "line";
  if (dimension === "category" || dimension === "cancel_reason" || dimension === "customer_region") return "pie";
  if (dimension === "none") return "number";
  return "bar";
}

function defaultTitle(metric: string, dimension: string): string {
  const m = {
    revenue: "Revenue",
    units_sold: "Units sold",
    order_count: "Order count",
    cancellation_count: "Cancellations",
    cancellation_rate: "Cancellation rate",
    avg_order_value: "Average order value",
  }[metric] || "Report";
  if (dimension === "none") return m;
  const d = {
    product: "by product",
    category: "by category",
    day: "over time",
    week: "by week",
    month: "by month",
    weekday: "by weekday",
    customer_region: "by region",
    cancel_reason: "by cancel reason",
  }[dimension as keyof object] || "";
  return `${m} ${d}`.trim();
}
