"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { AlertTriangle, Clock, Package, CreditCard, Wallet } from "lucide-react";
import { Badge } from "@/components/Badge";

type RecentAlertsProps = {
    alerts: {
        delayedDeliveries: any[];
        lowStock: any[];
        overdueReceivables?: any[];
        overduePayables?: any[];
    };
    className?: string;
};

export function RecentAlerts({ alerts, className }: RecentAlertsProps) {
    const delayedCount = alerts.delayedDeliveries.length;
    const lowStockCount = alerts.lowStock.length;
    const overdueReceivablesCount = alerts.overdueReceivables?.length ?? 0;
    const overduePayablesCount = alerts.overduePayables?.length ?? 0;
    const totalCount = delayedCount + lowStockCount + overdueReceivablesCount + overduePayablesCount;

    return (
        <Card className={`border-none shadow-sm bg-white rounded-2xl ${className}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Attention Needed
                    </CardTitle>
                    {totalCount > 0 && (
                        <Badge variant="danger" className="rounded-full px-2" label={totalCount.toString()} />
                    )}
                </div>
            </CardHeader>
            <CardBody className="pt-2">
                <div className="flex flex-col gap-3">
                    {totalCount === 0 && (
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

                    {overdueReceivablesCount > 0 && (
                        <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
                            <CreditCard className="w-5 h-5 text-orange-600 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-orange-900">{overdueReceivablesCount} Overdue Collections</p>
                                <p className="text-xs text-orange-700 mt-1">
                                    Customer payments past due date need follow-up.
                                </p>
                            </div>
                        </div>
                    )}

                    {overduePayablesCount > 0 && (
                        <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100">
                            <Wallet className="w-5 h-5 text-rose-600 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-rose-900">{overduePayablesCount} Overdue Payables</p>
                                <p className="text-xs text-rose-700 mt-1">
                                    Vendor bills are past due and need payment planning.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
