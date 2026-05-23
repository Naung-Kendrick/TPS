import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { zg2uni } from 'rabbit-node';
import { pushNotification, NOTIF_TYPES } from '../lib/notifications';
import { AlertCircle, X, CheckCircle2, Upload, FileSpreadsheet, Loader2, FileJson } from 'lucide-react';

// Basic Zawgyi detector regex
const isZawgyi = (text) => {
  if (!text) return false;
  const zawgyiRegex = /\u1031[\u1000-\u102A]|\u1039[^\u1000-\u102A]/;
  return zawgyiRegex.test(text);
};

const ensureUnicode = (text) => {
  if (!text) return text;
  const str = String(text);
  if (isZawgyi(str)) {
    return zg2uni(str);
  }
  return str;
};

// ==========================================
// MYANMAR UNICODE DICTIONARIES & HELPER CONSTANTS
// ==========================================

// Regex to match a single Myanmar Unicode syllable
// Standard regex handles Consonant + [Stacking mark + Consonant] + [Medial signs] + [Vowel signs] + [Asat/Killer] + [Tone marks]
const MYANMAR_SYLLABLE_PAT = /[\u1000-\u1021\u1023-\u1027\u1029\u102A\u103F\u1040-\u1049\u104E](\u1039[\u1000-\u1021]|[\u103B-\u103E\u105A-\u105D])*\u103A?[\u1037\u1038]?/g;

// Lexical Dictionaries
const DICTS = {
  religions: [
    'ဗုဒ္ဓဘာသာ', // Buddhism
    'ခရစ်ယာန်', // Christianity
    'အစ္စလာမ်', // Islam
    'ဟိန္ဒူ', // Hinduism
    'နတ်ကိုးကွယ်' // Animism
  ],
  nationalities: [
    'တအာင်း', // Ta'ang
    'ဗမာ',     // Bamar
    'ရှမ်း',    // Shan
    'ကချင်',   // Kachin
    'ကရင်',    // Kayin
    'ချင်း',    // Chin
    'မွန်',     // Mon
    'ရခိုင်',   // Rakhine
    'တရုတ်',    // Chinese
    'ကုလား',    // Indian/South Asian
    'ပြည်နယ်ခြားသား' // Out-of-state resident
  ],
  relationships: [
    'ဦးစီး', // Head
    'ဇနီး', // Wife
    'ခင်ပွန်း', // Husband
    'သား', // Son
    'သမီး', // Daughter
    'အဖေ', // Father
    'အမေ', // Mother
    'ညီ', // Younger brother
    'မောင်', // Brother
    'မမ', // Older sister
    'ညီမ', // Younger sister
    'အစ်ကို', // Older brother
    'အစ်မ', // Older sister
    'ဖိုးဖိုး', // Grandfather
    'ဖွားဖွား', // Grandmother
    'မြေး', // Grandchild
    'တူ', // Nephew
    'တူမ', // Niece
    'ဦးလေး', // Uncle
    'ဒေါ်လေး' // Aunt
  ],
  nameSyllables: [
    'မောင်', 'အောင်', 'လှ', 'ထွန်း', 'ဦး', 'ဒေါ်', 'နန်း', 'စိုင်း', 'စိုး', 'မင်း', 'ကျော်', 'ဇော်', 
    'အေး', 'သန်း', 'ဝင်း', 'တင်', 'ကြည်', 'မြ', 'ဟန်', 'လွင်', 'မိုး', 'သူ', 'ဆန်း', 'နိုင်', 'ထက်', 
    'မျိုး', 'ခိုင်', 'စန္ဒာ', 'သီတာ', 'ရတနာ', 'ချို', 'ဝေ', 'ဖြိုး', 'ဇင်', 'သက်', 'နှင်း', 'ယဉ်', 'ဆွေ', 
    'ထွန်း', 'ဆန်း', 'ကျော်', 'လှ', 'နိုင်', 'ကို', 'ဖိုး', 'နန္ဒာ', 'သော်', 'ဉာဏ်', 'ထူး', 'ရဲ', 'မြတ်',
    'သီဟ', 'ဟိန်း', 'ကျော်', 'စည်သူ', 'နောင်', 'ဟန်', 'ဝေ', 'လင်း', 'အောင်', 'ခန့်', 'စံ', 'ကောင်း', 'မြတ်',
    'သက်', 'ခိုင်', 'နှင်း', 'နွယ်', 'နု', 'ခင်', 'ဝါ', 'ကြည်', 'ပြုံး', 'ချစ်', 'လတ်', 'ငယ်', 'နွေး', 'ဖြူ'
  ]
};

// Segments Myanmar text into individual syllables
const segmentSyllables = (text) => {
  if (!text) return [];
  const matches = text.match(MYANMAR_SYLLABLE_PAT);
  return matches || [];
};

// Calculates Levenshtein Distance between two words for spelling suggestions
const getLevenshteinDistance = (a, b) => {
  const tmp = [];
  let i, j;
  for (i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletion
        tmp[i][j - 1] + 1, // insertion
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
  }
  return tmp[a.length][b.length];
};

// Scans dictionary and returns closest match if within threshold (edit distance <= 2)
const getSpellingSuggestion = (word, dict) => {
  if (!word || !dict) return null;
  let minDistance = 999;
  let closestMatch = null;
  
  for (const entry of dict) {
    // If edit distance is close (<= 2 and within 50% of word length)
    const dist = getLevenshteinDistance(word, entry);
    if (dist > 0 && dist <= 2 && dist < minDistance) {
      minDistance = dist;
      closestMatch = entry;
    }
  }
  return closestMatch;
};

// Strict diacritic ordering validator per syllable
// Medial signs (ျ ြ ွ ှ) -> Vowels (ါ ာ ိ ီ ု ူ ေ ဲ) -> Asat (်) -> Tone marks (့ း)
const validateDiacriticOrdering = (syllable) => {
  if (!syllable) return null;
  
  const medials = 'ျြွှ';
  const vowels = 'ါာိီုူေဲ';
  const asat = '်';
  const tones = '့း';
  
  // Create mapping of characters in syllable to their respective indices
  let maxMedialIdx = -1;
  let minVowelIdx = 999;
  let maxVowelIdx = -1;
  let asatIdx = -1;
  let minToneIdx = 999;
  
  for (let i = 0; i < syllable.length; i++) {
    const char = syllable[i];
    if (medials.includes(char)) maxMedialIdx = Math.max(maxMedialIdx, i);
    if (vowels.includes(char)) {
      minVowelIdx = Math.min(minVowelIdx, i);
      maxVowelIdx = Math.max(maxVowelIdx, i);
    }
    if (char === asat) asatIdx = i;
    if (tones.includes(char)) minToneIdx = Math.min(minToneIdx, i);
  }
  
  // Rule 1: Medials must appear before Vowels
  if (maxMedialIdx !== -1 && minVowelIdx !== 999 && maxMedialIdx > minVowelIdx) {
    return 'မီးစွဲသင်္ကေတများသည် သရသင်္ကေတများ၏ ရှေ့တွင်ရှိရမည် (Medial signs must appear before vowel signs)';
  }
  
  // Rule 2: Vowels must appear before Asat
  if (maxVowelIdx !== -1 && asatIdx !== -1 && maxVowelIdx > asatIdx) {
    return 'သရသင်္ကေတများသည် အသတ် (်) ၏ ရှေ့တွင်ရှိရမည် (Vowel signs must appear before asat)';
  }
  
  // Rule 3: Asat must appear before Tone marks
  if (asatIdx !== -1 && minToneIdx !== 999 && asatIdx > minToneIdx) {
    return 'အသတ် (်) သည် အောက်ကမြစ်/ဝစ္စပေါက်တို့၏ ရှေ့တွင်ရှိရမည် (Asat must appear before tone marks)';
  }
  
  // Rule 4: Vowels must appear before Tone marks
  if (maxVowelIdx !== -1 && minToneIdx !== 999 && maxVowelIdx > minToneIdx) {
    return 'သရသင်္ကေတများသည် အောက်ကမြစ်/ဝစ္စပေါက်တို့၏ ရှေ့တွင်ရှိရမည် (Vowel signs must appear before tone marks)';
  }

  return null;
};

// Recursively walk any object/array and convert every Myanmar string to Unicode
export const deepEnsureUnicode = (value) => {
  if (typeof value === 'string') return ensureUnicode(value);
  if (Array.isArray(value)) return value.map(deepEnsureUnicode);
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = deepEnsureUnicode(value[key]);
    }
    return result;
  }
  return value;
};

// Myanmar text quality validator — detects garbled/misspelled Myanmar text
const validateMyanmarText = (text, fieldKey = null) => {
  if (!text || typeof text !== 'string') return null;
  const str = text.trim();
  if (str === '' || str === '-') return null;

  // Only validate strings that contain Myanmar characters
  const hasMyanmarChars = /[\u1000-\u109F]/.test(str);
  if (!hasMyanmarChars) return null;

  const issues = [];

  // 1. Basic structural checks
  if (/([\u103B-\u103E])\1/.test(str)) issues.push('Duplicate medial/modifier');
  if (/([\u102B-\u1032])\1/.test(str)) issues.push('Duplicate vowel sign');
  if (/(\u1039)\1/.test(str)) issues.push('Duplicate virama');
  if (/(\u1037)\1+/.test(str)) issues.push('Repeated dot below (့)');
  if (/(\u1038)\1+/.test(str)) issues.push('Repeated visarga (း)');
  if (/\u1031[^\u1000-\u102A\u1040-\u1049]*\u1031/.test(str)) issues.push('Multiple ေ in sequence');
  if (/\u1039[^\u1000-\u102A]/.test(str)) issues.push('Invalid stacking (္ not followed by consonant)');
  if (/\u1039$/.test(str)) issues.push('Stacking mark at end of text');

  // 2. Syllable-level orthography checks
  const syllables = segmentSyllables(str);
  for (const syl of syllables) {
    const orderingError = validateDiacriticOrdering(syl);
    if (orderingError) {
      issues.push(`Orthography Error in syllable "${syl}": ${orderingError}`);
    }
  }

  // 3. Dictionary & Lexicon checks with Levenshtein-based spelling suggestions
  if (fieldKey) {
    if (fieldKey === 'religious') {
      const matched = DICTS.religions.some(r => r === str);
      if (!matched) {
        const sugg = getSpellingSuggestion(str, DICTS.religions);
        if (sugg) issues.push(`Did you mean "${sugg}"?`);
      }
    }
    else if (fieldKey === 'household_relationship') {
      const matched = DICTS.relationships.some(r => r === str);
      if (!matched) {
        const sugg = getSpellingSuggestion(str, DICTS.relationships);
        if (sugg) {
          issues.push(`Did you mean "${sugg}"?`);
        } else {
          issues.push(`Relationship is unusual`);
        }
      }
    }
    else if (fieldKey === 'nationality') {
      const matched = DICTS.nationalities.some(r => r === str);
      if (!matched) {
        const sugg = getSpellingSuggestion(str, DICTS.nationalities);
        if (sugg) issues.push(`Did you mean "${sugg}"?`);
      }
    }
    else if (fieldKey === 'resident_status') {
      const matched = DICTS.nationalities.some(r => r === str);
      if (!matched) {
        const sugg = getSpellingSuggestion(str, DICTS.nationalities);
        if (sugg) issues.push(`Did you mean "${sugg}"?`);
      }
    }
    else if (fieldKey === 'township') {
      const matched = DICTS.townships.some(t => t === str);
      if (!matched) {
        const sugg = getSpellingSuggestion(str, DICTS.townships);
        if (sugg) issues.push(`Did you mean "${sugg}"?`);
      }
    }
    else if (fieldKey === 'district') {
      const matched = DICTS.districts.some(d => d === str);
      if (!matched) {
        const sugg = getSpellingSuggestion(str, DICTS.districts);
        if (sugg) issues.push(`Did you mean "${sugg}"?`);
      }
    }
    else if (fieldKey === 'name' || fieldKey === 'fathers_name' || fieldKey === 'mothers_name') {
      for (const syl of syllables) {
        if (syl.length <= 1) continue; // skip single letter particles
        const found = DICTS.nameSyllables.some(s => s === syl);
        if (!found) {
          const sugg = getSpellingSuggestion(syl, DICTS.nameSyllables);
          if (sugg) {
            issues.push(`Unusual syllable "${syl}" - Did you mean "${sugg}"?`);
          }
        }
      }
    }
  }

  // 4. Mixed encoding checking
  const myanmarSegments = str.split(/[\s,\-\/\.\(\)0-9၀-၉]+/);
  for (const seg of myanmarSegments) {
    if (/[\u1000-\u109F]/.test(seg) && /[a-zA-Z]/.test(seg)) {
      issues.push('Latin characters mixed with Myanmar');
      break;
    }
  }

  return issues.length > 0 ? issues.join('; ') : null;
};

// Auto-correct District by adding space before "ခရိုင်" suffix if missing
// Handles: "တာ့တိုးခရိုင်" → "တာ့တိုး ခရိုင်", "နမ့်ခမ်းခရိုင်" → "နမ့်ခမ်း ခရိုင်"
const autoCorrectDistrict = (value) => {
  if (!value || typeof value !== 'string') return value;
  const str = value.trim();
  if (str === '') return str;
  
  // Check for missing space before "ခရိုင်" (District)
  const districtMatch = str.match(/^(.+?)ခရိုင်$/);
  if (districtMatch && !str.includes(' ခရိုင်')) {
    return `${districtMatch[1].trim()} ခရိုင်`;
  }
  
  return str;
};

// Auto-correct Township: ensure space before "မြို့နယ်" suffix
// Handles: "နမ့်ခမ်းမြို့နယ်" → "နမ့်ခမ်း မြို့နယ်"
const autoCorrectTownship = (value) => {
  if (!value || typeof value !== 'string') return value;
  const str = value.trim();
  if (str === '') return str;
  
  // Check for missing space before "မြို့နယ်" (Township)
  const townshipMatch = str.match(/^(.+?)မြို့နယ်$/);
  if (townshipMatch && !str.includes(' မြို့နယ်')) {
    return `${townshipMatch[1].trim()} မြို့နယ်`;
  }
  
  return str;
};

// Auto-correct Ward/Village/Group by adding space before suffix if missing
// Handles: "ကောင်းတပ်ရပ်ကွက်" → "ကောင်းတပ် ရပ်ကွက်"
const autoCorrectWardVillageGroup = (value) => {
  if (!value || typeof value !== 'string') return value;
  const str = value.trim();
  if (str === '') return str;
  
  // Check for missing space before "ရပ်ကွက်" (Ward)
  // Pattern: something ending with chars followed immediately by "ရပ်ကွက်"
  const wardMatch = str.match(/^(.+?)ရပ်ကွက်$/);
  if (wardMatch && !str.includes(' ရပ်ကွက်')) {
    return `${wardMatch[1].trim()} ရပ်ကွက်`;
  }
  
  // Check for missing space before "ရွာ" (Village)
  // Pattern: word characters followed immediately by "ရွာ" at end
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

// Auto-format Household No: "ကောင်းတပ်-၁" → "ကောင်းတပ် - ၁"
const formatHouseholdNo = (value) => {
  if (!value) return value;
  let v = String(value).replace(/\s*-\s*/g, '-');
  v = v.replace(/-/g, ' - ');
  v = v.replace(/  +/g, ' ').trim();
  return v;
};

// Detect Ward/Village/Group type from value
// Returns: 'ward' | 'village' | 'group' | 'unknown'
const detectWardVillageGroupType = (value) => {
  if (!value || typeof value !== 'string') return 'unknown';
  const str = value.trim();
  if (str === '') return 'unknown';
  
  // Check for Ward (ရပ်ကွက်)
  if (str.includes('ရပ်ကွက်')) {
    return 'ward';
  }
  
  // Check for Group (အုပ်စု) - MUST check BEFORE Village
  // because group names might contain "ရွာ" (e.g., "ကျေးရွာအုပ်စု")
  if (str.includes('အုပ်စု')) {
    return 'group';
  }
  
  // Check for Village (ရွာ)
  if (str.includes('ရွာ')) {
    return 'village';
  }
  
  return 'unknown';
};

// Split comma-separated ward/village/group values and return array of types
// e.g., "ကောင်းတပ် ရွာ , အောင်ချမ်းသာ အုပ်စု" → ['village', 'group']
const getWardVillageGroupTypes = (value) => {
  if (!value || typeof value !== 'string') return ['unknown'];
  
  // Split by comma and clean up each part
  const parts = value.split(/[,၊]/).map(p => p.trim()).filter(p => p !== '');
  
  if (parts.length === 0) return ['unknown'];
  
  // Auto-correct each part and detect its type
  const types = parts.map(part => {
    const corrected = autoCorrectWardVillageGroup(part);
    return detectWardVillageGroupType(corrected);
  });
  
  // Remove duplicates and 'unknown'
  return [...new Set(types.filter(t => t !== 'unknown'))];
};

// Simple validation - just check if it contains one of the keywords
const validateWardVillageGroup = (value) => {
  if (!value || typeof value !== 'string') return 'Value is required';
  const str = value.trim();
  if (str === '') return 'Value is required';
  
  // Auto-correct first
  const corrected = autoCorrectWardVillageGroup(str);
  
  // Just check if it contains any of the keywords
  const type = detectWardVillageGroupType(corrected);
  if (type === 'unknown') {
    return `Must contain "ရပ်ကွက်" (Ward), "ရွာ" (Village), or "အုပ်စု" (Group)`;
  }
  
  return null; // Valid
};

// Validate household-level ID requirements
// Rule 1: At least one member per household must have Ta'ang Land ID
// Rule 2: At least 1-2 members per household must have Previous ID
const validateHouseholdIDRequirements = (data) => {
  const errors = [];
  
  // Group by household
  const households = data.reduce((acc, row) => {
    const hn = row.household_no || 'UNKNOWN';
    if (!acc[hn]) acc[hn] = [];
    acc[hn].push(row);
    return acc;
  }, {});
  
  Object.entries(households).forEach(([householdNo, members]) => {
    const hasTaangLandID = members.some(m => m.taang_land_id_no && m.taang_land_id_no.trim() !== '');
    const previousIDCount = members.filter(m => m.previous_id_no && m.previous_id_no.trim() !== '').length;
    
    if (!hasTaangLandID) {
      errors.push({
        householdNo,
        issue: 'No Ta\'ang Land ID',
        detail: 'At least one family member must have a Ta\'ang Land ID No.',
        rowNumbers: members.map((m, i) => i + 2).slice(0, 3) // First 3 rows as reference
      });
    }
    
    if (previousIDCount < 1) {
      errors.push({
        householdNo,
        issue: 'No Previous ID',
        detail: 'At least one family member must have a Previous ID No. (NRC).',
        rowNumbers: members.map((m, i) => i + 2).slice(0, 3)
      });
    }
    
    // Warning if more than 2 previous IDs (soft rule, just log)
    if (previousIDCount > 2) {
      // This is allowed but unusual - no error, just informational
    }
  });
  
  return errors;
};

// Shared: run validation + Supabase upsert for a flat array of parsed rows
const processAndUpload = async (formattedData, setValidationErrors, setShowModal, setLoading, setSuccessMsg, onUploadSuccess, fileInputRef) => {
  const errorsFound = [];
  
  // Check household-level ID requirements first
  const householdIDErrors = validateHouseholdIDRequirements(formattedData);
  if (householdIDErrors.length > 0) {
    householdIDErrors.forEach(err => {
      errorsFound.push({
        rowNumber: err.rowNumbers.join(', ') + '...',
        name: `Household: ${err.householdNo}`,
        missingFields: null,
        spellingIssues: [`${err.issue}: ${err.detail}`]
      });
    });
  }

  // Process each row and add ward_village_group_type as array
  const processedData = [];
  
  formattedData.forEach((parsedRow, index) => {
    // Get all types from comma-separated ward_village_group
    const types = getWardVillageGroupTypes(parsedRow.ward_village_group);
    
    // Create record with types array
    const processedRow = {
      ...parsedRow,
      ward_village_group_type: types // Array: ['village', 'group'] or ['ward'] etc.
    };
    processedData.push(processedRow);
    
    // Validate using original value
    const missingFields = [];
    if (!parsedRow.ward_village_group) missingFields.push('Ward/Village/Group');
    if (!parsedRow.township) missingFields.push('Township');
    if (!parsedRow.district) missingFields.push('District');
    if (!parsedRow.gender) missingFields.push('Gender');
    if (!parsedRow.household_relationship) missingFields.push('Household Relationship');

    // Validate Ward/Village/Group format (simple check only)
    const wardVillageError = validateWardVillageGroup(parsedRow.ward_village_group);

    const myanmarFieldsToCheck = [
      { key: 'name', label: 'Name' },
      { key: 'fathers_name', label: "Father's Name" },
      { key: 'mothers_name', label: "Mother's Name" },
      { key: 'household_relationship', label: 'Household Relationship' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'religious', label: 'Religious' },
      { key: 'ward_village_group', label: 'Ward/Village/Group' },
      { key: 'township', label: 'Township' },
      { key: 'district', label: 'District' },
      { key: 'resident_status', label: 'Resident Status' },
    ];
    const spellingIssues = [];
    for (const field of myanmarFieldsToCheck) {
      const issue = validateMyanmarText(parsedRow[field.key], field.key);
      if (issue) spellingIssues.push(`${field.label}: "${parsedRow[field.key]}" (${issue})`);
    }

    // Add ward/village/group format error if present
    if (wardVillageError) {
      spellingIssues.push(`Ward/Village/Group: ${wardVillageError}`);
    }

    // District must end with " ခရိုင်"
    if (parsedRow.district && !parsedRow.district.endsWith(' ခရိုင်')) {
      spellingIssues.push(`ခရိုင် (District): "${parsedRow.district}" — " ခရိုင်" ဟူသောစကားလုံးဖြင့် အဆုံးသတ်ရမည်။ ဥပမာ — "မန်တုံ ခရိုင်"`);
    }

    // Township must end with " မြို့နယ်"
    if (parsedRow.township && !parsedRow.township.endsWith(' မြို့နယ်')) {
      spellingIssues.push(`မြို့နယ် (Township): "${parsedRow.township}" — " မြို့နယ်" ဟူသောစကားလုံးဖြင့် အဆုံးသတ်ရမည်။ ဥပမာ — "နမ္မတူ မြို့နယ်"`);
    }

    if (missingFields.length > 0 || spellingIssues.length > 0) {
      errorsFound.push({
        rowNumber: index + 2,
        name: parsedRow.name || 'No Name Provided',
        missingFields: missingFields.length > 0 ? missingFields.join(', ') : null,
        spellingIssues: spellingIssues.length > 0 ? spellingIssues : null,
      });
    }
  });

  if (errorsFound.length > 0) {
    setValidationErrors(errorsFound);
    setShowModal(true);
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    return;
  }

  let successCount = 0;
  let duplicateCount = 0;
  let dbErrors = [];

  // ── Phase 1 Optimization: bulk duplicate check + batched insert ──
  // Fields used to identify a duplicate row (must stay in sync with fingerprint below)
  const DUP_FIELDS = [
    'household_no', 'name', 'date_of_birth', 'gender',
    'fathers_name', 'mothers_name', 'household_relationship', 'occupation',
    'previous_id_no', 'taang_land_id_no', 'nationality', 'resident_status',
    'religious', 'house_no', 'ward_village_group', 'township', 'district',
  ];
  const fingerprint = (row) => DUP_FIELDS.map(f => row[f] || '').join('\u0001');

  // 1. Collect unique household numbers in the upload (narrows the DB scan)
  const uniqueHouseholdNos = [...new Set(
    processedData.map(r => r.household_no || '').filter(Boolean)
  )];

  // 2. Fetch existing rows from DB in chunks (Postgres IN() handles ~1000 items fine,
  //    but chunk to 500 to keep URL length safe)
  const existingFingerprints = new Set();
  const SELECT_CHUNK = 500;
  for (let i = 0; i < uniqueHouseholdNos.length; i += SELECT_CHUNK) {
    const slice = uniqueHouseholdNos.slice(i, i + SELECT_CHUNK);
    const { data: existingRows, error: selErr } = await supabase
      .from('households')
      .select(DUP_FIELDS.join(','))
      .in('household_no', slice);
    if (selErr) {
      dbErrors.push(`Duplicate check failed: ${selErr.message}`);
      continue;
    }
    (existingRows || []).forEach(r => existingFingerprints.add(fingerprint(r)));
  }

  // 3. Partition: new rows go to insert queue, duplicates are counted
  const rowsToInsert = [];
  const insertSourceIndex = []; // maps batch index → original row index for error reporting
  for (let i = 0; i < processedData.length; i++) {
    const fp = fingerprint(processedData[i]);
    if (existingFingerprints.has(fp)) {
      duplicateCount++;
    } else {
      rowsToInsert.push(processedData[i]);
      insertSourceIndex.push(i);
      // Also add to set so duplicates *within* the same CSV are skipped
      existingFingerprints.add(fp);
    }
  }

  // 4. Insert in batches; on batch failure, retry per-row to attribute errors
  const INSERT_BATCH = 200;
  for (let i = 0; i < rowsToInsert.length; i += INSERT_BATCH) {
    const batch = rowsToInsert.slice(i, i + INSERT_BATCH);
    const { error: batchErr } = await supabase.from('households').insert(batch);
    if (!batchErr) {
      successCount += batch.length;
    } else {
      // Batch failed — fall back to per-row inserts so we can identify which row(s) broke
      for (let j = 0; j < batch.length; j++) {
        const { error: rowErr } = await supabase.from('households').insert(batch[j]);
        if (rowErr) {
          const originalIdx = insertSourceIndex[i + j];
          dbErrors.push(`Row ${originalIdx + 2}: ${rowErr.message}`);
        } else {
          successCount++;
        }
      }
    }
  }

  const parts = [];
  if (successCount > 0) parts.push(`✓ Inserted ${successCount} new records`);
  if (duplicateCount > 0) parts.push(`Skipped ${duplicateCount} duplicates`);
  if (dbErrors.length > 0) parts.push(`${dbErrors.length} DB errors`);
  const msg = parts.join(' | ') || 'No changes made.';
  setSuccessMsg(msg);
  if (successCount > 0) {
    pushNotification({
      type: NOTIF_TYPES.UPLOAD,
      title: 'Upload Complete',
      message: msg,
    });
  }
  if (onUploadSuccess && successCount > 0) onUploadSuccess();
  setLoading(false);
  if (fileInputRef.current) fileInputRef.current.value = '';
};

const CsvUploader = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]); // Modal state
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef(null);

  const handleJsonUpload = (file) => {
    setLoading(true);
    setSuccessMsg(null);
    setValidationErrors([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rawParsed = JSON.parse(e.target.result);
        // Recursively convert every Myanmar string to Unicode before processing
        const parsed = deepEnsureUnicode(rawParsed);
        const households = Array.isArray(parsed) ? parsed : [parsed];

        const formattedData = [];
        for (const hh of households) {
          const hhId = hh.household_id || hh.household_no || 'UNKNOWN';
          const loc = hh.location || {};
          const members = Array.isArray(hh.members) ? hh.members : [];
          for (const m of members) {
            formattedData.push({
              household_no: formatHouseholdNo(ensureUnicode(String(hhId).trim())),
              name: ensureUnicode(m.name || ''),
              date_of_birth: m.dob || m.date_of_birth || '',
              gender: ensureUnicode(m.gender || ''),
              fathers_name: ensureUnicode(m.fathers_name || ''),
              mothers_name: ensureUnicode(m.mothers_name || ''),
              household_relationship: ensureUnicode(m.relationship || m.household_relationship || ''),
              occupation: ensureUnicode(m.occupation || ''),
              previous_id_no: ensureUnicode(m.previous_id_no || ''),
              taang_land_id_no: ensureUnicode(m.taang_land_id_no || ''),
              nationality: ensureUnicode(m.nationality || ''),
              resident_status: ensureUnicode(m.resident_status || ''),
              religious: ensureUnicode(m.religious || ''),
              house_no: ensureUnicode(loc.house_no || m.house_no || ''),
              ward_village_group: ensureUnicode(loc.ward_village || loc.ward_village_group || m.ward_village_group || ''),
              township: autoCorrectTownship(ensureUnicode(loc.township || m.township || '')),
              district: autoCorrectDistrict(ensureUnicode(loc.district || m.district || '')),
              submission_date: m.submission_date || '',
              address: ensureUnicode(`${loc.house_no || ''}, ${loc.ward_village || ''}, ${loc.township || ''}, ${loc.district || ''}`),
            });
          }
        }

        if (formattedData.length === 0) throw new Error('JSON file has no member records.');

        // Validate household-level ID requirements for JSON upload
        const householdIDErrors = validateHouseholdIDRequirements(formattedData);
        if (householdIDErrors.length > 0) {
          const householdErrors = householdIDErrors.map(err => ({
            rowNumber: err.rowNumbers.join(', ') + '...',
            name: `Household: ${err.householdNo}`,
            missingFields: null,
            spellingIssues: [`${err.issue}: ${err.detail}`]
          }));
          setValidationErrors(householdErrors);
          setShowModal(true);
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        await processAndUpload(
          formattedData,
          setValidationErrors, setShowModal, setLoading, setSuccessMsg, onUploadSuccess, fileInputRef
        );
      } catch (err) {
        console.error('JSON upload error:', err);
        alert(err.message || 'Failed to parse JSON file.');
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.json')) {
      handleJsonUpload(file);
      return;
    }

    setLoading(true);
    setSuccessMsg(null);
    setValidationErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: "UTF-8",
      transformHeader: (header) => header.trim().replace(/\s+/g, ' '),
      complete: async (results) => {
        try {
          if (results.errors.length > 0) {
            console.warn("PapaParse parsing warnings:", results.errors);
          }

          let currentHouseholdNo = '';
          let currentWard = '';
          let currentTownship = '';
          let currentDistrict = '';

          const errorsFound = [];

          // 1. Mapping and Forward-Filling
          const formattedData = results.data.map((row, index) => {
            // Forward Fill Variables
            const rawHn = row['Household No.'];
            const rawWard = row['Ward / Village / Group'];
            const rawTownship = row['Township'];
            const rawDistrict = row['District'];

            // Household Number forward-fill (auto-format spacing around hyphens)
            if (rawHn && rawHn.trim() !== '') currentHouseholdNo = formatHouseholdNo(ensureUnicode(rawHn.trim()));
            else if (index === 0 && (!rawHn || rawHn.trim() === '')) currentHouseholdNo = 'UNKNOWN-1';

            // Region forward-fills (auto-correct suffixes + Unicode)
            if (rawWard && rawWard.trim() !== '') currentWard = rawWard.trim();
            if (rawTownship && rawTownship.trim() !== '') currentTownship = autoCorrectTownship(ensureUnicode(rawTownship.trim()));
            if (rawDistrict && rawDistrict.trim() !== '') currentDistrict = autoCorrectDistrict(ensureUnicode(rawDistrict.trim()));

            const cell = (key) => (row[key] || '').trim();
            
            // Auto-correct ward_village_group during CSV parsing
            let wardValue = ensureUnicode(currentWard);
            wardValue = autoCorrectWardVillageGroup(wardValue);
            
            // Get all types (handles comma-separated values)
            const wardTypes = getWardVillageGroupTypes(wardValue);
            
            const parsedRow = {
              household_no: currentHouseholdNo,
              name: ensureUnicode(cell('Name')),
              date_of_birth: cell('Date of birth'),
              gender: ensureUnicode(cell('Gender')),
              fathers_name: ensureUnicode(cell("Father's Name")),
              mothers_name: ensureUnicode(cell("Mother's Name")),
              household_relationship: ensureUnicode(cell('Household Relationship')),
              occupation: ensureUnicode(cell('Occupation')),
              previous_id_no: ensureUnicode(cell('Previous ID No.')),
              taang_land_id_no: ensureUnicode(cell("Ta'ang Land ID No.")),
              nationality: ensureUnicode(cell('Nationality')),
              resident_status: ensureUnicode(cell('Resident Status')),
              religious: ensureUnicode(cell('Religious')),
              house_no: ensureUnicode(cell('House NO.')),
              ward_village_group: wardValue,
              ward_village_group_type: wardTypes, // Array of types
              township: currentTownship,
              district: currentDistrict,
              submission_date: cell('Submission Date'),
              address: ensureUnicode(`${cell('House NO.')}, ${wardValue}, ${currentTownship}, ${currentDistrict}`)
            };

            // 2. Strict Validation Check (After Forward-Fill)
            const missingFields = [];
            if (!parsedRow.ward_village_group) missingFields.push('Ward/Village/Group');
            if (!parsedRow.township) missingFields.push('Township');
            if (!parsedRow.district) missingFields.push('District');
            if (!parsedRow.gender) missingFields.push('Gender');
            if (!parsedRow.household_relationship) missingFields.push('Household Relationship');

            // 2b. Myanmar Text Quality Validation
            const myanmarFieldsToCheck = [
              { key: 'name', label: 'Name' },
              { key: 'fathers_name', label: "Father's Name" },
              { key: 'mothers_name', label: "Mother's Name" },
              { key: 'household_relationship', label: 'Household Relationship' },
              { key: 'occupation', label: 'Occupation' },
              { key: 'nationality', label: 'Nationality' },
              { key: 'religious', label: 'Religious' },
              { key: 'ward_village_group', label: 'Ward/Village/Group' },
              { key: 'township', label: 'Township' },
              { key: 'district', label: 'District' },
              { key: 'resident_status', label: 'Resident Status' },
            ];
            const spellingIssues = [];
            for (const field of myanmarFieldsToCheck) {
              const issue = validateMyanmarText(parsedRow[field.key], field.key);
              if (issue) {
                spellingIssues.push(`${field.label}: "${parsedRow[field.key]}" (${issue})`);
              }
            }

            // 2c. Ward/Village/Group Format Validation
            const wardVillageError = validateWardVillageGroup(parsedRow.ward_village_group);
            if (wardVillageError) {
              spellingIssues.push(`Ward/Village/Group: ${wardVillageError}`);
            }

            // 2d. District must end with " ခရိုင်" (space + suffix required)
            if (parsedRow.district) {
              if (!parsedRow.district.endsWith(' ခရိုင်')) {
                spellingIssues.push(`ခရိုင် (District): "${parsedRow.district}" — " ခရိုင်" ဟူသောစကားလုံးဖြင့် အဆုံးသတ်ရမည်။ ဥပမာ — "မန်တုံ ခရိုင်"`);
              }
            }

            // 2e. Township must end with " မြို့နယ်" (space + suffix required)
            if (parsedRow.township) {
              if (!parsedRow.township.endsWith(' မြို့နယ်')) {
                spellingIssues.push(`မြို့နယ် (Township): "${parsedRow.township}" — " မြို့နယ်" ဟူသောစကားလုံးဖြင့် အဆုံးသတ်ရမည်။ ဥပမာ — "နမ္မတူ မြို့နယ်"`);
              }
            }

            // 3. Error Tracking
            if (missingFields.length > 0 || spellingIssues.length > 0) {
              errorsFound.push({
                rowNumber: index + 2, // Excel Row offset
                name: parsedRow.name || 'No Name Provided',
                missingFields: missingFields.length > 0 ? missingFields.join(', ') : null,
                spellingIssues: spellingIssues.length > 0 ? spellingIssues : null,
              });
            }

            return parsedRow;
          });

          if (formattedData.length === 0) {
            throw new Error('The CSV file is empty or formatted incorrectly.');
          }

          // 4. Validate household-level ID requirements
          const householdIDErrors = validateHouseholdIDRequirements(formattedData);
          if (householdIDErrors.length > 0) {
            const householdErrors = householdIDErrors.map(err => ({
              rowNumber: err.rowNumbers.join(', ') + '...',
              name: `Household: ${err.householdNo}`,
              missingFields: null,
              spellingIssues: [`${err.issue}: ${err.detail}`]
            }));
            errorsFound.push(...householdErrors);
          }

          if (errorsFound.length > 0) {
            setValidationErrors(errorsFound);
            setShowModal(true);
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }

          // 5. Delegate to shared upload processor
          await processAndUpload(
            formattedData,
            setValidationErrors, setShowModal, setLoading, setSuccessMsg, onUploadSuccess, fileInputRef
          );

        } catch (err) {
          console.error("Upload error:", err);
          alert(err.message || 'An error occurred during upload.');
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (err) => {
        setLoading(false);
        alert(`Error reading CSV file: ${err.message}`);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  const closeErrorModal = () => {
    setShowModal(false);
    setValidationErrors([]);
  };

  return (
    <div className="bg-white p-6 xl:p-8 border border-[#E5E7EB] mb-8" style={{ borderRadius: '0px' }}>
      <div className="flex items-center gap-3 mb-4 xl:mb-6">
        <div className="bg-[#F3F4F6] text-[#1A1A1A] p-2" style={{ borderRadius: '0px' }}>
          <Upload size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Bulk Upload Households (CSV / JSON)</h2>
          <p className="text-sm text-[#737373]">Upload a CSV file or a previously exported JSON backup.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">

        <label className="flex flex-col items-center justify-center w-full h-32 border border-dashed border-[#E5E7EB] cursor-pointer bg-[#FAFAFA] hover:bg-[#F3F4F6] transition-colors" style={{ borderRadius: '0px' }}>
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className="flex gap-2 mb-2">
              <FileSpreadsheet size={28} className="text-[#737373]" />
              <FileJson size={28} className="text-[#737373]" />
            </div>
            <p className="text-sm text-[#737373] font-medium">Click to upload or drag and drop</p>
            <p className="text-xs text-[#737373]">.CSV or .JSON files</p>
          </div>
          <input
            type="file"
            accept=".csv,.json"
            className="hidden"
            onChange={handleFileUpload}
            disabled={loading}
            ref={fileInputRef}
          />
        </label>

        {loading && (
          <div className="flex items-center gap-3 font-medium p-4" style={{ borderRadius: '0px', backgroundColor: '#EEF2F5', border: '1px solid #B0BEC5', color: '#4A6572' }}>
            <Loader2 className="animate-spin" size={20} style={{ color: '#4A6572' }} />
            Processing and validating your file...
          </div>
        )}

        {successMsg && !loading && (
          <div className="tps-success-enter flex items-center gap-3 font-medium p-4" style={{ borderRadius: '0px', backgroundColor: '#F0F7F0', border: '1px solid #A5D6A7', color: '#1B5E20' }}>
            <CheckCircle2 size={20} style={{ color: '#2E7D32', flexShrink: 0 }} />
            {successMsg}
          </div>
        )}

      </div>

      {/* ERROR MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>

            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]" style={{ backgroundColor: '#FDF2F2' }}>
              <div className="flex items-center gap-3" style={{ color: '#B71C1C' }}>
                <AlertCircle size={24} />
                <h3 className="text-xl font-bold">Validation Failed: Upload Blocked</h3>
              </div>
              <button onClick={closeErrorModal} className="text-[#737373] hover:text-[#1A1A1A] transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-[#737373] mb-4 font-medium">
                We found <span className="text-[#1A1A1A] font-bold">{validationErrors.length}</span> errors in your CSV file. You must fix these missing fields in Excel before we can upload this file to the database.
              </p>

              <div className="tps-responsive-table">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB] sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-sm font-semibold text-[#737373] w-20">Excel Row</th>
                      <th className="px-4 py-3 text-sm font-semibold text-[#737373] w-1/5">Name</th>
                      <th className="px-4 py-3 text-sm font-semibold text-[#737373]">Issue(s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] bg-white">
                    {validationErrors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-[#F3F4F6] transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-[#1A1A1A] align-top">#{err.rowNumber}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[#1A1A1A] align-top">{err.name}</td>
                        <td className="px-4 py-3 text-sm">
                          {err.missingFields && (
                            <div className="mb-2">
                              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#B71C1C' }}>Missing Fields:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {err.missingFields.split(', ').map((field, i) => (
                                  <span key={i} className="inline-block px-2 py-0.5 text-xs font-medium" style={{ borderRadius: '0px', backgroundColor: '#FDF2F2', color: '#B71C1C', border: '1px solid #FECACA' }}>
                                    {field}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {err.spellingIssues && (
                            <div>
                              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#B71C1C' }}>⚠ Data Validation Errors:</span>
                              <div className="mt-1 space-y-1">
                                {err.spellingIssues.map((issue, i) => (
                                  <div key={i} className="px-2 py-1 text-xs font-medium" style={{ borderRadius: '0px', backgroundColor: '#FDF2F2', color: '#7F1D1D', border: '1px solid #FECACA' }}>
                                    {issue}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[#E5E7EB] bg-[#FAFAFA] flex justify-end">
              <button
                onClick={closeErrorModal}
                className="hover:bg-[#737373] transition-colors"
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#1A1A1A',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: '1px solid #1A1A1A',
                  borderRadius: '0px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                CANCEL UPLOAD & FIX EXCEL
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CsvUploader;
