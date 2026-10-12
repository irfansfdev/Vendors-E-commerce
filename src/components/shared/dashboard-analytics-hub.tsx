"use client";

import React, { useState } from "react";
import {
  BarChart2,
  PieChart,
  Award,
  TrendingUp,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// --- Types ---

export type MonthlyPoint = {
  label: string;
  amount: number;
  orders: number;
};

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
  subtext?: string;
};

export type RankingItem = {
  rank: number;
  label: string;
  primaryValue: number; // e.g. sales amount
  secondaryValue: number; // e.g. order count
  detail?: string;
};

export type ComparativePoint = {
  dayLabel: string; // e.g. "Mon", "Tue"
  thisWeekDate: string; // e.g. "Sep 22"
  lastWeekDate: string; // e.g. "Sep 15"
  thisWeekOrders: number;
  thisWeekAmount: number;
  lastWeekOrders: number;
  lastWeekAmount: number;
};

export type DistributionItem = {
  label: string;
  count: number;
  amount: number;
  color: string;
  detail?: string;
};

export type DashboardAnalyticsProps = {
  panelRole: string; // e.g. "Platform Admin", "Shop Admin", "Rider Operations"
  isRider?: boolean;

  // Tab 1: Monthly Combo Chart (Bar + Line)
  monthlyData: {
    points: MonthlyPoint[];
    amountLabel?: string;
    ordersLabel?: string;
    isCurrency?: boolean;
  };

  // Tab 2: Status Breakdown (Donut)
  statusData: {
    title: string;
    centerLabel: string;
    centerSubtext?: string;
    valueUnit?: string;
    slices: DonutSlice[];
  };

  // Tab 3: Rankings / Leaderboard
  rankingsData: {
    title: string;
    subtitle: string;
    primaryLabel: string;
    secondaryLabel: string;
    isCurrency?: boolean;
    secondaryIsCurrency?: boolean;
    items: RankingItem[];
  };

  // Tab 4: 7-Day "This Week vs Last Week" Comparative Line
  pulseData: {
    title: string;
    points: ComparativePoint[];
    isCurrency?: boolean;
  };

  // Tab 5: Distribution / Payment Mix
  distributionData: {
    title: string;
    subtitle: string;
    items: DistributionItem[];
    isCurrency?: boolean;
  };
};

export function DashboardAnalyticsHub({
  panelRole,
  isRider = false,
  monthlyData,
  statusData,
  rankingsData,
  pulseData,
  distributionData,
}: DashboardAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<
    "monthly" | "status" | "rankings" | "pulse" | "distribution"
  >("monthly");

  const tabs = [
    {
      id: "monthly" as const,
      label: isRider ? "Delivery Overview" : "Sales Overview",
      icon: BarChart2,
    },
    {
      id: "status" as const,
      label: isRider ? "Status" : "Order Status",
      icon: PieChart,
    },
    {
      id: "rankings" as const,
      label: isRider
        ? "Performance Batches"
        : panelRole.includes("Admin") && !panelRole.includes("Shop")
        ? "Top Shops"
        : "Top Products",
      icon: Award,
    },
    {
      id: "pulse" as const,
      label: "Weekly Compare",
      icon: TrendingUp,
    },
    {
      id: "distribution" as const,
      label: isRider ? "COD Summary" : "Payments",
      icon: isRider ? Layers : CreditCard,
    },
  ];

  return (
    <section className="surface overflow-hidden rounded-2xl border border-slate-200/80 p-5 sm:p-6 dark:border-white/10">
      {/* Integrated Header with Compact Clean Tabs */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-orange-500">
              Analytics & Insights
            </span>
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
              {panelRole}
            </span>
          </div>
          <h2 className="mt-1 text-lg font-black tracking-tight sm:text-xl">
            {activeTab === "monthly" &&
              (isRider
                ? "Delivery Overview"
                : "Sales Overview")}
            {activeTab === "status" && statusData.title}
            {activeTab === "rankings" && rankingsData.title}
            {activeTab === "pulse" && pulseData.title}
            {activeTab === "distribution" && distributionData.title}
          </h2>
        </div>

        {/* Sleek Pill Tab Navigation - Seamlessly inside the card header */}
        {!isRider && <nav className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-slate-100/80 p-1.5 dark:bg-white/5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all sm:gap-2 sm:px-3 sm:text-xs ${
                  isActive
                    ? "bg-white text-orange-600 shadow-xs dark:bg-slate-900 dark:text-orange-400"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Icon
                  className={`size-3.5 ${
                    isActive ? "text-orange-500" : "text-slate-400"
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>}
      </div>

      {/* Dynamic Graph Views */}
      <div className="pt-6">
        {activeTab === "monthly" && <MonthlySalesVisual {...monthlyData} />}
        {!isRider && activeTab === "status" && <DonutStatusVisual {...statusData} />}
        {!isRider && activeTab === "rankings" && (
          <RankingLeaderboardVisual {...rankingsData} />
        )}
        {!isRider && activeTab === "pulse" && <ComparativeLineVisual {...pulseData} />}
        {!isRider && activeTab === "distribution" && (
          <DistributionVisual {...distributionData} />
        )}
      </div>
    </section>
  );
}

// =========================================================================
// 1. MONTHLY COMBO CHART (Bar: Gross Sales + Line: Order Count)
// =========================================================================
function MonthlySalesVisual({
  points,
  amountLabel = "Sales",
  ordersLabel = "Orders",
  isCurrency = true,
}: DashboardAnalyticsProps["monthlyData"]) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxAmount = Math.max(...points.map((point) => point.amount), 1);
  const totalAmount = points.reduce((sum, point) => sum + point.amount, 0);
  const totalOrders = points.reduce((sum, point) => sum + point.orders, 0);
  const peak = points.reduce((best, point) => point.amount > best.amount ? point : best, points[0] ?? { label: "-", amount: 0, orders: 0 });
  const formatValue = (value: number) => isCurrency ? formatCurrency(value) : value.toLocaleString();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-orange-500">Monthly performance</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{formatValue(totalAmount)}</p>
          <p className="mt-1 text-xs text-slate-500">Total {amountLabel.toLowerCase()} across {points.length} months</p>
        </div>
        <div className="flex gap-2 text-xs font-bold">
          <span className="rounded-lg bg-orange-50 px-3 py-2 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{totalOrders.toLocaleString()} {ordersLabel.toLowerCase()}</span>
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-600 dark:bg-white/10 dark:text-slate-300">Peak: {peak.label}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="relative flex h-64 items-end gap-1 border-b border-slate-200 pb-7 dark:border-white/10 sm:gap-2">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-7">
            {[100, 75, 50, 25, 0].map((ratio) => <div key={ratio} className="border-t border-dashed border-slate-200/80 dark:border-white/10" />)}
          </div>
          {points.map((point, index) => {
            const height = point.amount > 0 ? Math.max((point.amount / maxAmount) * 100, 5) : 2;
            const active = hoveredIdx === index;
            return (
              <div key={point.label} className="group relative z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-end" onMouseEnter={() => setHoveredIdx(index)} onMouseLeave={() => setHoveredIdx(null)}>
                {active && <div className="pointer-events-none absolute bottom-[calc(100%-1.25rem)] z-20 mb-2 whitespace-nowrap rounded-xl bg-slate-950 px-3 py-2 text-[11px] font-bold text-white shadow-xl"><p className="text-slate-400">{point.label}</p><p className="mt-1 text-orange-300">{formatValue(point.amount)} {amountLabel}</p><p className="text-slate-300">{point.orders.toLocaleString()} {ordersLabel}</p></div>}
                <div className={`w-full max-w-10 rounded-t-lg transition-all duration-300 ${active ? "bg-orange-600 shadow-lg shadow-orange-500/20" : "bg-orange-400 hover:bg-orange-500"}`} style={{ height: `${height}%` }} />
                <span className={`absolute -bottom-6 max-w-full truncate text-[9px] font-black uppercase ${active ? "text-orange-600 dark:text-orange-300" : "text-slate-400"}`}>{point.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-400"><span>{formatValue(maxAmount)}</span><span>Monthly {amountLabel.toLowerCase()}</span><span>{formatValue(0)}</span></div>
      </div>
    </div>
  );
}

function MonthlyComboVisual({
  points,
  amountLabel = "Gross Volume",
  ordersLabel = "Orders",
  isCurrency = true,
}: DashboardAnalyticsProps["monthlyData"]) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxAmount = Math.max(...points.map((p) => p.amount), 1);
  const maxOrders = Math.max(...points.map((p) => p.orders), 1);
  const totalAmount = points.reduce((sum, p) => sum + p.amount, 0);
  const totalOrders = points.reduce((sum, p) => sum + p.orders, 0);
  const peakMonth = points.reduce(
    (prev, cur) => (cur.amount > prev.amount ? cur : prev),
    points[0] || { label: "-", amount: 0, orders: 0 }
  );

  // SVG dimensions
  const width = 800;
  const height = 260;
  const padLeft = 60;
  const padRight = 50;
  const padTop = 35;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const colCount = Math.max(points.length, 1);

  // Compute column & line point positions
  const coords = points.map((pt, i) => {
    const colCenter = padLeft + (i + 0.5) * (plotW / colCount);
    const barW = Math.min(plotW / colCount - 10, 34);
    const barH = (pt.amount / maxAmount) * plotH;
    const barY = padTop + plotH - barH;
    const lineY = padTop + plotH - (pt.orders / maxOrders) * plotH;
    return {
      colCenter,
      barW,
      barH,
      barY,
      lineY,
      pt,
      i,
    };
  });

  // Generate smooth cubic Bézier line for order counts
  let linePathD = "";
  if (coords.length > 0) {
    linePathD = `M ${coords[0].colCenter} ${coords[0].lineY}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(i - 1, 0)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(i + 2, coords.length - 1)];

      const cp1x = p1.colCenter + (p2.colCenter - p0.colCenter) / 6;
      const cp1y = p1.lineY + (p2.lineY - p0.lineY) / 6;
      const cp2x = p2.colCenter - (p3.colCenter - p1.colCenter) / 6;
      const cp2y = p2.lineY - (p3.lineY - p1.lineY) / 6;

      linePathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(
        1
      )} ${cp2y.toFixed(1)}, ${p2.colCenter.toFixed(1)} ${p2.lineY.toFixed(1)}`;
    }
  }

  return (
    <div className="space-y-6">
      {/* Subheader info & Dual Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last 12 months · Total:{" "}
          <strong className="text-slate-900 dark:text-white">
            {isCurrency
              ? formatCurrency(totalAmount)
              : totalAmount.toLocaleString()}
          </strong>{" "}
          · Peak:{" "}
          <strong className="text-orange-600 dark:text-orange-400">
            {peakMonth.label} (
            {isCurrency ? formatCurrency(peakMonth.amount) : peakMonth.amount})
          </strong>
        </p>

        {/* Combo Chart Dual Legend */}
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span className="size-3 rounded-xs bg-orange-500 shadow-xs" />
            <span>{amountLabel} (Bar)</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span className="flex items-center">
              <span className="h-0.5 w-3 bg-emerald-500" />
              <span className="size-2 rounded-full bg-emerald-500 -ml-1 border border-white dark:border-slate-900" />
            </span>
            <span>{ordersLabel} (Line)</span>
          </span>
        </div>
      </div>

      {/* SVG Combo Chart */}
      <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-linear-to-b from-orange-500/[0.02] to-transparent p-2 dark:border-white/5">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-64 w-full overflow-visible"
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
            <linearGradient id="barHoverGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines with Dual Y-Axis Labels */}
          {[1, 0.5, 0].map((ratio) => {
            const y = padTop + plotH * (1 - ratio);
            const amtVal = maxAmount * ratio;
            const ordVal = Math.round(maxOrders * ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200/80 dark:text-white/5"
                  strokeDasharray="4 4"
                />
                {/* Left Y-Axis: Amount */}
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[9px] font-bold"
                >
                  {isCurrency
                    ? amtVal >= 1000
                      ? `Rs ${(amtVal / 1000).toFixed(0)}k`
                      : `Rs ${amtVal.toFixed(0)}`
                    : amtVal.toFixed(0)}
                </text>
                {/* Right Y-Axis: Orders */}
                <text
                  x={width - padRight + 8}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-emerald-600 text-[9px] font-black dark:fill-emerald-400"
                >
                  {ordVal} {ordersLabel.slice(0, 3)}
                </text>
              </g>
            );
          })}

          {/* 1. Columns / Bars (Amount) */}
          {coords.map((c) => {
            const isHovered = hoveredIdx === c.i;
            return (
              <g
                key={`bar-${c.i}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(c.i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <rect
                  x={c.colCenter - c.barW / 2}
                  y={c.barY}
                  width={c.barW}
                  height={Math.max(c.barH, 3)}
                  rx="6"
                  fill={
                    isHovered ? "url(#barHoverGradient)" : "url(#barGradient)"
                  }
                  className="transition-all duration-300"
                />

                {/* X-Axis Month Label */}
                <text
                  x={c.colCenter}
                  y={height - padBottom + 18}
                  textAnchor="middle"
                  className={`text-[9px] font-extrabold uppercase transition-colors ${
                    isHovered
                      ? "fill-orange-600 font-black"
                      : "fill-slate-400 dark:fill-slate-500"
                  }`}
                >
                  {c.pt.label}
                </text>
              </g>
            );
          })}

          {/* 2. Overlaid Smooth Line (Orders Count) */}
          {linePathD && (
            <path
              d={linePathD}
              fill="none"
              stroke="#10b981"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-xs"
            />
          )}

          {/* 3. Line Dots & Hover Guides */}
          {coords.map((c) => {
            const isHovered = hoveredIdx === c.i;
            return (
              <g
                key={`dot-${c.i}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(c.i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Vertical hover guide */}
                {isHovered && (
                  <line
                    x1={c.colCenter}
                    y1={padTop}
                    x2={c.colCenter}
                    y2={height - padBottom}
                    stroke="#f97316"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="opacity-70"
                  />
                )}

                {/* Circular Dot on Line */}
                <circle
                  cx={c.colCenter}
                  cy={c.lineY}
                  r={isHovered ? 6 : 4}
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth={isHovered ? 3 : 2.5}
                  className="transition-all duration-200"
                />

                {/* Large hit area */}
                <circle cx={c.colCenter} cy={c.lineY} r={18} fill="transparent" />
              </g>
            );
          })}
        </svg>

        {/* Hover Floating Tooltip Card */}
        {hoveredIdx !== null && coords[hoveredIdx] && (
          <div
            className="pointer-events-none absolute -top-1 rounded-xl border border-slate-200 bg-slate-950/95 px-3.5 py-2 text-xs text-white shadow-xl backdrop-blur-md transition-all dark:border-white/10"
            style={{
              left: `${Math.min(
                Math.max((coords[hoveredIdx].colCenter / width) * 100 - 10, 2),
                76
              )}%`,
            }}
          >
            <p className="font-bold text-slate-400">
              {coords[hoveredIdx].pt.label}
            </p>
            <p className="mt-0.5 font-black text-orange-400">
              {isCurrency
                ? formatCurrency(coords[hoveredIdx].pt.amount)
                : coords[hoveredIdx].pt.amount.toLocaleString()}{" "}
              <span className="text-[10px] text-slate-300 font-semibold">
                ({amountLabel})
              </span>
            </p>
            <p className="mt-0.5 font-black text-emerald-400">
              {coords[hoveredIdx].pt.orders.toLocaleString()}{" "}
              <span className="text-[10px] text-slate-300 font-semibold">
                {ordersLabel}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Bottom 4 Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total {amountLabel}
          </span>
          <p className="mt-1 text-base font-black text-slate-900 dark:text-white">
            {isCurrency
              ? formatCurrency(totalAmount)
              : totalAmount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total {ordersLabel}
          </span>
          <p className="mt-1 text-base font-black text-emerald-600 dark:text-emerald-400">
            {totalOrders.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Peak Month
          </span>
          <p className="mt-1 text-base font-black text-orange-600 dark:text-orange-400">
            {peakMonth.label}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Average Per Order
          </span>
          <p className="mt-1 text-base font-black text-slate-900 dark:text-white">
            {isCurrency
              ? formatCurrency(totalAmount / Math.max(totalOrders, 1))
              : Math.round(
                  totalAmount / Math.max(totalOrders, 1)
                ).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 2. STATUS BREAKDOWN: Clean Interactive Donut Ring Chart with Center Metric
// =========================================================================
function DonutStatusVisual({
  title: _title,
  centerLabel,
  centerSubtext,
  valueUnit = "orders",
  slices,
}: DashboardAnalyticsProps["statusData"]) {
  const [activeSlice, setActiveSlice] = useState<number | null>(null);

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  // SVG Ring calculation
  const size = 220;
  const center = size / 2;
  const radius = 80;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  const computedSlices = slices.reduce<Array<DonutSlice & {
    fraction: number;
    percent: number;
    strokeDasharray: string;
    strokeDashoffset: number;
    idx: number;
  }>>((result, s, idx) => {
    const fraction = total > 0 ? s.value / total : 0;
    const previousFraction = result.reduce((sum, slice) => sum + slice.fraction, 0);
    result.push({
      ...s,
      fraction,
      percent: Math.round(fraction * 100),
      strokeDasharray: `${fraction * circumference} ${circumference}`,
      strokeDashoffset: -previousFraction * circumference,
      idx,
    });
    return result;
  }, []);

  const highlighted = activeSlice !== null ? computedSlices[activeSlice] : null;

  return (
    <div className="grid items-center gap-8 md:grid-cols-[240px_1fr]">
      {/* SVG Ring with Center Metric */}
      <div className="relative mx-auto flex items-center justify-center">
        <svg
          width={size}
          height={size}
          className="-rotate-90 transform overflow-visible"
        >
          {/* Background Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-white/5"
          />

          {/* Slices */}
          {computedSlices.map((slice) => {
            const isSelected = activeSlice === slice.idx;
            return (
              <circle
                key={slice.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isSelected ? strokeWidth + 6 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                className="cursor-pointer transition-all duration-300"
                onMouseEnter={() => setActiveSlice(slice.idx)}
                onMouseLeave={() => setActiveSlice(null)}
              />
            );
          })}
        </svg>

        {/* Center Content */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {highlighted ? (
            <div className="animate-in fade-in duration-200">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {highlighted.percent}%
              </span>
              <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                {highlighted.label}
              </p>
              <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                {highlighted.value} {valueUnit}
              </p>
            </div>
          ) : (
            <div>
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {total}
              </span>
              <p className="text-xs font-bold text-slate-400">{centerLabel}</p>
              {centerSubtext && (
                <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold uppercase text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {centerSubtext}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slices Breakdown Cards */}
      <div className="space-y-2.5">
        {computedSlices.map((slice) => {
          const isSelected = activeSlice === slice.idx;
          return (
            <div
              key={slice.label}
              onMouseEnter={() => setActiveSlice(slice.idx)}
              onMouseLeave={() => setActiveSlice(null)}
              className={`group cursor-pointer rounded-xl border p-3 transition-all ${
                isSelected
                  ? "border-orange-300 bg-orange-50/40 shadow-xs dark:border-orange-500/30 dark:bg-orange-500/10"
                  : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <strong className="font-extrabold text-slate-800 dark:text-slate-200">
                    {slice.label}
                  </strong>
                  {slice.subtext && (
                    <span className="hidden text-[10px] text-slate-400 sm:inline">
                      · {slice.subtext}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 dark:text-white">
                    {slice.value} {valueUnit}
                  </span>
                  <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-black text-slate-600 shadow-xs dark:bg-white/10 dark:text-slate-300">
                    {slice.percent}%
                  </span>
                </div>
              </div>

              {/* Progress Line */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/60 dark:bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${slice.percent}%`,
                    backgroundColor: slice.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// 3. RANKINGS / LEADERBOARD: Horizontal Ranking Bars (Super Intuitive)
// =========================================================================
function RankingLeaderboardVisual({
  title: _title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  isCurrency = true,
  secondaryIsCurrency = false,
  items,
}: DashboardAnalyticsProps["rankingsData"]) {
  const maxVal = Math.max(...items.map((it) => it.primaryValue), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <p>{subtitle}</p>
        <span className="font-bold text-slate-500">
          {items.length} units evaluated
        </span>
      </div>

      {items.length === 0 ? (
        <div className="grid h-40 place-items-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 dark:border-white/10">
          No ranking records available yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => {
            const widthPct = Math.max((item.primaryValue / maxVal) * 100, 4);
            const rank = index + 1;

            return (
              <div
                key={item.label}
                className="group rounded-xl border border-slate-100 bg-slate-50/40 p-3.5 transition-all hover:border-slate-200 hover:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-6 place-items-center rounded-lg text-[10px] font-black ${
                        rank === 1
                          ? "bg-amber-400 text-slate-950 font-black"
                          : rank === 2
                          ? "bg-slate-300 text-slate-900"
                          : rank === 3
                          ? "bg-orange-200 text-orange-950"
                          : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                      }`}
                    >
                      #{rank}
                    </span>
                    <strong className="font-extrabold text-slate-800 dark:text-slate-200">
                      {item.label}
                    </strong>
                    {item.detail && (
                      <span className="text-[11px] text-slate-400">
                        ({item.detail})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <span className="text-slate-500 dark:text-slate-400">
                      <strong>
                        {secondaryIsCurrency
                          ? formatCurrency(item.secondaryValue)
                          : item.secondaryValue.toLocaleString()}
                      </strong>{" "}
                      {secondaryLabel}
                    </span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {isCurrency
                        ? formatCurrency(item.primaryValue)
                        : item.primaryValue.toLocaleString()}{" "}
                      <span className="text-[10px] font-bold text-slate-400">
                        {primaryLabel}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200/50 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-orange-400 to-orange-500 transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 4. "THIS WEEK VS LAST WEEK" COMPARATIVE LINE CHART
// =========================================================================
function ComparativeLineVisual({
  title: _title,
  points,
  isCurrency = false,
}: DashboardAnalyticsProps["pulseData"]) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const totalThisWeekOrders = points.reduce(
    (sum, p) => sum + p.thisWeekOrders,
    0
  );
  const totalLastWeekOrders = points.reduce(
    (sum, p) => sum + p.lastWeekOrders,
    0
  );
  const totalThisWeekAmount = points.reduce(
    (sum, p) => sum + p.thisWeekAmount,
    0
  );
  const totalLastWeekAmount = points.reduce(
    (sum, p) => sum + p.lastWeekAmount,
    0
  );

  const primaryThisTotal = isCurrency
    ? totalThisWeekAmount
    : totalThisWeekOrders;
  const primaryLastTotal = isCurrency
    ? totalLastWeekAmount
    : totalLastWeekOrders;

  const diffOrders = totalThisWeekOrders - totalLastWeekOrders;
  const growthRate =
    primaryLastTotal > 0
      ? ((primaryThisTotal - primaryLastTotal) / primaryLastTotal) * 100
      : 0;

  // SVG dimensions
  const width = 800;
  const height = 250;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(
    ...points.map((p) =>
      Math.max(
        isCurrency ? p.thisWeekAmount : p.thisWeekOrders,
        isCurrency ? p.lastWeekAmount : p.lastWeekOrders
      )
    ),
    1
  );

  const coords = points.map((p, i) => {
    const x =
      padLeft + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const thisVal = isCurrency ? p.thisWeekAmount : p.thisWeekOrders;
    const lastVal = isCurrency ? p.lastWeekAmount : p.lastWeekOrders;
    const yThis = padTop + plotH - (thisVal / maxVal) * plotH;
    const yLast = padTop + plotH - (lastVal / maxVal) * plotH;
    return {
      x,
      yThis,
      yLast,
      thisVal,
      lastVal,
      p,
      i,
    };
  });

  // Curve for This Week
  let pathThis = "";
  if (coords.length > 0) {
    pathThis = `M ${coords[0].x} ${coords[0].yThis}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(i - 1, 0)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(i + 2, coords.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.yThis + (p2.yThis - p0.yThis) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.yThis - (p3.yThis - p1.yThis) / 6;

      pathThis += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(
        1
      )} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.yThis.toFixed(1)}`;
    }
  }

  // Curve for Last Week (dashed)
  let pathLast = "";
  if (coords.length > 0) {
    pathLast = `M ${coords[0].x} ${coords[0].yLast}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(i - 1, 0)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(i + 2, coords.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.yLast + (p2.yLast - p0.yLast) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.yLast - (p3.yLast - p1.yLast) / 6;

      pathLast += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(
        1
      )} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.yLast.toFixed(1)}`;
    }
  }

  // Area under This Week
  const areaThis = coords.length
    ? `${pathThis} L ${coords[coords.length - 1].x} ${
        height - padBottom
      } L ${coords[0].x} ${height - padBottom} Z`
    : "";

  return (
    <div className="space-y-6">
      {/* Header Info & Dual Line Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comparing 7-day day-by-day trajectory
          </p>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ${
              growthRate >= 0
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
            }`}
          >
            {growthRate >= 0 ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {growthRate >= 0 ? `+${growthRate.toFixed(1)}%` : `${growthRate.toFixed(1)}%`} vs last week
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
            <span className="size-2.5 rounded-full bg-orange-500 ring-2 ring-orange-200 dark:ring-orange-950" />
            <span>This Week ({totalThisWeekOrders} orders)</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="size-2 rounded-full border-2 border-slate-400 bg-white dark:bg-slate-900" />
            <span>Last Week ({totalLastWeekOrders} orders)</span>
          </span>
        </div>
      </div>

      {/* SVG Comparative Chart */}
      <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-linear-to-b from-orange-500/[0.02] to-transparent p-2 dark:border-white/5">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-60 w-full overflow-visible"
        >
          <defs>
            <linearGradient id="thisWeekGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[1, 0.5, 0].map((ratio) => {
            const y = padTop + plotH * (1 - ratio);
            const val = maxVal * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200/80 dark:text-white/5"
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[9px] font-bold"
                >
                  {isCurrency
                    ? val >= 1000
                      ? `Rs ${(val / 1000).toFixed(0)}k`
                      : `Rs ${val.toFixed(0)}`
                    : val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Area under This Week */}
          {areaThis && <path d={areaThis} fill="url(#thisWeekGradient)" />}

          {/* Last Week Line (Dashed Slate) */}
          {pathLast && (
            <path
              d={pathLast}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2.4"
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* This Week Line (Solid Orange) */}
          {pathThis && (
            <path
              d={pathThis}
              fill="none"
              stroke="#f97316"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-xs"
            />
          )}

          {/* Points & Hover Guides */}
          {coords.map((c) => {
            const isHovered = hoveredIdx === c.i;
            return (
              <g
                key={c.i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(c.i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Vertical hover line */}
                {isHovered && (
                  <line
                    x1={c.x}
                    y1={padTop}
                    x2={c.x}
                    y2={height - padBottom}
                    stroke="#f97316"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="opacity-70"
                  />
                )}

                {/* Last Week Point */}
                <circle
                  cx={c.x}
                  cy={c.yLast}
                  r={isHovered ? 5 : 3.5}
                  fill="#ffffff"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  className="transition-all"
                />

                {/* This Week Point */}
                <circle
                  cx={c.x}
                  cy={c.yThis}
                  r={isHovered ? 6.5 : 4.5}
                  fill="#ffffff"
                  stroke="#ea580c"
                  strokeWidth={isHovered ? 3 : 2.5}
                  className="transition-all"
                />

                {/* Large Hit Area */}
                <circle cx={c.x} cy={(c.yThis + c.yLast) / 2} r={24} fill="transparent" />

                {/* X-Axis Day Label */}
                <text
                  x={c.x}
                  y={height - padBottom + 18}
                  textAnchor="middle"
                  className={`text-[10px] font-extrabold uppercase transition-colors ${
                    isHovered
                      ? "fill-orange-600 font-black"
                      : "fill-slate-400 dark:fill-slate-500"
                  }`}
                >
                  {c.p.dayLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredIdx !== null && coords[hoveredIdx] && (
          <div
            className="pointer-events-none absolute -top-1 rounded-xl border border-slate-200 bg-slate-950/95 px-3.5 py-2.5 text-xs text-white shadow-xl backdrop-blur-md transition-all dark:border-white/10"
            style={{
              left: `${Math.min(
                Math.max((coords[hoveredIdx].x / width) * 100 - 10, 2),
                76
              )}%`,
            }}
          >
            <p className="font-bold text-slate-400">
              {coords[hoveredIdx].p.dayLabel} ({coords[hoveredIdx].p.thisWeekDate} vs{" "}
              {coords[hoveredIdx].p.lastWeekDate})
            </p>
            <div className="mt-1 flex items-center justify-between gap-4 font-black">
              <span className="text-orange-400">
                This Week:{" "}
                {coords[hoveredIdx].p.thisWeekOrders.toLocaleString()} orders{" "}
                {coords[hoveredIdx].p.thisWeekAmount > 0 &&
                  `(${formatCurrency(coords[hoveredIdx].p.thisWeekAmount)})`}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-4 font-bold text-slate-300">
              <span>
                Last Week:{" "}
                {coords[hoveredIdx].p.lastWeekOrders.toLocaleString()} orders{" "}
                {coords[hoveredIdx].p.lastWeekAmount > 0 &&
                  `(${formatCurrency(coords[hoveredIdx].p.lastWeekAmount)})`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Comparison Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            This Week Orders
          </span>
          <p className="mt-1 text-base font-black text-orange-600 dark:text-orange-400">
            {totalThisWeekOrders.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Last Week Orders
          </span>
          <p className="mt-1 text-base font-black text-slate-600 dark:text-slate-300">
            {totalLastWeekOrders.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Orders Difference
          </span>
          <p
            className={`mt-1 text-base font-black ${
              diffOrders >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {diffOrders >= 0 ? `+${diffOrders}` : diffOrders}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Week-over-Week
          </span>
          <p
            className={`mt-1 text-base font-black ${
              growthRate >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {growthRate >= 0 ? `+${growthRate.toFixed(1)}%` : `${growthRate.toFixed(1)}%`}
          </p>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 5. DISTRIBUTION & CHANNELS: Multi-Segmented Bar & Channel Share Cards
// =========================================================================
function DistributionVisual({
  title: _title,
  subtitle,
  items,
  isCurrency = true,
}: DashboardAnalyticsProps["distributionData"]) {
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <p>{subtitle}</p>
        <span className="font-bold text-slate-500">
          {totalCount} total processed
        </span>
      </div>

      {/* Multi-Segmented Continuous Stacked Bar */}
      <div className="h-4 overflow-hidden rounded-full bg-slate-100 flex dark:bg-white/10">
        {items.map((item) => {
          const pct = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={item.label}
              style={{ width: `${pct}%`, backgroundColor: item.color }}
              className="h-full transition-all duration-500 hover:opacity-85"
              title={`${item.label}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Distribution Cards Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const pct =
            totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
          return (
            <div
              key={item.label}
              className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:border-slate-200 dark:border-white/5 dark:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <strong className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {item.label}
                  </strong>
                </div>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-black text-slate-600 shadow-xs dark:bg-white/10 dark:text-slate-300">
                  {pct}%
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {item.count.toLocaleString()}
                </span>
                {isCurrency && item.amount > 0 && (
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrency(item.amount)}
                  </span>
                )}
              </div>
              {item.detail && (
                <p className="mt-1 text-[10px] text-slate-400">{item.detail}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
