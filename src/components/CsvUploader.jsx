import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { pushNotification, NOTIF_TYPES } from '../lib/notifications';
import { AlertCircle, X, CheckCircle2, Upload, FileSpreadsheet, Loader2, FileJson, Table } from 'lucide-react';

// Text normalization placeholder - no Zawgyi conversion (removed per request)
const ensureUnicode = (text) => text;

// ==========================================
// WHITESPACE NORMALIZATION
// Match the DB's stored format regardless of how the user typed it.
//
// Fixes the most common user mistakes:
//   • Leading / trailing spaces           "  အောင်ထွန်း  "  →  "အောင်ထွန်း"
//   • Multiple consecutive spaces         "ဦး   အောင်"      →  "ဦး အောင်"
//   • Tabs and newlines pasted from Excel "ဦး\tအောင်"       →  "ဦး အောင်"
//   • Non-breaking spaces (U+00A0)        produced by Word  →  regular space
//   • Zero-width chars (U+200B, U+200C,
//     U+200D, U+FEFF) accidentally
//     pasted from Word/Browser            stripped silently
//   • Myanmar comma (၊) treated as
//     equivalent to "," for list fields
// ==========================================
const normalizeWhitespace = (text) => {
  if (text === null || text === undefined) return '';
  let s = String(text);

  // Strip zero-width characters that look invisible but break equality checks
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Convert non-breaking space (U+00A0) and other Unicode spaces to regular space
  s = s.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  // Collapse all runs of whitespace (spaces, tabs, newlines) into a single space
  s = s.replace(/\s+/g, ' ');

  return s.trim();
};

// Normalize a comma-separated list (e.g. "ကောင်းတပ်ရွာ,အောင်ချမ်းသာအုပ်စု")
// → split by "," or Myanmar comma "၊"
// → trim each item
// → rejoin with ", " (the DB-canonical separator)
const normalizeCommaList = (text) => {
  if (!text) return text;
  const parts = String(text)
    .split(/[,၊]/)
    .map(p => normalizeWhitespace(p))
    .filter(p => p !== '');
  return parts.join(', ');
};

// ==========================================
// ID NUMBER NORMALIZATION
// ==========================================

// Ta'ang Land ID — canonical form: "No-01001812000123456"
//   • prefix "No-" (capital N, lowercase o, hyphen)
//   • followed by digits, no spaces anywhere
//
// Fixes the most common user mistakes (separator and case):
//   • "No - 01001812000123456"   (spaces around hyphen)     → "No-01001812000123456"
//   • "No 01001812000123456"     (space, no hyphen)          → "No-01001812000123456"
//   • "No.01001812000123456"     (dot)                       → "No-01001812000123456"
//   • "No,01001812000123456"     (comma)                     → "No-01001812000123456"
//   • "No;01001812000123456"     (semicolon)                 → "No-01001812000123456"
//   • "No:01001812000123456"     (colon)                     → "No-01001812000123456"
//   • "No/01001812000123456"     (slash)                     → "No-01001812000123456"
//   • "No\01001812000123456"     (backslash)                 → "No-01001812000123456"
//   • "No|01001812000123456"     (pipe)                      → "No-01001812000123456"
//   • "No_01001812000123456"     (underscore)                → "No-01001812000123456"
//   • "no-01001812000123456"     (lowercase prefix)          → "No-01001812000123456"
//   • "NO-01001812000123456"     (uppercase prefix)          → "No-01001812000123456"
//   • "No-01001 812000 123456"   (spaces inside number)      → "No-01001812000123456"
//   • "No—01001812000123456"     (em-dash instead of hyphen) → "No-01001812000123456"
//   • "01001812000123456"        (no prefix at all)          → "No-01001812000123456"
const normalizeTaangLandId = (text) => {
  if (text === null || text === undefined) return '';
  let s = String(text);

  // Strip zero-width / non-breaking / regular whitespace — canonical has none
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0\s]/g, '');
  if (s === '') return '';

  // Normalize any em-dash / en-dash to plain hyphen
  s = s.replace(/[–—]/g, '-');

  // If it starts with "no" / "No" / "NO", absorb ANY combination of
  // separator characters that follow (dash, dot, comma, semicolon, colon,
  // slash, backslash, pipe, underscore, equals, hash, tilde) and replace
  // the whole prefix block with the canonical "No-".
  if (/^[Nn][Oo]/.test(s)) {
    s = s.replace(/^[Nn][Oo][-.,;:|\\/_=#~]*/, 'No-');
  } else if (/^\d/.test(s)) {
    // Bare number with no prefix → add canonical prefix
    s = 'No-' + s;
  }

  return s;
};

// Previous ID (Myanmar NRC) — canonical form: "၁၃/နခန(နိုင်)၀၉၆၉၁၅"
//   • region "/" township "(" type ")" serial
//   • no spaces around the structural separators
//
// Fixes the most common user mistakes:
//   • "13 / နခန (နိုင်) 096915"  (spaces around / ( ))     → "13/နခန(နိုင်)096915"
//   • "13/ နခန ( နိုင် ) 096915"  (asymmetric spaces)       → "13/နခန(နိုင်)096915"
//   • "  13/နခန(နိုင်)096915  "  (leading/trailing space)  → "13/နခန(နိုင်)096915"
//
// Conservative — does NOT strip spaces inside the township/type segments
// because some legitimate codes might contain spaces.
const normalizePreviousId = (text) => {
  if (text === null || text === undefined) return '';
  let s = String(text);

  // Strip zero-width chars and convert NBSP to regular space
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  s = s.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  // Remove whitespace immediately around the structural separators
  s = s.replace(/\s*\/\s*/g, '/');
  s = s.replace(/\s*\(\s*/g, '(');
  s = s.replace(/\s*\)\s*/g, ')');

  // Collapse any remaining whitespace runs and trim
  s = s.replace(/\s+/g, ' ').trim();

  return s;
};

// ==========================================
// DATE OF BIRTH NORMALIZATION + VALIDATION
// ==========================================

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

// Auto-correct common separator mistakes:
//   "15-06-1985"  →  "15.06.1985"
//   "15/06/1985"  →  "15.06.1985"
//   "15 . 06 . 1985"  →  "15.06.1985"
//   "1.6.1985"  →  "01.06.1985"  (zero-pad day & month)
// Returns the canonicalised string, or empty string if input is empty.
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

// Strict validator. Returns an error string if invalid, or null if valid.
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
    // ── Head / Spouse ──
    'ဦးစီး',           // Head of household
    'အိမ်ထောင်ဦးစီး',  // Head of household (formal)
    'ဇနီး',            // Wife
    'ခင်ပွန်း',         // Husband
    'ခင်ပွန်းသည်',     // Husband (formal)
    'ဇနီးမယား',         // Wife (formal)
    // ── Parents ──
    'အဖေ',             // Father
    'အမေ',             // Mother
    'ဖခင်',             // Father (formal)
    'မိခင်',             // Mother (formal)
    'ခမည်း',            // Father (formal/elderly)
    'မယ်တော်',          // Mother (formal)
    // ── Children ──
    'သား',              // Son
    'သမီး',             // Daughter
    'သားကြီး',         // Eldest son
    'သားလတ်',          // Middle son
    'သားငယ်',          // Youngest son
    'သမီးကြီး',         // Eldest daughter
    'သမီးလတ်',          // Middle daughter
    'သမီးငယ်',         // Youngest daughter
    'သားမက်',          // Son-in-law
    'ချွေးမ',            // Daughter-in-law
    // ── Siblings ──
    'ညီ',              // Younger brother
    'မောင်',           // Brother
    'မောင်လေး',        // Younger brother
    'အစ်ကို',          // Older brother
    'အကို',            // Older brother (variant)
    'မမ',              // Older sister
    'အစ်မ',            // Older sister
    'ညီမ',             // Younger sister
    'နှမ',             // Sister
    // ── Grandparents ──
    'ဖိုးဖိုး',          // Grandfather
    'ဖွားဖွား',         // Grandmother
    'အဘိုး',            // Grandfather (formal)
    'အဘွား',            // Grandmother (formal)
    // ── Grandchildren ──
    'မြေး',             // Grandchild
    'မြေးယောက်ျား',    // Grandson
    'မြေးမိန်းမ',       // Granddaughter
    'မြစ်',             // Great-grandchild
    // ── Aunts / Uncles ──
    'ဦးလေး',           // Uncle
    'ဒေါ်လေး',          // Aunt
    'ဦးကြီး',           // Older uncle
    'ဒေါ်ကြီး',         // Older aunt
    'ဘကြီး',            // Uncle (father's older brother)
    'အရီး',             // Aunt
    // ── Nieces / Nephews / Cousins ──
    'တူ',               // Nephew
    'တူမ',              // Niece
    'ဝမ်းကွဲ',          // Cousin
    'ဝမ်းကွဲမောင်နှမ', // Cousin (formal)
    // ── In-laws ──
    'ယောက္ခမ',          // Parent-in-law
    'ယောက္ခမယောကျ်ား', // Father-in-law
    'ယောက္ခမမိန်းမ',   // Mother-in-law
    'ခဲအို',             // Brother-in-law / sister-in-law
    'ခယ်မ',             // Sister-in-law (wife's younger sister)
    // ── Step / Other ──
    'ထွေးအဖ',           // Stepfather
    'ထွေးအမ',           // Stepmother
    'မယားသား',          // Stepson (wife's son from previous marriage)
    'မယားပါသား',         // Stepson (variant spelling)
    'မယားသမီး',         // Stepdaughter (wife's daughter from previous marriage)
    'မယားပါသမီး',        // Stepdaughter (variant spelling)
    'ခင်ပွန်းသား',       // Stepson (husband's son from previous marriage)
    'ခင်ပွန်းသမီး',      // Stepdaughter (husband's daughter from previous marriage)
    'ဆွေမျိုး',         // Relative
    'အိမ်ဖော်',         // Helper / domestic
    'ဧည့်သည်',          // Guest
    // ── Extended / Rare ──
    'မရီး',             // Aunt (mother's sister)
    'ယောက်ဖ',           // Brother-in-law (older sister's husband)
    'ယောက်ဖလေး',        // Younger brother-in-law (younger sister's husband)
    'ခေါင်းမ',           // Sister-in-law (husband's sister)
    'သမီးတော်',          // Niece (brother's daughter)
    'သားတော်',           // Nephew (brother's son)
    'အရီးမ',             // Aunt (father's younger sister)
    'အရီးကြီး',          // Aunt (father's older sister)
    'ဘကြီးလေး',          // Uncle (father's younger brother)
    'ဘ',                 // Uncle (general)
    'မြေးသား',           // Grandson (formal)
    'မြေးသမီး',          // Granddaughter (formal)
    'မြစ်ယောက်ျား',     // Great-grandson
    'မြစ်မိန်းမ',        // Great-granddaughter
    'မြေးချွေးမ',        // Granddaughter-in-law
    'မြေးသားမက်',        // Grandson-in-law
    'တူသား',             // Nephew (formal)
    'တူသမီး',            // Niece (formal)
    'ဝမ်းကြ',             // Second cousin
    'ဆွေကြီး',            // Elder relative
    'ဆွေငယ်',             // Younger relative
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

// Recursively walk any object/array (no conversion - just pass through)
// Exported for backward compatibility with other components
export const deepEnsureUnicode = (value) => value;

// Myanmar text quality validator — detects garbled/misspelled Myanmar text
const validateMyanmarText = (text, fieldKey = null) => {
  if (!text || typeof text !== 'string') return null;
  const str = text.trim();
  if (str === '' || str === '-') return null;

  // Only validate strings that contain Myanmar characters
  const hasMyanmarChars = /[\u1000-\u109F]/.test(str);
  if (!hasMyanmarChars) return null;

  // ── NAME FIELDS: LIGHTWEIGHT VALIDATION ──
  // Skip heavy dictionary/orthography checks (too many false positives),
  // BUT catch critical data quality issues:
  //   1. Latin characters mixed with Myanmar (paste mistakes)
  //   2. Duplicate ေ (e-vowel) in a single syllable — catches garbled
  //      input like "လှေးအီရှှဌေေး" while allowing valid "လေးအလေး"
  if (fieldKey === 'name' || fieldKey === 'fathers_name' || fieldKey === 'mothers_name') {
    if (/[\u1000-\u109F]/.test(str) && /[a-zA-Z]/.test(str)) {
      return 'Latin characters mixed with Myanmar';
    }
    // Check for duplicate ေ in any single syllable (garbled text indicator)
    const syllablesCheck = segmentSyllables(str);
    for (const syl of syllablesCheck) {
      const eCount = (syl.match(/\u1031/g) || []).length;
      if (eCount > 1) {
        return `Syllable "${syl}" has duplicate ေ (${eCount} times) — check your input`;
      }
    }
    return null;
  }

  const issues = [];

  // 1. Basic structural checks
  if (/([\u103B-\u103E])\1/.test(str)) issues.push('Duplicate medial/modifier');
  if (/([\u102B-\u1032])\1/.test(str)) issues.push('Duplicate vowel sign');
  if (/(\u1039)\1/.test(str)) issues.push('Duplicate virama');
  if (/(\u1037)\1+/.test(str)) issues.push('Repeated dot below (့)');
  if (/(\u1038)\1+/.test(str)) issues.push('Repeated visarga (း)');
  // Multiple ေ (e-vowel) check: catches ေ‌ေ with or without other chars between
  // This is a critical data quality check — prevents garbled input like "လှေးအီရှှဌေေး"
  if (/\u1031[^\u1000-\u102A\u1040-\u1049]*\u1031/.test(str)) issues.push('Multiple ေ in sequence');
  // Additional strict check: two ေ in same syllable (consecutive or with zero-width chars)
  const syllablesForECheck = segmentSyllables(str);
  for (const syl of syllablesForECheck) {
    const eCount = (syl.match(/\u1031/g) || []).length;
    if (eCount > 1) {
      issues.push(`Syllable "${syl}" has duplicate ေ (${eCount} times)`);
      break; // Only report once per string
    }
  }
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
      // Optional dictionary lookup — skip silently if no township list is defined.
      // Suffix correctness is already enforced separately by the " မြို့နယ်" check.
      const dict = DICTS.townships;
      if (Array.isArray(dict) && dict.length > 0 && !dict.some(t => t === str)) {
        const sugg = getSpellingSuggestion(str, dict);
        if (sugg) issues.push(`Did you mean "${sugg}"?`);
      }
    }
    else if (fieldKey === 'district') {
      // Optional dictionary lookup — skip silently if no district list is defined.
      // Suffix correctness is already enforced separately by the " ခရိုင်" check.
      const dict = DICTS.districts;
      if (Array.isArray(dict) && dict.length > 0 && !dict.some(d => d === str)) {
        const sugg = getSpellingSuggestion(str, dict);
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

// Strict validation for Household No.
// Returns error string if invalid, null if valid.
// Rules:
//   • Cannot be blank/empty
//   • Cannot be "UNKNOWN" or "UNKNOWN-1" (system fallback only)
//   • Should not use separators other than hyphen (-)
//   • Must follow standard "Name - Number" or "Name-Number" format (e.g., ကောင်းတပ်-၁)
const validateHouseholdNo = (value) => {
  if (!value || typeof value !== 'string') {
    return 'Household No. is required';
  }
  const str = value.trim();
  if (str === '') {
    return 'Household No. is required';
  }
  if (str === 'UNKNOWN' || str === 'UNKNOWN-1') {
    return 'Household No. cannot be "UNKNOWN"';
  }
  if (/[/.,၊၊]/.test(str)) {
    return 'Separators like /, ., or , are not allowed. Use hyphen (-) only';
  }
  const hhNoRegex = /^[a-zA-Z\u1000-\u109F\s]+(?:\s*[-–—]\s*)[0-9၀-၉]+$/;
  if (!hhNoRegex.test(str)) {
    return 'Invalid format — must follow "Name-Number" or "Name - Number" (e.g., ကောင်းတပ်-၁)';
  }
  return null;
};

// Strict validation for Ta'ang Land ID No. format (between 4 and 19 digits)
const validateTaangLandId = (value) => {
  if (!value || typeof value !== 'string' || value.trim() === '') return null; // Optional
  
  const str = value.trim();
  let normalized = str.replace(/[\u200B-\u200D\uFEFF\u00A0\s]/g, '').replace(/[–—]/g, '-');
  let numericPart = '';
  if (/^[Nn][Oo]/.test(normalized)) {
    numericPart = normalized.replace(/^[Nn][Oo][-.,;:|\\/_=#~]*/, '');
  } else {
    numericPart = normalized;
  }
  
  if (!/^[0-9၀-၉]+$/.test(numericPart)) {
    return "Ta'ang Land ID No. must contain digits only";
  }
  
  const len = numericPart.length;
  if (len <= 3) {
    return "Ta'ang Land ID No. must have more than 3 digits";
  }
  if (len >= 20) {
    return "Ta'ang Land ID No. must have less than 20 digits";
  }
  return null;
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
// Note: Neither Ta'ang Land ID nor Previous ID (NRC) is required.
// Some households may not have applied for IDs yet.
const validateHouseholdIDRequirements = (data) => {
  // No ID requirements enforced - allows households without any IDs
  return [];
};

// Audio chime notifications for upload success and validation errors using Web Audio API
export const playUploadSuccessSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.09);
      osc.stop(ctx.currentTime + i * 0.09 + 0.2);
    });
  } catch (e) {
    console.warn('Audio playback error:', e);
  }
};

export const playUploadFailureSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const notes = [174.61, 138.59];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.25);
    });
  } catch (e) {
    console.warn('Audio playback error:', e);
  }
};

// Shared: run validation + Supabase upsert for a flat array of parsed rows
const processAndUpload = async (formattedData, setValidationErrors, setShowModal, setLoading, setSuccessMsg, onUploadSuccess, fileInputRef, setProgress) => {
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
    if (!parsedRow.name || parsedRow.name.trim() === '') missingFields.push('Name');
    if (!parsedRow.household_no || parsedRow.household_no.trim() === '' || parsedRow.household_no === 'UNKNOWN-1') missingFields.push('Household No.');
    if (!parsedRow.date_of_birth || parsedRow.date_of_birth.trim() === '') missingFields.push('Date of Birth');
    if (!parsedRow.ward_village_group || parsedRow.ward_village_group.trim() === '') missingFields.push('Ward/Village/Group');
    if (!parsedRow.township || parsedRow.township.trim() === '') missingFields.push('Township');
    if (!parsedRow.district || parsedRow.district.trim() === '') missingFields.push('District');
    if (!parsedRow.gender || parsedRow.gender.trim() === '') missingFields.push('Gender');
    if (!parsedRow.household_relationship || parsedRow.household_relationship.trim() === '') missingFields.push('Household Relationship');

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

    // Date of Birth must be a complete dd.mm.yyyy
    const dobError = validateDateOfBirth(parsedRow.date_of_birth);
    if (dobError) {
      spellingIssues.push(dobError);
    }

    // Household No. must be valid (not UNKNOWN, not empty, proper format)
    const hnError = validateHouseholdNo(parsedRow.household_no);
    if (hnError) {
      spellingIssues.push(hnError);
    }

    // District must end with " ခရိုင်"
    if (parsedRow.district && !parsedRow.district.endsWith(' ခရိုင်')) {
      spellingIssues.push(`ခရိုင် (District): "${parsedRow.district}" — " ခရိုင်" ဟူသောစကားလုံးဖြင့် အဆုံးသတ်ရမည်။ ဥပမာ — "မန်တုံ ခရိုင်"`);
    }

    // Township must end with " မြို့နယ်"
    if (parsedRow.township && !parsedRow.township.endsWith(' မြို့နယ်')) {
      spellingIssues.push(`မြို့နယ် (Township): "${parsedRow.township}" — " မြို့နယ်" ဟူသောစကားလုံးဖြင့် အဆုံးသတ်ရမည်။ ဥပမာ — "နမ္မတူ မြို့နယ်"`);
    }

    // Ta'ang Land ID No. must be valid format and length (more than 3 and less than 20 digits)
    const tlidError = validateTaangLandId(parsedRow.taang_land_id_no);
    if (tlidError) {
      spellingIssues.push(`Ta'ang Land ID No.: ${tlidError}`);
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
    playUploadFailureSound();
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

  // Progress: duplicate check phase
  if (setProgress) {
    setProgress({ current: 0, total: uniqueHouseholdNos.length, stage: 'Checking for duplicates...' });
  }

  // 2. Fetch existing rows from DB in chunks
  // OPTIMIZATION: Reduced chunk size to 25, added logging & timeout protection
  const existingFingerprints = new Set();
  const SELECT_CHUNK = 25;
  console.log(`[processAndUpload] Starting duplicate check for ${uniqueHouseholdNos.length} unique households...`);

  for (let i = 0; i < uniqueHouseholdNos.length; i += SELECT_CHUNK) {
    const slice = uniqueHouseholdNos.slice(i, i + SELECT_CHUNK);
    const startTime = Date.now();

    console.log(`[processAndUpload] Querying households ${i+1}-${Math.min(i+SELECT_CHUNK, uniqueHouseholdNos.length)} of ${uniqueHouseholdNos.length}...`);

    const { data: existingRows, error: selErr } = await supabase
      .from('households')
      .select(DUP_FIELDS.join(','))
      .in('household_no', slice);

    const duration = Date.now() - startTime;
    console.log(`[processAndUpload] Query completed in ${duration}ms, found ${existingRows?.length || 0} existing rows`);

    if (selErr) {
      console.error(`[processAndUpload] Duplicate check query failed:`, selErr);
      dbErrors.push(`Duplicate check failed: ${selErr.message}`);
      continue;
    }
    (existingRows || []).forEach(r => existingFingerprints.add(fingerprint(r)));

    // Update progress during duplicate check
    if (setProgress) {
      const checked = Math.min(i + SELECT_CHUNK, uniqueHouseholdNos.length);
      setProgress({ current: checked, total: uniqueHouseholdNos.length, stage: `Checking duplicates... ${checked}/${uniqueHouseholdNos.length} households` });
    }

    // Small delay between queries to prevent overwhelming the DB
    if (i + SELECT_CHUNK < uniqueHouseholdNos.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  console.log(`[processAndUpload] Duplicate check complete. ${existingFingerprints.size} unique fingerprints found.`);

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

    // Update progress for upload phase
    if (setProgress) {
      setProgress({
        current: Math.min(i + INSERT_BATCH, rowsToInsert.length),
        total: rowsToInsert.length,
        stage: `Uploading to database... ${Math.min(i + INSERT_BATCH, rowsToInsert.length)}/${rowsToInsert.length}`
      });
    }

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
    playUploadSuccessSound();
    pushNotification({
      type: NOTIF_TYPES.UPLOAD,
      title: 'Upload Complete',
      message: msg,
    });
  } else if (dbErrors.length > 0) {
    playUploadFailureSound();
  }
  if (onUploadSuccess && successCount > 0) onUploadSuccess();
  setLoading(false);
  if (fileInputRef.current) fileInputRef.current.value = '';
};

const CsvUploader = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });
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
        
        let households = [];
        if (Array.isArray(parsed)) {
          households = parsed;
        } else if (parsed && Array.isArray(parsed.households)) {
          households = parsed.households;
        } else if (parsed && Array.isArray(parsed.data)) {
          households = parsed.data;
        } else if (parsed && Array.isArray(parsed.records)) {
          households = parsed.records;
        } else if (parsed) {
          households = [parsed];
        }

        // Helper: normalize whitespace + ensure Unicode in one step.
        const norm = (v) => normalizeWhitespace(ensureUnicode(v || ''));

        const formattedData = [];
        for (const hh of households) {
          const hhId = hh.household_id || hh.household_no || 'UNKNOWN';
          const loc = hh.location || {
            house_no: hh.house_no,
            ward_village: hh.ward_village_group || hh.ward_village,
            township: hh.township,
            district: hh.district
          };
          const members = Array.isArray(hh.members) ? hh.members : (Array.isArray(hh.family_members) ? hh.family_members : []);
          
          if (members.length > 0) {
            for (const m of members) {
              formattedData.push({
                household_no: formatHouseholdNo(norm(hhId)),
                name: norm(m.name),
                date_of_birth: normalizeDateOfBirth(m.dob || m.date_of_birth),
                gender: norm(m.gender),
                fathers_name: norm(m.fathers_name || m.father_name),
                mothers_name: norm(m.mothers_name || m.mother_name),
                household_relationship: norm(m.relationship || m.household_relationship),
                occupation: norm(m.occupation),
                previous_id_no: normalizePreviousId(ensureUnicode(m.previous_id_no || m.nrc || '')),
                taang_land_id_no: normalizeTaangLandId(m.taang_land_id_no || ''),
                nationality: norm(m.nationality),
                resident_status: norm(m.resident_status),
                religious: norm(m.religious),
                house_no: norm(loc.house_no || m.house_no),
                ward_village_group: normalizeCommaList(norm(loc.ward_village || loc.ward_village_group || m.ward_village_group)),
                township: autoCorrectTownship(norm(loc.township || m.township)),
                district: autoCorrectDistrict(norm(loc.district || m.district)),
                submission_date: normalizeWhitespace(m.submission_date),
                address: norm(`${loc.house_no || m.house_no || ''}, ${loc.ward_village || m.ward_village_group || ''}, ${loc.township || m.township || ''}, ${loc.district || m.district || ''}`),
              });
            }
          } else if (hh.name && (hh.household_no || hh.household_id)) {
            // Flat member record
            formattedData.push({
              household_no: formatHouseholdNo(norm(hh.household_no || hh.household_id)),
              name: norm(hh.name),
              date_of_birth: normalizeDateOfBirth(hh.dob || hh.date_of_birth),
              gender: norm(hh.gender),
              fathers_name: norm(hh.fathers_name || hh.father_name),
              mothers_name: norm(hh.mothers_name || hh.mother_name),
              household_relationship: norm(hh.relationship || hh.household_relationship),
              occupation: norm(hh.occupation),
              previous_id_no: normalizePreviousId(ensureUnicode(hh.previous_id_no || hh.nrc || '')),
              taang_land_id_no: normalizeTaangLandId(hh.taang_land_id_no || ''),
              nationality: norm(hh.nationality),
              resident_status: norm(hh.resident_status),
              religious: norm(hh.religious),
              house_no: norm(loc.house_no || hh.house_no),
              ward_village_group: normalizeCommaList(norm(loc.ward_village || loc.ward_village_group || hh.ward_village_group)),
              township: autoCorrectTownship(norm(loc.township || hh.township)),
              district: autoCorrectDistrict(norm(loc.district || hh.district)),
              submission_date: normalizeWhitespace(hh.submission_date),
              address: norm(`${loc.house_no || hh.house_no || ''}, ${loc.ward_village || hh.ward_village_group || ''}, ${loc.township || hh.township || ''}, ${loc.district || hh.district || ''}`),
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
          setValidationErrors, setShowModal, setLoading, setSuccessMsg, onUploadSuccess, fileInputRef, setProgress
        );
      } catch (err) {
        console.error('JSON upload error:', err);
        playUploadFailureSound();
        alert(err.message || 'Failed to parse JSON file.');
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Shared pipeline: takes already-parsed rows (CSV or Excel) and runs forward-fill,
  // validation, and the upload — single source of truth for both formats.
  // Now with batch processing + progress tracking for large files (1000+ rows).
  const processRowsLikeCsv = async (rows, sourceLabel = 'file') => {
    try {
          // Filter out completely empty trailing rows to prevent browser freezes
          const activeRows = (rows || []).filter(row => {
            if (!row) return false;
            return Object.values(row).some(val => val !== undefined && val !== null && String(val).trim() !== '');
          });

          const totalRows = activeRows.length;
          console.log(`[${sourceLabel}] Processing ${totalRows} rows...`);

          // Mirror Papa.parse output shape
          const results = { data: activeRows, errors: [] };
          if (results.errors.length > 0) {
            console.warn("PapaParse parsing warnings:", results.errors);
          }

          let currentHouseholdNo = '';
          let currentWard = '';
          let currentTownship = '';
          let currentDistrict = '';

          const errorsFound = [];
          const formattedData = [];

          // BATCH PROCESSING: Process in chunks of 50 rows to keep UI responsive
          const BATCH_SIZE = 50;
          setProgress({ current: 0, total: totalRows, stage: 'Reading and validating rows...' });

          for (let i = 0; i < results.data.length; i += BATCH_SIZE) {
            const batch = results.data.slice(i, i + BATCH_SIZE);

            // Process this batch
            const batchResults = batch.map((row, batchIndex) => {
              const index = i + batchIndex;
            // Forward Fill Variables — normalize whitespace at the source so
            // forward-filled values are clean for every downstream row.
            const rawHn       = normalizeWhitespace(row['Household No.']);
            const rawWard     = normalizeWhitespace(row['Ward / Village / Group']);
            const rawTownship = normalizeWhitespace(row['Township']);
            const rawDistrict = normalizeWhitespace(row['District']);

            // Household Number forward-fill (auto-format spacing around hyphens)
            if (rawHn !== '') currentHouseholdNo = formatHouseholdNo(ensureUnicode(rawHn));
            else if (index === 0 && rawHn === '') currentHouseholdNo = 'UNKNOWN-1';

            // Region forward-fills (auto-correct suffixes + Unicode)
            if (rawWard !== '')     currentWard     = rawWard;
            if (rawTownship !== '') currentTownship = autoCorrectTownship(ensureUnicode(rawTownship));
            if (rawDistrict !== '') currentDistrict = autoCorrectDistrict(ensureUnicode(rawDistrict));

            // Generic cell reader — every field passes through normalizeWhitespace
            // (trims, collapses double spaces, strips zero-width chars, fixes NBSPs).
            const cell = (key) => normalizeWhitespace(row[key]);

            // Ward/Village/Group: normalize comma-list separators ("," or "၊" → ", "),
            // run Unicode + per-segment suffix auto-correction.
            let wardValue = normalizeCommaList(ensureUnicode(currentWard));
            // Apply suffix auto-correction to each segment separately so that
            // "ကောင်းတပ်ရွာ, အောင်ချမ်းသာအုပ်စု" becomes
            // "ကောင်းတပ် ရွာ, အောင်ချမ်းသာ အုပ်စု".
            wardValue = wardValue
              .split(', ')
              .map(seg => autoCorrectWardVillageGroup(seg))
              .join(', ');
            
            // Get all types (handles comma-separated values)
            const wardTypes = getWardVillageGroupTypes(wardValue);
            
            const parsedRow = {
              household_no: currentHouseholdNo,
              name: ensureUnicode(cell('Name')),
              date_of_birth: normalizeDateOfBirth(cell('Date of birth')),
              gender: ensureUnicode(cell('Gender')),
              fathers_name: ensureUnicode(cell("Father's Name")),
              mothers_name: ensureUnicode(cell("Mother's Name")),
              household_relationship: ensureUnicode(cell('Household Relationship')),
              occupation: ensureUnicode(cell('Occupation')),
              previous_id_no: normalizePreviousId(ensureUnicode(cell('Previous ID No.'))),
              taang_land_id_no: normalizeTaangLandId(cell("Ta'ang Land ID No.")),
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
            if (!parsedRow.name || parsedRow.name.trim() === '') missingFields.push('Name');
            if (!parsedRow.household_no || parsedRow.household_no.trim() === '' || parsedRow.household_no === 'UNKNOWN-1') missingFields.push('Household No.');
            if (!parsedRow.date_of_birth || parsedRow.date_of_birth.trim() === '') missingFields.push('Date of Birth');
            if (!parsedRow.ward_village_group || parsedRow.ward_village_group.trim() === '') missingFields.push('Ward/Village/Group');
            if (!parsedRow.township || parsedRow.township.trim() === '') missingFields.push('Township');
            if (!parsedRow.district || parsedRow.district.trim() === '') missingFields.push('District');
            if (!parsedRow.gender || parsedRow.gender.trim() === '') missingFields.push('Gender');
            if (!parsedRow.household_relationship || parsedRow.household_relationship.trim() === '') missingFields.push('Household Relationship');

            const spellingIssues = [];

            // 2b. Household No. Validation
            const hnError = validateHouseholdNo(parsedRow.household_no);
            if (hnError) {
              spellingIssues.push(hnError);
            }

            // 2c. Myanmar Text Quality Validation
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
            for (const field of myanmarFieldsToCheck) {
              const issue = validateMyanmarText(parsedRow[field.key], field.key);
              if (issue) {
                spellingIssues.push(`${field.label}: "${parsedRow[field.key]}" (${issue})`);
              }
            }

            // 2c. Date of Birth Validation — MUST be a complete dd.mm.yyyy
            const dobError = validateDateOfBirth(parsedRow.date_of_birth);
            if (dobError) {
              spellingIssues.push(dobError);
            }

            // 2d. Ward/Village/Group Format Validation
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

            // 2f. Ta'ang Land ID No. Validation (more than 3 and less than 20 digits)
            const tlidError = validateTaangLandId(parsedRow.taang_land_id_no);
            if (tlidError) {
              spellingIssues.push(`Ta'ang Land ID No.: ${tlidError}`);
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

          // Add batch results to main data array
          formattedData.push(...batchResults);

          // Update progress
          const processed = Math.min(i + BATCH_SIZE, totalRows);
          setProgress({ current: processed, total: totalRows, stage: `Processing rows... ${processed}/${totalRows}` });

          // Yield to UI to prevent freezing (every 50 rows)
          if (i + BATCH_SIZE < totalRows) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        if (formattedData.length === 0) {
          throw new Error('The CSV file is empty or formatted incorrectly.');
        }

        console.log(`[${sourceLabel}] Validation complete. ${formattedData.length} rows formatted, ${errorsFound.length} errors found so far.`);

          // 4. Validate household-level ID requirements
          setProgress({ current: 0, total: 0, stage: 'Validating household IDs...' });
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
            console.log(`[${sourceLabel}] ${errorsFound.length} validation errors — showing modal.`);
            setValidationErrors(errorsFound);
            setShowModal(true);
            setLoading(false);
            setProgress({ current: 0, total: 0, stage: '' });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }

          console.log(`[${sourceLabel}] No errors — proceeding to upload ${formattedData.length} rows.`);

          // 5. Delegate to shared upload processor
          await processAndUpload(
            formattedData,
            setValidationErrors, setShowModal, setLoading, setSuccessMsg, onUploadSuccess, fileInputRef, setProgress
          );

    } catch (err) {
      console.error("Upload error:", err);
      alert(err.message || `An error occurred during ${sourceLabel} upload.`);
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // CSV handler — uses PapaParse for streaming UTF-8 parsing
  const handleCsvUpload = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: "UTF-8",
      transformHeader: (header) => header.trim().replace(/\s+/g, ' '),
      complete: (results) => processRowsLikeCsv(results.data, 'CSV'),
      error: (err) => {
        setLoading(false);
        alert(`Error reading CSV file: ${err.message}`);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  // Helper to crop Excel sheet range to actual populated cells only,
  // preventing SheetJS from freezing the browser when parsing large empty cells.
  const cropSheetRange = (worksheet) => {
    if (!worksheet || !worksheet['!ref']) return;
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    let maxRow = range.s.r;
    for (const key of Object.keys(worksheet)) {
      if (key.startsWith('!')) continue;
      const cell = worksheet[key];
      if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
        const coord = XLSX.utils.decode_cell(key);
        if (coord.r > maxRow) {
          maxRow = coord.r;
        }
      }
    }
    range.e.r = maxRow;
    worksheet['!ref'] = XLSX.utils.encode_range(range);
  };

  // Excel handler — reads .xlsx / .xls via SheetJS, converts first sheet
  // to the same row shape Papa would produce (header-keyed objects), then
  // routes through the shared processRowsLikeCsv pipeline.
  const handleExcelUpload = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        // cellDates:true  → real Excel date cells become JS Date objects (not serial numbers).
        // cellNF:false    → don't carry over Excel cell formatting strings.
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error('Excel file has no sheets.');
        const worksheet = workbook.Sheets[firstSheetName];

        // Crop the range to only active populated rows before parsing
        cropSheetRange(worksheet);

        // raw:false       → values come out as formatted strings (matches CSV behaviour).
        // defval:''       → missing cells become empty strings (matches PapaParse + header:true).
        // dateNF:dd.mm.yyyy → all date cells render as "15.11.1985" — matches the format
        //                    used by HouseholdForm.jsx and householdPrint.js elsewhere
        //                    in the system, so age calculations and editing keep working.
        const rawRows = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: '',
          dateNF: 'dd.mm.yyyy',
        });

        // Normalize header whitespace exactly like PapaParse's transformHeader does,
        // so the same column-name lookups (`row['Household No.']` etc.) work.
        const rows = rawRows.map(row => {
          const cleaned = {};
          for (const key of Object.keys(row)) {
            const cleanKey = String(key).trim().replace(/\s+/g, ' ');
            cleaned[cleanKey] = row[key];
          }
          return cleaned;
        });

        if (rows.length === 0) throw new Error('Excel file has no data rows.');

        await processRowsLikeCsv(rows, 'Excel');
      } catch (err) {
        console.error('Excel upload error:', err);
        alert(err.message || 'Failed to parse Excel file.');
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Single entry point — dispatches to the right parser based on file extension.
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setProgress({ current: 0, total: 0, stage: '' });
    setSuccessMsg(null);
    setValidationErrors([]);

    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) {
      handleJsonUpload(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      handleExcelUpload(file);
    } else if (name.endsWith('.csv')) {
      handleCsvUpload(file);
    } else {
      setLoading(false);
      alert('Unsupported file type. Please upload a .csv, .xlsx, .xls, or .json file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const closeErrorModal = () => {
    setShowModal(false);
    setValidationErrors([]);
  };

  return (
    <div className="bg-white border border-gray-200">
      <div className="px-6 xl:px-8 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-2 uppercase letter-spacing-0.05">
          <Upload size={14} className="text-gray-900" /> 
          Bulk Household File Import (Excel / CSV / JSON)
        </h3>
      </div>
      <div className="p-6 xl:p-8">
        <div className="flex flex-col gap-4">

        <label className="flex flex-col items-center justify-center w-full h-32 border border-dashed border-[#E5E7EB] cursor-pointer bg-[#FAFAFA] hover:bg-[#F3F4F6] transition-colors" style={{ borderRadius: '0px' }}>
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className="flex gap-2 mb-2">
              <Table size={28} className="text-[#737373]" />
              <FileSpreadsheet size={28} className="text-[#737373]" />
              <FileJson size={28} className="text-[#737373]" />
            </div>
            <p className="text-sm text-[#737373] font-medium">
              <span className="hidden sm:inline">Click to upload or drag and drop</span>
              <span className="inline sm:hidden">Tap to upload file</span>
            </p>
            <p className="text-xs text-[#737373]">.XLSX, .XLS, .CSV, or .JSON files</p>
          </div>
          <input
            type="file"
            accept=".csv,.json,.xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
            disabled={loading}
            ref={fileInputRef}
          />
        </label>

        {loading && (
          <div className="flex flex-col gap-3 p-4" style={{ borderRadius: '0px', backgroundColor: '#EEF2F5', border: '1px solid #B0BEC5', color: '#4A6572' }}>
            <div className="flex items-center gap-3 font-medium">
              <Loader2 className="animate-spin" size={20} style={{ color: '#4A6572' }} />
              {progress.total > 0 ? (
                <span>{progress.stage}</span>
              ) : (
                <span>Processing and validating your file...</span>
              )}
            </div>
            {progress.total > 0 && (
              <div className="w-full">
                <div className="flex justify-between text-sm mb-1" style={{ color: '#4A6572' }}>
                  <span>Row {progress.current} of {progress.total}</span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-300 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300 ease-out"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                      backgroundColor: '#1D4ED8'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {successMsg && !loading && (
          <div className="tps-success-enter flex items-center gap-3 font-medium p-4" style={{ borderRadius: '0px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF' }}>
            <CheckCircle2 size={20} style={{ color: '#1D4ED8', flexShrink: 0 }} />
            {successMsg}
          </div>
        )}

      </div>
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
