import { NextResponse } from 'next/server';
import { requireOwner, requireActiveBusinessSubscription } from '@/lib/auth';
import { isAdvancedReport } from '@/lib/subscription-features';
import connectToDatabase from '@/lib/db';
import Transaction from '@/models/Transaction';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    const { features } = await requireActiveBusinessSubscription();
    if (!features.advancedReports || !isAdvancedReport('profit-loss')) {
      return NextResponse.json(
        { error: 'Advanced reports are not available on your plan. Upgrade to access this report.' },
        { status: 403 }
      );
    }
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const period = searchParams.get('period') || 'daily';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const query: any = { 
      owner: user.id,
      status: 'confirmed'
    };
    
    if (shopId) query.shopId = shopId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .sort({ transactionDate: 1 })
      .select('type transactionDate summary lineItems')
      .lean();

    // Group by period
    const groupedData: Record<string, any> = {};
    
    transactions.forEach(t => {
      const date = new Date(t.transactionDate);
      let key: string;
      
      switch(period) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          date: key,
          sales: 0,
          purchases: 0,
          count: 0
        };
      }

      if (t.type === 'sale') {
        groupedData[key].sales += t.summary.grandTotal || 0;
      } else if (t.type === 'purchase') {
        groupedData[key].purchases += t.summary.grandTotal || 0;
      }
      groupedData[key].count += 1;
    });

    const summary = Object.values(groupedData).map(d => ({
      ...d,
      profit: d.sales - d.purchases,
      margin: d.sales > 0 ? ((d.sales - d.purchases) / d.sales * 100).toFixed(2) : 0
    }));

    // Overall totals
    const totalSales = summary.reduce((acc, d) => acc + d.sales, 0);
    const totalPurchases = summary.reduce((acc, d) => acc + d.purchases, 0);
    const totalProfit = totalSales - totalPurchases;

    return NextResponse.json({
      summary,
      totals: {
        totalSales,
        totalPurchases,
        totalProfit,
        margin: totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(2) : 0
      }
    });

  } catch (error) {
    console.error('Profit & Loss report error:', error);
    return NextResponse.json({ error: 'Failed to load profit & loss report' }, { status: 500 });
  }
}
