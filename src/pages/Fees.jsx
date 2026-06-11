import React, { useState, useEffect } from 'react';
import { dbService, formatDateDisplay, sendWhatsAppMessage } from '../database/dbService';
import ReceiptPDF from '../components/ReceiptPDF';
import { IndianRupee, FileText, Check, Plus, Search, HelpCircle, DollarSign, Calendar, MessageCircle } from 'lucide-react';

export default function Fees() {
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Receipts
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [selectedFeeRecord, setSelectedFeeRecord] = useState(null); // for payment collection
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentDateInput, setPaymentDateInput] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    async function loadFeeData() {
      try {
        const [feeList, studentList] = await Promise.all([
          dbService.getFees(),
          dbService.getStudents()
        ]);
        setFees(feeList);
        setStudents(studentList);
      } catch (err) {
        console.error("Failed to load fee lists:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFeeData();
  }, []);

  const getStudentDetails = (studentId) => {
    const student = students.find(s => s.id === studentId);
    return student ? { name: student.name, standard: student.standard } : { name: 'Unknown Student', standard: '-' };
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFeeRecord) return;

    try {
      setLoading(true);
      const updateData = {
        status: 'Paid',
        payment_date: paymentDateInput,
        payment_mode: paymentMode
      };
      
      const updatedRecord = await dbService.updateFeeStatus(selectedFeeRecord.id, updateData);
      
      // Update local fees state
      setFees(prev => prev.map(f => f.id === updatedRecord.id ? updatedRecord : f));
      setSelectedFeeRecord(null);
    } catch (err) {
      console.error("Failed to log payment:", err);
    } finally {
      setLoading(false);
    }
  };
  const handleOpenCollectModal = (record) => {
    setSelectedFeeRecord(record);
    setPaymentDateInput(new Date().toISOString().split('T')[0]);
  };
  const handleOpenReceipt = (feeRecord) => {
    const student = getStudentDetails(feeRecord.student_id);
    setActiveReceipt({
      id: feeRecord.id,
      studentName: student.name,
      standard: student.standard,
      amount: feeRecord.amount,
      paymentMode: feeRecord.payment_mode,
      paymentDate: formatDateDisplay(feeRecord.payment_date)
    });
  };

  // Calculations
  let totalCollected = 0;
  let totalPending = 0;
  fees.forEach(f => {
    if (f.status === 'Paid') totalCollected += f.amount;
    else totalPending += f.amount;
  });

  // Filtered List
  const filteredFees = fees.filter(f => {
    const student = getStudentDetails(f.student_id);
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fees Ledger</h1>
          <p className="page-subtitle">Track outstanding balances, log payments and issue official receipts.</p>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid-cols-4" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: '800px', marginBottom: '2.5rem' }}>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div>
            <span className="stat-label">Total Collections</span>
            <div className="stat-val" style={{ color: 'var(--success)' }}>₹{totalCollected}</div>
          </div>
          <div className="stat-icon-wrapper success">
            <IndianRupee size={24} />
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div>
            <span className="stat-label">Outstanding Balance</span>
            <div className="stat-val" style={{ color: 'var(--danger)' }}>₹{totalPending}</div>
          </div>
          <div className="stat-icon-wrapper warning">
            <IndianRupee size={24} />
          </div>
        </div>
      </div>

      {/* Filter Options */}
      <div className="filters-bar">
        <div className="search-input-wrapper" style={{ maxWidth: '350px' }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-control"
            placeholder="Search by student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className={`btn ${statusFilter === 'All' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('All')}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            All Ledger
          </button>
          <button 
            className={`btn ${statusFilter === 'Paid' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('Paid')}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            Paid
          </button>
          <button 
            className={`btn ${statusFilter === 'Pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('Pending')}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            Pending
          </button>
        </div>
      </div>

      {/* Fees Table */}
      {loading && fees.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading ledger information...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Standard</th>
                <th>Fee Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFees.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No fee records found.
                  </td>
                </tr>
              ) : (
                filteredFees.map(record => {
                  const student = getStudentDetails(record.student_id);
                  const isPaid = record.status === 'Paid';

                  return (
                    <tr key={record.id}>
                      <td data-label="Student Name" style={{ fontWeight: '600' }}>{student.name}</td>
                      <td data-label="Standard">{student.standard}</td>
                      <td data-label="Fee Amount" style={{ fontWeight: '700' }}>₹{record.amount}</td>
                      <td data-label="Due Date" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatDateDisplay(record.due_date)}</td>
                      <td data-label="Status">
                        <span className={`badge ${isPaid ? 'badge-success' : 'badge-danger'}`}>
                          {record.status}
                        </span>
                      </td>
                      <td data-label="Actions" style={{ textAlign: 'right' }}>
                        {isPaid ? (
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => handleOpenReceipt(record)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '0.35rem' }}
                          >
                            <FileText size={14} /> Receipt
                          </button>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => {
                                const studentInfo = students.find(s => s.id === record.student_id);
                                const parentMobile = studentInfo?.parent_mobile || studentInfo?.mobile || '';
                                const message = `Dear Parent, this is a reminder from BrainBridge Tuition that the outstanding fee of ₹${record.amount} for ${student.name} was due on ${formatDateDisplay(record.due_date)}. Please pay as soon as possible. Thank you.`;
                                sendWhatsAppMessage(parentMobile, message);
                              }}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '0.35rem', borderColor: '#25d366', color: '#25d366' }}
                              title="Send WhatsApp Reminder"
                            >
                              <MessageCircle size={14} /> Remind
                            </button>
                            <button 
                              className="btn btn-success" 
                              onClick={() => handleOpenCollectModal(record)}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '0.35rem' }}
                            >
                              <Check size={14} /> Collect
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Payment Modal */}
      {selectedFeeRecord && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Record Fee Payment</h3>
              <button className="modal-close" onClick={() => setSelectedFeeRecord(null)}>Close</button>
            </div>
            <form onSubmit={handleRecordPaymentSubmit}>
              <div className="modal-body">
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Student Name</div>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem', marginTop: '0.15rem' }}>
                    {getStudentDetails(selectedFeeRecord.student_id).name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Due Date</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{formatDateDisplay(selectedFeeRecord.due_date)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Amount Due</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>₹{selectedFeeRecord.amount}</div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Received Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={paymentDateInput}
                    onChange={(e) => setPaymentDateInput(e.target.value)}
                    required
                    style={{ marginBottom: '1rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-control"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="UPI">UPI (GooglePay / PhonePe / Paytm)</option>
                    <option value="Cash">Cash Payment</option>
                    <option value="NetBanking">Net Banking / Card</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedFeeRecord(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Overlay */}
      {activeReceipt && (
        <ReceiptPDF 
          receiptData={activeReceipt} 
          onClose={() => setActiveReceipt(null)} 
        />
      )}
    </div>
  );
}
