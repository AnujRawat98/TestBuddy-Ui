import React, { useEffect, useState } from 'react';
import { platformApi } from '../../services/api';
import './PlatformDashboard.css';

type OrganisationBilling = {
  organisationId: string;
  organisationName: string;
  schemaName: string;
  defaultPlan: string;
  createdAt: string;
  assessmentCredits: number;
  interviewCredits: number;
  totalPayments: number;
  successfulPaymentAmount: number;
};

type PaymentHistory = {
  paymentId: string;
  amount: number;
  status: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  createdAt: string;
};

const PlatformDashboard: React.FC = () => {
  const [organisations, setOrganisations] = useState<OrganisationBilling[]>([]);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [selectedOrganisationId, setSelectedOrganisationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      setLoading(true);
      try {
        const response = await platformApi.getOrganisations();
        const rows = Array.isArray(response.data) ? response.data : [];
        setOrganisations(rows);
        if (rows.length > 0) {
          setSelectedOrganisationId(rows[0].organisationId);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Unable to load organisation billing data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!selectedOrganisationId) {
      setPayments([]);
      return;
    }

    const loadPayments = async () => {
      setPaymentsLoading(true);
      try {
        const response = await platformApi.getPayments(selectedOrganisationId);
        setPayments(Array.isArray(response.data) ? response.data : []);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Unable to load payment history.');
      } finally {
        setPaymentsLoading(false);
      }
    };

    loadPayments();
  }, [selectedOrganisationId]);

  const selectedOrganisation = organisations.find((item) => item.organisationId === selectedOrganisationId) ?? null;

  return (
    <div className="platform-page">
      <div className="platform-header">
        <div>
          <div className="platform-eyebrow">Platform Admin</div>
          <h1 className="platform-title">Organisation Billing Console</h1>
          <p className="platform-subtitle">Track wallet balances and payment activity across all organisations.</p>
        </div>
      </div>

      {error && <div className="platform-alert">{error}</div>}

      <section className="platform-panel">
        <div className="platform-panel-title">Organisations</div>
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Schema</th>
                <th>Plan</th>
                <th>Assessment Credits</th>
                <th>Interview Credits</th>
                <th>Payments</th>
                <th>Successful Revenue</th>
              </tr>
            </thead>
            <tbody>
              {!loading && organisations.length === 0 && (
                <tr>
                  <td colSpan={7} className="platform-empty">No organisations found.</td>
                </tr>
              )}
              {organisations.map((item) => (
                <tr
                  key={item.organisationId}
                  className={item.organisationId === selectedOrganisationId ? 'selected' : ''}
                  onClick={() => setSelectedOrganisationId(item.organisationId)}
                >
                  <td>
                    <div className="platform-org-name">{item.organisationName}</div>
                    <div className="platform-org-date">Created {new Date(item.createdAt).toLocaleDateString('en-US')}</div>
                  </td>
                  <td>{item.schemaName}</td>
                  <td>{item.defaultPlan}</td>
                  <td>{item.assessmentCredits}</td>
                  <td>{item.interviewCredits}</td>
                  <td>{item.totalPayments}</td>
                  <td>Rs. {item.successfulPaymentAmount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="platform-panel">
        <div className="platform-panel-title">
          {selectedOrganisation ? `${selectedOrganisation.organisationName} Payment History` : 'Payment History'}
        </div>
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Order Id</th>
                <th>Payment Id</th>
              </tr>
            </thead>
            <tbody>
              {!paymentsLoading && payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="platform-empty">No payment records for this organisation.</td>
                </tr>
              )}
              {payments.map((item) => (
                <tr key={item.paymentId}>
                  <td>{new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td>{item.status}</td>
                  <td>Rs. {item.amount}</td>
                  <td>{item.razorpayOrderId}</td>
                  <td>{item.razorpayPaymentId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PlatformDashboard;
