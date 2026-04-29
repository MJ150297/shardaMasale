"use client";

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '@/components/ui/theme-toggle';

import {
  LayoutDashboard,
  Package,
  Users,
  Receipt,
  BarChart3,
  Settings,
  Code,
  LogOut,
  ChevronDown,
  Home,
  Bell
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
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    roles: ['owner', 'admin', 'manager', 'staff'],
  },
  {
    title: 'Items',
    url: '/dashboard/items',
    icon: Package,
    roles: ['owner', 'admin', 'manager', 'cashier', 'staff'],
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
    comingSoon: true,
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

interface DashboardShellProps {
  children: ReactNode;
  user: UserData;
}

export default function DashboardShell({ children, user }: DashboardShellProps) {
  const pathname = usePathname();

  const userInitials = user.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user.role)
  );

  return (
    <TooltipProvider>
      <SidebarProvider>
        {/* Sidebar */}
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
                      <Link href="/dashboard/settings">
                        <Settings className="mr-2 size-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 dark:text-red-400">
                      <LogOut className="mr-2 size-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>

        {/* Main Content */}
        <SidebarInset className="font-sans">
          
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b dark:border-gray-800 dark:bg-gray-900/50">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
            <div className="flex flex-1 items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold dark:text-white">Dashboard</h1>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button variant="ghost" size="icon">
                  <Bell className="size-4" />
                </Button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 dark:bg-gray-950">
            {children}
          </main>

        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}