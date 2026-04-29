import { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import DashboardShell from '@/components/layout/dashboard-shell';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await requireUser();

  return (
    <DashboardShell user={{
      name: user.name,
      email: user.email,
      role: user.role
    }}>
      {children}
    </DashboardShell>
  );
}