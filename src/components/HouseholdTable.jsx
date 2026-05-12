import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import EditHouseholdModal from './EditHouseholdModal';
import EmptyState from './EmptyState';

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
    <div style={{ marginTop: '2rem', background: 'var(--card-bg)', padding: '2rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
        <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>Household Directory</h2>
        <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
          <input 
            type="text" 
            placeholder="Search name, address, or ID..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              paddingLeft: '1rem',
              borderRadius: '24px',
              backgroundColor: '#F3F4F6',
              border: '1px solid transparent'
            }}
          />
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 'var(--radius)', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        {search.trim() === '' ? (
          <EmptyState
            type="no-search"
            title="Search Household Database"
            message="Type a name, address, household number, or ID to fetch records."
          />
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ borderCollapse: 'collapse', textAlign: 'left', width: 'max-content' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: '600', minWidth: '150px' }}>Actions</th>
                  {columns.map(col => (
                    <th key={col.key} style={{ padding: '1rem', whiteSpace: 'nowrap', minWidth: '120px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={columns.length + 1}>
                    <EmptyState type="no-search" title="Searching Database" message="Fetching matching records..." compact />
                  </td></tr>
                ) : households.length === 0 ? (
                  <tr><td colSpan={columns.length + 1}>
                    <EmptyState type="no-results" message={`No records match "${search}". Try a different name, ID, or address.`} compact />
                  </td></tr>
                ) : (
                  households.map((h) => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background-color 0.2s' }}>
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        <button 
                          onClick={() => handleEdit(h)} 
                          style={{ 
                            marginRight: '8px', 
                            padding: '6px 12px', 
                            backgroundColor: 'var(--primary-color)', 
                            color: 'white', 
                            fontSize: '0.875rem' 
                          }}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(h.id)} 
                          style={{ 
                            padding: '6px 12px', 
                            backgroundColor: '#EF4444', 
                            color: 'white', 
                            fontSize: '0.875rem' 
                          }}
                        >
                          Delete
                        </button>
                      </td>
                      {columns.map(col => (
                        <td key={`${h.id}-${col.key}`} style={{ padding: '1rem', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
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

      {search.trim() !== '' && totalPages > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <span>Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} records</span>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ 
                backgroundColor: page === 0 ? '#F3F4F6' : 'white', 
                border: '1px solid #E5E7EB', 
                color: page === 0 ? '#9CA3AF' : 'var(--text-primary)' 
              }}
            >
              Prev
            </button>
            <button 
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{ 
                backgroundColor: page === totalPages - 1 ? '#F3F4F6' : 'white', 
                border: '1px solid #E5E7EB', 
                color: page === totalPages - 1 ? '#9CA3AF' : 'var(--text-primary)' 
              }}
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
