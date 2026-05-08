import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, RotateCcw, AlertCircle, CheckCircle2, User, Home, MapPin, Users, ChevronRight, Loader2, X } from 'lucide-react';

// Convert Myanmar numerals to Arabic and calculate age from DOB string (format: day.month.year)
const myanmarToArabic = (str) => {
  if (!str) return null;
  const map = { '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4', '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9' };
  return str.replace(/[၀-၉]/g, ch => map[ch] || ch);
};

const getAge = (dobStr) => {
  if (!dobStr) return null;
  const converted = myanmarToArabic(dobStr.trim());
  // Try splitting by . or / or -
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

  // Family view state
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
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setHasSearched(true);
    setExpandedHouseholdNo(null);
    setFamilyMembers([]);
    
    // Check if at least one field is filled
    const isAnyFieldFilled = Object.values(formData).some(val => val.trim() !== '');
    if (!isAnyFieldFilled) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      // DYNAMIC SUPABASE QUERY BUILDER
      let query = supabase.from('households').select('*');

      if (formData.household_no.trim()) query = query.ilike('household_no', `%${formData.household_no.trim()}%`);
      if (formData.name.trim()) query = query.ilike('name', `%${formData.name.trim()}%`);
      if (formData.fathers_name.trim()) query = query.ilike('fathers_name', `%${formData.fathers_name.trim()}%`);
      if (formData.ward_village_group.trim()) query = query.ilike('ward_village_group', `%${formData.ward_village_group.trim()}%`);
      if (formData.township.trim()) query = query.ilike('township', `%${formData.township.trim()}%`);
      if (formData.district.trim()) query = query.ilike('district', `%${formData.district.trim()}%`);

      // We limit to 50 to prevent huge payloads if the user uses a very generic term
      const { data, error } = await query.limit(50);

      if (error) throw error;
      setResults(data || []);

    } catch (err) {
      console.error(err);
      alert('Error fetching verification data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewFamily = async (householdNo) => {
    // Toggle off if already viewing this family
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

      // Sort: ဦးစီး first, then ဇနီး/ခင်ပွန်း, then children, then others
      const relationshipOrder = { 'ဦးစီး': 1, 'ဇနီး': 2, 'ခင်ပွန်း': 2, 'သား': 3, 'သမီး': 3 };
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
    <div className="flex flex-col gap-6">
      
      {/* VERIFICATION FORM */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Search size={18} className="text-primary" /> 
            Verification Parameters
          </h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleVerify}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Household No.</label>
                <input 
                  type="text" 
                  name="household_no" 
                  value={formData.household_no} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  placeholder="e.g. မန်မိုင်-၁"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  placeholder="Enter name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Father's Name</label>
                <input 
                  type="text" 
                  name="fathers_name" 
                  value={formData.fathers_name} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  placeholder="Enter father's name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ward / Village / Group</label>
                <input 
                  type="text" 
                  name="ward_village_group" 
                  value={formData.ward_village_group} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  placeholder="Enter village"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Township</label>
                <input 
                  type="text" 
                  name="township" 
                  value={formData.township} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  placeholder="Enter township"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">District</label>
                <input 
                  type="text" 
                  name="district" 
                  value={formData.district} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  placeholder="Enter district"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                type="submit" 
                disabled={loading}
                className="flex items-center gap-2 bg-primary hover:bg-blue-800 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-70"
              >
                {loading ? <RotateCcw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                Verify Data (စစ်ဆေးမည်)
              </button>
              <button 
                type="button" 
                onClick={handleClear}
                disabled={loading}
                className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-70"
              >
                Clear Filters
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* VERIFICATION RESULTS */}
      {hasSearched && !loading && results && (
        <div>
          {results.length === 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <AlertCircle size={40} className="text-red-500 mb-3" />
              <h3 className="text-lg font-bold text-red-700 mb-1">Data not found.</h3>
              <p className="text-red-600/80">Please check the inputs and try again. Ensure spelling is correct.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={20} className="text-green-600" />
                <h3 className="font-bold text-gray-900 text-lg">Verification Successful: {results.length} Match(es) Found</h3>
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">No.</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Household No.</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Name</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Date of Birth</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Gender</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Father's Name</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Mother's Name</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Household Relationship</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Occupation</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Previous ID No.</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Ta'ang Land ID No.</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Nationality</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Resident Status</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Religious</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">House NO.</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Ward / Village / Group</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Township</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">District</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm">Submission Date</th>
                        <th className="px-4 py-3 text-slate-500 font-semibold text-sm text-center sticky right-0 bg-slate-50 border-l border-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((person, index) => (
                        <React.Fragment key={person.id}>
                          <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${expandedHouseholdNo === person.household_no ? 'bg-blue-50/30' : ''}`}>
                            <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                            <td className="px-4 py-3 font-semibold text-green-700">{person.household_no}</td>
                            <td className="px-4 py-3 font-bold text-gray-900">{person.name}</td>
                            <td className="px-4 py-3 text-gray-700">{person.date_of_birth || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.gender || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.fathers_name || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.mothers_name || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.household_relationship || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.occupation || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.previous_id_no || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.taang_land_id_no || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.nationality || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.resident_status || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.religious || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.house_no || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.ward_village_group || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.township || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.district || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{person.submission_date || person.created_at?.split('T')[0] || '-'}</td>
                            <td className="px-4 py-3 text-center sticky right-0 bg-white border-l border-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                              <button
                                onClick={() => handleViewFamily(person.household_no)}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  expandedHouseholdNo === person.household_no
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                }`}
                              >
                                {expandedHouseholdNo === person.household_no ? 'Close Family' : 'View Family'}
                              </button>
                            </td>
                          </tr>
                          
                          {/* INLINE FAMILY ROSTER PANEL (directly below the selected person row) */}
                          {expandedHouseholdNo === person.household_no && (
                            <tr>
                              <td colSpan="21" className="p-0 bg-slate-100 border-b-4 border-slate-300">
                                <div className="p-4 sm:p-6 animate-in fade-in slide-in-from-top-2">
                                  <div className="bg-white rounded-xl border border-blue-200 shadow-md overflow-hidden">
                                    <div className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
                                      <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                                        <Users size={18} />
                                        Family Roster — Household: {expandedHouseholdNo}
                                      </h3>
                                      <button
                                        onClick={() => { setExpandedHouseholdNo(null); setFamilyMembers([]); }}
                                        className="text-white/80 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
                                      >
                                        <X size={18} />
                                      </button>
                                    </div>
                  
                                    {familyLoading ? (
                                      <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
                                        <Loader2 className="animate-spin text-primary" size={32} />
                                        <span className="font-medium text-sm">Loading family members...</span>
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        {familyMembers.length === 0 ? (
                                          <div className="text-center text-slate-500 py-8 text-sm">No family members found for this household.</div>
                                        ) : (
                                          <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                                            <thead>
                                              <tr className="bg-blue-50/50 border-b border-blue-100">
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">No.</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Household No.</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Name</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Date of Birth</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Gender</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Father's Name</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Mother's Name</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Household Relationship</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Occupation</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Previous ID No.</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Ta'ang Land ID No.</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Nationality</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Resident Status</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Religious</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">House NO.</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Ward / Village / Group</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Township</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">District</th>
                                                <th className="px-4 py-2.5 text-slate-600 font-semibold">Submission Date</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {familyMembers.map((member, i) => (
                                                <tr 
                                                  key={member.id} 
                                                  className={`border-b border-slate-100 transition-colors hover:bg-blue-50/30 ${
                                                    member.household_relationship === 'ဦးစီး' ? 'bg-blue-50/50' : ''
                                                  }`}
                                                >
                                                  <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                                                  <td className="px-4 py-2.5 font-semibold text-green-700">{member.household_no}</td>
                                                  <td className="px-4 py-2.5 font-bold text-gray-900">
                                                    {member.name}
                                                    {member.household_relationship === 'ဦးစီး' && (
                                                      <span className="ml-2 bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">HEAD</span>
                                                    )}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.date_of_birth || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.gender || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.fathers_name || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.mothers_name || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700 font-medium">{member.household_relationship || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.occupation || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.previous_id_no || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.taang_land_id_no || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.nationality || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.resident_status || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.religious || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.house_no || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.ward_village_group || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.township || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.district || '-'}</td>
                                                  <td className="px-4 py-2.5 text-gray-700">{member.submission_date || member.created_at?.split('T')[0] || '-'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                        {familyMembers.length > 0 && (
                                          <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 font-medium flex flex-wrap items-center gap-x-5 gap-y-1">
                                            <span>Total Members: {familyMembers.length}</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-blue-600">ကျား (Male): {familyMembers.filter(m => m.gender && (m.gender.includes('ကျား') || m.gender.trim() === 'က')).length}</span>
                                            <span className="text-pink-600">မ (Female): {familyMembers.filter(m => m.gender && !(m.gender.includes('ကျား') || m.gender.trim() === 'က')).length}</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-orange-600">Under 16: {familyMembers.filter(m => { const age = getAge(m.date_of_birth); return age !== null && age < 16; }).length}</span>
                                            <span className="text-emerald-600">16 - 60: {familyMembers.filter(m => { const age = getAge(m.date_of_birth); return age !== null && age >= 16 && age <= 60; }).length}</span>
                                            <span className="text-red-600">Above 60: {familyMembers.filter(m => { const age = getAge(m.date_of_birth); return age !== null && age > 60; }).length}</span>
                                          </div>
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
