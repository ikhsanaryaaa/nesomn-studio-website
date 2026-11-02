import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthGate } from '@/components/page-state';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';
import { api } from '@/lib/api';
const rp = (n: number) =>
  new Intl.NumberFormat('en-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
export default function CheckoutPage() {
  const [params] = useSearchParams();
  return (
    <AuthGate>
      <InvoiceContent key={params.get('order') ?? 'missing'} />
    </AuthGate>
  );
}
function InvoiceContent() {
  const qc = useQueryClient();
  const [params] = useSearchParams(),
    id = params.get('order');
  const [confirmed, setConfirmed] = useState(false);
  const [qrError, setQrError] = useState(false);
  const invoice = useQuery({
    queryKey: ['qris-invoice', id],
    queryFn: () => api.billing.invoice(id!),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
    retry: false,
  });
  const value = invoice.data;
  useEffect(() => {
    if (value?.status === 'paid')
      for (const key of ['library', 'billing-history', 'subscription', 'ai-credit'])
        void qc.invalidateQueries({ queryKey: [key] });
  }, [value?.status, qc]);
  return (
    <>
      <Seo
        title="QRIS checkout"
        description="Check the amount and unique payment code before paying."
      />
      <Topbar title="Checkout" />
      <div className="checkout-page">
        <h1 className="checkout-title">QRIS payment</h1>
        {!id ? (
          <p role="alert">
            Order ID is missing. <Link to="/account">Open account</Link>
          </p>
        ) : invoice.isLoading ? (
          <p role="status">Loading invoice…</p>
        ) : invoice.isError ? (
          <div role="alert">
            <p>Unable to load the invoice. Do not pay until the amount has been verified.</p>
            <Button className="checkout-refresh" onClick={() => void invoice.refetch()}>
              Try again
            </Button>
          </div>
        ) : value ? (
          <>
            <dl className="checkout-breakdown">
              {(
                [
                  ['Subtotal', value.quote.subtotalIdr],
                  ['Discount', value.quote.discountIdr ? -value.quote.discountIdr : 0],
                  ['Unique payment code', value.code],
                  ['Amount due', value.payableIdr],
                ] as const
              ).map(([label, amount]) => (
                <div key={label} className="checkout-line">
                  <dt>{label}</dt>
                  <dd className="checkout-amount">{rp(amount)}</dd>
                </div>
              ))}
            </dl>
            <p className="workspace-followup-note">
              Unique payment code {rp(value.code)} is added to match your payment. Pay exactly{' '}
              {rp(value.payableIdr)}. This code is part of the payment amount and does not add
              credits.
            </p>
            <section aria-live="polite" className="checkout-state">
              {qrError && (
                <p role="alert" className="checkout-alert">
                  Unable to load the QR code. Check the status and try again before paying.
                </p>
              )}
              {value.status === 'paid' ? (
                <p className="checkout-state-heading">
                  Payment verified. <Link to="/account">Open account and history</Link>
                </p>
              ) : value.status === 'pending' ? (
                <>
                  <p className="checkout-instructions">
                    Valid until {new Date(value.expiresAt).toLocaleString('en-ID')}. The status is
                    updated by the server.
                  </p>
                  {!confirmed ? (
                    <Button
                      className="checkout-qr-action"
                      onClick={() => {
                        setQrError(false);
                        setConfirmed(true);
                      }}
                    >
                      Show QRIS for {rp(value.payableIdr)}
                    </Button>
                  ) : (
                    <>
                      <img
                        className="checkout-qr-image"
                        src={`/api/billing/orders/${encodeURIComponent(id)}/qr`}
                        alt={`QRIS order ${id}, amount due ${rp(value.payableIdr)}`}
                        onError={() => {
                          setQrError(true);
                          setConfirmed(false);
                        }}
                      />
                      <p className="checkout-recovery">
                        Scan the QR code with your payment app. Do not pay twice while waiting for
                        confirmation.
                      </p>
                    </>
                  )}
                </>
              ) : (
                <p role="alert">
                  {value.status === 'expired'
                    ? 'This invoice has expired. Do not use this QR code.'
                    : 'This payment needs reconciliation. Do not pay again; contact support with your order ID.'}
                </p>
              )}
              {value.status !== 'paid' && (
                <Button
                  variant="secondary"
                  className="checkout-refresh"
                  disabled={invoice.isFetching}
                  onClick={() => void invoice.refetch()}
                >
                  Check payment status
                </Button>
              )}
            </section>
            <p className="checkout-order-id">Order ID: {id}</p>
          </>
        ) : null}
      </div>
    </>
  );
}
