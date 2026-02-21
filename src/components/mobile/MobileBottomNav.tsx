"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Box, Plus, Factory, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
    const pathname = usePathname();

    const navItems = [
        { label: "Home", href: "/dashboard", icon: Home },
        { label: "Inventory", href: "/inventory", icon: Box },
        { label: "Add", href: "#", icon: Plus, isFab: true }, // Placeholder for quick action
        { label: "Production", href: "/production", icon: Factory },
        { label: "Settings", href: "/settings", icon: Settings },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 block border-t border-border bg-surface pb-safe md:hidden">
            <div className="flex items-center justify-around px-2 py-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    if (item.isFab) {
                        return (
                            <button
                                key={item.label}
                                className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition active:scale-95 -mt-8 border-4 border-surface"
                            >
                                <Icon className="h-7 w-7" />
                            </button>
                        )
                    }

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center gap-1.5 p-2 transition active:scale-95",
                                isActive ? "text-primary" : "text-text-muted hover:text-text"
                            )}
                        >
                            <Icon className={cn("h-6 w-6", isActive && "fill-current")} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
