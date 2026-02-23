"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function getStoredTheme(): Theme {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("theme");
    return stored === "dark" ? "dark" : "light";
}

export function DarkModeToggle() {
    const [theme, setTheme] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const initial = getStoredTheme();
        setTheme(initial);
        // document element data-theme should already be set by the initial load script
        // but we enforce it here just in case.
        document.documentElement.dataset.theme = initial;
    }, []);

    const toggleTheme = () => {
        const nextTheme = theme === "light" ? "dark" : "light";
        setTheme(nextTheme);
        document.documentElement.dataset.theme = nextTheme;
        window.localStorage.setItem("theme", nextTheme);
    };

    // Prevent hydration mismatch by not rendering the icon until mounted
    if (!mounted) {
        return <div className="h-8 w-8" />;
    }

    return (
        <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
            {theme === "light" ? (
                <Moon className="h-4 w-4" />
            ) : (
                <Sun className="h-4 w-4" />
            )}
        </button>
    );
}
