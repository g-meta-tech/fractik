"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSidebar } from "@/hooks/use-sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Monitor,
  Eye,
  Layers,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

const projectSubItems = [
  { label: "Overview", suffix: "", icon: Eye },
  { label: "Capabilities", suffix: "?tab=capabilities", icon: Layers },
  { label: "Settings", suffix: "?tab=settings", icon: Settings },
] as const;

export function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const { setTheme } = useTheme();
  const pathname = usePathname();
  const projects = useQuery(api.projects.listByOrg);

  return (
    <aside
      className={`flex h-screen flex-col border-r bg-background transition-all duration-200 ${
        collapsed ? "w-[60px]" : "w-[240px]"
      }`}
    >
      {/* Top: Org switcher */}
      <div className="flex items-center justify-between border-b p-3">
        {!collapsed && (
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger: "w-full justify-start",
              },
            }}
          />
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={<button type="button" />}
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
              onClick={toggle}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expandir" : "Colapsar"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Middle: Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
            pathname === "/dashboard"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>

        {!collapsed && (
          <div className="mt-4 px-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Proyectos
            </p>
            {projects === undefined ? (
              <div className="mt-2 space-y-1">
                <div className="h-7 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-7 w-3/4 animate-pulse rounded-md bg-muted" />
              </div>
            ) : projects.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Sin proyectos aún
              </p>
            ) : (
              <div className="mt-1 space-y-0.5">
                {projects.map((p) => {
                  const href = `/projects/${p.slug}`;
                  const isActive = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <div key={p._id}>
                      <Link
                        href={href}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                          isActive
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </Link>
                      {/* Sub-items for active project */}
                      {isActive && (
                        <div className="ml-5 mt-0.5 space-y-0.5 border-l pl-2">
                          {projectSubItems.map((sub) => {
                            const subHref = `${href}${sub.suffix}`;
                            return (
                              <Link
                                key={sub.label}
                                href={subHref}
                                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                              >
                                <sub.icon className="h-3 w-3 shrink-0" />
                                <span>{sub.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom: Theme toggle + User */}
      <div className="border-t p-3 space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Cambiar tema</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />
              Claro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />
              Oscuro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" />
              Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className={collapsed ? "flex justify-center" : ""}>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
        </div>
      </div>
    </aside>
  );
}
