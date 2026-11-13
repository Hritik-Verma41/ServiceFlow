"use client";

import { useEffect, useState } from "react";
import type { DashboardDateRange } from "./date-range-selector";

interface RevenueTrendChartProps {
    dateRange: DashboardDateRange;
}

interface Company {
    id: string;
}

interface RevenueTrendItem {
    date: string;
    revenue: string;
}

interface RevenueTrendResponse {
    company_id: string;
    currency: string;
    results: RevenueTrendItem[];
}

interface ChartPoint {
    date: string;
    revenue: number;
}

function getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];

    const [startYear, startMonth, startDay] = startDate
        .split("-")
        .map(Number);

    const [endYear, endMonth, endDay] = endDate
        .split("-")
        .map(Number);

    const current = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    while (current <= end) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, "0");
        const day = String(current.getDate()).padStart(2, "0");

        dates.push(`${year}-${month}-${day}`);
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

function formatCurrency(value: number, currency = "INR"): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(value);
}

function formatDateLabel(date: string): string {
    const parsed = new Date(`${date}T00:00:00`);

    return parsed.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
    });
}

export function RevenueTrendChart({
    dateRange,
}: RevenueTrendChartProps) {
    const [points, setPoints] = useState<ChartPoint[]>([]);
    const [currency, setCurrency] = useState("INR");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function fetchRevenueTrend() {
            try {
                setLoading(true);
                setError("");

                if (!dateRange.startDate || !dateRange.endDate) {
                    setPoints([]);
                    setLoading(false);
                    return;
                }

                const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
                const token = sessionStorage.getItem("accessToken");

                if (!apiUrl || !token) {
                    throw new Error(
                        "API configuration or session is missing."
                    );
                }

                const headers = {
                    Authorization: `Bearer ${token}`,
                };

                const companyResponse = await fetch(
                    `${apiUrl}/api/companies/`,
                    {
                        headers,
                        signal: controller.signal,
                    }
                );

                if (!companyResponse.ok) {
                    throw new Error("Unable to load company information.");
                }

                const companies: Company[] =
                    await companyResponse.json();

                if (companies.length === 0) {
                    throw new Error("No active company found.");
                }

                const companyId = companies[0].id;

                const queryParams = new URLSearchParams({
                    start_date: dateRange.startDate,
                    end_date: dateRange.endDate,
                });

                const response = await fetch(
                    `${apiUrl}/api/companies/${companyId}/revenue/trend/?${queryParams}`,
                    {
                        headers,
                        signal: controller.signal,
                    }
                );

                if (!response.ok) {
                    throw new Error("Unable to load revenue trends.");
                }

                const data: RevenueTrendResponse =
                    await response.json();

                setCurrency(data.currency);

                const revenueByDate = new Map(
                    data.results.map((item) => [
                        item.date,
                        Number(item.revenue),
                    ])
                );

                const allDates = getDateRange(
                    dateRange.startDate,
                    dateRange.endDate
                );

                setPoints(
                    allDates.map((date) => ({
                        date,
                        revenue: revenueByDate.get(date) ?? 0,
                    }))
                );
            } catch (err) {
                if (
                    err instanceof Error &&
                    err.name === "AbortError"
                ) {
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load revenue trends."
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        fetchRevenueTrend();

        return () => controller.abort();
    }, [dateRange.startDate, dateRange.endDate]);

    const maxRevenue = Math.max(
        ...points.map((point) => point.revenue),
        0
    );

    const chartWidth = 800;
    const chartHeight = 240;
    const leftPadding = 12;
    const rightPadding = 12;
    const topPadding = 20;
    const bottomPadding = 30;

    const plotWidth = chartWidth - leftPadding - rightPadding;
    const plotHeight = chartHeight - topPadding - bottomPadding;

    const getX = (index: number) =>
        points.length <= 1
            ? chartWidth / 2
            : leftPadding +
              (index / (points.length - 1)) * plotWidth;

    const getY = (revenue: number) =>
        topPadding +
        plotHeight -
        (maxRevenue > 0 ? revenue / maxRevenue : 0) * plotHeight;

    const linePath = points
        .map(
            (point, index) =>
                `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(
                    point.revenue
                )}`
        )
        .join(" ");

    const areaPath =
        points.length > 0
            ? `${linePath} L ${getX(points.length - 1)} ${
                  topPadding + plotHeight
              } L ${getX(0)} ${topPadding + plotHeight} Z`
            : "";

    const labelStep = Math.max(
        1,
        Math.ceil(points.length / 5)
    );

    const totalRevenue = points.reduce(
        (total, point) => total + point.revenue,
        0
    );

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold">
                        Revenue Trends
                    </h3>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Daily collected revenue
                    </p>
                </div>

                <div className="text-right">
                    <p className="text-xs text-slate-400">
                        Total collected
                    </p>

                    <p className="mt-1 text-lg font-semibold tracking-tight">
                        {loading
                            ? "Loading..."
                            : formatCurrency(totalRevenue, currency)}
                    </p>
                </div>
            </div>

            {loading && (
                <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                    Loading revenue trends...
                </div>
            )}

            {!loading && error && (
                <div className="flex h-64 items-center justify-center text-sm text-red-500">
                    {error}
                </div>
            )}

            {!loading && !error && points.length === 0 && (
                <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                    Select a valid date range to view revenue trends.
                </div>
            )}

            {!loading && !error && points.length > 0 && maxRevenue === 0 && (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                    <span className="text-3xl text-slate-300">₹</span>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        No collected revenue during this period
                    </p>
                    <p className="text-xs text-slate-400">
                        Revenue will appear here when payments are received.
                    </p>
                </div>
            )}

            {!loading && !error && maxRevenue > 0 && (
                <div className="w-full">
                    <svg
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        className="h-auto w-full overflow-visible"
                        role="img"
                        aria-label="Daily collected revenue chart"
                    >
                        {[0, 1, 2, 3].map((step) => {
                            const y =
                                topPadding +
                                (plotHeight / 3) * step;

                            return (
                                <line
                                    key={step}
                                    x1={leftPadding}
                                    y1={y}
                                    x2={chartWidth - rightPadding}
                                    y2={y}
                                    stroke="currentColor"
                                    strokeOpacity="0.10"
                                    strokeDasharray="4 5"
                                />
                            );
                        })}

                        <path
                            d={areaPath}
                            fill="#2563eb"
                            fillOpacity="0.10"
                        />

                        <path
                            d={linePath}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {points.map((point, index) => (
                            <circle
                                key={point.date}
                                cx={getX(index)}
                                cy={getY(point.revenue)}
                                r={points.length <= 31 ? 4 : 2.5}
                                fill="#2563eb"
                                stroke="white"
                                strokeWidth="2"
                            >
                                <title>
                                    {formatDateLabel(point.date)}:{" "}
                                    {formatCurrency(point.revenue, currency)}
                                </title>
                            </circle>
                        ))}

                        {points
                            .filter(
                                (_, index) =>
                                    index % labelStep === 0 ||
                                    index === points.length - 1
                            )
                            .map((point) => {
                                const index = points.findIndex(
                                    (item) => item.date === point.date
                                );

                                return (
                                    <text
                                        key={point.date}
                                        x={getX(index)}
                                        y={chartHeight - 5}
                                        textAnchor="middle"
                                        fill="currentColor"
                                        fillOpacity="0.55"
                                        fontSize="12"
                                    >
                                        {formatDateLabel(point.date)}
                                    </text>
                                );
                            })}
                    </svg>

                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        Collected revenue per day
                    </div>
                </div>
            )}
        </section>
    );
}
