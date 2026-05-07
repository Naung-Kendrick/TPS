import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, RotateCcw, AlertCircle, CheckCircle2, User, Home, MapPin } from 'lucide-react';

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
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setHasSearched(true);
    
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((person) => (
                  <div key={person.id} className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="bg-green-50 px-5 py-3 border-b border-green-100 flex items-center justify-between">
                      <span className="font-bold text-gray-900 truncate pr-4">{person.name}</span>
                      <span className="bg-white text-green-700 border border-green-200 px-2.5 py-1 rounded-md text-xs font-bold shrink-0">
                        {person.household_no}
                      </span>
                    </div>
                    <div className="p-5 space-y-4">
                      
                      <div className="flex items-start gap-3">
                        <User size={18} className="text-slate-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Personal Details</div>
                          <div className="text-sm text-gray-800">
                            <strong>Gender:</strong> {person.gender} <br/>
                            <strong>DOB:</strong> {person.date_of_birth || '-'} <br/>
                            <strong>Father:</strong> {person.fathers_name || '-'} <br/>
                            <strong>Mother:</strong> {person.mothers_name || '-'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Home size={18} className="text-slate-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Household Info</div>
                          <div className="text-sm text-gray-800">
                            <strong>Relationship:</strong> {person.household_relationship} <br/>
                            <strong>Occupation:</strong> {person.occupation || '-'} <br/>
                            <strong>Religion:</strong> {person.religious || '-'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <MapPin size={18} className="text-slate-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Location</div>
                          <div className="text-sm text-gray-800">
                            <strong>Village/Ward:</strong> {person.ward_village_group || '-'} <br/>
                            <strong>Township:</strong> {person.township || '-'} <br/>
                            <strong>District:</strong> {person.district || '-'}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Verification;
