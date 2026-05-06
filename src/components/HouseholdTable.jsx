import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import EditHouseholdModal from './EditHouseholdModal';

const HouseholdTable = ({ refreshTrigger }) => {
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Edit state
  const [editingHousehold, setEditingHousehold] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState(0);

  // If the user types a new search, reset to page 0
  useEffect(() => {
    setPage(0);
  }, [search]);

  useEffect(() => {
    // Only fetch if there is a search term.
    // If search is empty, we clear the results to show the "white box".
    if (search.trim() === '') {
      setHouseholds([]);
      setTotalCount(0);
      return;
    }

    const timer = setTimeout(() => {
      fetchHouseholds();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [page, search, refreshTrigger]);

  const fetchHouseholds = async () => {
    setLoading(true);
    
    let query = supabase
      .from('households')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    const searchTerm = `%${search}%`;
    query = query.or(`name.ilike.${searchTerm},address.ilike.${searchTerm},household_no.ilike.${searchTerm},taang_land_id_no.ilike.${searchTerm},previous_id_no.ilike.${searchTerm}`);

    const from = page * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("Error fetching households:", error);
    } else {
      setHouseholds(data || []);
      setTotalCount(count || 0);
    }
    
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      const { error } = await supabase
        .from('households')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Error deleting record: ' + error.message);
      } else {
        fetchHouseholds();
      }
    }
  };

  const handleEdit = (household) => {
    setEditingHousehold(household);
    setIsEditModalOpen(true);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Column definitions for mapping
  const columns = [
    { label: 'Household No.', key: 'household_no' },
    { label: 'Name', key: 'name' },
    { label: 'Date of birth', key: 'date_of_birth' },
    { label: 'Gender', key: 'gender' },
    { label: "Father's Name", key: 'fathers_name' },
    { label: "Mother's Name", key: 'mothers_name' },
    { label: 'Household Relationship', key: 'household_relationship' },
    { label: 'Occupation', key: 'occupation' },
    { label: 'Previous ID No.', key: 'previous_id_no' },
    { label: "Ta'ang Land ID No.", key: 'taang_land_id_no' },
    { label: 'Nationality', key: 'nationality' },
    { label: 'Resident Status', key: 'resident_status' },
    { label: 'Religious', key: 'religious' },
    { label: 'House NO.', key: 'house_no' },
    { label: 'Ward / Village / Group', key: 'ward_village_group' },
    { label: 'Township', key: 'township' },
    { label: 'District', key: 'district' },
    { label: 'Submission Date', key: 'submission_date' }
  ];

  return (
    <div style={{ marginTop: '2rem', background: 'var(--color-background-soft, rgba(0,0,0,0.05))', padding: '1.5rem', borderRadius: '8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Household Directory</h2>
        <input 
          type="text" 
          placeholder="Search by name, address, or ID..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ 
            padding: '0.6rem 1rem', 
            width: '100%', 
            maxWidth: '350px', 
            borderRadius: '20px', 
            border: '1px solid #ccc',
            fontSize: '1rem'
          }}
        />
      </div>

      <div style={{ background: 'white', borderRadius: '8px', padding: search.trim() === '' ? '3rem' : '0', color: '#333', minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
        
        {/* If user hasn't searched, show empty white box */}
        {search.trim() === '' ? (
          <div style={{ textAlign: 'center', margin: 'auto', color: '#888' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Search Database</h3>
            <p style={{ margin: 0 }}>Type a name, address, or ID in the search bar above to fetch records.</p>
          </div>
        ) : (
          /* Table View when searching */
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ borderCollapse: 'collapse', textAlign: 'left', width: 'max-content' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eaeaea', backgroundColor: '#f9f9f9' }}>
                  <th style={{ padding: '1rem', whiteSpace: 'nowrap', minWidth: '150px' }}>Actions</th>
                  {columns.map(col => (
                    <th key={col.key} style={{ padding: '1rem', whiteSpace: 'nowrap', minWidth: '120px' }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={columns.length + 1} style={{ padding: '2rem', textAlign: 'center' }}>Searching database...</td></tr>
                ) : households.length === 0 ? (
                  <tr><td colSpan={columns.length + 1} style={{ padding: '2rem', textAlign: 'center' }}>No matching records found.</td></tr>
                ) : (
                  households.map((h) => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #eaeaea' }}>
                      <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                        <button onClick={() => handleEdit(h)} style={{ marginRight: '10px', padding: '5px 10px', backgroundColor: '#42b883', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleDelete(h.id)} style={{ padding: '5px 10px', backgroundColor: '#ff5f5f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                      </td>
                      {columns.map(col => (
                        <td key={`${h.id}-${col.key}`} style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                          {h[col.key] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls - Only show when searching and there are results */}
      {search.trim() !== '' && totalPages > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ fontSize: '0.9rem' }}>Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} records</span>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #ccc', background: page === 0 ? '#eee' : '#fff', color: '#333', cursor: page === 0 ? 'not-allowed' : 'pointer' }}
            >
              Prev
            </button>
            <span style={{ margin: '0 0.5rem' }}>Page {page + 1} of {totalPages}</span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #ccc', background: page === totalPages - 1 ? '#eee' : '#fff', color: '#333', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <EditHouseholdModal 
        household={editingHousehold} 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onUpdateSuccess={fetchHouseholds}
      />
    </div>
  );
};

export default HouseholdTable;
