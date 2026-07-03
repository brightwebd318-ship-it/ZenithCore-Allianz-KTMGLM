import React, { useState, useEffect } from 'react';
import { User, Edit3, X, Save, ShieldAlert, Phone, MapPin, HeartPulse, Droplets } from 'lucide-react';

interface PatientProfileModalProps {
  patient: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: any) => Promise<void>;
}

export default function PatientProfileModal({ patient, isOpen, onClose, onSave }: PatientProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (patient) {
      setFormData(JSON.parse(JSON.stringify(patient)));
    }
  }, [patient]);

  if (!isOpen || !patient || !formData) return null;

  const handleSave = async () => {
    await onSave(formData);
    setIsEditing(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => {
      const copy = { ...prev };
      if (['abha_number', 'abha_address', 'gstin'].includes(field)) {
        copy[field] = value;
      } else if (['given', 'family'].includes(field)) {
        if (!copy.resource_fhir.name) copy.resource_fhir.name = [{ given: [''], family: '' }];
        if (field === 'given') copy.resource_fhir.name[0].given[0] = value;
        if (field === 'family') copy.resource_fhir.name[0].family = value;
      } else if (field === 'telecom_phone') {
        if (!copy.resource_fhir.telecom) copy.resource_fhir.telecom = [{ system: 'phone', value: '' }];
        copy.resource_fhir.telecom[0].value = value;
      } else if (field === 'telecom_email') {
        if (!copy.resource_fhir.telecom) copy.resource_fhir.telecom = [];
        const emailIndex = copy.resource_fhir.telecom.findIndex((t: any) => t.system === 'email');
        if (emailIndex >= 0) copy.resource_fhir.telecom[emailIndex].value = value;
        else copy.resource_fhir.telecom.push({ system: 'email', value });
      } else if (field === 'address') {
        if (!copy.resource_fhir.address) copy.resource_fhir.address = [{ text: '' }];
        copy.resource_fhir.address[0].text = value;
      } else if (field === 'contact_name') {
        if (!copy.resource_fhir.contact) copy.resource_fhir.contact = [{ name: { text: '' }, telecom: [{ value: '' }] }];
        copy.resource_fhir.contact[0].name.text = value;
      } else if (field === 'contact_phone') {
        if (!copy.resource_fhir.contact) copy.resource_fhir.contact = [{ name: { text: '' }, telecom: [{ value: '' }] }];
        if (!copy.resource_fhir.contact[0].telecom) copy.resource_fhir.contact[0].telecom = [{ value: '' }];
        copy.resource_fhir.contact[0].telecom[0].value = value;
      } else {
        copy.resource_fhir[field] = value;
      }
      return copy;
    });
  };

  const getValue = (field: string) => {
    const r = formData.resource_fhir || {};
    switch (field) {
      case 'given': return r.name?.[0]?.given?.[0] || '';
      case 'family': return r.name?.[0]?.family || '';
      case 'telecom_phone': return r.telecom?.find((t: any) => t.system === 'phone')?.value || '';
      case 'telecom_email': return r.telecom?.find((t: any) => t.system === 'email')?.value || '';
      case 'address': return r.address?.[0]?.text || '';
      case 'contact_name': return r.contact?.[0]?.name?.text || '';
      case 'contact_phone': return r.contact?.[0]?.telecom?.[0]?.value || '';
      case 'abha_number': return formData.abha_number || '';
      case 'abha_address': return formData.abha_address || '';
      case 'gstin': return formData.gstin || '';
      default: return r[field] || '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl dark:bg-slate-900 dark:border-slate-800 overflow-hidden animate-in fade-in">
        <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center">
            <User className="h-5 w-5 mr-2" /> Patient Profile
          </h3>
          <div className="flex space-x-2">
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="flex items-center text-white/90 hover:text-white bg-white/20 px-3 py-1.5 rounded text-sm font-bold transition-colors">
                <Edit3 className="h-4 w-4 mr-1.5" /> Edit
              </button>
            ) : (
              <button onClick={handleSave} className="flex items-center text-brand-600 hover:text-brand-700 bg-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors">
                <Save className="h-4 w-4 mr-1.5" /> Save
              </button>
            )}
            <button onClick={() => { setIsEditing(false); onClose(); }} className="text-white/80 hover:text-white text-sm font-bold ml-2">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="h-20 w-20 shrink-0 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-500 flex items-center justify-center font-bold text-3xl shadow-sm">
              {getValue('given')?.[0] || 'P'}
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">First Name</label>
                {isEditing ? <input type="text" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('given')} onChange={e => handleChange('given', e.target.value)} /> : <p className="font-bold text-slate-800 dark:text-slate-200">{getValue('given')}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Last Name</label>
                {isEditing ? <input type="text" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('family')} onChange={e => handleChange('family', e.target.value)} /> : <p className="font-bold text-slate-800 dark:text-slate-200">{getValue('family')}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date of Birth</label>
                {isEditing ? <input type="date" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('birthDate')} onChange={e => handleChange('birthDate', e.target.value)} /> : <p className="font-medium text-slate-800 dark:text-slate-200">{getValue('birthDate')}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gender</label>
                {isEditing ? (
                  <select className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('gender')} onChange={e => handleChange('gender', e.target.value)}>
                    <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                ) : <p className="font-medium text-slate-800 dark:text-slate-200 capitalize">{getValue('gender')}</p>}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center border-b border-slate-100 dark:border-slate-700 pb-2">
              <MapPin className="h-4 w-4 mr-1.5 text-slate-400" /> Contact Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Phone Number</label>
                {isEditing ? <input type="text" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('telecom_phone')} onChange={e => handleChange('telecom_phone', e.target.value)} /> : <p className="text-sm font-medium dark:text-slate-200">{getValue('telecom_phone') || '-'}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email</label>
                {isEditing ? <input type="email" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('telecom_email')} onChange={e => handleChange('telecom_email', e.target.value)} /> : <p className="text-sm font-medium dark:text-slate-200">{getValue('telecom_email') || '-'}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Residential Address</label>
                {isEditing ? <textarea rows={2} className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('address')} onChange={e => handleChange('address', e.target.value)} /> : <p className="text-sm font-medium dark:text-slate-200">{getValue('address') || '-'}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Guardian Name</label>
                {isEditing ? <input type="text" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('contact_name')} onChange={e => handleChange('contact_name', e.target.value)} /> : <p className="text-sm font-medium dark:text-slate-200">{getValue('contact_name') || '-'}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Guardian Phone</label>
                {isEditing ? <input type="text" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('contact_phone')} onChange={e => handleChange('contact_phone', e.target.value)} /> : <p className="text-sm font-medium dark:text-slate-200">{getValue('contact_phone') || '-'}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-sm text-rose-800 dark:text-rose-400 flex items-center border-b border-rose-200/50 dark:border-rose-900/50 pb-2">
                <HeartPulse className="h-4 w-4 mr-1.5" /> Clinical Baseline
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-rose-600/70 dark:text-rose-400/70 uppercase mb-1">Blood Group</label>
                  {isEditing ? <input type="text" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('bloodGroup')} onChange={e => handleChange('bloodGroup', e.target.value)} /> : <p className="font-bold text-rose-900 dark:text-rose-300">{getValue('bloodGroup') || '-'}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-rose-600/70 dark:text-rose-400/70 uppercase mb-1">Allergies</label>
                  {isEditing ? <textarea rows={2} className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('allergies')} onChange={e => handleChange('allergies', e.target.value)} /> : <p className="text-sm font-medium text-rose-900 dark:text-rose-300">{getValue('allergies') || 'None reported'}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-rose-600/70 dark:text-rose-400/70 uppercase mb-1">Medical History</label>
                  {isEditing ? <textarea rows={2} className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('medicalHistory')} onChange={e => handleChange('medicalHistory', e.target.value)} /> : <p className="text-sm font-medium text-rose-900 dark:text-rose-300">{getValue('medicalHistory') || 'None reported'}</p>}
                </div>
              </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                <ShieldAlert className="h-4 w-4 mr-1.5 text-slate-400" /> ABHA & IDs
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">14-Digit ABHA Number</label>
                  {isEditing ? <input type="text" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('abha_number')} onChange={e => handleChange('abha_number', e.target.value)} /> : <p className="font-mono font-bold text-slate-700 dark:text-slate-300">{getValue('abha_number') || '-'}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">ABHA Address String</label>
                  {isEditing ? <input type="text" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('abha_address')} onChange={e => handleChange('abha_address', e.target.value)} /> : <p className="font-mono font-medium text-slate-700 dark:text-slate-300">{getValue('abha_address') || '-'}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">GSTIN</label>
                  {isEditing ? <input type="text" className="w-full rounded border px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700" value={getValue('gstin')} onChange={e => handleChange('gstin', e.target.value)} /> : <p className="font-mono font-medium text-slate-700 dark:text-slate-300">{getValue('gstin') || '-'}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
