"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

export function LogoutButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      className="text-white hover:bg-white/10 hover:text-white"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.localStorage.removeItem("activeUserName");
        window.localStorage.removeItem("activeUserId");
        router.replace("/login");
        router.refresh();
      }}
    >
      Log Out
    </Button>
  );
}
