import React, { useState, useEffect } from 'react';
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
          {value || 'ရက်စွဲရွေးချယ်ပါ (SELECT DATE)'}
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

  const toMyanmarNum = (num) => {
    const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
    return num.toString().split('').map(digit => myanmarNumbers[parseInt(digit)] || digit).join('');
  };

  const days = Array.from({length: 31}, (_, i) => toMyanmarNum(i + 1));
  const months = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'];
  const years = Array.from({length: 107}, (_, i) => toMyanmarNum(2026 - i));

  const handleDobChange = (e) => {
    const { name, value } = e.target;
    setDob(prev => ({ ...prev, [name]: value }));
  };

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const checkHouseholdExists = async () => {
    if (!formData.household_no) return;
    
    try {
      const { data, error: fetchError } = await supabase
        .from('households')
        .select('house_no, ward_village_group, township, district, resident_status, religious, nationality')
        .eq('household_no', formData.household_no)
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
  };

  const submitForm = async (mode) => {
    if (!formData.household_no || !formData.name) {
      setError('ကျေးဇူးပြု၍ မရှိမဖြစ်လိုအပ်သောအချက်အလက်များကို ဖြည့်စွက်ပါ။ (Please fill required fields)');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let savedLocally = false;

      if (!navigator.onLine) {
        // Device is offline — queue the write
        enqueue({ table: 'households', type: 'insert', payload: { ...formData } });
        savedLocally = true;
      } else {
        const { error: supabaseError } = await supabase
          .from('households')
          .insert([formData]);

        if (supabaseError) {
          // Network error mid-request — queue it
          enqueue({ table: 'households', type: 'insert', payload: { ...formData } });
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

  const inputStyle = {
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
  };

  const labelStyle = {
    fontSize: '9px',
    fontWeight: '600',
    color: '#737373',
    display: 'block',
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  };

  const groupStyle = {
    marginBottom: '4px',
  };

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

  const FormFields = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 14px' }}>

      <div style={groupStyle}>
        <label style={labelStyle}>အိမ်ထောင်စုစာရင်းအမှတ် (Household No.)</label>
        <input type="text" name="household_no" value={formData.household_no} onChange={handleChange} onBlur={checkHouseholdExists} placeholder="ဥပမာ - မနမ-၁" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} required />
        {autoFillMessage && <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#737373', fontWeight: '600' }}>{autoFillMessage}</p>}
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>အမည် (Name)</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="အမည် ဖြည့်ပါ" style={inputStyle} required />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>မွေးသက္ကရာဇ် (Date of Birth)</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <select name="day" value={dob.day} onChange={handleDobChange} style={{ ...inputStyle, flex: '0 0 28%', fontFamily: 'var(--font-mono)' }}>
            <option value="">ရက်</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select name="month" value={dob.month} onChange={handleDobChange} style={{ ...inputStyle, flex: '0 0 40%' }}>
            <option value="">လ</option>
            {months.map((m, i) => <option key={m} value={toMyanmarNum(i + 1)}>{toMyanmarNum(i + 1)}</option>)}
          </select>
          <select name="year" value={dob.year} onChange={handleDobChange} style={{ ...inputStyle, flex: '1 1 0', fontFamily: 'var(--font-mono)' }}>
            <option value="">နှစ်</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>ကျား / မ (Gender)</label>
        <select name="gender" value={formData.gender} onChange={handleChange} style={inputStyle}>
          <option value="">ရွေးချယ်ပါ</option>
          <option value="ကျား">ကျား</option>
          <option value="မ">မ</option>
        </select>
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>အဘအမည် (Father's Name)</label>
        <input type="text" name="fathers_name" value={formData.fathers_name} onChange={handleChange} placeholder="အဘအမည် ဖြည့်ပါ" style={inputStyle} />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>မိခင်အမည် (Mother's Name)</label>
        <input type="text" name="mothers_name" value={formData.mothers_name} onChange={handleChange} placeholder="မိခင်အမည် ဖြည့်ပါ" style={inputStyle} />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>အိမ်ထောင်ဦးစီးနှင့်တော်စပ်ပုံ (Relationship)</label>
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
          <option value="">ရွေးချယ်ပါ</option>
          <option value="ဦးစီး">ဦးစီး</option>
          <option value="ဇနီး">ဇနီး</option>
          <option value="သား">သား</option>
          <option value="သမီး">သမီး</option>
          <option value="ချွေးမ">ချွေးမ</option>
          <option value="မြေး">မြေး</option>
          <option value="other">အခြား (Other...)</option>
        </select>
        {isCustomRelationship && (
          <input type="text" name="household_relationship" value={formData.household_relationship} onChange={handleChange} placeholder="တော်စပ်ပုံ ရိုက်ထည့်ပါ" style={{ ...inputStyle, marginTop: '8px' }} autoFocus />
        )}
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>အလုပ်အကိုင် (Occupation)</label>
        <input type="text" name="occupation" value={formData.occupation} onChange={handleChange} placeholder="အလုပ်အကိုင် ဖြည့်ပါ" style={inputStyle} />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>ယခင်မှတ်ပုံတင်အမှတ် (Previous ID No.)</label>
        <input type="text" name="previous_id_no" value={formData.previous_id_no} onChange={handleChange} placeholder="ယခင်မှတ်ပုံတင်အမှတ် ဖြည့်ပါ" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>တအာင်းပြည်နယ်မှတ်ပုံတင်အမှတ် (Ta'ang Land ID No.)</label>
        <input type="text" name="taang_land_id_no" value={formData.taang_land_id_no} onChange={handleChange} placeholder="တအာင်းပြည်နယ်မှတ်ပုံတင်အမှတ် ဖြည့်ပါ" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>လူမျိုး (Nationality)</label>
        <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} placeholder="လူမျိုး ဖြည့်ပါ" style={inputStyle} />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>နေထိုင်မှုအခြေအနေ (Resident Status)</label>
        <select name="resident_status" value={formData.resident_status} onChange={handleChange} style={inputStyle}>
          <option value="">ရွေးချယ်ပါ</option>
          <option value="တအာင်း">တအာင်း</option>
          <option value="ပြည်နယ်ခြားသား">ပြည်နယ်ခြားသား</option>
        </select>
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>ကိုးကွယ်သည့်ဘာသာ (Religious)</label>
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
          <option value="">ရွေးချယ်ပါ</option>
          <option value="ဗုဒ္ဓ">ဗုဒ္ဓ</option>
          <option value="ခရစ်ယာန်">ခရစ်ယာန်</option>
          <option value="အစ္စလာမ်">အစ္စလာမ်</option>
          <option value="ဟိန္ဒူ">ဟိန္ဒူ</option>
          <option value="နတ်">နတ်</option>
          <option value="other">အခြား (Other...)</option>
        </select>
        {isCustomReligion && (
          <input type="text" name="religious" value={formData.religious} onChange={handleChange} placeholder="ဘာသာအမည် ရိုက်ထည့်ပါ" style={{ ...inputStyle, marginTop: '8px' }} autoFocus />
        )}
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>အိမ်အမှတ် (House NO.)</label>
        <input type="text" name="house_no" value={formData.house_no} onChange={handleChange} placeholder="အိမ်အမှတ် ဖြည့်ပါ" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>ရပ်ကွက် / ကျေးရွာ / အုပ်စု</label>
        <input type="text" name="ward_village_group" value={formData.ward_village_group} onChange={handleChange} placeholder="ရပ်ကွက် / ကျေးရွာ ဖြည့်ပါ" style={inputStyle} />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>မြို့နယ် (Township)</label>
        <input type="text" name="township" value={formData.township} onChange={handleChange} placeholder="မြို့နယ် ဖြည့်ပါ" style={inputStyle} />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>ခရိုင် (District)</label>
        <input type="text" name="district" value={formData.district} onChange={handleChange} placeholder="ခရိုင် ဖြည့်ပါ" style={inputStyle} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>တင်သွင်းသည့်ရက်စွဲ (Submission Date)</label>
        <MyanmarCalendar
          value={formData.submission_date}
          onChange={(val) => setFormData(prev => ({ ...prev, submission_date: val }))}
        />
      </div>

    </div>
  );

  return (
    <div style={{ padding: '32px' }} className="max-w-7xl mx-auto">
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>HOUSEHOLD REGISTRATION</h2>
          <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>အချက်အလက်များကို ဖြည့်စွက်ပြီး စာရင်းသွင်းပါ။</p>
        </div>
        <button
          type="button"
          onClick={openForm}
          style={{
            padding: '8px 20px', border: '1px solid #1A1A1A', backgroundColor: '#1A1A1A',
            color: '#FFFFFF', fontWeight: '500', fontSize: '12px', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0
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
          zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
            width: '100%', maxWidth: '1080px',
            maxHeight: '96vh', display: 'flex', flexDirection: 'column',
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
                  အချက်အလက်များကို ဖြည့်စွက်ပြီး စာရင်းသွင်းပါ။
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
              <div style={{ margin: '12px 24px 0', padding: '10px 12px', border: '1px solid #E5E7EB', color: '#1A1A1A', fontSize: '12px', flexShrink: 0 }}>
                အချက်အလက်များ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။
              </div>
            )}
            {error && (
              <div style={{ margin: '12px 24px 0', padding: '10px 12px', border: '1px solid #E5E7EB', color: '#1A1A1A', fontSize: '12px', flexShrink: 0 }}>
                {error}
              </div>
            )}

            {/* Scrollable form body */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '14px 20px' }}>
              <form id="registration-form" onSubmit={(e) => { e.preventDefault(); submitForm('SAME_HOUSEHOLD'); }}>
                <FormFields />
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
              <button type="button" onClick={() => submitForm('NEW_HOUSEHOLD')} disabled={loading} style={{
                padding: '8px 16px', border: '1px solid #1A1A1A', backgroundColor: '#1A1A1A',
                color: '#FFFFFF', fontWeight: '500', fontSize: '12px',
                cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase'
              }}>
                {loading ? 'SAVING...' : 'NEW HOUSEHOLD'}
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
