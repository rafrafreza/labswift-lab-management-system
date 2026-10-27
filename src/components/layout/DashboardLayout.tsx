import { Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ChevronRight,
  FileText,
  FlaskConical,
  FolderOpen,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Stethoscope,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  X,
  Plus,
  Bell,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { preloadCommonRoutes, preloadRoute } from "@/lib/preload";
import { cn } from "@/lib/utils";

// Shown inside the layout while a page's code loads, so the sidebar and header never disappear
function ContentLoader() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="h-4 w-72 animate-pulse rounded bg-slate-200/50" />
      <div className="grid grid-cols-2 gap-4 pt-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/50" />)}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-slate-200/40" />
    </div>
  );
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Patients",  href: "/patients",  icon: Users, exact: false },
  { label: "Reports",   href: "/reports",   icon: FileText, exact: false },
];

const ADMIN_NAV_ITEMS = [
  { label: "Templates",    href: "/admin/templates",  icon: FolderOpen, exact: false },
  { label: "Doctors",      href: "/admin/doctors",    icon: Stethoscope, exact: false },
  { label: "Financials",   href: "/admin/financials", icon: Wallet, exact: false },
  { label: "Incentives",   href: "/admin/incentives", icon: IndianRupee, exact: false },
  { label: "Staff",        href: "/admin/users",      icon: UserCog, exact: false },
  { label: "Analytics",    href: "/admin/analytics",  icon: TrendingUp, exact: false },
  { label: "Settings",     href: "/admin/settings",   icon: Settings, exact: false },
];

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    preloadCommonRoutes();
  }, []);

  function isActive(href: string, exact = false) {
    if (exact) return location.pathname === href;
    return location.pathname.startsWith(href);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  // Current page label for header breadcrumb
  const allItems = [...NAV_ITEMS, ...ADMIN_NAV_ITEMS];
  const activeItem = allItems.find((item) => isActive(item.href, item.exact ?? false));

  const NavLink = ({ item }: { item: typeof NAV_ITEMS[number] }) => {
    const active = isActive(item.href, (item as any).exact ?? false);
    return (
      <Link
        to={item.href}
        onClick={() => setSidebarOpen(false)}
        onMouseEnter={() => preloadRoute(item.href)}
        onFocus={() => preloadRoute(item.href)}
        onTouchStart={() => preloadRoute(item.href)}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
          active
            ? "bg-white/10 text-white shadow-sm"
            : "text-slate-400 hover:bg-white/6 hover:text-slate-200",
        )}
      >
        <div className={cn(
          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
          active ? "bg-emerald-500/20 text-emerald-400" : "text-slate-500 group-hover:text-slate-400",
        )}>
          <item.icon className="h-4 w-4" />
        </div>
        {item.label}
        {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />}
      </Link>
    );
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex h-full flex-col", mobile && "w-full")}
      style={{ background: "linear-gradient(160deg, #0a1628 0%, #0d1f38 60%, #0a1a30 100%)" }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.07]">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-900/40">
          <FlaskConical className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[15px] font-bold leading-none text-white tracking-tight">Labswift</div>
          <div className="mt-0.5 text-[10px] leading-none text-slate-500 tracking-wide">LIMS Platform</div>
        </div>
        {mobile && (
          <button onClick={() => setSidebarOpen(false)} className="ml-auto p-1 text-slate-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <div>
          <div className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">
            Workspace
          </div>
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => <NavLink key={item.href} item={item} />)}
          </div>
        </div>

        {isAdmin && (
          <div>
            <div className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">
              Administration
            </div>
            <div className="space-y-0.5">
              {ADMIN_NAV_ITEMS.map((item) => <NavLink key={item.href} item={item} />)}
            </div>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/[0.07] px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5 transition-colors cursor-default">
          <div className="relative flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/30 to-emerald-600/30 border border-emerald-500/30">
              <span className="text-[13px] font-bold text-emerald-400">
                {profile?.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#0a1628]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-none text-slate-200">
              {profile?.name}
            </div>
            <div className="mt-1 text-[10px] leading-none text-slate-500">
              {profile?.role === "ADMIN" ? "Administrator" : "Lab Staff"}
            </div>
          </div>
          <button onClick={handleSignOut} title="Sign out"
            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6f9]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-shrink-0" style={{ width: "var(--sidebar-w, 256px)" }}>
        <div className="w-full">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 w-64 flex-shrink-0 animate-slide-in">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top header */}
        <header className="flex h-[60px] flex-shrink-0 items-center gap-4 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-4 lg:px-6 shadow-xs">
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors lg:hidden">
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-slate-400 text-[13px]">LabSwift</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="font-semibold text-slate-700 text-[13px]">
              {activeItem?.label ?? "Dashboard"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Quick new report button */}
            <Link to="/reports/new"
              className="btn btn-primary btn-sm hidden sm:inline-flex gap-1.5 shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              New Report
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 lg:p-6 animate-page-in">
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense fallback={<ContentLoader />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
