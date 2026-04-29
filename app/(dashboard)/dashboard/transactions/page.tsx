import { requireUser } from '@/lib/auth';
import TransactionsClient from './transactions-client';

export default async function TransactionsPage() {
  await requireUser();
  return <TransactionsClient />;
}
