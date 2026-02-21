"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";

export type DateRange = { from: Date; to: Date };

type Preset = {
    label: string;
    key: string;
    getRange: () => DateRange;
};

function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

const presets: Preset[] = [
    {
        label: "Today",
        key: "today",
        getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
    },
    {
        label: "Last 7 days",
        key: "7d",
        getRange: () => {
            const now = new Date();
            const from = new Date(now);
            from.setDate(from.getDate() - 6);
            return { from: startOfDay(from), to: endOfDay(now) };
        },
    },
    {
        label: "Current month",
        key: "current_month",
        getRange: () => {
            const now = new Date();
            return {
                from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
                to: endOfDay(now),
            };
        },
    },
    {
        label: "Past month",
        key: "past_month",
        getRange: () => {
            const now = new Date();
            const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const to = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
            return { from: startOfDay(from), to: endOfDay(to) };
        },
    },
    {
        label: "All time",
        key: "all",
        getRange: () => ({
            from: new Date(2000, 0, 1),
            to: endOfDay(new Date()),
        }),
    },
];

function formatShort(d: Date) {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface DateFilterProps {
    value: DateRange;
    onChange: (range: DateRange, presetKey: string) => void;
    defaultPreset?: string;
    className?: string;
}

function toInputDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DateFilter({ value, onChange, defaultPreset = "all", className }: DateFilterProps) {
    const [open, setOpen] = useState(false);
    const [activeKey, setActiveKey] = useState(defaultPreset);
    const [showCustom, setShowCustom] = useState(false);
    const [customFrom, setCustomFrom] = useState(() => toInputDate(value.from));
    const [customTo, setCustomTo] = useState(() => toInputDate(value.to));
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function select(preset: Preset) {
        setActiveKey(preset.key);
        setShowCustom(false);
        onChange(preset.getRange(), preset.key);
        setOpen(false);
    }

    function applyCustom() {
        if (!customFrom || !customTo) return;
        const from = startOfDay(new Date(customFrom));
        const to = endOfDay(new Date(customTo));
        if (from > to) return;
        setActiveKey("custom");
        onChange({ from, to }, "custom");
        setOpen(false);
    }

    const label = `${formatShort(value.from)} – ${formatShort(value.to)}`;

    return (
        <div ref={ref} className={`relative inline-block ${className ?? ""}`}>
            <button
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{label}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-gray-200 bg-white shadow-lg py-1.5 animate-in fade-in slide-in-from-top-1">
                    {presets.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => select(p)}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${activeKey === p.key && !showCustom
                                ? "bg-accent/10 text-accent font-semibold"
                                : "text-gray-700 hover:bg-gray-50"
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}

                    {/* Custom option */}
                    <button
                        onClick={() => setShowCustom(!showCustom)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${activeKey === "custom" || showCustom
                            ? "bg-accent/10 text-accent font-semibold"
                            : "text-gray-700 hover:bg-gray-50"
                            }`}
                    >
                        Custom range
                    </button>

                    {showCustom && (
                        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                                <input
                                    type="date"
                                    value={customFrom}
                                    onChange={(e) => setCustomFrom(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                                <input
                                    type="date"
                                    value={customTo}
                                    onChange={(e) => setCustomTo(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                                />
                            </div>
                            <button
                                onClick={applyCustom}
                                className="w-full rounded-lg bg-accent text-white text-sm font-medium py-1.5 hover:bg-accent/90 transition-colors mt-1"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** Helper to get the default range for a preset key */
export function getPresetRange(key: string): DateRange {
    const preset = presets.find((p) => p.key === key);
    return preset ? preset.getRange() : presets[presets.length - 1].getRange();
}
