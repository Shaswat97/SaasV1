"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { AlertTriangle, Clock, Package } from "lucide-react";
import { Badge } from "@/components/Badge";

type RecentAlertsProps = {
    alerts: {
        delayedDeliveries: any[];
        lowStock: any[];
    };
    className?: string;
};

export function RecentAlerts({ alerts, className }: RecentAlertsProps) {
    const delayedCount = alerts.delayedDeliveries.length;
    const lowStockCount = alerts.lowStock.length;

    return (
        <Card className={`border-none shadow-sm bg-white rounded-2xl ${className}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Attention Needed
                    </CardTitle>
                    {(delayedCount + lowStockCount) > 0 && (
                        <Badge variant="danger" className="rounded-full px-2" label={(delayedCount + lowStockCount).toString()} />
                    )}
                </div>
            </CardHeader>
            <CardBody className="pt-2">
                <div className="flex flex-col gap-3">
                    {delayedCount === 0 && lowStockCount === 0 && (
                        <div className="text-sm text-gray-500 py-4 text-center">
                            All operations running smoothly.
                        </div>
                    )}

                    {delayedCount > 0 && (
                        <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                            <Clock className="w-5 h-5 text-red-500 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-900">{delayedCount} Delayed Orders</p>
                                <p className="text-xs text-red-700 mt-1">
                                    Shipments overdue by 2+ days.
                                </p>
                            </div>
                        </div>
                    )}

                    {lowStockCount > 0 && (
                        <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <Package className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-900">{lowStockCount} Low Stock Items</p>
                                <p className="text-xs text-amber-700 mt-1">
                                    Inventory below reorder point.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
