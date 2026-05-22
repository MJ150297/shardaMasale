import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Item from '@/models/Item';
import StockMovement from '@/models/StockMovement';
import { roundCurrency } from '@/lib/utils';

type CostingMethod = 'fifo' | 'average' | 'latest';

// Calculate FIFO valuation for an item
async function calculateFIFOValuation(itemId: string, currentQuantity: number) {
  if (currentQuantity <= 0) return { value: 0, averageCost: 0 };
  
  const inMovements = await StockMovement.find({
    item: itemId,
    type: { $in: ['IN', 'RETURN_IN'] }
  })
  .sort({ createdAt: 1 })
  .select('quantity metadata.unitCost')
  .lean();

  let remaining = currentQuantity;
  let totalValue = 0;

  for (const movement of inMovements) {
    if (remaining <= 0) break;
    
    const unitCost = (movement.metadata as any)?.unitCost as number || 0;
    const takeQty = Math.min(movement.quantity, remaining);

    totalValue += takeQty * unitCost;
    remaining -= takeQty;
  }

  return {
    value: roundCurrency(totalValue),
    averageCost: roundCurrency(totalValue / currentQuantity)
  };
}

// Calculate Weighted Average Cost
async function calculateAverageCost(itemId: string, currentQuantity: number) {
  if (currentQuantity <= 0) return { value: 0, averageCost: 0 };

  const movements = await StockMovement.find({
    item: itemId,
    type: { $in: ['IN', 'RETURN_IN'] }
  })
  .select('quantity metadata.unitCost')
  .lean();

  let totalQty = 0;
  let totalCost = 0;

  for (const movement of movements) {
    const unitCost = (movement.metadata as any)?.unitCost as number || 0;
    totalQty += movement.quantity;
    totalCost += movement.quantity * unitCost;
  }

  const averageCost = totalQty > 0 ? roundCurrency(totalCost / totalQty) : 0;
  
  return {
    value: roundCurrency(averageCost * currentQuantity),
    averageCost
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const costingMethod = (searchParams.get('method') as CostingMethod) || 'latest';

    const query: any = { owner: user.id, itemType: 'product' };
    if (shopId) query.shopId = shopId;

    // Get current stock with full details
    const items = await Item.find(query)
      .select('name sku category unitOfMeasure pricing.costPrice pricing.sellingPrice stock')
      .lean();

    // Calculate valuations for each item
    const itemsWithValuation = await Promise.all(items.map(async (item) => {
      const qty = item.stock.currentQuantity;
      
      let valuation = {
        latest: roundCurrency(qty * item.pricing.costPrice),
        fifo: 0,
        average: 0,
        averageCost: item.pricing.costPrice
      };

      if (costingMethod === 'fifo' || costingMethod === 'average') {
        const fifoData = await calculateFIFOValuation(item._id.toString(), qty);
        const avgData = await calculateAverageCost(item._id.toString(), qty);
        
        valuation.fifo = fifoData.value;
        valuation.average = avgData.value;
        valuation.averageCost = avgData.averageCost || item.pricing.costPrice;
      }

      return {
        ...item,
        valuation,
        isLowStock: qty > 0 && qty <= item.stock.reorderLevel,
        isOutOfStock: qty <= 0
      };
    }));

    // Summary calculations
    const totalLatestValue = itemsWithValuation.reduce((acc, i) => acc + i.valuation.latest, 0);
    const totalFIFOValue = itemsWithValuation.reduce((acc, i) => acc + i.valuation.fifo, 0);
    const totalAverageValue = itemsWithValuation.reduce((acc, i) => acc + i.valuation.average, 0);
    const totalSellValue = itemsWithValuation.reduce((acc, i) => acc + (i.stock.currentQuantity * i.pricing.sellingPrice), 0);
    
    const outOfStock = itemsWithValuation.filter(i => i.isOutOfStock).length;
    const lowStock = itemsWithValuation.filter(i => i.isLowStock).length;

    // Get recent stock movements
    const movements = await StockMovement.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('item', 'name sku')
      .populate('createdBy', 'name email')
      .lean();

    return NextResponse.json({
      items: itemsWithValuation,
      movements,
      costingMethod,
      summary: {
        totalItems: items.length,
        totalStockValue: totalLatestValue,
        totalFIFOValue,
        totalAverageValue,
        totalSellValue,
        outOfStock,
        lowStock,
        totalPotentialProfit: roundCurrency(totalSellValue - totalLatestValue)
      }
    });

  } catch (error) {
    console.error('Stock report error:', error);
    return NextResponse.json({ error: 'Failed to load stock report' }, { status: 500 });
  }
}
