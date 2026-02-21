import { ArrowRight, Box, CheckCircle, Clock, AlertTriangle } from "lucide-react";

type TransactionItemProps = {
    title: string;
    subtitle: string;
    amount: string; // or quantity
    status: "completed" | "pending" | "warning";
    date: string;
};

export function MobileTransactionItem({ title, subtitle, amount, status, date }: TransactionItemProps) {
    return (
        <div className="flex items-center gap-4 py-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${status === "warning" ? "bg-orange-100 text-orange-600" :
                    status === "pending" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                }`}>
                {status === "warning" ? <AlertTriangle className="h-6 w-6" /> :
                    status === "pending" ? <Clock className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />}
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-text">{title}</h4>
                <p className="text-xs text-text-muted">{subtitle} • {date}</p>
            </div>
            <div className="text-right">
                <p className={`font-bold ${status === "warning" ? "text-orange-600" : "text-text"}`}>{amount}</p>
            </div>
        </div>
    );
}
