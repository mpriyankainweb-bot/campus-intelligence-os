import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
