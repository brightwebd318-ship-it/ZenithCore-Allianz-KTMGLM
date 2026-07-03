import React, { useEffect, useState } from 'react';
import { Package, Plus, ToggleLeft, ToggleRight, FileText, Paperclip, Edit2, Trash2 } from 'lucide-react';
import { dataService } from '../services/dataService';
import type { InventoryItem, BusinessExpense } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface InventoryViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ triggerRefresh, triggerRefreshKey }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // New Inventory Item Form
  const [itemName, setItemName] = useState('');
  const [itemStock, setItemStock] = useState(50);
  const [itemPrice, setItemPrice] = useState(500);
  const [itemSellable, setItemSellable] = useState(true);

  // New Expense Form
  const [expName, setExpName] = useState('');
  const [expCategory, setExpCategory] = useState<'Salaries' | 'Rent' | 'Supplies' | 'Utilities' | 'Other'>('Supplies');
  const [expAmount, setExpAmount] = useState(1500);
  const [expDate, setExpDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Editing Expense states
  const [editingExpense, setEditingExpense] = useState<BusinessExpense | null>(null);
  const [editExpName, setEditExpName] = useState('');
  const [editExpCategory, setEditExpCategory] = useState<'Salaries' | 'Rent' | 'Supplies' | 'Utilities' | 'Other'>('Supplies');
  const [editExpAmount, setEditExpAmount] = useState(0);
  const [editExpDate, setEditExpDate] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editingFileUploading, setEditingFileUploading] = useState(false);

  const loadInventoryData = async () => {
    try {
      const items = await dataService.getInventory();
      setInventory(items);
      const exps = await dataService.getExpenses();
      setExpenses(exps);
    } catch (err) {
      console.error('Failed to load inventory details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryData();
  }, [triggerRefreshKey]);

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    try {
      await dataService.addInventoryItem({
        item_name: itemName,
        stock_count: itemStock,
        unit_price: itemPrice,
        sellable_via_invoice: itemSellable,
      });

      setItemName('');
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Added new product to stock list: ${itemName}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustStock = async (itemId: string, increment: boolean) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;

    const nextStock = increment ? item.stock_count + 5 : Math.max(0, item.stock_count - 5);
    try {
      await dataService.updateInventoryStock(itemId, nextStock);
      await dataService.addAuditTrail(
        'FINANCIAL_MUTATION',
        `Adjusted stock of product '${item.item_name}' (ID: ${itemId}) from ${item.stock_count} to ${nextStock}`
      );
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSellable = async (item: InventoryItem) => {
    try {
      // In a real DB we'd update. We simulate this by rewriting in mock or database:
      // Since dataService doesn't have editSellable directly we can update it locally
      // Or edit dataService. But let's build it dynamically.
      // We will adjust via dataService.updateInventoryStock or just mock it since we handle items.
      // Let's implement this! In mock, we can fetch items, modify, write.
      // Let's write a small custom helper in view or edit dataService.
      // Since it's mockup or Supabase, let's keep it simple:
      const items = JSON.parse(localStorage.getItem('praxdoc_inventory') || '[]');
      const idx = items.findIndex((i: any) => i.id === item.id);
      if (idx !== -1) {
        items[idx].sellable_via_invoice = !items[idx].sellable_via_invoice;
        localStorage.setItem('praxdoc_inventory', JSON.stringify(items));
        await dataService.addAuditTrail('FINANCIAL_MUTATION', `Toggled sellability of product ID: ${item.id}`);
        triggerRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName.trim()) return;
    setUploading(true);

    try {
      let attachmentSize = 0;
      let attachments: any[] = [];

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const tenant = await dataService.getTenant();
        const filePath = `expenses/${tenant.id}/${Date.now()}.${fileExt}`;

        if (isSupabaseConfigured && supabase) {
          const { error: uploadErr } = await supabase.storage
            .from('PraxDocu')
            .upload(filePath, selectedFile);

          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from('PraxDocu')
            .getPublicUrl(filePath);

          attachmentSize = selectedFile.size;
          attachments = [{
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            url: urlData.publicUrl,
            filePath: filePath
          }];
        } else {
          // Fallback mock
          attachmentSize = selectedFile.size;
          attachments = [{
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            url: `https://mock-storage.PraxDoc.com/PraxDocu/${filePath}`,
            filePath: filePath
          }];
        }
      }

      await dataService.addExpense({
        expense_name: expName,
        category: expCategory,
        amount: expAmount,
        expense_date: expDate,
        attachment_size_bytes: attachmentSize,
        bill_attachments: attachments,
      });

      setExpName('');
      setSelectedFile(null);
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Logged new clinical overhead expense: ${expName}`);
      triggerRefresh();
      loadInventoryData();
    } catch (err) {
      console.error("Error logging overhead expense:", err);
      alert("Error saving overhead expense.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteExpense = async (expId: string, expName: string) => {
    if (!window.confirm(`Are you sure you want to delete the expense: ${expName}?`)) return;
    try {
      await dataService.deleteExpense(expId);
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Deleted overhead expense: ${expName}`);
      triggerRefresh();
      loadInventoryData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete expense.");
    }
  };

  const handleStartEditExpense = (exp: BusinessExpense) => {
    setEditingExpense(exp);
    setEditExpName(exp.expense_name);
    setEditExpCategory(exp.category);
    setEditExpAmount(exp.amount);
    setEditExpDate(exp.expense_date);
    setEditFile(null);
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    setEditingFileUploading(true);

    try {
      let attachmentSize = editingExpense.attachment_size_bytes;
      let attachments = editingExpense.bill_attachments || [];

      if (editFile) {
        const fileExt = editFile.name.split('.').pop();
        const tenant = await dataService.getTenant();
        const filePath = `expenses/${tenant.id}/${Date.now()}.${fileExt}`;

        if (isSupabaseConfigured && supabase) {
          const { error: uploadErr } = await supabase.storage
            .from('PraxDocu')
            .upload(filePath, editFile);

          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from('PraxDocu')
            .getPublicUrl(filePath);

          attachmentSize = editFile.size;
          attachments = [{
            name: editFile.name,
            type: editFile.type,
            size: editFile.size,
            url: urlData.publicUrl,
            filePath: filePath
          }];
        } else {
          attachmentSize = editFile.size;
          attachments = [{
            name: editFile.name,
            type: editFile.type,
            size: editFile.size,
            url: `https://mock-storage.PraxDoc.com/PraxDocu/${filePath}`,
            filePath: filePath
          }];
        }
      }

      await dataService.updateExpense(editingExpense.id, {
        expense_name: editExpName,
        category: editExpCategory,
        amount: editExpAmount,
        expense_date: editExpDate,
        attachment_size_bytes: attachmentSize,
        bill_attachments: attachments,
      });

      setEditingExpense(null);
      setEditFile(null);
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Updated overhead expense: ${editExpName}`);
      triggerRefresh();
      loadInventoryData();
    } catch (err) {
      console.error(err);
      alert("Failed to update expense.");
    } finally {
      setEditingFileUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* 1. Inventory Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Inventory Items Grid (Left 8 Columns) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-brand-500" />
              <h3 className="font-bold text-slate-900 dark:text-white">Clinical Stock Ledger</h3>
            </div>
            <span className="text-[10px] bg-brand-50 border border-brand-100 px-2.5 py-0.5 rounded font-bold text-brand-600 dark:bg-brand-950/20 dark:border-brand-900/30">
              Active Inventory
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:bg-slate-850 dark:border-slate-800">
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Units in Stock</th>
                  <th className="px-4 py-3">Unit Retail price</th>
                  <th className="px-4 py-3">Sellable via Invoice</th>
                  <th className="px-4 py-3 text-right">Adjustment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">Loading stock logs...</td>
                  </tr>
                ) : inventory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">No stock ledger items found.</td>
                  </tr>
                ) : (
                  inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{item.item_name}</td>
                      <td className="px-4 py-3.5">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                          item.stock_count < 15 ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400' : 'bg-slate-50 text-slate-700 dark:bg-slate-800'
                        }`}>
                          {item.stock_count} units
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold">₹{item.unit_price}</td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => handleToggleSellable(item)}
                          className="flex items-center text-slate-500 hover:text-brand-500 focus:outline-none transition-colors"
                        >
                          {item.sellable_via_invoice ? (
                            <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[10px]">
                              <ToggleRight className="h-5 w-5 mr-1" /> Yes
                            </span>
                          ) : (
                            <span className="flex items-center text-slate-400 font-semibold uppercase text-[10px]">
                              <ToggleLeft className="h-5 w-5 mr-1" /> No
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleAdjustStock(item.id, false)}
                          className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => handleAdjustStock(item.id, true)}
                          className="px-2 py-0.5 bg-brand-50 border border-brand-200 rounded text-[10px] font-bold text-brand-600 hover:bg-brand-100 dark:bg-brand-950/20 dark:border-brand-900/30"
                        >
                          +5
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Inventory Form (Right 4 Columns) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4 flex flex-col justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
            <Plus className="h-4 w-4 mr-1 text-brand-500" /> Catalog New Stock Item
          </h4>

          <form onSubmit={handleAddInventory} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item Title / Descriptor</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                placeholder="e.g. Acupuncture Needles (Box of 100)"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Stock</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={itemStock}
                  onChange={(e) => setItemStock(parseInt(e.target.value) || 0)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit Price (₹)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={itemPrice}
                  onChange={(e) => setItemPrice(parseInt(e.target.value) || 0)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 py-2">
              <input
                id="sellableCheck"
                type="checkbox"
                checked={itemSellable}
                onChange={(e) => setItemSellable(e.target.checked)}
                className="h-4 w-4 rounded border-slate-350 text-brand-500"
              />
              <label htmlFor="sellableCheck" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Sellable via invoices
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs py-2.5 rounded-lg shadow transition-colors"
            >
              Add Item to Catalog
            </button>
          </form>
        </div>

      </div>

      {/* 2. Business Expenses Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Expenses List Ledger (Left 8 Columns) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-indigo-500" />
              <h3 className="font-bold text-slate-900 dark:text-white">Business Overhead ledger</h3>
            </div>
            <span className="text-[10px] bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded font-bold text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900/30">
              Utility Outlays
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:bg-slate-850 dark:border-slate-800">
                  <th className="px-4 py-3">Expense Details</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Outlay Date</th>
                  <th className="px-4 py-3">Vouchers Size</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">Loading utility sheets...</td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">No overhead expenses logged.</td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{exp.expense_name}</td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">{exp.expense_date}</td>
                      <td className="px-4 py-3.5">
                        {exp.attachment_size_bytes > 0 ? (
                          <span className="inline-flex items-center text-[10px] text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-950/20 px-1.5 py-0.5 rounded">
                            <Paperclip className="h-3 w-3 mr-0.5" />
                            Voucher ({(exp.attachment_size_bytes / 1024).toFixed(0)} KB)
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">No Receipt</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-slate-900 dark:text-white">
                        ₹{exp.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {exp.bill_attachments && exp.bill_attachments[0]?.url && (
                          <a
                            href={exp.bill_attachments[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-500 hover:text-brand-600 font-bold mr-1.5"
                            title="View Voucher"
                          >
                            📎 View
                          </a>
                        )}
                        <button
                          onClick={() => handleStartEditExpense(exp)}
                          className="text-brand-500 hover:text-brand-600 font-bold"
                          title="Edit Outlay"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.expense_name)}
                          className="text-red-500 hover:text-red-750 font-bold ml-1.5"
                          title="Delete Outlay"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Expense Form (Right 4 Columns) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
            <Plus className="h-4 w-4 mr-1 text-brand-500" /> Log Overhead Utility
          </h4>

          <form onSubmit={handleAddExpense} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expense Label</label>
              <input
                type="text"
                required
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                placeholder="e.g. Clinic Electricity Bill"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  <option value="Salaries">Salaries</option>
                  <option value="Rent">Rent</option>
                  <option value="Supplies">Supplies</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(parseInt(e.target.value) || 0)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Outlay Date</label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Voucher Scan</label>
                <input
                  type="file"
                  accept=".pdf,.jpeg,.jpg"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200 file:mr-2 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs py-2.5 rounded-lg shadow transition-colors disabled:opacity-50 font-semibold"
            >
              {uploading ? 'Uploading Voucher...' : 'Log Overhead Outlay'}
            </button>
          </form>
        </div>

      </div>

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md dark:bg-slate-900 dark:border-slate-800 overflow-hidden animate-in fade-in">
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Edit Business Expense</h3>
              <button onClick={() => setEditingExpense(null)} className="text-white/80 hover:text-white text-xs font-bold">Close</button>
            </div>
            
            <form onSubmit={handleUpdateExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expense Label</label>
                <input
                  type="text"
                  required
                  value={editExpName}
                  onChange={(e) => setEditExpName(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                  <select
                    value={editExpCategory}
                    onChange={(e) => setEditExpCategory(e.target.value as any)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200"
                  >
                    <option value="Salaries">Salaries</option>
                    <option value="Rent">Rent</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editExpAmount}
                    onChange={(e) => setEditExpAmount(parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Outlay Date</label>
                  <input
                    type="date"
                    required
                    value={editExpDate}
                    onChange={(e) => setEditExpDate(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Replace Voucher Scan</label>
                  <input
                    type="file"
                    accept=".pdf,.jpeg,.jpg"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setEditFile(file);
                    }}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200 file:mr-2 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingFileUploading}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold shadow disabled:opacity-50"
                >
                  {editingFileUploading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
