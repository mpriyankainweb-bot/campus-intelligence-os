import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENTS = {
  emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
  blue: "bg-blue-500/10 text-blue-600 ring-blue-500/20",
  amber: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
  violet: "bg-violet-500/10 text-violet-600 ring-violet-500/20",
  rose: "bg-rose-500/10 text-rose-600 ring-rose-500/20",
  slate: "bg-slate-500/10 text-slate-600 ring-slate-500/20",
} as const;

export type StatAccent = keyof typeof ACCENTS;

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaGood = true,
  accent = "blue",
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  deltaGood?: boolean;
  accent?: StatAccent;
  hint?: string;
}) {
  const deltaPositive = delta?.startsWith("+");
  const deltaNegative = delta?.startsWith("-");
  const deltaNeutral = !deltaPositive && !deltaNegative;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className={cn("flex size-10 items-center justify-center rounded-xl ring-1", ACCENTS[accent])}>
          <Icon className="size-5" />
        </div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              deltaNeutral
                ? "bg-slate-100 text-slate-600"
                : deltaNegative || !deltaGood
                  ? "bg-rose-50 text-rose-600"
                  : "bg-emerald-50 text-emerald-600"
            )}
          >
            {deltaNegative ? (
              <ArrowDownRight className="size-3" />
            ) : deltaPositive ? (
              <ArrowUpRight className="size-3" />
            ) : null}
            {delta}
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
    </motion.div>
  );
}
