import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Strict validation for Household No. format
const validateHouseholdNoFormat = (value) => {
  if (!value || value.trim() === '') {
    return 'အိမ်ထောင်စုအမှတ် ဖြည့်စွက်ရန် လိုအပ်ပါသည် (Household No. is required)';
  }
  const str = value.trim();
  if (str === 'UNKNOWN' || str === 'UNKNOWN-1') {
    return 'အိမ်ထောင်စုအမှတ်သည် "UNKNOWN" မဖြစ်ရပါ (Household No. cannot be "UNKNOWN")';
  }
  if (/[/.,၊၊]/.test(str)) {
    return 'အိမ်ထောင်စုအမှတ်တွင် /, ., , (သို့မဟုတ်) ၊ မသုံးရပါ။ ဟိုက်ဖင် (-) သာ သုံးရပါမည် (Separators like /, ., or , are not allowed. Use hyphen (-) only)';
  }
  const hhNoRegex = /^[a-zA-Z\u1000-\u109F\s]+(?:\s*[-–—]\s*)[0-9၀-၉]+$/;
  if (!hhNoRegex.test(str)) {
    return 'အိမ်ထောင်စုအမှတ် ပုံစံမမှန်ပါ။ ဥပမာ - ကောင်းတပ်-၁ သို့မဟုတ် ကောင်းတပ် - ၁ ဖြစ်ရမည် (Format must be like ကောင်းတပ်-၁ or ကောင်းတပ် - ၁)';
  }
  return '';
};

// Strict validation for Ta'ang Land ID No. format (between 4 and 19 digits)
const validateTaangLandIdFormat = (value) => {
  if (!value || value.trim() === '') return ''; // Optional field, allowed empty
  
  const str = value.trim();
  // Strip invisible characters/whitespace and extract numeric part
  let normalized = str.replace(/[\u200B-\u200D\uFEFF\u00A0\s]/g, '').replace(/[–—]/g, '-');
  let numericPart = '';
  if (/^[Nn][Oo]/.test(normalized)) {
    numericPart = normalized.replace(/^[Nn][Oo][-.,;:|\\/_=#~]*/, '');
  } else {
    numericPart = normalized;
  }
  
  // Verify numericPart only contains Myanmar or English digits
  if (!/^[0-9၀-၉]+$/.test(numericPart)) {
    return "Ta'ang Land ID No. တွင် ဂဏန်းများသာ ပါဝင်ရပါမည် (Ta'ang Land ID No. must contain digits only)";
  }
  
  const len = numericPart.length;
  if (len <= 3) {
    return "Ta'ang Land ID No. ၏ ဂဏန်းအရေအတွက်သည် ၃ လုံးထက် ပိုရပါမည် (Ta'ang Land ID must have more than 3 digits)";
  }
  if (len >= 20) {
    return "Ta'ang Land ID No. ၏ ဂဏန်းအရေအတွက်သည် ၂၀ လုံးထက် နည်းရပါမည် (Ta'ang Land ID must have less than 20 digits)";
  }
  return '';
};

// Convert Myanmar digits (၀-၉) to Arabic digits (0-9) for parsing.
const myanmarToArabicDigits = (text) => {
  if (!text) return text;
  return String(text).replace(/[၀-၉]/g, ch => String('၀၁၂၃၄၅၆၇၈၉'.indexOf(ch)));
};

// Convert Arabic digits (0-9) to Myanmar digits (၀-၉).
const arabicToMyanmarDigits = (text) => {
  if (!text) return text;
  return String(text).replace(/[0-9]/g, ch => '၀၁၂၃၄၅၆၇၈၉'[parseInt(ch, 10)]);
};

// Normalizes and zero-pads dates (e.g. ၃.၆.၁၉၉၇ -> ၀၃.၀၆.၁၉၉၇) in Myanmar numerals
const normalizeDateOfBirth = (text) => {
  if (text === null || text === undefined) return '';
  let s = String(text).trim();
  if (s === '') return '';

  // Strip zero-width / NBSP and normalise whitespace
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  s = s.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  s = s.replace(/\s+/g, '');

  // Convert any separator (-, /, space) to "." for canonical form
  s = s.replace(/[-\/]/g, '.');

  // If exactly 3 numeric parts, zero-pad day and month to 2 digits each.
  const parts = s.split('.');
  if (parts.length === 3 && parts.every(p => /^\d+$/.test(myanmarToArabicDigits(p)))) {
    const [d, m, y] = parts;
    const padArabic = (v) => {
      const arabic = myanmarToArabicDigits(v);
      return arabic.length === 1 ? '0' + arabic : arabic;
    };
    // Format to standard English date first, then map everything to Myanmar digits
    const englishDob = `${padArabic(d)}.${padArabic(m)}.${myanmarToArabicDigits(y)}`;
    return arabicToMyanmarDigits(englishDob);
  }

  return arabicToMyanmarDigits(s);
};

// Validate standard date format and real-world existence
const validateDateOfBirth = (text) => {
  if (text === null || text === undefined) return 'မွေးသက္ကရာဇ် ဖြည့်စွက်ရန် လိုအပ်ပါသည် (Date of Birth is required, format: dd.mm.yyyy)';
  const raw = String(text).trim();
  if (raw === '' || raw === '-') return 'မွေးသက္ကရာဇ် ဖြည့်စွက်ရန် လိုအပ်ပါသည် (Date of Birth is required, format: dd.mm.yyyy)';

  // Convert Myanmar digits to Arabic digits so that the English regex match works!
  const s = myanmarToArabicDigits(raw);

  // Must match dd.mm.yyyy exactly (after normalisation)
  const match = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return `မွေးသက္ကရာဇ် "${text}" ပုံစံမမှန်ပါ။ စံပုံစံ - dd.mm.yyyy ဖြစ်ရမည် ဥပမာ - ၁၅.၀၆.၁၉၈၅ (Date of Birth "${text}" is incomplete or wrong format. Required: dd.mm.yyyy)`;
  }

  const day   = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year  = parseInt(match[3], 10);
  const currentYear = new Date().getFullYear();

  if (month < 1 || month > 12) return `မွေးသက္ကရာဇ် "${text}" တွင် လအမှားဖြစ်နေသည် (Month must be 01-12)`;
  if (day   < 1 || day   > 31) return `မွေးသက္ကရာဇ် "${text}" တွင် ရက်အမှားဖြစ်နေသည် (Day must be 01-31)`;
  if (year  < 1900 || year > currentYear) {
    return `မွေးသက္ကရာဇ် "${text}" တွင် ခုနှစ်အမှားဖြစ်နေသည် (Year must be 1900-${currentYear})`;
  }

  // Check calendar dates
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return `မွေးသက္ကရာဇ် "${text}" သည် ပြက္ခဒိန်အရ မှန်ကန်သောရက်စွဲမဟုတ်ပါ (Not a real calendar date)`;
  }

  return null;
};

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

    // Validate Household No.
    const hhError = validateHouseholdNoFormat(formData.household_no);
    if (hhError) {
      setError(hhError);
      setLoading(false);
      return;
    }
    // Validate Ta'ang Land ID No.
    const tlidError = validateTaangLandIdFormat(formData.taang_land_id_no);
    if (tlidError) {
      setError(tlidError);
      setLoading(false);
      return;
    }

    // Normalize and validate Date of Birth
    let finalDob = formData.date_of_birth || '';
    if (finalDob) {
      finalDob = normalizeDateOfBirth(finalDob);
      const dobError = validateDateOfBirth(finalDob);
      if (dobError) {
        setError(dobError);
        setLoading(false);
        return;
      }
    }

    const { id, created_at, updated_at, ...updateData } = {
      ...formData,
      date_of_birth: finalDob
    };

    const { error: supabaseError } = await supabase
      .from('households')
      .update(updateData)
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
