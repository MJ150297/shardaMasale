"use client";

import { ReactNode, useState, createContext, useContext, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useActiveShop } from '@/components/providers/shop-provider';
import { signOut } from 'next-auth/react';
import ThemeToggle from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/layout/notification-bell';
import { useIsMobile } from '@/hooks/use-mobile';
import CreateShopDialog from '@/components/create-shop-dialog';

import {
  LayoutDashboard,
  LayoutDashboard as LayoutDashboardOutline,
  Package,
  Package as PackageOutline,
  Users,
  Users as UsersOutline,
  Receipt,
  Receipt as ReceiptOutline,
  FileText,
  FileText as FileTextOutline,
  BarChart3,
  Settings,
  Code,
  LogOut,
  ChevronDown,
  Home,
  Bell,
  Store,
  Check,
  MoreHorizontal
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

import type { UserRole } from '@/models/User';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  roles: UserRole[];
  comingSoon?: boolean;
}

const navItems: NavItem[] = [
  // Super Owner Navigation
  {
    title: 'Super Dashboard',
    url: '/super',
    icon: LayoutDashboard,
    roles: ['superOwner'],
  },
  {
    title: 'Shops',
    url: '/super/shops',
    icon: Store,
    roles: ['superOwner'],
  },
  {
    title: 'Owners',
    url: '/super/owners',
    icon: Users,
    roles: ['superOwner'],
  },
  {
    title: 'System Settings',
    url: '/super/settings',
    icon: Settings,
    roles: ['superOwner'],
  },

  // Business User Navigation
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    roles: ['owner', 'admin', 'manager', 'staff'],
  },
  {
    title: 'Parties',
    url: '/dashboard/parties',
    icon: Users,
    roles: ['owner', 'admin', 'manager', 'cashier'],
  },
  {
    title: 'Transactions',
    url: '/dashboard/transactions',
    icon: Receipt,
    roles: ['owner', 'admin', 'manager', 'cashier', 'staff'],
  },
  {
    title: 'Items',
    url: '/dashboard/items',
    icon: Package,
    roles: ['owner', 'admin', 'manager', 'cashier', 'staff'],
  },
  {
    title: 'Invoices',
    url: '/dashboard/invoices',
    icon: FileText,
    roles: ['owner', 'admin', 'manager', 'cashier', 'staff'],
  },
  {
    title: 'Reports',
    url: '/reports',
    icon: BarChart3,
    roles: ['owner', 'admin', 'manager'],
    comingSoon: true,
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
    roles: ['owner', 'admin'],
  },
  {
    title: 'Developer',
    url: '/dashboard/developer',
    icon: Code,
    roles: ['owner'],
  },
];

interface UserData {
  name: string;
  email: string;
  role: UserRole;
}

// Page Actions Context
interface PageAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
}

const PageActionsContext = createContext<{
  setActions: (actions: PageAction[]) => void;
}>({ setActions: () => { } });

export const usePageActions = () => useContext(PageActionsContext);

interface DashboardShellProps {
  children: ReactNode;
  user: UserData;
}

export default function DashboardShell({ children, user }: DashboardShellProps) {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isMobile = useIsMobile();
  const { activeShopId, currentShop, availableShops, switchShop, isLoading } = useActiveShop();

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOut({
        callbackUrl: '/signin',
      });
    } catch {
      setIsSigningOut(false);
    }
  };

  const userInitials = user.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user.role)
  );

  // Page Actions State
  const [pageActions, setPageActions] = useState<PageAction[]>([]);

  // Select primary navigation items for mobile footer (max 4 direct items + 1 "More" button)
  const mobileNavItems = filteredNavItems.filter(item =>
    ['/dashboard', '/dashboard/parties', '/dashboard/items', '/dashboard/invoices'].includes(item.url)
  );

  // Remaining nav items not shown directly in the mobile bar (shown inside "More" menu)
  const extraMobileNavItems = filteredNavItems.filter(
    item => !['/dashboard', '/dashboard/parties', '/dashboard/items', '/dashboard/invoices'].includes(item.url)
  );

  // Calculate bottom padding based on existence of actions
  const mainBottomPadding = isMobile
    ? pageActions.length > 0
      ? 'pb-32'
      : 'pb-20'
    : '';

  return (
    <PageActionsContext.Provider value={{ setActions: setPageActions }}>
      <TooltipProvider>
        <SidebarProvider>
          {/* Sidebar - Hidden on mobile */}
          {!isMobile && (
            <Sidebar variant="inset" collapsible="icon" className="font-sans dark:bg-gray-900 dark:border-gray-800">

              <SidebarHeader className="border-b border-border dark:border-gray-800">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton size="lg" asChild>
                      <Link href="/dashboard">
                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                          <Home className="size-4" />
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">GSMS</span>
                          <span className="truncate text-xs text-muted-foreground">
                            Shop Management
                          </span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarHeader>

              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel className="font-medium dark:text-gray-400">Navigation</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {filteredNavItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            tooltip={item.title}
                            isActive={pathname === item.url}
                            className="hover:bg-accent data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                          >
                            <Link href={item.url}>
                              <item.icon className="size-4" />
                              <span>{item.title}</span>
                              {item.comingSoon && (
                                <Badge
                                  variant="secondary"
                                  className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium"
                                >
                                  Soon
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>

              <SidebarFooter className="border-t border-border dark:border-gray-800">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          size="lg"
                          className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground hover:bg-accent"
                        >
                          <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                              {userInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">
                              {user.name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {user.role}
                            </span>
                          </div>
                          <ChevronDown className="ml-auto size-4 text-muted-foreground" />
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                        side="bottom"
                        align="end"
                        sideOffset={4}
                      >
                        <DropdownMenuLabel className="p-0 font-normal">
                          <div className="flex items-center gap-2 px-1 py-1.5">
                            <div className="grid flex-1 text-left text-sm leading-tight">
                              <span className="truncate font-semibold">{user.name}</span>
                              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                            </div>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/profile">
                            <Users className="mr-2 size-4" />
                            Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/settings">
                            <Settings className="mr-2 size-4" />
                            Settings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 dark:text-red-400"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                        >
                          <LogOut className="mr-2 size-4" />
                          {isSigningOut ? 'Signing out...' : 'Sign out'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarFooter>

              <SidebarRail />
            </Sidebar>
          )}

          {/* Main Content */}
          <SidebarInset className="font-sans">

            {/* Header */}
            <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b dark:border-gray-800 dark:bg-gray-900/50">
              {!isMobile && <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />}
              <div className="flex flex-1 items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold dark:text-white">Dashboard</h1>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm" className="h-8 gap-1" disabled={isLoading}>
                        <Store className="size-3.5" />
                        <span className="truncate max-w-28">
                          {currentShop ? currentShop.name : (isLoading ? 'Loading...' : 'Select Shop')}
                        </span>
                        <ChevronDown className="size-3.5 ml-1 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Select Shop</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {availableShops.length > 0 ? (
                        availableShops.map((shop) => {
                          const isActive = shop.id === activeShopId;
                          return (
                            <DropdownMenuItem
                              key={shop.id}
                              onClick={() => switchShop(shop.id)}
                              disabled={isActive}
                            >
                              <div className="flex items-center gap-2">
                                {isActive ? (
                                  <Check className="size-3.5" />
                                ) : (
                                  <div className="size-3.5" />
                                )}
                                {shop.name}
                              </div>
                            </DropdownMenuItem>
                          );
                        })
                      ) : (
                        <DropdownMenuItem asChild>
                          <CreateShopDialog
                            trigger={
                              <span className="flex items-center gap-2 text-sm">
                                <Store className="size-3.5" />
                                Create your first shop
                              </span>
                            }
                            autoSwitch={true}
                          />
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={user.role === 'superOwner' ? '/super/shops' : '/dashboard/shops'}>
                          <Store className="mr-2 size-3.5" />
                          Manage Shops
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ThemeToggle />
                  <NotificationBell />
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className={`flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 dark:bg-gray-950 ${mainBottomPadding}`}>
              {children}
            </main>

            {/* Mobile Floating Action Buttons - Colourful & Visually Appealing */}
            {isMobile && pageActions.length > 0 && (
              <div className="fixed bottom-16 left-0 right-0 z-40 px-3 py-2">
                <div className="flex gap-3 w-full">
                  {pageActions.map((action, index) => {
                    const ActionIcon = action.icon;

                    // Determine colour scheme based on label text for semantic variety
                    const labelLower = (action.label || '').toLowerCase();

                    let gradient: string, shadowColor: string, ringColor: string;

                    if (labelLower.includes('payment') || labelLower.includes('pay') || labelLower.includes('cash')) {
                      gradient = 'from-emerald-600 to-green-500';
                      shadowColor = 'shadow-emerald-600/30';
                      ringColor = 'ring-emerald-400/50';
                    } else if (labelLower.includes('bill') || labelLower.includes('invoice')) {
                      gradient = 'from-violet-600 to-purple-500';
                      shadowColor = 'shadow-violet-400/30';
                      ringColor = 'ring-violet-400/50';
                    } else if (labelLower.includes('sale') || labelLower.includes('sell')) {
                      gradient = 'from-sky-400 to-blue-500';
                      shadowColor = 'shadow-sky-400/30';
                      ringColor = 'ring-sky-400/50';
                    } else if (labelLower.includes('purchase') || labelLower.includes('buy') || labelLower.includes('stock')) {
                      gradient = 'from-amber-400 to-orange-500';
                      shadowColor = 'shadow-amber-400/30';
                      ringColor = 'ring-amber-400/50';
                    } else if (labelLower.includes('return') || labelLower.includes('refund')) {
                      gradient = 'from-rose-400 to-red-500';
                      shadowColor = 'shadow-rose-400/30';
                      ringColor = 'ring-rose-400/50';
                    } else if (labelLower.includes('report') || labelLower.includes('export')) {
                      gradient = 'from-indigo-400 to-blue-500';
                      shadowColor = 'shadow-indigo-400/30';
                      ringColor = 'ring-indigo-400/50';
                    } else {
                      // Fallback: alternate vibrant colours by index
                      const fallbacks = [
                        { g: 'from-blue-400 to-indigo-500', s: 'shadow-blue-400/30', r: 'ring-blue-400/50' },
                        { g: 'from-fuchsia-400 to-pink-500', s: 'shadow-fuchsia-400/30', r: 'ring-fuchsia-400/50' },
                        { g: 'from-teal-400 to-emerald-500', s: 'shadow-teal-400/30', r: 'ring-teal-400/50' },
                      ];
                      const fb = fallbacks[index % fallbacks.length];
                      gradient = fb.g;
                      shadowColor = fb.s;
                      ringColor = fb.r;
                    }

                    return (
                      <button
                        key={index}
                        onClick={action.onClick}
                        className={`
                        group relative flex-1 h-10 flex items-center justify-center gap-2
                        rounded-xl font-semibold text-sm text-white
                        bg-linear-to-br ${gradient}
                        shadow-lg ${shadowColor} hover:shadow-xl hover:${shadowColor}
                        active:scale-[0.95] active:shadow-md
                        transition-all duration-200 ease-out
                        hover:brightness-110
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:${ringColor}
                        overflow-hidden
                      `}
                      >
                        {/* Animated shimmer overlay */}
                        <span className="absolute inset-0 bg-linear-to-r from-white/0 via-white/25 to-white/0 opacity-0 group-hover:opacity-100 -translate-x-full group-hover:translate-x-full transition-all duration-700 ease-in-out pointer-events-none" />

                        {/* Glass highlight */}
                        {/* <span className="absolute inset-x-3 top-0 h-[1.5px] rounded-full bg-white/40 pointer-events-none" /> */}

                        {/* Icon with hover animation */}
                        {ActionIcon && (
                          <ActionIcon className="size-4 group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-200" />
                        )}

                        {/* Label */}
                        <span className="relative drop-shadow-sm">{action.label}</span>

                        {/* Ripple surface */}
                        <span className="absolute inset-0 rounded-xl bg-white/0 active:bg-white/15 transition-colors duration-150 pointer-events-none" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile Bottom Navigation */}
            {isMobile && (
              <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background dark:bg-gray-900 dark:border-gray-800 pb-safe">
                <div className="flex justify-around items-center h-16 px-2">
                      {mobileNavItems.map((item) => {
                    const isActive = pathname === item.url;

                    // Map to filled icon variants
                    const getIcon = () => {
                      switch (item.url) {
                        case '/dashboard':
                          return isActive ? LayoutDashboard : LayoutDashboardOutline;
                        case '/dashboard/parties':
                          return isActive ? Users : UsersOutline;
                        case '/dashboard/items':
                          return isActive ? Package : PackageOutline;
                        case '/dashboard/invoices':
                          return isActive ? FileText : FileTextOutline;
                        default:
                          return item.icon;
                      }
                    };

                    const ActiveIcon = getIcon();

                    return (
                      <Link
                        key={item.url}
                        href={item.url}
                        className={`flex flex-col items-center justify-center w-full h-full min-h-12 gap-0.5 text-xs
                        transition-all duration-200 ease-out
                        active:scale-[0.92]
                        ${isActive
                            ? 'text-primary scale-105'
                            : 'text-muted-foreground hover:text-foreground hover:scale-[1.02]'
                          }`}
                        style={{
                          transform: isActive ? 'translateY(-2px) scale(1.05)' : 'translateY(0) scale(1)',
                          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                      >
                        <ActiveIcon
                          className={`size-5 transition-all duration-200 ${isActive ? 'drop-shadow-sm' : ''}`}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                        <span
                          className={`text-[10px] font-medium transition-all duration-200 ${isActive ? 'font-semibold' : ''}`}
                        >
                          {item.title}
                        </span>
                      </Link>
                    );
                  })}

                  {/* "More" button with dropdown for remaining links */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex flex-col items-center justify-center w-full h-full min-h-12 gap-0.5 text-xs text-muted-foreground hover:text-foreground hover:scale-[1.02] active:scale-[0.92] transition-all duration-200 ease-out"
                        style={{
                          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                      >
                        <MoreHorizontal className="size-5 transition-all duration-200" strokeWidth={2} />
                        <span className="text-[10px] font-medium transition-all duration-200">More</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="top"
                      align="end"
                      sideOffset={8}
                      className="mb-2 w-56 rounded-xl bg-white"
                    >
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        More Options
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {extraMobileNavItems.map((item) => (
                        <DropdownMenuItem key={item.url} asChild>
                          <Link href={item.url} className="flex items-center gap-2">
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                            {item.comingSoon && (
                              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">
                                Soon
                              </Badge>
                            )}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 dark:text-red-400"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                      >
                        <LogOut className="mr-2 size-4" />
                        {isSigningOut ? 'Signing out...' : 'Sign out'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </nav>
            )}

          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </PageActionsContext.Provider>
  );
}
