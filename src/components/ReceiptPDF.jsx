import React from 'react';
import { Printer, X, GraduationCap, CheckCircle } from 'lucide-react';

export default function ReceiptPDF({ receiptData, onClose }) {
  if (!receiptData) return null;

  const { studentName, standard, amount, paymentMode, paymentDate, id } = receiptData;
  const invoiceNumber = `BB-${id.substring(0, 8).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '650px', background: '#ffffff', color: '#1e293b' }}>
        
        {/* Actions bar (hidden during print) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1.5rem', background: '#0a0e17', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)', color: '#fff' }} className="no-print">
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} className="text-success" /> Invoice Generated
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handlePrint} style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
              <Printer size={16} /> Print Receipt
            </button>
            <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', color: '#fff', borderColor: '#202b3d' }}>
              <X size={16} /> Close
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper */}
        <div className="receipt-print" style={{ padding: '2.5rem', fontFamily: "'Inter', sans-serif" }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1' }}>
                <GraduationCap size={32} />
                <span style={{ fontSize: '1.75rem', fontWeight: '800', tracking: '-0.02em', color: '#0f172a' }}>BrainBridge</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem', lineHeight: '1.4' }}>
                102, Silver Arcade, Vijay Nagar<br />
                Indore, MP - 452010<br />
                Email: support@brainbridge.com | Tel: +91 98765 43210
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' }}>Receipt</h2>
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                <div><strong>Invoice No:</strong> {invoiceNumber}</div>
                <div><strong>Payment Date:</strong> {paymentDate}</div>
              </div>
            </div>
          </div>

          {/* Student Billing info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', margin: '2rem 0' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Billed To</span>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>{studentName}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                Class: {standard} Standard<br />
                Tuition Roll ID: Student-{id.substring(0, 4)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Payment Info</span>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                <div><strong>Method:</strong> {paymentMode}</div>
                <div><strong>Status:</strong> <span style={{ color: '#10b981', fontWeight: '700' }}>PAID</span></div>
                <div><strong>Received Date:</strong> {paymentDate}</div>
              </div>
            </div>
          </div>

          {/* Details Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: '0.85rem', textAlign: 'left' }}>Item Description</th>
                <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: '0.85rem', textAlign: 'right', width: '150px' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem', color: '#334155' }}>
                  <strong>Monthly Tuition Fees</strong><br />
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Fees for the current billing cycle</span>
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem', color: '#0f172a', textAlign: 'right', fontWeight: '600' }}>
                  ₹{amount}.00
                </td>
              </tr>
              <tr style={{ background: '#f8fafc' }}>
                <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: '700', color: '#334155' }}>Total Paid:</td>
                <td style={{ padding: '1rem', textAlign: 'right', fontSize: '1.1rem', fontWeight: '800', color: '#6366f1' }}>₹{amount}.00</td>
              </tr>
            </tbody>
          </table>

          {/* Footer note */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '3rem', borderTop: '1px dashed #e2e8f0', paddingTop: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: '350px', lineHeight: '1.4' }}>
              * This is a computer-generated invoice and does not require a physical signature.<br />
              * Thank you for choosing BrainBridge Academy!
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '150px', height: '40px', borderBottom: '1px solid #cbd5e1', marginBottom: '0.25rem' }}></div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Authorized Signatory</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
