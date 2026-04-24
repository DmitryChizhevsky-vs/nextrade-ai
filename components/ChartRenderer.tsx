"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartRow } from "@/lib/types";

type Props = {
  chartType: "bar" | "line" | "pie" | "number" | "none";
  rows: ChartRow[];
  valueFormat?: "currency" | "integer" | "percent";
};

const PIE_COLORS = ["#008080", "#0FB5AE", "#1F9A8A", "#2E7D6B", "#3B5E4F", "#5D7F6D"];

export function ChartRenderer({ chartType, rows, valueFormat }: Props) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-text-muted text-body italic">
        No data matched this query.
      </div>
    );
  }

  if (chartType === "number") {
    const v = rows[0]?.value ?? 0;
    return (
      <div className="py-4">
        <div className="text-[56px] leading-none font-bold tracking-[-0.05em] text-text-primary">
          {formatValue(v, valueFormat)}
        </div>
        <div className="label-mono mt-2">{rows[0]?.label ?? ""}</div>
      </div>
    );
  }

  if (chartType === "bar") {
    return (
      <div className="h-[320px] w-full">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#6C757D" }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
              interval={0}
              angle={rows.length > 6 ? -30 : 0}
              textAnchor={rows.length > 6 ? "end" : "middle"}
              height={rows.length > 6 ? 60 : 30}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6C757D" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCompact(Number(v), valueFormat)}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,128,128,0.06)" }}
              contentStyle={tooltipStyle}
              formatter={(v: number) => formatValue(v, valueFormat)}
            />
            <Bar dataKey="value" fill="#008080" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <div className="h-[320px] w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#6C757D" }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6C757D" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCompact(Number(v), valueFormat)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => formatValue(v, valueFormat)}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#008080"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#008080" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // pie
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={110}
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => formatValue(v, valueFormat)}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-4">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-small text-text-muted">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className="text-text-primary">{r.label}</span>
            <span className="tabular-nums">{formatValue(r.value, valueFormat)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "#1A1A1A",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  fontSize: 12,
  padding: "8px 10px",
};

function formatValue(v: number, fmt?: "currency" | "integer" | "percent"): string {
  if (fmt === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);
  }
  if (fmt === "percent") return `${v.toFixed(1)}%`;
  return new Intl.NumberFormat("en-US").format(Math.round(v));
}

function formatCompact(v: number, fmt?: "currency" | "integer" | "percent"): string {
  if (fmt === "currency") {
    if (Math.abs(v) >= 1000) {
      return "$" + new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);
    }
    return "$" + v.toFixed(0);
  }
  if (fmt === "percent") return `${v.toFixed(0)}%`;
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}
