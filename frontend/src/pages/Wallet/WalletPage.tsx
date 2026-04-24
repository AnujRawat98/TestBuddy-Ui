import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BadgeIndianRupee,
  CalendarClock,
  CreditCard,
  ReceiptText,
  Sparkles,
  Target,
  UserRoundSearch,
} from 'lucide-react';
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

  const totalAmount = useMemo(
    () =>
      assessmentQuantity * (pricing?.assessmentUnitPrice ?? 0) +
      interviewQuantity * (pricing?.interviewUnitPrice ?? 0),
    [assessmentQuantity, interviewQuantity, pricing],
  );

  const walletInsights = useMemo(
    () => [
      {
        label: 'Assessment Credits',
        value: loading ? '--' : wallet?.assessmentCredits ?? 0,
        note: '1 assessment link consumes 1 credit',
        icon: Target,
      },
      {
        label: 'Interview Credits',
        value: loading ? '--' : wallet?.interviewCredits ?? 0,
        note: '1 interview start consumes 1 credit',
        icon: UserRoundSearch,
      },
    ],
    [loading, wallet],
  );

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
        name: 'MazeAI',
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
          color: '#059669',
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
      <section className="wallet-hero">
        <div>
          <div className="wallet-eyebrow">Wallet and Billing</div>
          <h1 className="wallet-title">Keep MazeAI credits ready for every assessment and interview run.</h1>
          <p className="wallet-subtitle">
            Monitor live credit balance, review payment activity, and recharge instantly from one premium billing dashboard.
          </p>
        </div>

        <div className="wallet-hero-meta">
          <div className="wallet-meta-chip">
            <CalendarClock size={16} />
            {wallet
              ? `Updated ${new Date(wallet.updatedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : 'Fetching wallet summary'}
          </div>
          <div className="wallet-meta-chip subtle">
            <Sparkles size={16} />
            Shared pricing from public catalog
          </div>
        </div>
      </section>

      {error && <div className="wallet-alert wallet-alert-error">{error}</div>}
      {message && <div className="wallet-alert wallet-alert-success">{message}</div>}

      <section className="wallet-overview-grid">
        {walletInsights.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="wallet-balance-card">
              <div className="wallet-balance-top">
                <span className="wallet-balance-icon">
                  <Icon size={18} />
                </span>
                <span className="wallet-balance-status">Active</span>
              </div>
              <div className="wallet-card-label">{item.label}</div>
              <div className="wallet-card-value">{item.value}</div>
              <div className="wallet-card-note">{item.note}</div>
            </article>
          );
        })}

        <article className="wallet-pricing-card">
          <div className="wallet-pricing-header">
            <div>
              <div className="wallet-panel-kicker">Current Pricing</div>
              <h2>Public credit catalog</h2>
            </div>
            <BadgeIndianRupee size={18} />
          </div>

          <div className="wallet-pricing-list">
            <div className="wallet-pricing-row">
              <span>Assessment credit</span>
              <strong>Rs. {pricing?.assessmentUnitPrice ?? '--'}</strong>
            </div>
            <div className="wallet-pricing-row">
              <span>Interview credit</span>
              <strong>Rs. {pricing?.interviewUnitPrice ?? '--'}</strong>
            </div>
          </div>

          <p className="wallet-pricing-footnote">
            Charges are fetched from the shared public pricing table so billing stays aligned across the platform.
          </p>
        </article>
      </section>

      <section className="wallet-main-grid">
        <article className="wallet-panel recharge-panel">
          <div className="wallet-panel-header">
            <div>
              <div className="wallet-panel-kicker">Recharge</div>
              <h2>Top up credits</h2>
              <p>Choose how many assessment and interview credits you want to add to this workspace.</p>
            </div>
            <span className="wallet-panel-icon">
              <CreditCard size={20} />
            </span>
          </div>

          <div className="wallet-form-grid">
            <label className="wallet-field">
              <span>Assessment credits</span>
              <input
                type="number"
                min={0}
                value={assessmentQuantity}
                onChange={(e) => setAssessmentQuantity(Math.max(0, Number(e.target.value || 0)))}
              />
              <small>{assessmentQuantity} x Rs. {pricing?.assessmentUnitPrice ?? '--'}</small>
            </label>

            <label className="wallet-field">
              <span>Interview credits</span>
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
              <span>{paying ? 'Preparing payment...' : 'Pay with Razorpay'}</span>
              {!paying && <ArrowUpRight size={16} />}
            </button>
          </div>
        </article>

        <article className="wallet-panel wallet-summary-panel">
          <div className="wallet-panel-header">
            <div>
              <div className="wallet-panel-kicker">Billing Notes</div>
              <h2>Credit usage rules</h2>
              <p>Keep these simple wallet rules in mind while planning candidate volume.</p>
            </div>
            <span className="wallet-panel-icon">
              <ReceiptText size={20} />
            </span>
          </div>

          <div className="wallet-usage-list">
            <div className="wallet-usage-item">
              <span className="wallet-usage-dot" />
              <div>
                <strong>Assessment links</strong>
                <p>Every assessment attempt consumes one assessment credit from the organisation wallet.</p>
              </div>
            </div>
            <div className="wallet-usage-item">
              <span className="wallet-usage-dot" />
              <div>
                <strong>Interview sessions</strong>
                <p>Each interview session start uses one interview credit once the candidate enters the live flow.</p>
              </div>
            </div>
            <div className="wallet-usage-item">
              <span className="wallet-usage-dot" />
              <div>
                <strong>Webhook confirmation</strong>
                <p>Credits appear after Razorpay confirms the payment through the backend webhook flow.</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="wallet-panel wallet-history">
        <div className="wallet-panel-header">
          <div>
            <div className="wallet-panel-kicker">Transactions</div>
            <h2>Payment history</h2>
            <p>Review every credit movement, recharge event, and debit reference in one place.</p>
          </div>
          <span className="wallet-panel-icon">
            <ReceiptText size={20} />
          </span>
        </div>

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
                  <td colSpan={6} className="wallet-empty">
                    No transactions yet.
                  </td>
                </tr>
              )}
              {transactions.map((item) => (
                <tr key={item.id}>
                  <td>
                    {new Date(item.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <span className={`wallet-badge ${item.type === 'CREDIT' ? 'credit' : 'debit'}`}>{item.type}</span>
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
