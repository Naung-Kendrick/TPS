import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const EditHouseholdModal = ({ household, isOpen, onClose, onUpdateSuccess }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (household) {
      setFormData(household);
    }
  }, [household]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { id, created_at, updated_at, ...updateData } = formData;

    // Add audit metadata
    const finalUpdateData = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    const { error: supabaseError } = await supabase
      .from('households')
      .update(finalUpdateData)
      .eq('id', id);

    if (supabaseError) {
      setError(supabaseError.message);
      setLoading(false);
    } else {
      setLoading(false);
      onUpdateSuccess();
      onClose();
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    marginBottom: '15px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    color: 'var(--text-primary)',
    backgroundColor: '#F9FAFB',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    fontSize: '13px'
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2.5rem',
        borderRadius: 'var(--radius)',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <h2 style={{ color: 'var(--primary-color)', marginTop: 0, marginBottom: '2rem', fontSize: '1.75rem' }}>Edit Member Details</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} name="name" value={formData.name || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Household No.</label>
              <input style={inputStyle} name="household_no" value={formData.household_no || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Gender</label>
              <input style={inputStyle} name="gender" value={formData.gender || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Date of Birth</label>
              <input style={inputStyle} name="date_of_birth" value={formData.date_of_birth || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Father's Name</label>
              <input style={inputStyle} name="fathers_name" value={formData.fathers_name || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Mother's Name</label>
              <input style={inputStyle} name="mothers_name" value={formData.mothers_name || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Relationship</label>
              <input style={inputStyle} name="household_relationship" value={formData.household_relationship || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Occupation</label>
              <input style={inputStyle} name="occupation" value={formData.occupation || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Previous ID No.</label>
              <input style={inputStyle} name="previous_id_no" value={formData.previous_id_no || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Ta'ang Land ID No.</label>
              <input style={inputStyle} name="taang_land_id_no" value={formData.taang_land_id_no || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Nationality</label>
              <input style={inputStyle} name="nationality" value={formData.nationality || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Resident Status</label>
              <input style={inputStyle} name="resident_status" value={formData.resident_status || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Religious</label>
              <input style={inputStyle} name="religious" value={formData.religious || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>House NO.</label>
              <input style={inputStyle} name="house_no" value={formData.house_no || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Ward / Village / Group</label>
              <input style={inputStyle} name="ward_village_group" value={formData.ward_village_group || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Township</label>
              <input style={inputStyle} name="township" value={formData.township || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>District</label>
              <input style={inputStyle} name="district" value={formData.district || ''} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>Submission Date</label>
              <input style={inputStyle} name="submission_date" value={formData.submission_date || ''} onChange={handleChange} />
            </div>
          </div>

          {error && <p style={{ color: '#EF4444', fontWeight: '500' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem' }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ 
                padding: '0.75rem 1.5rem', 
                borderRadius: '8px', 
                border: '1px solid #E5E7EB', 
                backgroundColor: 'white',
                color: 'var(--text-primary)',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              style={{ 
                padding: '0.75rem 2rem', 
                borderRadius: '8px', 
                border: 'none', 
                backgroundColor: 'var(--primary-color)', 
                color: 'white',
                fontWeight: '600',
                boxShadow: '0 4px 6px -1px rgba(30, 64, 175, 0.4)'
              }}
            >
              {loading ? 'Saving...' : 'Update Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditHouseholdModal;
