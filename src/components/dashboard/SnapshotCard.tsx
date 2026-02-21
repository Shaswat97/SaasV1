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
};

export function SnapshotCard({ title, items, className }: SnapshotCardProps) {
    return (
        <Card className={cn("border-none shadow-sm bg-white rounded-2xl", className)}>
            <CardHeader className="pb-2 border-none">
                <CardTitle className="text-base font-serif font-bold text-gray-800">
                    {title}
                </CardTitle>
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
        </Card>
    );
}
