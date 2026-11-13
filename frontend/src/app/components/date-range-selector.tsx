"use client";

import { useEffect, useRef, useState } from "react";

export type DateRangePreset =
    | "TODAY"
    | "LAST_7_DAYS"
    | "LAST_30_DAYS"
    | "THIS_MONTH"
    | "CUSTOM";

export interface DashboardDateRange {
    preset: DateRangePreset;
    startDate: string;
    endDate: string;
}

interface DateRangeSelectorProps {
    value: DashboardDateRange;
    onChange: (range: DashboardDateRange) => void;
}

const presets: {
    value: DateRangePreset;
    label: string;
}[] = [
    { value: "TODAY", label: "Today" },
    { value: "LAST_7_DAYS", label: "Last 7 days" },
    { value: "LAST_30_DAYS", label: "Last 30 days" },
    { value: "THIS_MONTH", label: "This month" },
    { value: "CUSTOM", label: "Custom range" },
];

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getPresetRange(
    preset: DateRangePreset
): DashboardDateRange {
    const today = new Date();
    const endDate = formatDate(today);

    const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    switch (preset) {
        case "TODAY":
            break;

        case "LAST_7_DAYS":
            start.setDate(start.getDate() - 6);
            break;

        case "LAST_30_DAYS":
            start.setDate(start.getDate() - 29);
            break;

        case "THIS_MONTH":
            start.setDate(1);
            break;

        case "CUSTOM":
            return {
                preset,
                startDate: "",
                endDate: "",
            };
    }

    return {
        preset,
        startDate: formatDate(start),
        endDate,
    };
}

function formatDisplayDate(date: string): string {
    if (!date) return "";

    const parsedDate = new Date(`${date}T00:00:00`);

    return parsedDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export function DateRangeSelector({
    value,
    onChange,
}: DateRangeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    const selectedPreset = presets.find(
        (preset) => preset.value === value.preset
    );

    const isCustom = value.preset === "CUSTOM";

    const invalidRange =
        isCustom &&
        value.startDate !== "" &&
        value.endDate !== "" &&
        value.startDate > value.endDate;

    const customRangeComplete =
        isCustom &&
        value.startDate !== "" &&
        value.endDate !== "" &&
        !invalidRange;

    const displayLabel = isCustom
        ? customRangeComplete
            ? `${formatDisplayDate(value.startDate)} – ${formatDisplayDate(value.endDate)}`
            : "Select custom dates"
        : selectedPreset?.label || "Last 30 days";

    function handlePresetChange(preset: DateRangePreset) {
        onChange(getPresetRange(preset));

        if (preset !== "CUSTOM") {
            setIsOpen(false);
        }
    }

    function handleStartDateChange(startDate: string) {
        onChange({
            ...value,
            startDate,
        });
    }

    function handleEndDateChange(endDate: string) {
        onChange({
            ...value,
            endDate,
        });
    }

    return (
        <div
            ref={containerRef}
            className="relative w-fit max-w-full"
        >
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen((previous) => !previous)}
                aria-expanded={isOpen}
                aria-haspopup="true"
                className={`flex max-w-full items-center gap-3 rounded-xl border bg-white px-4 py-2.5 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:bg-slate-900 ${
                    isOpen
                        ? "border-blue-500 ring-4 ring-blue-500/10 dark:border-blue-400"
                        : "border-slate-200 dark:border-slate-700"
                }`}
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="4" width="18" height="17" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                        <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
                    </svg>
                </span>

                <span className="min-w-0">
                    <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        Date range
                    </span>
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {displayLabel}
                    </span>
                </span>

                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`ml-1 shrink-0 text-slate-400 transition-transform ${
                        isOpen ? "rotate-180" : ""
                    }`}
                >
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute left-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-40px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Select date range
                        </p>
                    </div>

                    <div className="p-2">
                        {presets.map((preset) => {
                            const isSelected =
                                value.preset === preset.value;

                            return (
                                <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() =>
                                        handlePresetChange(preset.value)
                                    }
                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm transition-colors ${
                                        isSelected
                                            ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                                            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>{preset.label}</span>

                                    {isSelected && (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="17"
                                            height="17"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="m5 12 4 4L19 6" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom Date Range */}
                    {isCustom && (
                        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
                            <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Custom date range
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Start date
                                    </label>
                                    <input
                                        type="date"
                                        value={value.startDate}
                                        max={value.endDate || undefined}
                                        onChange={(event) =>
                                            handleStartDateChange(
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-blue-950"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                        End date
                                    </label>
                                    <input
                                        type="date"
                                        value={value.endDate}
                                        min={value.startDate || undefined}
                                        onChange={(event) =>
                                            handleEndDateChange(
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-blue-950"
                                    />
                                </div>
                            </div>

                            {invalidRange && (
                                <p className="mt-2 text-xs text-red-500">
                                    End date must be on or after the start date.
                                </p>
                            )}

                            <button
                                type="button"
                                disabled={!customRangeComplete}
                                onClick={() => setIsOpen(false)}
                                className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Apply date range
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
