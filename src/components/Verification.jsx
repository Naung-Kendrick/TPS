import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { exportHouseholdExcel, printHouseholdPdf } from '../lib/householdPrint';
import { Search, RotateCcw, AlertCircle, CheckCircle2, X, Loader2, Printer, FileSpreadsheet } from 'lucide-react';
import EmptyState from './EmptyState';

// Convert Myanmar numerals to Arabic and calculate age from DOB string (format: day.month.year)
const myanmarToArabic = (str) => {
  if (!str) return null;
  const map = { '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4', '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9' };
  return str.replace(/[၀၁၂၃၄၅၆၇၈၉]/g, ch => map[ch] || ch);
};

const getAge = (dobStr) => {
  if (!dobStr) return null;
  const converted = myanmarToArabic(dobStr.trim());
  const parts = converted.split(/[.\/\-]/);
  if (parts.length < 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  const dob = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

const Verification = () => {
  const [formData, setFormData] = useState({
    household_no: '',
    name: '',
    fathers_name: '',
    ward_village_group: '',
    township: '',
    district: ''
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  const [expandedHouseholdNo, setExpandedHouseholdNo] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [familyLoading, setFamilyLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleClear = () => {
    setFormData({
      household_no: '',
      name: '',
      fathers_name: '',
      ward_village_group: '',
      township: '',
      district: ''
    });
    setResults(null);
    setHasSearched(false);
    setExpandedHouseholdNo(null);
    setFamilyMembers([]);
    setVerifyError(null);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setHasSearched(true);
    setExpandedHouseholdNo(null);
    setFamilyMembers([]);
    
    const isAnyFieldFilled = Object.values(formData).some(val => val.trim() !== '');
    if (!isAnyFieldFilled) {
      setResults([]);
      return;
    }

    setLoading(true);
    setVerifyError(null);

    try {
      let query = supabase.from('households').select('*');

      if (formData.household_no.trim()) query = query.ilike('household_no', `%${formData.household_no.trim()}%`);
      if (formData.name.trim()) query = query.ilike('name', `%${formData.name.trim()}%`);
      if (formData.fathers_name.trim()) query = query.ilike('fathers_name', `%${formData.fathers_name.trim()}%`);
      if (formData.ward_village_group.trim()) query = query.ilike('ward_village_group', `%${formData.ward_village_group.trim()}%`);
      if (formData.township.trim()) query = query.ilike('township', `%${formData.township.trim()}%`);
      if (formData.district.trim()) query = query.ilike('district', `%${formData.district.trim()}%`);

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setResults(data || []);

    } catch (err) {
      console.error(err);
      const msg = err?.message || '';
      const isOffline = !navigator.onLine;
      setVerifyError({ message: msg, offline: isOffline });
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = exportHouseholdExcel;
  const handlePrintPdf = printHouseholdPdf;


  const handleViewFamily = async (householdNo) => {
    if (expandedHouseholdNo === householdNo) {
      setExpandedHouseholdNo(null);
      setFamilyMembers([]);
      return;
    }

    setExpandedHouseholdNo(householdNo);
    setFamilyLoading(true);

    try {
      const { data, error } = await supabase
        .from('households')
        .select('*')
        .eq('household_no', householdNo);

      if (error) throw error;

      const relationshipOrder = { '\u1026\u1038\u1005\u102E\u1038': 1, '\u1007\u1014\u102E\u1038': 2, '\u1001\u1004\u103A\u1015\u103D\u1014\u103A\u1038': 2, '\u101E\u102C\u1038': 3, '\u101E\u1019\u102E\u1038': 3 };
      const sortedData = [...(data || [])].sort((a, b) => {
        const orderA = relationshipOrder[a.household_relationship] || 99;
        const orderB = relationshipOrder[b.household_relationship] || 99;
        return orderA - orderB;
      });

      setFamilyMembers(sortedData);
    } catch (err) {
      console.error(err);
      alert('Error fetching family data: ' + err.message);
    } finally {
      setFamilyLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>
          DATA VERIFICATION
        </h2>
        <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>
          Strictly verify household members.
        </p>
      </div>

      {/* VERIFICATION FORM */}
      <div className="bg-white border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-2 uppercase letter-spacing-0.05">
            <Search size={14} className="text-gray-900" /> 
            Verification Parameters
          </h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleVerify}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 uppercase letter-spacing-0.02">Household No.</label>
                <input 
                  type="text" 
                  name="household_no" 
                  value={formData.household_no} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-none focus:outline-none focus:border-gray-900 transition-colors text-sm font-mono"
                  placeholder="e.g. HH-001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 uppercase letter-spacing-0.02">Name</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-none focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  placeholder="Enter name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 uppercase letter-spacing-0.02">Father's Name</label>
                <input 
                  type="text" 
                  name="fathers_name" 
                  value={formData.fathers_name} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-none focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  placeholder="Enter father's name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 uppercase letter-spacing-0.02">Ward / Village / Group</label>
                <input 
                  type="text" 
                  name="ward_village_group" 
                  value={formData.ward_village_group} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-none focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  placeholder="Enter village"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 uppercase letter-spacing-0.02">Township</label>
                <input 
                  type="text" 
                  name="township" 
                  value={formData.township} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-none focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  placeholder="Enter township"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 uppercase letter-spacing-0.02">District</label>
                <input 
                  type="text" 
                  name="district" 
                  value={formData.district} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-none focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  placeholder="Enter district"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                type="submit" 
                disabled={loading}
                className="flex items-center gap-2 bg-gray-900 hover:bg-white hover:text-gray-900 border border-transparent hover:border-gray-900 text-white px-5 py-2 rounded-none font-medium transition-colors text-xs uppercase letter-spacing-0.05 disabled:opacity-50"
              >
                {loading ? <RotateCcw size={14} className="animate-spin" /> : null}
                Verify Data
              </button>
              <button 
                type="button" 
                onClick={handleClear}
                disabled={loading}
                className="flex items-center gap-2 bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 px-5 py-2 rounded-none font-medium transition-colors text-xs uppercase letter-spacing-0.05 disabled:opacity-50"
              >
                Clear Filters
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Error state */}
      {verifyError && !loading && (
        <div className="border border-gray-200">
          <EmptyState
            type={verifyError.offline ? 'offline' : 'error'}
            message={verifyError.offline
              ? 'The device is offline. Reconnect and try again.'
              : 'Could not fetch records from the database.'}
            detail={verifyError.message}
            action={{ label: 'Retry', onClick: () => { setVerifyError(null); } }}
          />
        </div>
      )}

      {/* VERIFICATION RESULTS */}
      {hasSearched && !loading && results && !verifyError && (
        <div>
          {results.length === 0 ? (
            <div className="border border-gray-200">
              <EmptyState
                type="no-results"
                title="No Records Found"
                message="No household members match the search criteria. Check the spelling or try fewer filters."
                action={{ label: 'Clear Filters', onClick: handleClear }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} className="text-gray-900" />
                <h3 className="font-semibold text-gray-900 text-sm uppercase">Verification Successful: {results.length} Match(es) Found</h3>
              </div>
              
              <div className="border border-gray-200 overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">No.</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Household No.</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Name</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Date of Birth</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Gender</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Father's Name</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Mother's Name</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Relationship</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Occupation</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Previous ID</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Ta'ang ID</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Nationality</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Resident Status</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Religious</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">House NO.</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Ward / Village</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Township</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">District</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05">Submission Date</th>
                        <th className="px-4 py-3 text-gray-600 font-semibold uppercase letter-spacing-0.05 text-center sticky right-0 bg-gray-50 border-l border-gray-200">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((person, index) => (
                        <React.Fragment key={person.id}>
                          <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${expandedHouseholdNo === person.household_no ? 'bg-gray-50' : ''}`}>
                            <td className="px-4 py-3 text-gray-500 font-mono">{index + 1}</td>
                            <td className="px-4 py-3 font-semibold text-gray-900 font-mono">{person.household_no}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{person.name}</td>
                            <td className="px-4 py-3 text-gray-700 font-mono">{person.date_of_birth || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.gender || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.fathers_name || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.mothers_name || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.household_relationship || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.occupation || '-'}</td>
                            <td className="px-4 py-3 text-gray-700 font-mono">{person.previous_id_no || '-'}</td>
                            <td className="px-4 py-3 text-gray-700 font-mono">{person.taang_land_id_no || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.nationality || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.resident_status || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.religious || '-'}</td>
                            <td className="px-4 py-3 text-gray-700 font-mono">{person.house_no || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.ward_village_group || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.township || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.district || '-'}</td>
                            <td className="px-4 py-3 text-gray-700 font-mono">{person.submission_date || person.created_at?.split('T')[0] || '-'}</td>
                            <td className="px-4 py-3 text-center sticky right-0 bg-white border-l border-gray-200">
                              <button
                                onClick={() => handleViewFamily(person.household_no)}
                                className={`inline-flex items-center gap-1 px-3 py-1 border text-xs font-medium transition-all ${
                                  expandedHouseholdNo === person.household_no
                                    ? 'bg-gray-900 text-white border-transparent'
                                    : 'bg-white text-gray-900 border-gray-900 hover:bg-gray-50'
                                }`}
                              >
                                {expandedHouseholdNo === person.household_no ? 'CLOSE' : 'VIEW FAMILY'}
                              </button>
                            </td>
                          </tr>
                          
                          {/* INLINE FAMILY ROSTER PANEL */}
                          {expandedHouseholdNo === person.household_no && (
                            <tr>
                              <td colSpan="20" className="p-0 bg-gray-50 border-b border-gray-200">
                                <div className="p-6">
                                  <div className="bg-white border border-gray-200">
                                    <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
                                      <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-xs uppercase letter-spacing-0.05">
                                        Family Roster - Household: {expandedHouseholdNo}
                                      </h3>
                                      <button
                                        onClick={() => { setExpandedHouseholdNo(null); setFamilyMembers([]); }}
                                        className="text-gray-500 hover:text-gray-900 transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>

                                    {familyLoading ? (
                                      <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                                        <Loader2 className="animate-spin text-gray-900" size={24} />
                                        <span className="font-medium text-xs">Loading family members...</span>
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        {familyMembers.length === 0 ? (
                                          <div className="text-center text-gray-500 py-8 text-xs">No family members found for this household.</div>
                                        ) : (
                                          <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                                            <thead>
                                              <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">No.</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Household No.</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Name</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Date of Birth</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Gender</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Father's Name</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Mother's Name</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Relationship</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Occupation</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Previous ID</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Ta'ang ID</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Nationality</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Resident Status</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Religious</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">House NO.</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Ward / Village</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Township</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">District</th>
                                                <th className="px-4 py-2.5 text-gray-600 font-semibold uppercase letter-spacing-0.05">Submission Date</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {familyMembers.map((member, i) => (
                                                <tr 
                                                  key={member.id} 
                                                  className={`border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                                                    member.household_relationship === '\u1026\u1038\u1005\u102E\u1038' ? 'bg-gray-50' : ''
                                                  }`}
                                                >
                                                  <td className="px-4 py-2.5 text-gray-500 font-mono">{i + 1}</td>
                                                  <td className="px-4 py-2.5 font-semibold text-gray-900 font-mono">{member.household_no}</td>
                                                  <td className="px-4 py-2.5 font-medium text-gray-900">
                                                    {member.name}
                                                    {member.household_relationship === '\u1026\u1038\u1005\u102E\u1038' && (
                                                      <span className="ml-2 border border-gray-900 text-gray-900 px-1 py-0.5 text-[9px] font-bold uppercase">HEAD</span>
                                                    )}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-gray-700 font-mono">{member.date_of_birth || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.gender || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.fathers_name || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.mothers_name || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700 font-medium">{member.household_relationship || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.occupation || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700 font-mono">{member.previous_id_no || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700 font-mono">{member.taang_land_id_no || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.nationality || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.resident_status || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.religious || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700 font-mono">{member.house_no || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.ward_village_group || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.township || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.district || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700 font-mono">{member.submission_date || member.created_at?.split('T')[0] || '-'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                        {familyMembers.length > 0 && (
                                          <>
                                            <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 font-medium flex flex-wrap items-center gap-x-5 gap-y-1 font-mono">
                                              <span>Total Members: {familyMembers.length}</span>
                                              <span>|</span>
                                              <span>Male: {familyMembers.filter(m => m.gender && (m.gender.includes('\u1000\u103B\u102C\u1038') || m.gender.trim() === '\u1000')).length}</span>
                                              <span>Female: {familyMembers.filter(m => m.gender && !(m.gender.includes('\u1000\u103B\u102C\u1038') || m.gender.trim() === '\u1000')).length}</span>
                                              <span>|</span>
                                              <span>Under 16: {familyMembers.filter(m => { const age = getAge(m.date_of_birth); return age !== null && age < 16; }).length}</span>
                                              <span>16 - 60: {familyMembers.filter(m => { const age = getAge(m.date_of_birth); return age !== null && age >= 16 && age <= 60; }).length}</span>
                                              <span>Above 60: {familyMembers.filter(m => { const age = getAge(m.date_of_birth); return age !== null && age > 60; }).length}</span>
                                            </div>
                                            <div className="px-6 py-3 bg-white border-t border-gray-200 flex flex-wrap items-center justify-end gap-3">
                                              <span className="text-[11px] text-gray-500 uppercase letter-spacing-0.05 mr-auto">Print / Export Household Registration</span>
                                              <button
                                                type="button"
                                                onClick={() => handlePrintPdf(expandedHouseholdNo, familyMembers)}
                                                className="flex items-center gap-2 bg-gray-900 hover:bg-white hover:text-gray-900 border border-gray-900 text-white px-4 py-2 rounded-none font-medium transition-colors text-xs uppercase letter-spacing-0.05"
                                              >
                                                <Printer size={14} />
                                                Print PDF
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleExportExcel(expandedHouseholdNo, familyMembers)}
                                                className="flex items-center gap-2 bg-white border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white px-4 py-2 rounded-none font-medium transition-colors text-xs uppercase letter-spacing-0.05"
                                              >
                                                <FileSpreadsheet size={14} />
                                                Export Excel
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Verification;
