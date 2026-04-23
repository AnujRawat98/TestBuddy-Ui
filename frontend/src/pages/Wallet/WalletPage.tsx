import React, { useEffect, useMemo, useState } from 'react';
import { paymentApi, walletApi } from '../../services/api';
import './WalletPage.css';

type WalletSummary = {
  tenantId: string;
  assessmentCredits: number;
  interviewCredits: number;
  updatedAt: string;
};

type WalletTransaction = {
  id: string;
  type: string;
  creditType: string;
  quantity: number;
  referenceId: string;
  description: string;
  createdAt: string;
};

type WalletPricing = {
  assessmentUnitPrice: number;
  interviewUnitPrice: number;
  updatedAt: string;
};

type CreateOrderResponse = {
  paymentId: string;
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  currency: string;
  assessmentQuantity: number;
  interviewQuantity: number;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadCheckoutScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout.'));
    document.head.appendChild(script);
  });
}

const WalletPage: React.FC = () => {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [pricing, setPricing] = useState<WalletPricing | null>(null);
  const [assessmentQuantity, setAssessmentQuantity] = useState(0);
  const [interviewQuantity, setInterviewQuantity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const totalAmount = useMemo(() => {
    return assessmentQuantity * (pricing?.assessmentUnitPrice ?? 0) +
      interviewQuantity * (pricing?.interviewUnitPrice ?? 0);
  }, [assessmentQuantity, interviewQuantity, pricing]);

  const loadWallet = async () => {
    setError('');
    try {
      const [walletRes, txRes, pricingRes] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getTransactions(),
        walletApi.getPricing(),
      ]);

      setWallet(walletRes.data);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      setPricing(pricingRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to load wallet data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const openCheckout = async () => {
    setError('');
    setMessage('');

    if (totalAmount <= 0) {
      setError('Enter at least one assessment or interview credit to recharge.');
      return;
    }

    setPaying(true);

    try {
      await loadCheckoutScript();
      const response = await paymentApi.createOrder({
        assessmentQuantity,
        interviewQuantity,
      });

      const order: CreateOrderResponse = response.data;
      if (!window.Razorpay) {
        throw new Error('Razorpay checkout is unavailable.');
      }

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: 'TestBuddy',
        description: 'Wallet credit recharge',
        handler: () => {
          setMessage('Payment submitted. Credits will update after Razorpay webhook confirmation.');
          window.setTimeout(() => {
            loadWallet();
          }, 4000);
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
          },
        },
        theme: {
          color: '#1f7a4c',
        },
      });

      razorpay.open();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to start payment.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="wallet-page">
      <div className="wallet-page-header">
        <div>
          <div className="wallet-eyebrow">Billing</div>
          <h1 className="wallet-title">Wallet and Credits</h1>
          <p className="wallet-subtitle">Recharge assessment and interview credits for your workspace.</p>
        </div>
        {wallet && (
          <div className="wallet-updated">
            Updated {new Date(wallet.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
        )}
      </div>

      {error && <div className="wallet-alert wallet-alert-error">{error}</div>}
      {message && <div className="wallet-alert wallet-alert-success">{message}</div>}

      <div className="wallet-grid">
        <section className="wallet-panel">
          <div className="wallet-panel-title">Current Balance</div>
          <div className="wallet-summary-grid">
            <div className="wallet-summary-card">
              <div className="wallet-card-label">Assessment Credits</div>
              <div className="wallet-card-value">{loading ? '--' : wallet?.assessmentCredits ?? 0}</div>
              <div className="wallet-card-note">1 assessment link consumes 1 credit</div>
            </div>
            <div className="wallet-summary-card">
              <div className="wallet-card-label">Interview Credits</div>
              <div className="wallet-card-value">{loading ? '--' : wallet?.interviewCredits ?? 0}</div>
              <div className="wallet-card-note">1 interview start consumes 1 credit</div>
            </div>
          </div>
        </section>

        <section className="wallet-panel">
          <div className="wallet-panel-title">Recharge Credits</div>
          <div className="wallet-form-grid">
            <label className="wallet-field">
              <span>Assessments</span>
              <input
                type="number"
                min={0}
                value={assessmentQuantity}
                onChange={(e) => setAssessmentQuantity(Math.max(0, Number(e.target.value || 0)))}
              />
              <small>{assessmentQuantity} x Rs. {pricing?.assessmentUnitPrice ?? '--'}</small>
            </label>

            <label className="wallet-field">
              <span>Interviews</span>
              <input
                type="number"
                min={0}
                value={interviewQuantity}
                onChange={(e) => setInterviewQuantity(Math.max(0, Number(e.target.value || 0)))}
              />
              <small>{interviewQuantity} x Rs. {pricing?.interviewUnitPrice ?? '--'}</small>
            </label>
          </div>

          <div className="wallet-total-card">
            <div>
              <div className="wallet-total-label">Total payable</div>
              <div className="wallet-total-value">Rs. {totalAmount}</div>
            </div>
            <button className="wallet-pay-btn" disabled={paying || totalAmount <= 0 || !pricing} onClick={openCheckout}>
              {paying ? 'Preparing payment...' : 'Pay with Razorpay'}
            </button>
          </div>
        </section>
      </div>

      <section className="wallet-panel wallet-history">
        <div className="wallet-panel-title">Transaction History</div>
        <div className="wallet-table-wrap">
          <table className="wallet-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Credit</th>
                <th>Qty</th>
                <th>Reference</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {!loading && transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="wallet-empty">No transactions yet.</td>
                </tr>
              )}
              {transactions.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td>
                    <span className={`wallet-badge ${item.type === 'CREDIT' ? 'credit' : 'debit'}`}>
                      {item.type}
                    </span>
                  </td>
                  <td>{item.creditType}</td>
                  <td>{item.quantity}</td>
                  <td>{item.referenceId}</td>
                  <td>{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default WalletPage;
