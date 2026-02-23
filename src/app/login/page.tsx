import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BarChart3, Boxes, Factory, IndianRupee, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import { AUTH_COOKIE, resolveAuthContextByCookieValue } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const prisma = await getTenantPrisma();
  if (!prisma) {
    return <div className="p-8 text-danger">Tenant not found.</div>;
  }

  const token = cookies().get(AUTH_COOKIE)?.value ?? null;
  const auth = await resolveAuthContextByCookieValue(token, prisma);
  if (auth) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-7xl grid-cols-1 gap-4 rounded-[28px] border border-border/70 bg-surface p-4 shadow-soft lg:grid-cols-[0.9fr_1.1fr] lg:gap-5 lg:p-5">
        <section className="flex min-h-[560px] flex-col rounded-[22px] border border-border/60 bg-surface px-6 py-7 sm:px-8 sm:py-9">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-xl font-bold text-accent">
              T
            </span>
            <div>
              <p className="text-lg font-semibold text-text">TechnoSync</p>
              <p className="text-xs text-text-muted">by Techno Synergians</p>
            </div>
          </div>

          <div className="flex flex-1 items-center">
            <div className="w-full max-w-md">
              <h1 className="text-4xl font-semibold tracking-tight text-text">Welcome Back</h1>
              <p className="mt-3 text-base text-text-muted">
                Sign in with your employee code and PIN to continue.
              </p>
              <div className="mt-10">
                <LoginForm />
                <p className="mt-4 text-xs text-text-muted">Use credentials assigned by your admin.</p>
              </div>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between pt-10 text-xs text-text-muted">
            <p>Copyright {new Date().getFullYear()} Techno Synergians.</p>
            <p>Secure access portal</p>
          </div>
        </section>

        <section className="relative flex min-h-[320px] flex-col overflow-hidden rounded-[22px] border border-indigo-200/30 bg-[linear-gradient(165deg,hsl(233_78%_55%),hsl(244_70%_52%))] px-7 py-8 text-white sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
          <div className="pointer-events-none absolute right-[-120px] top-[-80px] h-64 w-64 rounded-full bg-white/10 blur-2xl" />

          <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/70">Business Intelligence</p>
          <h2 className="mt-5 max-w-lg text-4xl font-semibold leading-tight text-white">
            Make every operational move with confidence.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85">
            TechnoSync is a proactive solution, enabling you to take better business decisions with real-time
            visibility across sales, production, inventory, and finance.
          </p>

          <div className="mt-7 rounded-3xl border border-white/20 bg-white/8 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Built For Indian Operations</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white">
                <IndianRupee className="h-3.5 w-3.5" />
                INR-first finance
              </span>
            </div>

            <div className="relative h-56 overflow-hidden rounded-2xl border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:34px_34px] opacity-40" />

              <div className="absolute left-4 top-4 w-44 rounded-xl border border-slate-200/80 bg-white p-3 text-slate-900 shadow-xl">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Inventory Value</p>
                <p className="mt-1 flex items-center gap-1 text-lg font-bold">
                  <IndianRupee className="h-4 w-4" />
                  24.8L
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Raw + Finished stock valuation</p>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div className="h-2 w-3/4 rounded-full bg-cyan-500" />
                </div>
              </div>

              <div className="absolute right-3 top-10 w-52 rounded-xl border border-slate-200/80 bg-white p-3 text-slate-900 shadow-xl">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Collections Snapshot</p>
                <div className="mt-2 space-y-2 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Receivables</span>
                    <span className="flex items-center font-semibold"><IndianRupee className="mr-0.5 h-3.5 w-3.5" />9.2L</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Payables</span>
                    <span className="flex items-center font-semibold"><IndianRupee className="mr-0.5 h-3.5 w-3.5" />6.1L</span>
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div className="h-2 w-2/3 rounded-full bg-emerald-500" />
                </div>
              </div>

              <div className="absolute bottom-3 left-10 w-56 rounded-xl border border-slate-200/80 bg-white p-3 text-slate-900 shadow-xl">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Production Pulse</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <p className="text-slate-500">Yield</p>
                    <p className="font-semibold text-slate-900">94.6%</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-2">
                    <p className="text-slate-500">OEE</p>
                    <p className="font-semibold text-slate-900">81.3%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white">
                <Boxes className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Intelligent Inventory Planning</p>
                <p className="mt-1 text-sm text-white/85">Use stock balance, low-stock thresholds, and zone-level visibility to plan replenishment early.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Proactive Sales Practices</p>
                <p className="mt-1 text-sm text-white/85">Improve order confidence using availability checks, procurement plans, and dispatch readiness.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white">
                <Factory className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Real-Time Production Control</p>
                <p className="mt-1 text-sm text-white/85">Track production logs, crew utilization, OEE, and variance before delays impact commitments.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Cashflow Visibility</p>
                <p className="mt-1 text-sm text-white/85">Monitor receivables, payables, and payment status in INR to improve working-capital decisions.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Decision-Ready Analytics</p>
                <p className="mt-1 text-sm text-white/85">Convert live sales, purchase, inventory, and production data into trends you can act on quickly.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Governed Operations</p>
                <p className="mt-1 text-sm text-white/85">Strengthen control with role permissions and activity logs across all operational decisions.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
