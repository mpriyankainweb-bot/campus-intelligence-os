import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { GraduationCap, LogOut, Menu, type LucideIcon } from "lucide-react";
import { NotificationBell, type NotificationItem } from "./NotificationBell";

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

function initials(name?: string | null) {
  return (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DashboardShell({
  title,
  nav,
  notifications,
  children,
}: {
  title: string;
  nav: NavItem[];
  notifications: NotificationItem[];
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [active, setActive] = useState(nav[0]?.id ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);

  const navigate = (id: string) => {
    setActive(id);
    setSheetOpen(false);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const NavList = ({ onNavigate }: { onNavigate: (id: string) => void }) => (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {nav.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className={cn("size-4.5", isActive ? "text-emerald-300" : "text-slate-500 group-hover:text-slate-300")} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  const UserFooter = () => (
    <div className="border-t border-white/10 p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5">
            <Avatar className="size-9 border border-white/10 bg-emerald-500/20">
              <AvatarFallback className="text-xs font-semibold text-emerald-200">
                {initials(user?.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.fullName || "Guest"}
              </p>
              <p className="truncate text-[11px] capitalize text-slate-400">
                {user?.persona ?? "user"} · {user?.email ?? ""}
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>{user?.fullName || "Account"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLocation("/")}>
            <GraduationCap className="mr-2 size-4" /> Back to home
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={logout}
            className="cursor-pointer text-rose-600 focus:text-rose-600"
          >
            <LogOut className="mr-2 size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-slate-950 lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
            <GraduationCap className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-white">Campus Intelligence OS</p>
            <p className="text-[10px] text-slate-500">Institutional assistant</p>
          </div>
        </div>
        <NavList onNavigate={navigate} />
        <UserFooter />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-64 bg-slate-950 p-0 text-white">
          <SheetHeader className="h-16 justify-center border-b border-white/10 px-5">
            <SheetTitle className="flex items-center gap-2.5 text-left">
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
                <GraduationCap className="size-5" />
              </span>
              <span className="text-sm font-semibold text-white">Campus Intelligence OS</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100%-4rem)] flex-col">
            <NavList onNavigate={navigate} />
            <UserFooter />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-slate-600 hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell notifications={notifications} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 rounded-full">
                  <Avatar className="size-8 border border-slate-200 bg-slate-900 text-white">
                    <AvatarFallback className="text-[11px] font-semibold">
                      {initials(user?.fullName)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{user?.fullName || "Guest"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/")}>
                  <GraduationCap className="mr-2 size-4" /> Back to home
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-rose-600 focus:text-rose-600"
                >
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
