"use client";

import { useState, useEffect } from 'react';
import { BarChart3, Bell, Check, CreditCard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=10');
      const data = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const categories = [
    { id: 'general', label: 'General', icon: Bell },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'analysis', label: 'Analysis', icon: BarChart3 },
    { id: 'security', label: 'Security', icon: ShieldCheck },
  ] as const;

  type NotificationCategory = (typeof categories)[number]['id'];

  const [activeTab, setActiveTab] = useState<NotificationCategory>('general');

  const getNotificationCategory = (notification: Notification): NotificationCategory => {
    const text = `${notification.title} ${notification.message}`.toLowerCase();
    const metadata = notification.metadata || {};

    const hasTransactionMeta =
      Boolean(metadata.invoiceId) ||
      Boolean(metadata.transactionId) ||
      /invoice|transaction|sale|purchase|payment|due|overdue|bill/.test(text);

    const hasAnalysisMeta =
      Boolean(metadata.analysis) ||
      /analysis|report|trend|forecast|insight|recommendation|analytics|prediction/.test(text);

    const hasSecurityMeta =
      Boolean(metadata.security) ||
      /security|password|login|unauthorized|unauthorised|authentication|auth|access|breach/.test(text);

    if (hasSecurityMeta) return 'security';
    if (hasTransactionMeta) return 'transactions';
    if (hasAnalysisMeta) return 'analysis';
    return 'general';
  };

  const notificationsByCategory = categories.reduce((map, category) => {
    map[category.id] = notifications.filter(
      notification => getNotificationCategory(notification) === category.id
    );
    return map;
  }, {} as Record<NotificationCategory, Notification[]>);

  const counts = categories.reduce((map, category) => {
    map[category.id] = notificationsByCategory[category.id].length;
    return map;
  }, {} as Record<NotificationCategory, number>);

  const renderNotificationList = (items: Notification[]) => {
    if (loading) {
      return Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col items-start gap-2 p-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ));
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">
          <Bell className="size-8 mb-2 opacity-50" />
          <p className="text-sm">No notifications</p>
        </div>
      );
    }

    return items.map((notification) => (
      <div
        key={notification._id}
        className={`flex flex-col items-start p-3 ${!notification.read ? 'bg-accent/50' : ''}`}
      >
        <div className="flex w-full items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-medium leading-none">{notification.title}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{formatDate(notification.createdAt)}</p>
          </div>
          {!notification.read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notification._id);
              }}
            >
              <Check className="size-3" />
            </Button>
          )}
        </div>
      </div>
    ));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center rounded-full p-0 text-[10px] font-medium"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={markAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as NotificationCategory)} className="px-2 pb-2">
          <TabsList variant="segmented" className="w-full overflow-x-auto gap-1">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="w-10 px-1 justify-center"
                  title={category.label}
                  aria-label={category.label}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="sr-only">{category.label}</span>
                  {counts[category.id] > 0 && (
                    <Badge className="ml-1 rounded-full px-2 py-0.5 text-[10px]" variant="secondary">
                      {counts[category.id]}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category.id} value={category.id} className="min-h-55 max-h-75 overflow-y-auto px-0 py-2">
              {renderNotificationList(notificationsByCategory[category.id])}
            </TabsContent>
          ))}
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}