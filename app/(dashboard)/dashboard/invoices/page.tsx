import InvoicesClient from "./invoices-client"

export const metadata = {
  title: 'Invoices | GSMS',
  description: 'Manage and view all invoices'
}

export default function InvoicesPage() {
  return <InvoicesClient />
}