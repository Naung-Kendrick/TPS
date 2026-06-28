import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Pencil, Trash2, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { enqueue } from '../lib/retryQueue';
import { getSecureItem, setSecureItem, removeSecureItem } from '../lib/secureStorage';
import EditHouseholdModal from './EditHouseholdModal';

// ─── Custom Responsive Form Dropdown Selector ─────────────────────
const FormCustomSelect = ({ name, value, onChange, options, placeholder, style }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const selectedItem = options.find(o => (typeof o === 'object' ? o.value === value : o === value));
  const selectedLabel = selectedItem ? (typeof selectedItem === 'object' ? selectedItem.label : selectedItem) : placeholder;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          height: '34px',
          padding: '0 10px',
          marginTop: '3px',
          borderRadius: '0px',
          border: '1px solid #E5E7EB',
          fontSize: '9.5px',
          fontFamily: "Inter, 'Pyidaungsu', sans-serif",
          backgroundColor: '#FFFFFF',
          boxSizing: 'border-box',
          color: value ? '#1A1A1A' : '#737373',
          lineHeight: '1.2',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '9.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel}
        </span>
        <ChevronDown size={12} color="#737373" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 2px)',
          left: 0, right: 0,
          backgroundColor: '#FFFFFF',
          border: '1px solid #1A1A1A',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: '220px',
          overflowY: 'auto',
          zIndex: 999,
          borderRadius: '0px',
        }}>
          {placeholder && (
            <div
              onClick={() => { onChange({ target: { name, value: '' } }); setOpen(false); }}
              style={{
                padding: '10px 12px',
                fontSize: '12px',
                color: !value ? '#FFFFFF' : '#1A1A1A',
                backgroundColor: !value ? '#1A1A1A' : '#FFFFFF',
                fontWeight: !value ? '600' : '400',
                cursor: 'pointer',
                borderBottom: '1px solid #F3F4F6',
              }}
            >
              {placeholder}
            </div>
          )}
          {options.map(opt => {
            const optVal = typeof opt === 'object' ? opt.value : opt;
            const optLbl = typeof opt === 'object' ? opt.label : opt;
            const isSelected = value === optVal;
            return (
              <div
                key={optVal}
                onClick={() => { onChange({ target: { name, value: optVal } }); setOpen(false); }}
                style={{
                  padding: '10px 12px',
                  fontSize: '12px',
                  color: isSelected ? '#FFFFFF' : '#1A1A1A',
                  backgroundColor: isSelected ? '#1A1A1A' : '#FFFFFF',
                  fontWeight: isSelected ? '600' : '400',
                  cursor: 'pointer',
                  borderBottom: '1px solid #F9FAFB',
                }}
              >
                {optLbl}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
          width: '100%', height: '30px', padding: '0 10px', borderRadius: '0px', border: '1px solid #E5E7EB',
          fontSize: '11px', marginTop: '3px', boxSizing: 'border-box',
          fontFamily: "Inter, 'Pyidaungsu', sans-serif", backgroundColor: '#FFFFFF', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}
      >
        <span style={{ fontSize: '11px', color: value ? '#1A1A1A' : '#737373' }}>
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

  // Convert any separator (-, /, space, fullwidth period, ideographic period, Myanmar punctuation, commas) to "."
  s = s.replace(/[-\/．。။၊,]/g, '.');

  // If exactly 3 numeric parts, zero-pad day and month to 2 digits each.
  // Also expand 2-digit years to 4-digit years (e.g., 15 -> 2015, 85 -> 1985)
  const parts = s.split('.');
  if (parts.length === 3 && parts.every(p => /^\d+$/.test(myanmarToArabicDigits(p)))) {
    const [d, m, y] = parts;
    const padArabic = (v) => {
      const arabic = myanmarToArabicDigits(v);
      return arabic.length === 1 ? '0' + arabic : arabic;
    };
    const padArabicYear = (v) => {
      let arabic = myanmarToArabicDigits(v);
      if (arabic.length === 2) {
        const yr = parseInt(arabic, 10);
        arabic = String(yr >= 30 ? 1900 + yr : 2000 + yr);
      }
      return arabic;
    };
    // Format to standard English date first, then map everything to Myanmar digits
    const englishDob = `${padArabic(d)}.${padArabic(m)}.${padArabicYear(y)}`;
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

const DISTRICTS = ['နမ့်ခမ်း ခရိုင်', 'နမ့်ဆန် ခရိုင်', 'မန်တုံ ခရိုင်'];

const HouseholdForm = ({ user }) => {
  const districtFilter = (user?.access_level !== 'central' && user?.allowed_districts?.length > 0)
    ? user.allowed_districts : null;
  const townshipFilter = ((user?.access_level === 'township' || user?.access_level === 'sub_township') && user?.allowed_townships?.length > 0)
    ? user.allowed_townships : null;
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
  const [familyRoster, setFamilyRoster] = useState([]);
  const [editingMember, setEditingMember] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewFamilyModalOpen, setViewFamilyModalOpen] = useState(false);
  const [viewFamilyData, setViewFamilyData] = useState([]);
  const [viewFamilyLoading, setViewFamilyLoading] = useState(false);

  const [dob, setDob] = useState({ day: '', month: '', year: '' });
  const [wardVillageError, setWardVillageError] = useState('');
  const [householdNoError, setHouseholdNoError] = useState('');
  const [taangLandIdError, setTaangLandIdError] = useState('');

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = getSecureItem(DRAFT_KEY);
      if (saved) {
        const { formData: savedForm, dob: savedDob } = saved;
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
      setSecureItem(DRAFT_KEY, { formData, dob });
    } catch (_) {}
  }, [formData, dob]);

  useEffect(() => {
    const dobString = [dob.day, dob.month, dob.year].filter(Boolean).join('.');
    const normalized = normalizeDateOfBirth(dobString);
    setFormData(prev => ({ ...prev, date_of_birth: normalized }));
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

  const fetchFamilyRoster = useCallback(async (householdNo) => {
    if (!householdNo) {
      setFamilyRoster([]);
      setTotalFamilyMembers(0);
      return;
    }
    try {
      const normalizedHn = normalizeHouseholdNo(householdNo);
      const { data, error } = await supabase
        .from('households')
        .select('*')
        .ilike('household_no', `%${normalizedHn}%`)
        .order('created_at', { ascending: true });
        
      if (!error && data) {
        setFamilyRoster(data);
        setTotalFamilyMembers(data.length);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.household_no) {
        fetchFamilyRoster(formData.household_no);
      } else {
        setFamilyRoster([]);
        setTotalFamilyMembers(0);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.household_no, fetchFamilyRoster]);

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

  // Auto-format Household No: "ကောင်းတပ်-၁" → "ကောင်းတပ် - ၁"
  const formatHouseholdNo = (value) => {
    if (!value) return value;
    let v = String(value).replace(/\s*-\s*/g, '-');
    v = v.replace(/-/g, ' - ');
    v = v.replace(/  +/g, ' ').trim();
    return v;
  };

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

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;

    // Validate household_no on change
    if (name === 'household_no') {
      const err = validateHouseholdNoFormat(value);
      setHouseholdNoError(err);
      setFormData(prev => ({ ...prev, [name]: value }));
      return;
    }

    // Validate taang_land_id_no on change
    if (name === 'taang_land_id_no') {
      const err = validateTaangLandIdFormat(value);
      setTaangLandIdError(err);
      setFormData(prev => ({ ...prev, [name]: value }));
      return;
    }

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

  const checkHouseholdExists = useCallback(async (explicitValue) => {
    const val = explicitValue || formData.household_no;
    if (!val) return;
    
    try {
      const normalizedHn = normalizeHouseholdNo(val);
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

  const handleHouseholdNoBlur = useCallback(() => {
    if (!formData.household_no) {
      setHouseholdNoError('အိမ်ထောင်စုအမှတ် ဖြည့်စွက်ရန် လိုအပ်ပါသည် (Household No. is required)');
      return;
    }
    const err = validateHouseholdNoFormat(formData.household_no);
    setHouseholdNoError(err);
    if (!err) {
      const formatted = formatHouseholdNo(formData.household_no);
      setFormData(prev => ({ ...prev, household_no: formatted }));
      checkHouseholdExists(formatted);
    }
  }, [formData.household_no, checkHouseholdExists]);

  const submitForm = async (mode) => {
    if (!formData.household_no || !formData.name) {
      setError('ကျေးဇူးပြု၍ မရှိမဖြစ်လိုအပ်သောအချက်အလက်များကို ဖြည့်စွက်ပါ။ (Please fill required fields)');
      return;
    }

    const hhError = validateHouseholdNoFormat(formData.household_no);
    if (hhError) {
      setHouseholdNoError(hhError);
      setError('အိမ်ထောင်စုအမှတ် ပုံစံမမှန်ပါ။ (Household No. format is incorrect)');
      return;
    }

    const tlidError = validateTaangLandIdFormat(formData.taang_land_id_no);
    if (tlidError) {
      setTaangLandIdError(tlidError);
      setError("Ta'ang Land ID No. ပုံစံမမှန်ပါ။ (Ta'ang Land ID No. format is incorrect)");
      return;
    }

    const normalizedDob = normalizeDateOfBirth(formData.date_of_birth);
    const dobError = validateDateOfBirth(normalizedDob);
    if (dobError) {
      setError(dobError);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    // Add the detected types to the payload (array) and ensure standard formatted household_no
    const payload = {
      ...formData,
      date_of_birth: normalizedDob,
      household_no: formatHouseholdNo(formData.household_no),
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
      setSubmittedMembers(prev => [...prev, payload]);
      fetchFamilyRoster(payload.household_no);
      removeSecureItem(DRAFT_KEY);
      
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
    height: '34px',
    padding: '0 10px',
    borderRadius: '0px',
    border: '1px solid #E5E7EB',
    fontSize: '9.5px',
    marginTop: '3px',
    boxSizing: 'border-box',
    fontFamily: "Inter, 'Pyidaungsu', sans-serif",
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

  const rosterThStyle = {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: '10px',
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #E5E7EB',
  };

  const rosterTdStyle = {
    padding: '10px 12px',
    fontSize: '12px',
    color: '#111827',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  };

  const handleDeleteMember = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name || 'this member'}?`)) return;
    try {
      const { error } = await supabase.from('households').delete().eq('id', id);
      if (!error) {
        fetchFamilyRoster(formData.household_no);
      } else {
        alert('Failed to delete: ' + error.message);
      }
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

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
    setHouseholdNoError('');
    setTaangLandIdError('');
    removeSecureItem(DRAFT_KEY);
  }, [DRAFT_KEY]);

  const formFieldsJSX = useMemo(() => (
    <div className="tps-grid tps-grid-4" style={{ gap: '10px 14px', alignItems: 'start' }}>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>HOUSEHOLD NO.</label>
        <input 
          type="text" 
          name="household_no" 
          value={formData.household_no} 
          onChange={handleChange} 
          onBlur={handleHouseholdNoBlur} 
          placeholder="Enter household number" 
          style={{ 
            ...inputStyle, 
            fontFamily: 'var(--font-mono)',
            borderColor: householdNoError ? '#EF4444' : undefined 
          }} 
          autoComplete="off" 
          autoCorrect="off" 
          autoCapitalize="off" 
          spellCheck={false} 
          required 
        />
        {householdNoError && <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#EF4444', fontWeight: '500' }}>{householdNoError}</p>}
        {autoFillMessage && <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#737373', fontWeight: '600' }}>{autoFillMessage}</p>}
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>NAME</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter full name" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} required />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>DATE OF BIRTH</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <FormCustomSelect
            name="day"
            value={dob.day}
            onChange={handleDobChange}
            options={days}
            placeholder="Day"
            style={{ flex: '0 0 28%' }}
          />
          <FormCustomSelect
            name="month"
            value={dob.month}
            onChange={handleDobChange}
            options={months.map((m, i) => ({ value: toMyanmarNum(i + 1), label: toMyanmarNum(i + 1) }))}
            placeholder="Month"
            style={{ flex: '0 0 38%' }}
          />
          <FormCustomSelect
            name="year"
            value={dob.year}
            onChange={handleDobChange}
            options={years}
            placeholder="Year"
            style={{ flex: '1 1 0' }}
          />
        </div>
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>GENDER</label>
        <FormCustomSelect
          name="gender"
          value={formData.gender}
          onChange={handleChange}
          options={['ကျား', 'မ']}
          placeholder="Select Gender"
        />
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
        <FormCustomSelect
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
          options={[
            { value: 'ဦးစီး', label: 'ဦးစီး' },
            { value: 'ဇနီး', label: 'ဇနီး' },
            { value: 'သား', label: 'သား' },
            { value: 'သမီး', label: 'သမီး' },
            { value: 'ချွေးမ', label: 'ချွေးမ' },
            { value: 'မြေး', label: 'မြေး' },
            { value: 'other', label: 'အခြား...' }
          ]}
          placeholder="Select Relationship"
        />
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
        <input 
          type="text" 
          name="taang_land_id_no" 
          value={formData.taang_land_id_no} 
          onChange={handleChange} 
          placeholder="Enter Ta'ang Land ID number" 
          style={{ 
            ...inputStyle, 
            fontFamily: 'var(--font-mono)',
            borderColor: taangLandIdError ? '#EF4444' : undefined 
          }} 
          autoComplete="off" 
          autoCorrect="off" 
          autoCapitalize="off" 
          spellCheck={false} 
        />
        {taangLandIdError && <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#EF4444', fontWeight: '500' }}>{taangLandIdError}</p>}
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>NATIONALITY</label>
        <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} placeholder="Ta'ang" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>RESIDENT STATUS</label>
        <FormCustomSelect
          name="resident_status"
          value={formData.resident_status}
          onChange={handleChange}
          options={['တအာင်း', 'ပြည်နယ်ခြားသား']}
          placeholder="Select Resident Status"
        />
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>RELIGION</label>
        <FormCustomSelect
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
          options={[
            { value: 'ဗုဒ္ဓ', label: 'ဗုဒ္ဓ' },
            { value: 'ခရစ်ယာန်', label: 'ခရစ်ယာန်' },
            { value: 'အစ္စလာမ်', label: 'အစ္စလာမ်' },
            { value: 'ဟိန္ဒူ', label: 'ဟိန္ဒူ' },
            { value: 'နတ်', label: 'နတ်' },
            { value: 'other', label: 'အခြား...' }
          ]}
          placeholder="Select Religion"
        />
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
        {townshipFilter ? (
          <FormCustomSelect
            name="township"
            value={formData.township}
            onChange={handleChange}
            options={townshipFilter}
            placeholder="-- Select Township --"
          />
        ) : (
          <input type="text" name="township" value={formData.township} onChange={handleChange} placeholder="Enter township name" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
        )}
      </div>

      <div style={{ ...groupStyle, gridColumn: 'span 1' }}>
        <label style={labelStyle}>DISTRICT</label>
        {districtFilter ? (
          <FormCustomSelect
            name="district"
            value={formData.district}
            onChange={handleChange}
            options={districtFilter}
            placeholder="-- Select District --"
          />
        ) : (
          <input type="text" name="district" value={formData.district} onChange={handleChange} placeholder="Enter district name" style={inputStyle} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
        )}
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
          <p style={{ margin: 0, color: '#737373', fontSize: '12px', fontFamily: "'Inter', sans-serif", letterSpacing: '0.01em' }}>Please fill out the form to register household members.</p>
        </div>
      </div>

      {/* ── INLINE INPUT DATA LAYOUT BOX ── */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0px', overflow: 'hidden' }}>
        {/* Panel Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              INPUT DATA FORM — MEMBER REGISTRATION
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6B7280' }}>
              Fill in member credentials to record civil registry details.
            </p>
          </div>
        </div>

        {/* Alerts inside input box */}
        {draftRestored && (
          <div style={{ margin: '12px 20px 0', padding: '8px 12px', border: '1px solid #E5E7EB', backgroundColor: '#F3F4F6', color: '#1A1A1A', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>📋 Draft restored — your previous unsaved data has been reloaded.</span>
            <button type="button" onClick={() => { removeSecureItem(DRAFT_KEY); setDraftRestored(false); }} style={{ background: 'none', border: '1px solid #E5E7EB', fontSize: '10px', cursor: 'pointer', padding: '2px 8px', color: '#737373', textTransform: 'uppercase' }}>Clear</button>
          </div>
        )}
        {savedOffline && (
          <div style={{ margin: '12px 20px 0', padding: '8px 12px', border: '1px solid #E5E7EB', backgroundColor: '#F3F4F6', color: '#1A1A1A', fontSize: '11px' }}>
            📶 Saved locally — will sync automatically when internet is restored.
          </div>
        )}
        {success && (
          <div style={{ margin: '12px 20px 0', padding: '10px 12px', border: '1px solid #A5D6A7', backgroundColor: '#F0F7F0', color: '#1B5E20', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#2E7D32', fontSize: '16px' }}>✓</span>
            Member record saved successfully.
          </div>
        )}
        {error && (
          <div style={{ margin: '12px 20px 0', padding: '10px 12px', border: '1px solid #FEE2E2', backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: '12px' }}>
            {error}
          </div>
        )}

        {/* Form Body */}
        <div style={{ padding: '20px' }}>
          <form id="registration-form" onSubmit={(e) => { e.preventDefault(); submitForm('SAME_HOUSEHOLD'); }}>
            {formFieldsJSX}
          </form>
        </div>

        {/* Action Buttons Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #E5E7EB',
          display: 'flex', justifyContent: 'flex-end', gap: '12px',
          backgroundColor: '#FAFAFA'
        }}>
          <button type="button" onClick={clearForNewHousehold}
            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
            onMouseOut={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            style={{
              padding: '8px 16px', border: '1px solid #1A1A1A', backgroundColor: '#FFFFFF',
              color: '#1A1A1A', fontWeight: '500', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
              transition: 'background-color 120ms cubic-bezier(0.23,1,0.32,1)'
            }}>
            CLEAR FORM
          </button>
          <button type="button" onClick={() => submitForm('SAME_HOUSEHOLD')} disabled={loading}
            onMouseOver={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = '#1A1A1A'; } }}
            onMouseOut={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#1A1A1A'; e.currentTarget.style.color = '#FFFFFF'; } }}
            style={{
              padding: '8px 16px', border: '1px solid #1A1A1A', backgroundColor: '#1A1A1A',
              color: '#FFFFFF', fontWeight: '500', fontSize: '11px',
              cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
              transition: 'background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1)'
            }}>
            {loading ? 'SAVING...' : '+ ADD MEMBER'}
          </button>
          <button type="button" onClick={() => submitForm('NEW_HOUSEHOLD')} disabled={loading}
            onMouseOver={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = '#1A1A1A'; } }}
            onMouseOut={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#1A1A1A'; e.currentTarget.style.color = '#FFFFFF'; } }}
            style={{
              padding: '8px 16px', border: '1px solid #1A1A1A', backgroundColor: '#1A1A1A',
              color: '#FFFFFF', fontWeight: '500', fontSize: '11px',
              cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
              transition: 'background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1)'
            }}>
            NEW HOUSEHOLD
          </button>
        </div>
      </div>


      {/* Family Records Table matching user design */}
      {(() => {
        const activeHhNo = formData.household_no || (familyRoster[0]?.household_no) || (submittedMembers[submittedMembers.length - 1]?.household_no) || '';
        const targetNormalized = normalizeHouseholdNo(activeHhNo);

        if (!targetNormalized) return null;

        const matchingDb = familyRoster.filter(m => normalizeHouseholdNo(m.household_no) === targetNormalized);
        const matchingSubmitted = submittedMembers.filter(m => normalizeHouseholdNo(m.household_no) === targetNormalized);

        const combined = [...matchingDb];
        matchingSubmitted.forEach(sm => {
          if (!combined.some(fm => fm.name === sm.name && (fm.id ? fm.id === sm.id : fm.date_of_birth === sm.date_of_birth))) {
            combined.push(sm);
          }
        });
        const displayMembers = combined;
        const hhNoDisplay = activeHhNo || displayMembers[0]?.household_no || '—';
        
        if (displayMembers.length === 0 && !formData.household_no) return null;

        return (
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0px', overflow: 'hidden', marginTop: '12px' }}>
            {/* Header Bar matching image */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                FAMILY RECORDS: {hhNoDisplay || '—'}
              </div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {displayMembers.length} MEMBERS
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
                    <th style={rosterThStyle}>NO.</th>
                    <th style={rosterThStyle}>NAME</th>
                    <th style={rosterThStyle}>DATE OF BIRTH</th>
                    <th style={rosterThStyle}>GENDER</th>
                    <th style={rosterThStyle}>FATHER'S NAME</th>
                    <th style={rosterThStyle}>MOTHER'S NAME</th>
                    <th style={rosterThStyle}>RELATIONSHIP</th>
                    <th style={rosterThStyle}>OCCUPATION</th>
                    <th style={rosterThStyle}>PREVIOUS ID NO.</th>
                    <th style={rosterThStyle}>TA'ANG LAND ID NO.</th>
                    <th style={rosterThStyle}>NATIONALITY</th>
                    <th style={rosterThStyle}>RESIDENT STATUS</th>
                    <th style={rosterThStyle}>RELIGIOUS</th>
                    <th style={rosterThStyle}>SUBMISSION DATE</th>
                    <th style={{ ...rosterThStyle, textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {displayMembers.length === 0 ? (
                    <tr>
                      <td colSpan={15} style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px' }}>
                        No members registered yet for this household.
                      </td>
                    </tr>
                  ) : (
                    displayMembers.map((member, index) => {
                      const rel = member.household_relationship || '';
                      const isHead = rel === 'ဦးစီး' || rel.toLowerCase() === 'head';
                      const rawSub = member.submission_date || (member.created_at ? new Date(member.created_at).toLocaleDateString('en-GB').replace(/\//g, '.') : '—');
                      const subDate = rawSub;

                      return (
                        <tr key={member.id || index} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: index % 2 === 1 ? '#FAFAFA' : '#FFFFFF' }}>
                          <td style={{ ...rosterTdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{index + 1}</td>
                          <td style={{ ...rosterTdStyle, fontWeight: '600' }}>
                            {member.name}
                            {isHead && (
                              <span style={{ marginLeft: '6px', padding: '1px 4px', fontSize: '9px', fontWeight: '700', border: '1px solid #4B5563', borderRadius: '2px', color: '#374151', textTransform: 'uppercase', display: 'inline-block', verticalAlign: 'middle', lineHeight: '1.2' }}>
                                HEAD
                              </span>
                            )}
                          </td>
                          <td style={{ ...rosterTdStyle, fontFamily: 'var(--font-mono)' }}>{member.date_of_birth || '—'}</td>
                          <td style={rosterTdStyle}>{member.gender || '—'}</td>
                          <td style={rosterTdStyle}>{member.fathers_name || member.father_name || '—'}</td>
                          <td style={rosterTdStyle}>{member.mothers_name || member.mother_name || '—'}</td>
                          <td style={rosterTdStyle}>{member.household_relationship || '—'}</td>
                          <td style={rosterTdStyle}>{member.occupation || '—'}</td>
                          <td style={{ ...rosterTdStyle, fontFamily: 'var(--font-mono)' }}>{member.previous_id_no || member.nrc || '—'}</td>
                          <td style={{ ...rosterTdStyle, fontFamily: 'var(--font-mono)' }}>{member.taang_land_id_no || '—'}</td>
                          <td style={rosterTdStyle}>{member.nationality || '—'}</td>
                          <td style={rosterTdStyle}>{member.resident_status || '—'}</td>
                          <td style={rosterTdStyle}>{member.religious || member.religion || '—'}</td>
                          <td style={{ ...rosterTdStyle, fontFamily: 'var(--font-mono)' }}>{subDate}</td>
                          <td style={{ ...rosterTdStyle, textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => { setEditingMember(member); setIsEditModalOpen(true); }}
                                style={{ padding: '4px 6px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Edit Member"
                              >
                                <Pencil size={13} color="#6B7280" />
                              </button>
                              {member.id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(member.id, member.name)}
                                  style={{ padding: '4px 6px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="Delete Member"
                                >
                                  <Trash2 size={13} color="#9CA3AF" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Edit Household Modal */}
      {isEditModalOpen && (
        <EditHouseholdModal
          household={editingMember}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onUpdateSuccess={() => fetchFamilyRoster(formData.household_no)}
        />
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
