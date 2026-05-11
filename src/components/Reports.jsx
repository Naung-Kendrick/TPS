import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, Search, Map, MapPin, Home, Users, User, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

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
        const { data, error } = await supabase.from('households').select('district');
        if (error) throw error;
        const unique = [...new Set(data.filter(d => d.district).map(d => d.district))].sort();
        setDataList(unique.map(name => ({ id: name, name })));
      } 
      else if (level === 2) {
        const { data, error } = await supabase.from('households').select('township').eq('district', path.district);
        if (error) throw error;
        const unique = [...new Set(data.filter(d => d.township).map(d => d.township))].sort();
        setDataList(unique.map(name => ({ id: name, name })));
      }
      else if (level === 3) {
        const { data, error } = await supabase.from('households').select('ward_village_group').eq('township', path.township);
        if (error) throw error;
        const unique = [...new Set(data.filter(d => d.ward_village_group).map(d => d.ward_village_group))].sort();
        setDataList(unique.map(name => ({ id: name, name })));
      }
      else if (level === 4) {
        const { data, error } = await supabase
          .from('households')
          .select('id, name, household_no, gender, occupation, date_of_birth')
          .eq('ward_village_group', path.village)
          .ilike('household_relationship', '%ဦးစီး%');
        if (error) throw error;
        setDataList(data || []);
      }
      else if (level === 5) {
        const { data, error } = await supabase
          .from('households')
          .select('*')
          .eq('household_no', path.householdNo);
        if (error) throw error;
        
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

  const filteredData = dataList.filter(item => 
    item.name?.toLowerCase().includes(search.toLowerCase()) || 
    item.household_no?.toLowerCase().includes(search.toLowerCase())
  );

  const thStyle = {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '10px',
    fontWeight: '600',
    color: '#737373',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E5E7EB',
    backgroundColor: '#FAFAFA',
  };

  const tdStyle = {
    padding: '12px 16px',
    fontSize: '12px',
    color: '#1A1A1A',
    borderBottom: '1px solid #E5E7EB',
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-white">
      
      {/* HEADER & BREADCRUMBS */}
      <div className="mb-8">
        <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>HOUSEHOLD DIRECTORY</h2>
        
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 uppercase letter-spacing-0.02">
          <button onClick={() => jumpToLevel(1)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 1 ? 'text-gray-900 font-bold' : ''}`}>
            <Map size={14} /> Districts
          </button>
          
          {path.district && (
            <>
              <ChevronRight size={14} />
              <button onClick={() => jumpToLevel(2)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 2 ? 'text-gray-900 font-bold' : ''}`}>
                <MapPin size={14} /> {path.district}
              </button>
            </>
          )}

          {path.township && (
            <>
              <ChevronRight size={14} />
              <button onClick={() => jumpToLevel(3)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 3 ? 'text-gray-900 font-bold' : ''}`}>
                <Home size={14} /> {path.township}
              </button>
            </>
          )}

          {path.village && (
            <>
              <ChevronRight size={14} />
              <button onClick={() => jumpToLevel(4)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 4 ? 'text-gray-900 font-bold' : ''}`}>
                <Users size={14} /> {path.village}
              </button>
            </>
          )}

          {path.householdNo && (
            <>
              <ChevronRight size={14} />
              <span className="flex items-center gap-1 text-gray-900 font-bold">
                <User size={14} /> {path.headName} ({path.householdNo})
              </span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 border border-gray-200 text-gray-900 text-xs mb-8 flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        {level > 1 ? (
          <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 transition-colors font-medium text-xs uppercase letter-spacing-0.05">
            <ArrowLeft size={14} /> Back
          </button>
        ) : <div />}

        {level < 5 && (
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={14} />
            </div>
            <input 
              type="text" 
              placeholder={`Search ${level === 1 ? 'districts' : level === 2 ? 'townships' : level === 3 ? 'villages' : 'household heads'}...`} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-none focus:outline-none focus:border-gray-900 transition-colors text-xs"
            />
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="border border-gray-200 bg-white min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 gap-3">
            <Loader2 className="animate-spin text-gray-900" size={32} />
            <span className="font-medium text-xs uppercase">Fetching Records...</span>
          </div>
        ) : (
          <>
            {/* LEVELS 1, 2, 3: CARDS GRID */}
            {level <= 3 && (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-white min-h-[400px]">
                {filteredData.length === 0 ? (
                  <div className="col-span-full flex justify-center items-center h-40 text-gray-500 text-xs uppercase">No records found.</div>
                ) : (
                  filteredData.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        if (level === 1) handleNavigate(2, { district: item.name });
                        if (level === 2) handleNavigate(3, { township: item.name });
                        if (level === 3) handleNavigate(4, { village: item.name });
                      }}
                      className="bg-white p-5 border border-gray-200 hover:border-gray-900 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-gray-900">
                          {level === 1 && <Map size={16} />}
                          {level === 2 && <MapPin size={16} />}
                          {level === 3 && <Home size={16} />}
                        </div>
                        <span className="font-medium text-gray-900 text-xs">{item.name}</span>
                      </div>
                      <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-900 transition-colors" />
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
                    <tr>
                      <th style={thStyle}>Household Head (ဦးစီး)</th>
                      <th style={thStyle}>Household No.</th>
                      <th style={thStyle}>Gender</th>
                      <th style={thStyle}>Occupation</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr><td colSpan={5} className="p-12 text-center text-gray-500 text-xs uppercase">No household heads found.</td></tr>
                    ) : (
                      filteredData.map(head => (
                        <tr key={head.id} className="hover:bg-gray-50 transition-colors">
                          <td style={tdStyle} className="font-medium">{head.name}</td>
                          <td style={tdStyle} className="font-mono">{head.household_no}</td>
                          <td style={tdStyle}>{head.gender}</td>
                          <td style={tdStyle}>{head.occupation || '-'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <button 
                              onClick={() => handleNavigate(5, { headName: head.name, householdNo: head.household_no })}
                              className="inline-flex items-center gap-1 bg-white border border-gray-900 text-gray-900 px-3 py-1 text-xs font-medium hover:bg-gray-50 transition-colors uppercase"
                            >
                              View Family <ChevronRight size={14} />
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
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 text-xs uppercase letter-spacing-0.05">Family Roster: {path.householdNo}</h3>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Relationship</th>
                      <th style={thStyle}>Gender</th>
                      <th style={thStyle}>Date of Birth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyMembers.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-gray-500 text-xs uppercase">No family members found.</td></tr>
                    ) : (
                      familyMembers.map((member, i) => (
                        <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                          <td style={tdStyle} className="font-medium">{member.name}</td>
                          <td style={tdStyle}>
                            {member.household_relationship === 'ဦးစီး' ? (
                              <span className="border border-gray-900 text-gray-900 px-1.5 py-0.5 text-[10px] font-bold uppercase">HEAD</span>
                            ) : (
                              <span className="text-gray-600">{member.household_relationship}</span>
                            )}
                          </td>
                          <td style={tdStyle}>{member.gender}</td>
                          <td style={tdStyle} className="font-mono">{member.date_of_birth}</td>
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
