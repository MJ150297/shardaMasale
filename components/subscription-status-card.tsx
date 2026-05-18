'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Crown, AlertTriangle, Clock, CalendarDays, Building2, Package, Users, FileText } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface SubscriptionInfo {
  plan: string;
  status: string;
  expiryDate?: string | null;
  trialEndsAt?: string | null;
}

interface UsageInfo {
  shops: number;
  maxShops: number;
}

export default function SubscriptionStatusCard() {
  const { data: session } = useSession();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [usage, setUsage] = useState<UsageInfo>({ shops: 0, maxShops: 0 });

  useEffect(() => {
    if (session?.user?.subscription) {
      setInfo(session.user.subscription as SubscriptionInfo);
    }
    // Fetch usage data
    fetch('/api/subscription/usage')
      .then(r => r.json())
      .then(data => setUsage(data))
      .catch(() => {});
  }, [session]);

  if (!info) return null;

  const isActive = info.status === 'active' || info.status === 'trial';
  const daysRemaining = calculateDaysRemaining(info);

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Subscription</CardTitle>
          </div>
          <Badge
            variant={isActive ? 'default' : 'destructive'}
            className="capitalize"
          >
            {info.status}
          </Badge>
        </div>
        <CardDescription>
          {info.plan === 'enterprise'
            ? 'Enterprise Plan — Full access'
            : info.plan === 'paid'
              ? 'Paid Plan — Premium features'
              : info.plan === 'trial'
                ? 'Trial Plan — Exploring features'
                : 'Free Plan — Limited access'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="font-medium capitalize text-lg">{info.plan}</div>
          {daysRemaining !== null && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {info.status === 'trial'
                  ? `${daysRemaining} trial days remaining`
                  : `${daysRemaining} days remaining`}
              </span>
            </div>
          )}
        </div>

        {!isActive && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Subscription {info.status}</p>
              <p className="text-muted-foreground mt-1">
                {info.status === 'expired'
                  ? 'Your subscription has expired. Some features may be limited.'
                  : 'Your subscription has been suspended. Contact your administrator.'}
              </p>
            </div>
          </div>
        )}

        {/* Usage bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Shops</span>
            </div>
            <span className="text-muted-foreground">
              {usage.shops} / {usage.maxShops === Infinity ? '∞' : usage.maxShops}
            </span>
          </div>
          <Progress
            value={usage.maxShops === Infinity ? 0 : (usage.shops / usage.maxShops) * 100}
            className="h-1.5"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function calculateDaysRemaining(info: SubscriptionInfo): number | null {
  const endDate = info.status === 'trial' ? info.trialEndsAt : info.expiryDate;
  if (!endDate) return null;
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}