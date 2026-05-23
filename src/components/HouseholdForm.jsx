import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { enqueue } from '../lib/retryQueue';

const MyanmarCalendar = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const months = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'];
  const shortWeekDays = ['တန', 'တလ', 'အင်္ဂါ', 'ဗုဒ္ဓ', 'ကြာ', 'သော', 'စနေ'];

  const toMyanmarNum = (num) => {
    const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
    return num.toString().split('').map(digit => myanmarNumbers[parseInt(digit)] || digit).join('');
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDateSelect = (day, e) => {
    e.stopPropagation();
    const formattedDate = `${toMyanmarNum(day)}.${toMyanmarNum(currentMonth + 1)}.${toMyanmarNum(currentYear)}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  const calendarGrid = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarGrid.push(<div key={`empty-${i}`} style={{ padding: '0.5rem' }}></div>);
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = new Date().getDate() === d && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
    calendarGrid.push(
      <button
        key={d}
        type="button"
        onClick={(e) => handleDateSelect(d, e)}
        style={{
          padding: '0.4rem',
          border: 'none',
          backgroundColor: isToday ? '#F3F4F6' : 'transparent',
          color: '#1A1A1A',
          borderRadius: '0px',
          cursor: 'pointer',
          fontWeight: isToday ? '600' : '400',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = isToday ? '#F3F4F6' : 'transparent'}
      >
        {toMyanmarNum(d)}
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', height: '28px', padding: '0 10px', borderRadius: '0px', border: '1px solid #E5E7EB',
          fontSize: '11px', marginTop: '3px', boxSizing: 'border-box',
          fontFamily: 'Inter, sans-serif', backgroundColor: '#FFFFFF', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}
      >
        <span style={{ color: value ? '#1A1A1A' : '#737373' }}>
          {value || 'Select Date'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#737373' }}>
          <rect x="3" y="4" width="18" height="18" rx="0" ry="0"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px', zIndex: 50,
          backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0px',
          padding: '16px', width: '280px', boxShadow: 'none'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <button type="button" onClick={handlePrevMonth} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0px', cursor: 'pointer', padding: '2px 8px', color: '#1A1A1A' }}>
              &larr;
            </button>
            <div style={{ fontWeight: '600', color: '#1A1A1A', fontSize: '12px', textTransform: 'uppercase' }}>
              {months[currentMonth]} {toMyanmarNum(currentYear)}
            </div>
            <button type="button" onClick={handleNextMonth} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0px', cursor: 'pointer', padding: '2px 8px', color: '#1A1A1A' }}>
              &rarr;
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '8px', gap: '2px' }}>
            {shortWeekDays.map(d => (
              <div key={d} style={{ fontSize: '10px', fontWeight: '600', color: '#737373' }}>{d}</div>
            ))}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '2px' }}>
            {calendarGrid}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', borderTop: '1px solid #E5E7EB', paddingTop: '8px' }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }} style={{ background: 'none', border: 'none', color: '#1A1A1A', fontSize: '11px', cursor: 'pointer', fontWeight: '500', textTransform: 'uppercase' }}>
              CLEAR
            </button>
            <button type="button" onClick={(e) => {
              e.stopPropagation();
              setCurrentMonth(new Date().getMonth());
              setCurrentYear(new Date().getFullYear());
            }} style={{ background: 'none', border: 'none', color: '#1A1A1A', fontSize: '11px', cursor: 'pointer', fontWeight: '500', textTransform: 'uppercase' }}>
              TODAY
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const HouseholdForm = () => {
  const [formData, setFormData] = useState({
    household_no: '',
    name: '',
    date_of_birth: '',
    gender: '',
    fathers_name: '',
    mothers_name: '',
    household_relationship: '',
    occupation: '',
    previous_id_no: '',
    taang_land_id_no: '',
    nationality: 'တအာင်း',
    resident_status: '',
    religious: '',
    house_no: '',
    ward_village_group: '',
    township: '',
    district: '',
    submission_date: '' 
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [error, setError] = useState(null);
  const [submittedMembers, setSubmittedMembers] = useState([]);
  const [autoFillMessage, setAutoFillMessage] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);

  const DRAFT_KEY = 'tps_household_form_draft';
  const [isCustomRelationship, setIsCustomRelationship] = useState(false);
  const [isCustomReligion, setIsCustomReligion] = useState(false);
  
  const [totalFamilyMembers, setTotalFamilyMembers] = useState(0);
  const [viewFamilyModalOpen, setViewFamilyModalOpen] = useState(false);
  const [viewFamilyData, setViewFamilyData] = useState([]);
  const [viewFamilyLoading, setViewFamilyLoading] = useState(false);

  const [dob, setDob] = useState({ day: '', month: '', year: '' });
  const [wardVillageError, setWardVillageError] = useState('');

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const { formData: savedForm, dob: savedDob } = JSON.parse(saved);
        if (savedForm && savedForm.household_no) {
          setFormData(savedForm);
          if (savedDob) setDob(savedDob);
          setDraftRestored(true);
          setTimeout(() => setDraftRestored(false), 4000);
        }
      }
    } catch (_) {}
  }, []);

  // Auto-save draft on every change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, dob }));
    } catch (_) {}
  }, [formData, dob]);

  useEffect(() => {
    const dobString = [dob.day, dob.month, dob.year].filter(Boolean).join('.');
    setFormData(prev => ({ ...prev, date_of_birth: dobString }));
  }, [dob]);

  const toMyanmarNum = useCallback((num) => {
    const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
    return num.toString().split('').map(digit => myanmarNumbers[parseInt(digit)] || digit).join('');
  }, []);

  const days = useMemo(() => Array.from({length: 31}, (_, i) => toMyanmarNum(i + 1)), [toMyanmarNum]);
  const months = useMemo(() => ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'], []);
  const years = useMemo(() => Array.from({length: 107}, (_, i) => toMyanmarNum(2026 - i)), [toMyanmarNum]);

  const handleDobChange = useCallback((e) => {
    const { name, value } = e.target;
    setDob(prev => ({ ...prev, [name]: value }));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.household_no) {
        fetchFamilyCount(formData.household_no);
      } else {
        setTotalFamilyMembers(0);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.household_no]);

  const fetchFamilyCount = async (householdNo) => {
    try {
      const { count, error } = await supabase
        .from('households')
        .select('*', { count: 'exact', head: true })
        .eq('household_no', householdNo);
        
      if (!error && count !== null) {
        setTotalFamilyMembers(count);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewFamily = async (householdNo) => {
    setViewFamilyModalOpen(true);
    setViewFamilyLoading(true);
    try {
      const { data, error } = await supabase
        .from('households')
        .select('name, household_relationship, gender, date_of_birth')
        .eq('household_no', householdNo)
        .order('created_at', { ascending: true });
      
      if (data) setViewFamilyData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setViewFamilyLoading(false);
    }
  };

  // Auto-correct Township: ensure space before "မြို့နယ်" suffix
  const autoCorrectTownship = (value) => {
    if (!value || value.trim() === '') return value;
    const str = value.trim();
    const match = str.match(/^(.+?)မြို့နယ်$/);
    if (match && !str.includes(' မြို့နယ်')) {
      return `${match[1].trim()} မြို့နယ်`;
    }
    return str;
  };

  // Auto-correct District: ensure space before "ခရိုင်" suffix
  const autoCorrectDistrict = (value) => {
    if (!value || value.trim() === '') return value;
    const str = value.trim();
    const match = str.match(/^(.+?)ခရိုင်$/);
    if (match && !str.includes(' ခရိုင်')) {
      return `${match[1].trim()} ခရိုင်`;
    }
    return str;
  };

  // Auto-correct Ward/Village/Group by adding space before suffix if missing
  const autoCorrectWardVillageGroup = (value) => {
    if (!value || value.trim() === '') return value;
    const str = value.trim();
    
    // Check for missing space before "ရပ်ကွက်" (Ward)
    const wardMatch = str.match(/^(.+?)ရပ်ကွက်$/);
    if (wardMatch && !str.includes(' ရပ်ကွက်')) {
      return `${wardMatch[1].trim()} ရပ်ကွက်`;
    }
    
    // Check for missing space before "ရွာ" (Village)
    const villageMatch = str.match(/^(.+?)ရွာ$/);
    if (villageMatch && !str.includes(' ရွာ') && str !== 'ရွာ') {
      return `${villageMatch[1].trim()} ရွာ`;
    }
    
    // Check for missing space before "အုပ်စု" (Group)
    const groupMatch = str.match(/^(.+?)အုပ်စု$/);
    if (groupMatch && !str.includes(' အုပ်စု')) {
      return `${groupMatch[1].trim()} အုပ်စု`;
    }
    
    return str;
  };

  // Detect Ward/Village/Group types from value (handles comma-separated)
  const getWardVillageGroupTypes = (value) => {
    if (!value || typeof value !== 'string') return ['unknown'];
    
    // Split by comma and clean up each part
    const parts = value.split(/[,၊]/).map(p => p.trim()).filter(p => p !== '');
    if (parts.length === 0) return ['unknown'];
    
    // Detect type for each part
    const types = parts.map(part => {
      const str = part.trim();
      if (str === '') return 'unknown';
      
      // Check for Ward (ရပ်ကွက်)
      if (str.includes('ရပ်ကွက်')) return 'ward';
      
      // Check for Group (အုပ်စု) - MUST check BEFORE Village
      if (str.includes('အုပ်စု')) return 'group';
      
      // Check for Village (ရွာ)
      if (str.includes('ရွာ')) return 'village';
      
      return 'unknown';
    });
    
    // Remove duplicates and 'unknown'
    return [...new Set(types.filter(t => t !== 'unknown'))];
  };

  // Simple validation - just check if it contains one of the keywords
  const validateWardVillageGroup = (value) => {
    if (!value || value.trim() === '') return '';
    const str = value.trim();
    
    // Just check if it contains any of the keywords
    const types = getWardVillageGroupTypes(str);
    if (types.length === 0 || (types.length === 1 && types[0] === 'unknown')) {
      return `"ရပ်ကွက်", "ရွာ", သို့မဟုတ် "အုပ်စု" ပါဝင်ရမည်`;
    }
    
    return ''; // Valid
  };

  // Normalize household_no for flexible DB lookup: strip spaces around hyphens
  const normalizeHouseholdNo = (value) => {
    if (!value) return value;
    return value.replace(/\s*-\s*/g, '-').trim();
  };

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;

    // Auto-correct and validate ward_village_group on change
    if (name === 'ward_village_group') {
      const corrected = autoCorrectWardVillageGroup(value);
      const error = validateWardVillageGroup(corrected);
      setWardVillageError(error);
      setFormData(prev => ({ ...prev, [name]: corrected }));
      return;
    }

    // Auto-correct township and district suffixes
    if (name === 'township') {
      setFormData(prev => ({ ...prev, [name]: autoCorrectTownship(value) }));
      return;
    }
    if (name === 'district') {
      setFormData(prev => ({ ...prev, [name]: autoCorrectDistrict(value) }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const checkHouseholdExists = useCallback(async () => {
    if (!formData.household_no) return;
    
    try {
      const normalizedHn = normalizeHouseholdNo(formData.household_no);
      const { data, error: fetchError } = await supabase
        .from('households')
        .select('house_no, ward_village_group, township, district, resident_status, religious, nationality')
        .ilike('household_no', `%${normalizedHn}%`)
        .limit(1)
        .single();
        
      if (data) {
        setFormData(prev => ({
          ...prev,
          house_no: data.house_no || '',
          ward_village_group: data.ward_village_group || '',
          township: data.township || '',
          district: data.district || '',
          resident_status: data.resident_status || '',
          religious: data.religious || '',
          nationality: data.nationality || 'တအာင်း'
        }));
        setAutoFillMessage('AUTO-FILLED!');
        setTimeout(() => setAutoFillMessage(''), 5000);
      }
    } catch (err) {
      // Ignore normal 'no rows returned' errors
    }
  }, [formData.household_no]);

  const submitForm = async (mode) => {
    if (!formData.household_no || !formData.name) {
      setError('ကျေးဇူးပြု၍ မရှိမဖြစ်လိုအပ်သောအချက်အလက်များကို ဖြည့်စွက်ပါ။ (Please fill required fields)');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    // Add the detected types to the payload (array)
    const payload = {
      ...formData,
      ward_village_group_type: getWardVillageGroupTypes(formData.ward_village_group)
    };

    try {
      let savedLocally = false;

      if (!navigator.onLine) {
        // Device is offline — queue the write
        enqueue({ table: 'households', type: 'insert', payload });
        savedLocally = true;
      } else {
        const { error: supabaseError } = await supabase
          .from('households')
          .insert([payload]);

        if (supabaseError) {
          // Network error mid-request — queue it
          enqueue({ table: 'households', type: 'insert', payload });
          savedLocally = true;
        }
      }

      if (savedLocally) {
        setSavedOffline(true);
        setTimeout(() => setSavedOffline(false), 6000);
      } else {
        setSuccess(true);
      }
      setIsCustomRelationship(false);
      setIsCustomReligion(false);
      setDob({ day: '', month: '', year: '' });
      setSubmittedMembers(prev => [...prev, formData]);
      fetchFamilyCount(formData.household_no);
      localStorage.removeItem(DRAFT_KEY);
      
      if (mode === 'SAME_HOUSEHOLD') {
        setFormData(prev => ({
          ...prev,
          name: '',
          date_of_birth: '',
          gender: '',
          fathers_name: '',
          mothers_name: '',
          household_relationship: '',
          occupation: '',
          previous_id_no: '',
          taang_land_id_no: ''
        }));
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setFormData({
          household_no: '', name: '', date_of_birth: '', gender: '',
          fathers_name: '', mothers_name: '', household_relationship: '',
          occupation: '', previous_id_no: '', taang_land_id_no: '',
          nationality: 'တအာင်း', resident_status: '', religious: '',
          house_no: '', ward_village_group: '', township: '', district: '',
          submission_date: ''
        });
        setFormOpen(false);
      }
    } catch (err) {
      setError(err.message || 'An error occurred while saving the data.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = useMemo(() => ({
    width: '100%',
    height: '28px',
    padding: '0 10px',
    borderRadius: '0px',
    border: '1px solid #E5E7EB',
    fontSize: '11px',
    marginTop: '3px',
    boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    transition: 'border-color 0.1s',
    appearance: 'auto',
  }), []);

  const labelStyle = useMemo(() => ({
    fontSize: '9px',
    fontWeight: '600',
    color: '#737373',
    display: 'flex',
    alignItems: 'flex-end',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    height: '30px',
    lineHeight: '1.3',
    paddingBottom: '2px',
  }), []);

  const groupStyle = useMemo(() => ({
    marginBottom: '4px',
  }), []);

  const thStyle = {
    padding: '12px 8px',
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
    padding: '10px 8px',
    fontSize: '12px',
    color: '#1A1A1A',
    borderBottom: '1px solid #E5E7EB',
  };

  const tdMonoS = { ...tdStyle, fontFamily: 'var(--font-mono)' };

  const [formOpen, setFormOpen] = useState(false);

  const openForm = () => { setSuccess(false); setError(null); setFormOpen(true); };
  const closeForm = () => setFormOpen(false);

  const clearForNewHousehold = useCallback(() => {
    setFormData({
      household_no: '', name: '', date_of_birth: '', gender: '',
      fathers_name: '', mothers_name: '', household_relationship: '',
      occupation: '', previous_id_no: '', taang_land_id_no: '',
      nationality: 'တအာင်း', resident_status: '', religious: '',
      house_no: '', ward_village_group: '', township: '', district: '',
      submission_date: ''
    });
    setDob({ day: '', month: '', year: '' });
    setIsCustomRelationship(false);
    setIsCustomReligion(false);
    setSuccess(false);
    setError(null);
    localStorage.removeItem(DRAFT_KEY);
  }, [DRAFT_KEY]);

  const formFieldsJSX = useMemo(() => (
    <div className="tps-grid tps-grid-4" style={{ gap: '10px 14px', alignItems: 'start' }}>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>HOUSEHOLD NO.</label>
        <input type="text" name="household_no" value={formData.household_no} onChange={handleChange} onBlur={checkHouseholdExists} placeholder="Enter household number" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} required />
        {autoFillMessage && <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#737373', fontWeight: '600' }}>{autoFillMessage}</p>}
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>NAME</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter full name" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} required />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>DATE OF BIRTH</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <select name="day" value={dob.day} onChange={handleDobChange} style={{ ...inputStyle, flex: '0 0 28%', fontFamily: 'var(--font-mono)' }}>
            <option value="">Day</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select name="month" value={dob.month} onChange={handleDobChange} style={{ ...inputStyle, flex: '0 0 40%' }}>
            <option value="">Month</option>
            {months.map((m, i) => <option key={m} value={toMyanmarNum(i + 1)}>{toMyanmarNum(i + 1)}</option>)}
          </select>
          <select name="year" value={dob.year} onChange={handleDobChange} style={{ ...inputStyle, flex: '1 1 0', fontFamily: 'var(--font-mono)' }}>
            <option value="">Year</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>GENDER</label>
        <select name="gender" value={formData.gender} onChange={handleChange} style={inputStyle}>
          <option value="">Select Gender</option>
          <option value="ကျား">Male</option>
          <option value="မ">Female</option>
        </select>
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>FATHER'S NAME</label>
        <input type="text" name="fathers_name" value={formData.fathers_name} onChange={handleChange} placeholder="Enter father's name" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>MOTHER'S NAME</label>
        <input type="text" name="mothers_name" value={formData.mothers_name} onChange={handleChange} placeholder="Enter mother's name" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>RELATIONSHIP TO HEAD</label>
        <select
          name="household_relationship"
          value={isCustomRelationship ? "other" : formData.household_relationship}
          onChange={(e) => {
            if (e.target.value === 'other') {
              setIsCustomRelationship(true);
              setFormData(prev => ({...prev, household_relationship: ''}));
            } else {
              setIsCustomRelationship(false);
              handleChange(e);
            }
          }}
          style={inputStyle}
        >
          <option value="">Select Relationship</option>
          <option value="ဦးစီး">Head</option>
          <option value="ဇနီး">Wife</option>
          <option value="သား">Son</option>
          <option value="သမီး">Daughter</option>
          <option value="ချွေးမ">Daughter-in-law</option>
          <option value="မြေး">Grandchild</option>
          <option value="other">Other...</option>
        </select>
        {isCustomRelationship && (
          <input type="text" name="household_relationship" value={formData.household_relationship} onChange={handleChange} placeholder="Enter relationship" style={{ ...inputStyle, marginTop: '8px' }} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} autoFocus />
        )}
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>OCCUPATION</label>
        <input type="text" name="occupation" value={formData.occupation} onChange={handleChange} placeholder="Enter occupation" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>PREVIOUS ID NO. (NRC)</label>
        <input type="text" name="previous_id_no" value={formData.previous_id_no} onChange={handleChange} placeholder="Enter NRC number" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>TA'ANG LAND ID NO.</label>
        <input type="text" name="taang_land_id_no" value={formData.taang_land_id_no} onChange={handleChange} placeholder="Enter Ta'ang Land ID number" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>NATIONALITY</label>
        <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} placeholder="Ta'ang" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>RESIDENT STATUS</label>
        <select name="resident_status" value={formData.resident_status} onChange={handleChange} style={inputStyle}>
          <option value="">Select status</option>
          <option value="တအာင်း">တအာင်း</option>
          <option value="ပြည်နယ်ခြားသား">ပြည်နယ်ခြားသား</option>
        </select>
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>RELIGION</label>
        <select
          name="religious"
          value={isCustomReligion ? "other" : formData.religious}
          onChange={(e) => {
            if (e.target.value === 'other') {
              setIsCustomReligion(true);
              setFormData(prev => ({...prev, religious: ''}));
            } else {
              setIsCustomReligion(false);
              handleChange(e);
            }
          }}
          style={inputStyle}
        >
          <option value="">Select religion</option>
          <option value="ဗုဒ္ဓ">ဗုဒ္ဓ</option>
          <option value="ခရစ်ယာန်">ခရစ်ယာန်</option>
          <option value="အစ္စလာမ်">အစ္စလာမ်</option>
          <option value="ဟိန္ဒူ">ဟိန္ဒူ</option>
          <option value="နတ်">နတ်</option>
          <option value="other">Other...</option>
        </select>
        {isCustomReligion && (
          <input type="text" name="religious" value={formData.religious} onChange={handleChange} placeholder="Enter religion name" style={{ ...inputStyle, marginTop: '8px' }} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} autoFocus />
        )}
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>HOUSE NO.</label>
        <input type="text" name="house_no" value={formData.house_no} onChange={handleChange} placeholder="Enter house number" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>WARD / VILLAGE / GROUP</label>
        <input type="text" name="ward_village_group" value={formData.ward_village_group} onChange={handleChange} placeholder="Enter ward, village, or group name" style={{ ...inputStyle, borderColor: wardVillageError ? '#EF4444' : undefined }} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
        {wardVillageError && <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#EF4444', fontWeight: '500' }}>{wardVillageError}</p>}
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>TOWNSHIP</label>
        <input type="text" name="township" value={formData.township} onChange={handleChange} placeholder="Enter township name" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>DISTRICT</label>
        <input type="text" name="district" value={formData.district} onChange={handleChange} placeholder="Enter district name" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>SUBMISSION DATE</label>
        <MyanmarCalendar
          value={formData.submission_date}
          onChange={(val) => setFormData(prev => ({ ...prev, submission_date: val }))}
        />
      </div>

    </div>
  ), [formData, dob, autoFillMessage, isCustomRelationship, isCustomReligion, handleChange, handleDobChange, checkHouseholdExists, inputStyle, labelStyle, groupStyle, days, months, years, toMyanmarNum, wardVillageError]);

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8 xl:p-10 max-w-7xl xl:max-w-[1440px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>HOUSEHOLD REGISTRATION</h2>
          <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>Please fill out the form to register household members.</p>
        </div>
        <button
          type="button"
          onClick={openForm}
          onMouseOver={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = '#1A1A1A'; }}
          onMouseOut={e => { e.currentTarget.style.backgroundColor = '#1A1A1A'; e.currentTarget.style.color = '#FFFFFF'; }}
          style={{
            padding: '8px 20px', border: '1px solid #1A1A1A', backgroundColor: '#1A1A1A',
            color: '#FFFFFF', fontWeight: '500', fontSize: '12px', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
            transition: 'background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1)',
          }}
        >
          + ADD MEMBER
        </button>
      </div>

      {/* ── REGISTRATION MODAL ── */}
      {formOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: window.innerWidth < 768 ? '0' : '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
            width: '100%', maxWidth: '1080px',
            height: window.innerWidth < 768 ? '100%' : 'auto',
            maxHeight: window.innerWidth < 768 ? '100dvh' : '96vh',
            display: 'flex', flexDirection: 'column',
            borderRadius: '0px'
          }}>
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  HOUSEHOLD REGISTRATION
                </h3>
                <p style={{ margin: '1px 0 0', fontSize: '10px', color: '#737373' }}>
                  Please fill out the form to register household members.
                </p>
              </div>
              <button onClick={closeForm} type="button" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#737373', lineHeight: 1 }}>&times;</button>
            </div>

            {/* Alerts inside modal */}
            {draftRestored && (
              <div style={{ margin: '12px 24px 0', padding: '8px 12px', border: '1px solid #E5E7EB', backgroundColor: '#F3F4F6', color: '#1A1A1A', fontSize: '11px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📋 Draft restored — your previous unsaved data has been reloaded.</span>
                <button type="button" onClick={() => { localStorage.removeItem(DRAFT_KEY); setDraftRestored(false); }} style={{ background: 'none', border: '1px solid #E5E7EB', fontSize: '10px', cursor: 'pointer', padding: '2px 8px', color: '#737373', textTransform: 'uppercase' }}>Clear</button>
              </div>
            )}
            {savedOffline && (
              <div style={{ margin: '12px 24px 0', padding: '8px 12px', border: '1px solid #E5E7EB', backgroundColor: '#F3F4F6', color: '#1A1A1A', fontSize: '11px', flexShrink: 0 }}>
                📶 Saved locally — will sync automatically when internet is restored.
              </div>
            )}
            {success && (
              <div style={{ margin: '12px 24px 0', padding: '10px 12px', border: '1px solid #A5D6A7', backgroundColor: '#F0F7F0', color: '#1B5E20', fontSize: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#2E7D32', fontSize: '16px' }}>✓</span>
                Member record saved successfully.
              </div>
            )}
            {error && (
              <div style={{ margin: '12px 24px 0', padding: '10px 12px', border: '1px solid #E5E7EB', color: '#1A1A1A', fontSize: '12px', flexShrink: 0 }}>
                {error}
              </div>
            )}

            {/* Scrollable form body */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '14px 20px', paddingBottom: window.innerWidth < 768 ? '80px' : '14px' }}>
              <form id="registration-form" onSubmit={(e) => { e.preventDefault(); submitForm('SAME_HOUSEHOLD'); }}>
                {formFieldsJSX}
              </form>
            </div>

            {/* Sticky footer buttons */}
            <div style={{
              padding: '10px 20px', borderTop: '1px solid #E5E7EB',
              display: 'flex', justifyContent: 'flex-end', gap: '12px', flexShrink: 0,
              backgroundColor: '#FAFAFA'
            }}>
              <button type="button" onClick={closeForm} style={{
                padding: '8px 16px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                color: '#1A1A1A', fontWeight: '500', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase'
              }}>
                CANCEL
              </button>
              <button type="button" onClick={() => submitForm('SAME_HOUSEHOLD')} disabled={loading} style={{
                padding: '8px 16px', border: '1px solid #1A1A1A', backgroundColor: '#FFFFFF',
                color: '#1A1A1A', fontWeight: '500', fontSize: '12px',
                cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase'
              }}>
                {loading ? 'SAVING...' : 'ADD MEMBER'}
              </button>
              <button type="button" onClick={clearForNewHousehold}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = '#1A1A1A'; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#1A1A1A'; e.currentTarget.style.color = '#FFFFFF'; }}
                style={{
                  padding: '8px 16px', border: '1px solid #1A1A1A', backgroundColor: '#1A1A1A',
                  color: '#FFFFFF', fontWeight: '500', fontSize: '12px',
                  cursor: 'pointer', textTransform: 'uppercase',
                  transition: 'background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1)',
              }}>
                NEW HOUSEHOLD
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Table for submitted members */}
      {submittedMembers.length > 0 && (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ fontSize: '12px', margin: 0, color: '#1A1A1A', fontWeight: '600', textTransform: 'uppercase' }}>RECENTLY ADDED</h3>
            {totalFamilyMembers > 0 && (
              <span style={{ fontSize: '11px', border: '1px solid #E5E7EB', color: '#737373', padding: '2px 8px', fontFamily: 'var(--font-mono)' }}>
                {totalFamilyMembers} MEMBERS
              </span>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>No.</th>
                  <th style={thStyle}>Household No.</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Date of Birth</th>
                  <th style={thStyle}>Gender</th>
                  <th style={thStyle}>Father's Name</th>
                  <th style={thStyle}>Mother's Name</th>
                  <th style={thStyle}>Relationship</th>
                  <th style={thStyle}>Occupation</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {submittedMembers.map((member, index) => (
                  <tr key={index} style={{ backgroundColor: '#FFFFFF' }}>
                    <td style={tdMonoS}>{index + 1}</td>
                    <td style={{ ...tdMonoS, fontWeight: '600' }}>{member.household_no}</td>
                    <td style={{ ...tdStyle, fontWeight: '500' }}>{member.name}</td>
                    <td style={tdMonoS}>{member.date_of_birth}</td>
                    <td style={tdStyle}>{member.gender}</td>
                    <td style={tdStyle}>{member.fathers_name}</td>
                    <td style={tdStyle}>{member.mothers_name}</td>
                    <td style={tdStyle}>{member.household_relationship}</td>
                    <td style={tdStyle}>{member.occupation}</td>
                    <td style={tdStyle}>
                      <button onClick={() => handleViewFamily(member.household_no)} type="button" style={{
                        padding: '4px 10px',
                        border: '1px solid #1A1A1A',
                        backgroundColor: '#FFFFFF',
                        color: '#1A1A1A',
                        fontSize: '11px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        textTransform: 'uppercase'
                      }}
                      >
                        VIEW FAMILY
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Family Modal */}
      {viewFamilyModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '32px', border: '1px solid #E5E7EB', width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #E5E7EB', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#1A1A1A', fontSize: '14px', fontWeight: '600', textTransform: 'uppercase' }}>FAMILY MEMBERS</h3>
                <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>အိမ်ထောင်စုစာရင်းအမှတ်ရှိ မိသားစုဝင်အားလုံး</p>
              </div>
              <button onClick={() => setViewFamilyModalOpen(false)} type="button" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#1A1A1A' }}>&times;</button>
            </div>
            
            {viewFamilyLoading ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#737373', fontSize: '12px' }}>LOADING...</div>
            ) : viewFamilyData.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#737373', fontSize: '12px' }}>NO MEMBERS FOUND</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAFAFA' }}>
                    <th style={{ padding: '10px', textAlign: 'left', color: '#737373', fontSize: '10px', fontWeight: '600', borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase' }}>အမည် (NAME)</th>
                    <th style={{ padding: '10px', textAlign: 'left', color: '#737373', fontSize: '10px', fontWeight: '600', borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase' }}>တော်စပ်ပုံ (REL)</th>
                    <th style={{ padding: '10px', textAlign: 'left', color: '#737373', fontSize: '10px', fontWeight: '600', borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase' }}>ကျား/မ (GENDER)</th>
                  </tr>
                </thead>
                <tbody>
                  {viewFamilyData.map((member, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '10px', fontWeight: '500', color: '#1A1A1A', fontSize: '12px' }}>{member.name}</td>
                      <td style={{ padding: '10px', color: '#737373', fontSize: '12px' }}>{member.household_relationship}</td>
                      <td style={{ padding: '10px', color: '#737373', fontSize: '12px' }}>{member.gender}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HouseholdForm;
