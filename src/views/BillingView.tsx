import React, { useEffect, useState } from 'react';
import { CreditCard, Eye, Plus, FileText, UserCheck } from 'lucide-react';
import { dataService } from '../services/dataService';
import type { Invoice, Patient, User as StaffUser, InventoryItem } from '../services/dataService';

interface BillingViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
}

export const BillingView: React.FC<BillingViewProps> = ({ triggerRefresh, triggerRefreshKey }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [sessionsCount, setSessionsCount] = useState(1);
  const [ratePerSession, setRatePerSession] = useState(1200);

  // Custom manual entries state
  const [customItems, setCustomItems] = useState<Array<{ id: string; name: string; quantity: number; rate: number }>>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemRate, setNewItemRate] = useState(0);
  const [newItemQty, setNewItemQty] = useState(1);

  // Inventory suggestions state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState('custom');

  // Selected patient metadata (to show real-time GST status)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);



  // Modals
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [printableInvoice, setPrintableInvoice] = useState<Invoice | null>(null);

  const loadBillingData = async () => {
    try {
      const invs = await dataService.getInvoices();
      setInvoices(invs);
      
      const pts = await dataService.getPatients();
      setPatients(pts);
      if (pts.length > 0) {
        setSelectedPatientId(pts[0].id);
        setSelectedPatient(pts[0]);
      }

      const st = await dataService.getUsers();
      setStaff(st);
      if (st.length > 0) {
        setSelectedStaffId(st[0].id);
      }

      const invItems = await dataService.getInventory();
      setInventory(invItems);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [triggerRefreshKey]);

  // Update selected patient metadata dynamically
  useEffect(() => {
    if (selectedPatientId) {
      const p = patients.find((pat) => pat.id === selectedPatientId);
      setSelectedPatient(p || null);
    }
  }, [selectedPatientId, patients]);

  const handleAddCustomItem = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || newItemRate <= 0 || newItemQty <= 0) return;
    setCustomItems(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        name: newItemName.trim(),
        rate: newItemRate,
        quantity: newItemQty
      }
    ]);
    setNewItemName('');
    setNewItemRate(0);
    setNewItemQty(1);
    setSelectedInventoryId('custom');
  };

  const handleRemoveCustomItem = (id: string) => {
    setCustomItems(prev => prev.filter(item => item.id !== id));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedStaffId) return;

    try {
      const sessionsCost = sessionsCount * ratePerSession;
      const customCost = customItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
      const baseAmount = sessionsCost + customCost;
      const applyGst = selectedPatient ? selectedPatient.gst_enabled : false;

      const newInv = await dataService.addInvoice(
        selectedPatientId,
        sessionsCount,
        selectedStaffId,
        applyGst,
        baseAmount,
        customItems.map(item => ({ name: item.name, quantity: item.quantity, rate: item.rate }))
      );

      // Reset
      setCustomItems([]);
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Generated new invoice ledger trace for patient ID: ${selectedPatientId}`);
      
      // Open print overlay
      setPrintableInvoice(newInv);
      
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewInvoicePDF = async (invoice: Invoice) => {
    setPrintableInvoice(invoice);
    const patient = patients.find(p => p.id === invoice.patient_id);
    const patientName = patient ? `${patient.resource_fhir?.name?.[0]?.given?.[0]} ${patient.resource_fhir?.name?.[0]?.family}` : 'Unknown';
    await dataService.addAuditTrail('READ_PATIENT', `Viewed/Printed Invoice PDF (ID: ${invoice.resource_fhir?.identifier?.[0]?.value || invoice.id}) for Patient: ${patientName} (ID: ${invoice.patient_id})`);
  };

  const handleUpdateStatus = async (invId: string, status: Invoice['payment_status']) => {
    try {
      await dataService.updateInvoiceStatus(invId, status);
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Updated invoice ${invId} payment status to ${status}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };



  // Live Calculations for Preview card
  const sessionsCost = sessionsCount * ratePerSession;
  const customCost = customItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const basePreviewAmount = sessionsCost + customCost;
  const isGstActive = selectedPatient ? selectedPatient.gst_enabled : false;
  const cgstPreview = isGstActive ? basePreviewAmount * 0.09 : 0;
  const sgstPreview = isGstActive ? basePreviewAmount * 0.09 : 0;
  const totalPreviewAmount = basePreviewAmount + cgstPreview + sgstPreview;

  return (
    <div className="space-y-8">
      
      {/* Top Section: Form split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Invoice Generator (Full Width) */}
        <div className="lg:col-span-12 bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <CreditCard className="h-5 w-5 text-brand-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">Itemized Invoice Generator</h3>
          </div>

          <form onSubmit={handleCreateInvoice} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.resource_fhir?.name?.[0]?.given?.[0]} {p.resource_fhir?.name?.[0]?.family}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Billing Practitioner</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.position_role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Session Count</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={sessionsCount}
                    onChange={(e) => setSessionsCount(parseInt(e.target.value) || 1)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rate Per Session (₹)</label>
                  <input
                    type="number"
                    min={100}
                    value={ratePerSession}
                    onChange={(e) => setRatePerSession(parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Itemizer manual entries */}
              <div className="border-t border-slate-150 pt-3 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350">Add Manual Itemized Entries (Medicines, Supplies, Extra Services)</h4>
                
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Select Catalog Item or Type</label>
                    <select
                      value={selectedInventoryId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedInventoryId(val);
                        if (val === 'custom') {
                          setNewItemName('');
                          setNewItemRate(0);
                        } else {
                          const item = inventory.find(i => i.id === val);
                          if (item) {
                            setNewItemName(item.item_name);
                            setNewItemRate(item.unit_price);
                          }
                        }
                      }}
                      className="w-full rounded border border-slate-200 px-2 py-0.5 text-[11px] bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 mb-1"
                    >
                      <option value="custom">-- Custom/Manual Entry --</option>
                      {inventory.filter(i => i.sellable_via_invoice).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.item_name} (₹{item.unit_price})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Or enter custom item name here..."
                      value={newItemName}
                      onChange={(e) => {
                        setNewItemName(e.target.value);
                        setSelectedInventoryId('custom');
                      }}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Rate (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={newItemRate}
                      onChange={(e) => setNewItemRate(parseInt(e.target.value) || 0)}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      className="bg-brand-500 text-white p-1 rounded hover:bg-brand-600 shadow w-full flex items-center justify-center h-[28px]"
                      title="Add item"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* List of custom items */}
                {customItems.length > 0 && (
                  <div className="bg-slate-50 border border-slate-150 rounded-lg p-2 space-y-1 dark:bg-slate-800/40 dark:border-slate-800 text-[10px]">
                    {customItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-center bg-white border border-slate-200/50 p-1.5 rounded dark:bg-slate-900 dark:border-slate-800">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-250">{item.name}</span>
                          <span className="text-slate-400 ml-1.5 font-mono">({item.quantity} x ₹{item.rate})</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold font-mono text-slate-700 dark:text-slate-350">₹{(item.quantity * item.rate).toLocaleString('en-IN')}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomItem(item.id)}
                            className="text-red-500 hover:text-red-750 font-bold px-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Calculations display */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 dark:bg-slate-800/40 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Live Calculations summary</h4>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal ({sessionsCount} sessions {customItems.length > 0 ? `+ ${customItems.length} items` : ''})</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">₹{basePreviewAmount.toLocaleString('en-IN')}</span>
                  </div>

                  {isGstActive ? (
                    <div className="space-y-1 bg-emerald-50/50 p-2 rounded border border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/30">
                      <div className="flex justify-between text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold uppercase">
                        <span>Patient GST status:</span>
                        <span>Enabled (18% split)</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                        <span>CGST (9.0%):</span>
                        <span>₹{cgstPreview.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                        <span>SGST (9.0%):</span>
                        <span>₹{sgstPreview.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-slate-400 bg-slate-100 p-2 rounded dark:bg-slate-800/60 text-[10px] italic">
                      <span>GST split disabled (GST Status is off on Patient Ledger profile)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Amount</span>
                  <span className="text-xl font-extrabold text-brand-600 dark:text-brand-400 flex items-center">
                    <span className="text-sm text-slate-500 mr-0.5">₹</span>
                    {totalPreviewAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                
                <button
                  type="submit"
                  className="bg-brand-500 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-brand-600 shadow transition-colors flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" /> Generate Invoice
                </button>
              </div>

            </div>

          </form>
        </div>

      </div>

      {/* Invoice Ledger Table (Matching Layout in user mockup) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
          <FileText className="h-4 w-4 mr-2 text-brand-500" /> Invoice Ledger
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:bg-slate-850 dark:border-slate-800">
                <th className="px-4 py-3">Invoice ID</th>
                <th className="px-4 py-3">Patient Description</th>
                <th className="px-4 py-3">Tax Details</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 dark:divide-slate-800 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">Loading invoice items...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">No invoices generated yet.</td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const patient = patients.find((p) => p.id === invoice.patient_id);
                  const pName = patient ? `${patient.resource_fhir?.name?.[0]?.given?.[0]} ${patient.resource_fhir?.name?.[0]?.family}` : 'Unknown Patient';

                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-bold font-mono text-slate-900 dark:text-white">
                        {invoice.resource_fhir?.identifier?.[0]?.value || invoice.id}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold block">{pName}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{invoice.session_count_incremented} Session units</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px]">
                        {invoice.apply_gst ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            9% CGST + 9% SGST split (₹{invoice.computed_tax_amount.toLocaleString('en-IN')})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No tax split (GST Exempt)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        ₹{invoice.total_amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        {String(invoice.payment_status).toUpperCase() === 'PAID' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
                            PAID
                          </span>
                        )}
                        {String(invoice.payment_status).toUpperCase() === 'UNPAID' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400">
                            UNPAID
                          </span>
                        )}
                        {String(invoice.payment_status).toUpperCase() === 'PENDING' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-850 dark:bg-amber-950/20 dark:text-amber-400">
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5">
                        {String(invoice.payment_status).toUpperCase() !== 'PAID' && (
                          <button
                            onClick={() => handleUpdateStatus(invoice.id, 'PAID')}
                            className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded border border-emerald-100 dark:bg-emerald-950/10 dark:text-emerald-400 hover:bg-emerald-100"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          onClick={() => handleViewInvoicePDF(invoice)}
                          className="bg-brand-50 text-brand-600 text-[10px] font-bold px-2 py-1 rounded border border-brand-100 dark:bg-brand-950/20 dark:text-brand-400 hover:bg-brand-100 inline-flex items-center space-x-1"
                          title="View printable/downloadable receipt"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View Receipt</span>
                        </button>
                        <button
                          onClick={() => setViewInvoice(invoice)}
                          className="inline-flex items-center p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                          title="View raw JSON"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Invoice Receipt Overlay */}
      {printableInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-invoice-area, #printable-invoice-area * {
                visibility: visible !important;
              }
              #printable-invoice-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                color: black !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden dark:bg-slate-900 dark:border-slate-850 no-print">
            
            {/* Top Bar for Actions (Screen Only) */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-4 flex justify-between items-center dark:bg-slate-800 dark:border-slate-700">
              <span className="font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Receipt Document Viewer
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="bg-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-brand-600 transition-all flex items-center space-x-1 shadow-sm"
                >
                  <span>🖨️ Print / Save PDF</span>
                </button>
                <button
                  onClick={() => {
                    const patient = patients.find(p => p.id === printableInvoice.patient_id);
                    const pName = patient ? `${patient.resource_fhir?.name?.[0]?.given?.[0]} ${patient.resource_fhir?.name?.[0]?.family}` : 'Patient';
                    const practitioner = staff.find(s => s.id === printableInvoice.associated_practitioner_id)?.full_name || 'Practitioner';
                    
                    const receiptText = `
--------------------------------------------------
ZENITH CORE ALLIANCE RECEIPT
--------------------------------------------------
Invoice ID: ${printableInvoice.resource_fhir?.identifier?.[0]?.value || printableInvoice.id}
Date Generated: ${new Date(printableInvoice.created_at).toLocaleDateString('en-IN')}
Patient Name: ${pName}
Practitioner Name: ${practitioner}
--------------------------------------------------
LINE ITEMS:
${(printableInvoice.resource_fhir?.lineItem || []).map((item: any) => {
  const quantity = item.quantity || 1;
  const rate = item.priceComponent?.[0]?.amount?.value || 0;
  const total = quantity * rate;
  return `- ${item.description}: ${quantity} x ₹${rate} = ₹${total}`;
}).join('\n')}
--------------------------------------------------
Subtotal: ₹${printableInvoice.total_amount - printableInvoice.computed_tax_amount}
CGST (9%): ₹${printableInvoice.cgst_rate > 0 ? printableInvoice.computed_tax_amount / 2 : 0}
SGST (9%): ₹${printableInvoice.sgst_rate > 0 ? printableInvoice.computed_tax_amount / 2 : 0}
Grand Total: ₹${printableInvoice.total_amount}
Payment Status: ${String(printableInvoice.payment_status).toUpperCase()}
--------------------------------------------------
Thank you for choosing Zenith Core Alliance!
`;
                    const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `Invoice_${printableInvoice.resource_fhir?.identifier?.[0]?.value || printableInvoice.id}.txt`;
                    link.click();
                  }}
                  className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-emerald-700 transition-all flex items-center space-x-1 shadow-sm"
                >
                  <span>📥 Download Text Receipt</span>
                </button>
                <button
                  onClick={() => setPrintableInvoice(null)}
                  className="bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Document Content View */}
            <div className="p-8 max-h-[75vh] overflow-y-auto bg-white dark:bg-slate-900" id="printable-invoice-area">
              <div className="space-y-6">
                
                {/* Header branding */}
                <div className="flex justify-between items-center border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <img src="/logo.png" alt="Zenith Core Alliance" className="h-12 w-auto object-contain" />
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-outfit">
                        Zenith Core Alliance
                      </h2>
                      <p className="text-[10px] text-slate-450 uppercase tracking-widest font-bold">
                        Zenith Medical Alliance Workspace
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-3 py-1.5 rounded dark:bg-slate-800 dark:text-slate-200">
                      {printableInvoice.resource_fhir?.identifier?.[0]?.value || printableInvoice.id}
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-2 font-bold uppercase">
                      Date: {new Date(printableInvoice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Bill To & Bill From info */}
                <div className="grid grid-cols-2 gap-6 text-xs border-b border-slate-100 pb-4 dark:border-slate-800/60">
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Billed To (Patient)</h4>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {(() => {
                        const patient = patients.find(p => p.id === printableInvoice.patient_id);
                        return patient ? `${patient.resource_fhir?.name?.[0]?.given?.[0]} ${patient.resource_fhir?.name?.[0]?.family}` : 'Unknown Patient';
                      })()}
                    </p>
                    {(() => {
                      const patient = patients.find(p => p.id === printableInvoice.patient_id);
                      if (!patient) return null;
                      return (
                        <div className="text-slate-500 dark:text-slate-400 space-y-0.5 mt-1 font-mono text-[10px]">
                          {patient.abha_number && <p>ABHA No: {patient.abha_number}</p>}
                          {patient.abha_address && <p>ABHA Addr: {patient.abha_address}</p>}
                          {patient.gstin && <p>GSTIN: {patient.gstin}</p>}
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Billed From (Practitioner)</h4>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {staff.find(s => s.id === printableInvoice.associated_practitioner_id)?.full_name || 'Clinic Specialist'}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                      {staff.find(s => s.id === printableInvoice.associated_practitioner_id)?.position_role || 'Therapist'}
                    </p>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-2">
                  <h4 className="text-[10px] uppercase font-bold text-slate-400">Itemized Breakdown</h4>
                  <table className="w-full text-left border-collapse border border-slate-100 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 dark:bg-slate-850 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-4 py-2">Item Description</th>
                        <th className="px-4 py-2 text-right">Rate</th>
                        <th className="px-4 py-2 text-center">Qty</th>
                        <th className="px-4 py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {(printableInvoice.resource_fhir?.lineItem || [
                        {
                          description: 'Therapy Session Units',
                          quantity: printableInvoice.session_count_incremented,
                          priceComponent: [{ amount: { value: (printableInvoice.total_amount - printableInvoice.computed_tax_amount) / (printableInvoice.session_count_incremented || 1) } }]
                        }
                      ]).map((item: any, idx: number) => {
                        const quantity = item.quantity || 1;
                        const rate = item.priceComponent?.[0]?.amount?.value || 0;
                        const lineTotal = quantity * rate;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10">
                            <td className="px-4 py-2 text-slate-800 dark:text-slate-200 font-semibold">{item.description}</td>
                            <td className="px-4 py-2 text-right font-mono">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-center font-mono">{quantity}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Calculation Summary Footer block */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-850">
                  <div className="text-[10px] text-slate-450 italic flex items-end">
                    * All rates are listed in Indian Rupees (INR). Status is: {String(printableInvoice.payment_status).toUpperCase()}.
                  </div>
                  
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal:</span>
                      <span>₹{(printableInvoice.total_amount - printableInvoice.computed_tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {printableInvoice.apply_gst ? (
                      <div className="space-y-1 bg-emerald-50/30 p-2 rounded border border-emerald-100/40 dark:bg-emerald-950/5 dark:border-emerald-900/10">
                        <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                          <span>CGST (9.0%):</span>
                          <span>₹{(printableInvoice.computed_tax_amount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                          <span>SGST (9.0%):</span>
                          <span>₹{(printableInvoice.computed_tax_amount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between text-slate-400 text-[10px] italic">
                        <span>GST Exempt</span>
                        <span>₹0.00</span>
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>GRAND TOTAL:</span>
                      <span>₹{printableInvoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-450 dark:text-slate-500 border-t border-slate-100 pt-4 dark:border-slate-800/60 font-medium">
                  Thank you for choosing Zenith Core Alliance!
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* Raw JSON viewer Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-xl dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm font-mono">Ledger Node: {viewInvoice.id}</h3>
              <button onClick={() => setViewInvoice(null)} className="text-white/80 hover:text-white text-xs font-bold">Close</button>
            </div>
            <div className="p-6">
              <pre className="bg-slate-50 p-4 rounded-lg overflow-auto max-h-[60vh] text-left text-[11px] font-mono border border-slate-200 text-slate-800 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300">
                {JSON.stringify(viewInvoice, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
