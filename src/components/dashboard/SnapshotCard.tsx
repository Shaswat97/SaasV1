"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { cn } from "@/lib/utils";

export type SnapshotItem = {
    label: string;
    value: string;
    highlight?: boolean;
    color?: "default" | "red" | "green";
};

type SnapshotCardProps = {
    title: string;
    items: SnapshotItem[];
    className?: string;
    onClick?: () => void;
    hint?: string;
    scopeLabel?: string;
};

export function SnapshotCard({ title, items, className, onClick, hint, scopeLabel }: SnapshotCardProps) {
    const content = (
        <>
            <CardHeader className="pb-2 border-none">
                <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base font-serif font-bold text-gray-800">
                        {title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {scopeLabel ? (
                            <span className="rounded-full border border-border/60 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                                {scopeLabel}
                            </span>
                        ) : null}
                        {hint ? (
                            <span className="rounded-full border border-border/60 bg-white px-2 py-0.5 text-[11px] font-medium text-text-muted">
                                {hint}
                            </span>
                        ) : null}
                    </div>
                </div>
            </CardHeader>
            <CardBody className="pt-0">
                <div className="flex flex-col gap-3">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 font-medium">{item.label}</span>
                            <span
                                className={cn(
                                    "font-mono font-semibold",
                                    item.color === "red" ? "text-red-500" :
                                        item.color === "green" ? "text-green-600" :
                                            "text-gray-900",
                                    item.highlight && "text-base"
                                )}
                            >
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>
            </CardBody>
        </>
    );

    return (
        <Card
            className={cn(
                "border-none shadow-sm bg-white rounded-2xl",
                onClick && "transition hover:shadow-md hover:-translate-y-0.5",
                className
            )}
        >
            {onClick ? (
                <button
                    type="button"
                    onClick={onClick}
                    className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
                >
                    {content}
                </button>
            ) : (
                content
            )}
        </Card>
    );
}
