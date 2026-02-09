"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useState } from "react";

export type TabItem = {
  label: string;
  value: string;
  content: ReactNode;
};

export type TabsProps = {
  items: TabItem[];
  defaultValue?: string;
};

export function Tabs({ items, defaultValue }: TabsProps) {
  const [active, setActive] = useState(defaultValue ?? items[0]?.value ?? "");
  const activeTab = items.find((item) => item.value === active) ?? items[0];

  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {items.map((item) => {
          const isActive = item.value === active;
          return (
            <button
              key={item.value}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "focus-ring rounded-full px-4 py-2 text-sm transition",
                isActive
                  ? "bg-accent/20 text-text border border-accent/50"
                  : "text-text-muted hover:text-text"
              )}
              onClick={() => setActive(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="mt-6">
        {activeTab?.content}
      </div>
    </div>
  );
}
