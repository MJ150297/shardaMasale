import { roundCurrency } from "@/lib/utils";

export interface SettlementTarget {
  invoiceId: string;
  dueAmount: number;
}

export interface InvoiceSettlementAllocation {
  invoiceId: string;
  appliedAmount: number;
  discountAmount: number;
  settledAmount: number;
  remainingDueAmount: number;
}

export interface InvoiceSettlementResult {
  allocations: InvoiceSettlementAllocation[];
  totalAppliedAmount: number;
  totalDiscountAmount: number;
  totalSettledAmount: number;
  remainingCashAmount: number;
  remainingDiscountAmount: number;
}

export function allocateInvoiceSettlements(
  targets: SettlementTarget[],
  cashAmount: number,
  discountAmount: number,
): InvoiceSettlementResult {
  let remainingCashAmount = roundCurrency(Math.max(cashAmount, 0));
  let remainingDiscountAmount = roundCurrency(Math.max(discountAmount, 0));

  const allocations = targets.map((target) => {
    const dueAmount = roundCurrency(Math.max(target.dueAmount, 0));
    const appliedAmount = roundCurrency(
      Math.min(dueAmount, remainingCashAmount),
    );
    remainingCashAmount = roundCurrency(remainingCashAmount - appliedAmount);

    const dueAfterPayment = roundCurrency(dueAmount - appliedAmount);
    const appliedDiscountAmount = roundCurrency(
      Math.min(dueAfterPayment, remainingDiscountAmount),
    );
    remainingDiscountAmount = roundCurrency(
      remainingDiscountAmount - appliedDiscountAmount,
    );

    const settledAmount = roundCurrency(
      appliedAmount + appliedDiscountAmount,
    );

    return {
      invoiceId: target.invoiceId,
      appliedAmount,
      discountAmount: appliedDiscountAmount,
      settledAmount,
      remainingDueAmount: roundCurrency(dueAmount - settledAmount),
    };
  });

  const totalAppliedAmount = roundCurrency(
    allocations.reduce((total, allocation) => total + allocation.appliedAmount, 0),
  );
  const totalDiscountAmount = roundCurrency(
    allocations.reduce((total, allocation) => total + allocation.discountAmount, 0),
  );

  return {
    allocations,
    totalAppliedAmount,
    totalDiscountAmount,
    totalSettledAmount: roundCurrency(totalAppliedAmount + totalDiscountAmount),
    remainingCashAmount,
    remainingDiscountAmount,
  };
}
