import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, Search, Map, MapPin, Home, Users, User, ArrowLeft, Loader2 } from 'lucide-react';

const Reports = () => {
  const [level, setLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [path, setPath] = useState({
    district: null,
    township: null,
    village: null,
    headName: null,
    householdNo: null
  });

  const [dataList, setDataList] = useState([]); // Stores items for Levels 1 to 4
  const [familyMembers, setFamilyMembers] = useState([]); // Stores items for Level 5

  // Trigger data fetching whenever level or path changes
  useEffect(() => {
    fetchData();
  }, [level, path.district, path.township, path.village, path.householdNo]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setSearch('');
    
    try {
      if (level === 1) {
        // LEVEL 1: Fetch Unique Districts
        // (Note: Using JS Set for distinct values. For >100k rows, consider a Supabase RPC)
        const { data, error } = await supabase.from('households').select('district');
        if (error) throw error;
        const unique = [...new Set(data.filter(d => d.district).map(d => d.district))].sort();
        setDataList(unique.map(name => ({ id: name, name })));
      } 
      else if (level === 2) {
        // LEVEL 2: Fetch Unique Townships within the District
        const { data, error } = await supabase.from('households').select('township').eq('district', path.district);
        if (error) throw error;
        const unique = [...new Set(data.filter(d => d.township).map(d => d.township))].sort();
        setDataList(unique.map(name => ({ id: name, name })));
      }
      else if (level === 3) {
        // LEVEL 3: Fetch Unique Villages within the Township
        const { data, error } = await supabase.from('households').select('ward_village_group').eq('township', path.township);
        if (error) throw error;
        const unique = [...new Set(data.filter(d => d.ward_village_group).map(d => d.ward_village_group))].sort();
        setDataList(unique.map(name => ({ id: name, name })));
      }
      else if (level === 4) {
        // LEVEL 4: Fetch Heads of Households ('ဦးစီး') in the Village
        const { data, error } = await supabase
          .from('households')
          .select('id, name, household_no, gender, occupation, date_of_birth')
          .eq('ward_village_group', path.village)
          .ilike('household_relationship', '%ဦးစီး%');
        if (error) throw error;
        setDataList(data || []);
      }
      else if (level === 5) {
        // LEVEL 5: Fetch Family Members by Household No
        const { data, error } = await supabase
          .from('households')
          .select('*')
          .eq('household_no', path.householdNo);
        if (error) throw error;
        
        // Ensure 'ဦးစီး' is sorted to the top
        const relationshipOrder = { 'ဦးစီး': 1, 'ဇနီး': 2, 'ခင်ပွန်း': 2, 'သား': 3, 'သမီး': 3 };
        const sortedData = [...(data || [])].sort((a, b) => {
          const orderA = relationshipOrder[a.household_relationship] || 99;
          const orderB = relationshipOrder[b.household_relationship] || 99;
          return orderA - orderB;
        });
        setFamilyMembers(sortedData);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (newLevel, payload) => {
    setPath(prev => ({ ...prev, ...payload }));
    setLevel(newLevel);
  };

  const jumpToLevel = (targetLevel) => {
    if (targetLevel >= level) return;
    const newPath = { ...path };
    if (targetLevel < 5) { newPath.householdNo = null; newPath.headName = null; }
    if (targetLevel < 4) newPath.village = null;
    if (targetLevel < 3) newPath.township = null;
    if (targetLevel < 2) newPath.district = null;
    setPath(newPath);
    setLevel(targetLevel);
  };

  const goBack = () => {
    if (level > 1) jumpToLevel(level - 1);
  };

  // Filter Data List based on search query
  const filteredData = dataList.filter(item => 
    item.name?.toLowerCase().includes(search.toLowerCase()) || 
    item.household_no?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      
      {/* HEADER & BREADCRUMBS */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Household Directory</h2>
        
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <button onClick={() => jumpToLevel(1)} className={`flex items-center gap-1 hover:text-primary transition-colors ${level === 1 ? 'text-primary bg-blue-50 px-2 py-1 rounded-md' : ''}`}>
            <Map size={16} /> Districts
          </button>
          
          {path.district && (
            <>
              <ChevronRight size={16} />
              <button onClick={() => jumpToLevel(2)} className={`flex items-center gap-1 hover:text-primary transition-colors ${level === 2 ? 'text-primary bg-blue-50 px-2 py-1 rounded-md' : ''}`}>
                <MapPin size={16} /> {path.district}
              </button>
            </>
          )}

          {path.township && (
            <>
              <ChevronRight size={16} />
              <button onClick={() => jumpToLevel(3)} className={`flex items-center gap-1 hover:text-primary transition-colors ${level === 3 ? 'text-primary bg-blue-50 px-2 py-1 rounded-md' : ''}`}>
                <Home size={16} /> {path.township}
              </button>
            </>
          )}

          {path.village && (
            <>
              <ChevronRight size={16} />
              <button onClick={() => jumpToLevel(4)} className={`flex items-center gap-1 hover:text-primary transition-colors ${level === 4 ? 'text-primary bg-blue-50 px-2 py-1 rounded-md' : ''}`}>
                <Users size={16} /> {path.village}
              </button>
            </>
          )}

          {path.householdNo && (
            <>
              <ChevronRight size={16} />
              <span className="flex items-center gap-1 text-primary bg-blue-50 px-2 py-1 rounded-md">
                <User size={16} /> {path.headName} ({path.householdNo})
              </span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-8 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        {level > 1 ? (
          <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">
            <ArrowLeft size={16} /> Back
          </button>
        ) : <div />}

        {level < 5 && (
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={18} />
            </div>
            <input 
              type="text" 
              placeholder={`Search ${level === 1 ? 'districts' : level === 2 ? 'townships' : level === 3 ? 'villages' : 'household heads'}...`} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors shadow-sm"
            />
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-500 gap-3">
            <Loader2 className="animate-spin text-primary" size={40} />
            <span className="font-medium text-lg">Fetching Records...</span>
          </div>
        ) : (
          <>
            {/* LEVELS 1, 2, 3: CARDS GRID */}
            {level <= 3 && (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 min-h-[400px]">
                {filteredData.length === 0 ? (
                  <div className="col-span-full flex justify-center items-center h-40 text-slate-500">No records found.</div>
                ) : (
                  filteredData.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        if (level === 1) handleNavigate(2, { district: item.name });
                        if (level === 2) handleNavigate(3, { township: item.name });
                        if (level === 3) handleNavigate(4, { village: item.name });
                      }}
                      className="bg-white p-5 rounded-xl border border-slate-200 hover:border-primary hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 text-primary p-2.5 rounded-lg">
                          {level === 1 && <Map size={20} />}
                          {level === 2 && <MapPin size={20} />}
                          {level === 3 && <Home size={20} />}
                        </div>
                        <span className="font-semibold text-gray-900">{item.name}</span>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* LEVEL 4: HOUSEHOLD HEADS TABLE */}
            {level === 4 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-slate-500 font-semibold">Household Head (ဦးစီး)</th>
                      <th className="px-6 py-4 text-slate-500 font-semibold">Household No.</th>
                      <th className="px-6 py-4 text-slate-500 font-semibold">Gender</th>
                      <th className="px-6 py-4 text-slate-500 font-semibold">Occupation</th>
                      <th className="px-6 py-4 text-slate-500 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr><td colSpan={5} className="p-12 text-center text-slate-500">No household heads found matching your criteria.</td></tr>
                    ) : (
                      filteredData.map(head => (
                        <tr key={head.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-900">{head.name}</td>
                          <td className="px-6 py-4"><span className="bg-slate-100 px-2.5 py-1 rounded text-sm font-medium text-slate-700">{head.household_no}</span></td>
                          <td className="px-6 py-4 text-gray-600">{head.gender}</td>
                          <td className="px-6 py-4 text-gray-600">{head.occupation || '-'}</td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleNavigate(5, { headName: head.name, householdNo: head.household_no })}
                              className="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                            >
                              View Family <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* LEVEL 5: FAMILY MEMBERS TABLE */}
            {level === 5 && (
              <div className="overflow-x-auto">
                <div className="px-6 py-4 bg-blue-50 border-b border-slate-200">
                  <h3 className="font-semibold text-primary">Family Roster: {path.householdNo}</h3>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-slate-200">
                      <th className="px-6 py-4 text-slate-500 font-semibold">Name</th>
                      <th className="px-6 py-4 text-slate-500 font-semibold">Relationship</th>
                      <th className="px-6 py-4 text-slate-500 font-semibold">Gender</th>
                      <th className="px-6 py-4 text-slate-500 font-semibold">Date of Birth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyMembers.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-slate-500">No family members found.</td></tr>
                    ) : (
                      familyMembers.map((member, i) => (
                        <tr key={member.id} className={i !== familyMembers.length - 1 ? 'border-b border-slate-100' : ''}>
                          <td className="px-6 py-4 font-medium text-gray-900">{member.name}</td>
                          <td className="px-6 py-4">
                            {member.household_relationship === 'ဦးစီး' ? (
                              <span className="bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded text-xs font-bold tracking-wide shadow-sm">HEAD (ဦးစီး)</span>
                            ) : (
                              <span className="text-gray-600">{member.household_relationship}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-600">{member.gender}</td>
                          <td className="px-6 py-4 text-gray-600">{member.date_of_birth}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
