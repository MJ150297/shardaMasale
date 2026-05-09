import { handleGenerateInvoice } from '../route';

export async function POST(request: Request) {
  return handleGenerateInvoice(request);
}