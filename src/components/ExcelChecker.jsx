import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { zg2uni } from 'rabbit-node';
import {
  AlertCircle, X, CheckCircle2, Upload, FileSpreadsheet,
  Loader2, Download, FileCheck, AlertTriangle, ChevronDown,
  ChevronUp, FileWarning, Table, ClipboardCheck
} from 'lucide-react';

// ============ SHARED UTILITIES FROM CsvUploader ============

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
const validateMyanmarText = (text) => {
  if (!text || typeof text !== 'string') return null;
  const str = text.trim();
  if (str === '' || str === '-') return null;

  // Only validate strings that contain Myanmar characters
  const hasMyanmarChars = /[\u1000-\u109F]/.test(str);
  if (!hasMyanmarChars) return null;

  const issues = [];

  // 1. Duplicate/repeated medials & vowel signs that should never repeat
  // ှ (U+103E), ျ (U+103B), ြ (U+103C), ွ (U+103D)
  if (/([\u103B-\u103E])\1/.test(str)) issues.push('Duplicate medial/modifier');
  // Duplicate vowel signs: ါ (U+102B), ာ (U+102C), ိ (U+102D), ီ (U+102E), ု (U+102F), ူ (U+1030), ေ (U+1031), ဲ (U+1032)
  if (/([\u102B-\u1032])\1/.test(str)) issues.push('Duplicate vowel sign');
  // Duplicate asat ်(U+1039) or killer ့(U+1037) or visarga း(U+1038)
  if(/(\u1039)\1/.test(str)) issues.push('Duplicate virama');
  if(/(\u1037)\1+/.test(str)) issues.push('Repeated dot below (့)');
  if(/(\u1038)\1+/.test(str)) issues.push('Repeated visarga (း)');

  // 2. Multiple ေ in one syllable
  if(/\u1031[^\u1000-\u102A\u1040-\u1049]*\u1031/.test(str)) issues.push('Multiple ေ in sequence');

  // 3. Stacking mark ္ (U+1039) not followed by a valid consonant
  if(/\u1039[^\u1000-\u102A]/.test(str)) issues.push('Invalid stacking (္ not followed by consonant)');
  if(/\u1039$/.test(str)) issues.push('Stacking mark at end of text');

  // 4. Mixed encoding artifacts — Latin characters mixed into Myanmar words
  const myanmarSegments = str.split(/[\s,\-\/\.\(\)0-9၀-၉]+/);
  for (const seg of myanmarSegments) {
    if (/[\u1000-\u109F]/.test(seg) && /[a-zA-Z]/.test(seg)) {
      issues.push('Latin characters mixed with Myanmar');
      break;
    }
  }

  return issues.length > 0 ? issues.join('; ') : null;
};

// ============ SHARED FORMATTING & VALIDATION (mirrors CsvUploader) ============

// Auto-correct Ward/Village/Group by adding space before suffix if missing
const autoCorrectWardVillageGroup = (value) => {
  if (!value || typeof value !== 'string') return value;
  const str = value.trim();
  if (str === '') return str;
  const wardMatch = str.match(/^(.+?)ရပ်ကွက်$/);
  if (wardMatch && !str.includes(' ရပ်ကွက်')) return `${wardMatch[1].trim()} ရပ်ကွက်`;
  const villageMatch = str.match(/^(.+?)ရွာ$/);
  if (villageMatch && !str.includes(' ရွာ') && str !== 'ရွာ') return `${villageMatch[1].trim()} ရွာ`;
  const groupMatch = str.match(/^(.+?)အုပ်စု$/);
  if (groupMatch && !str.includes(' အုပ်စု')) return `${groupMatch[1].trim()} အုပ်စု`;
  return str;
};

// Auto-correct Township: ensure space before "မြို့နယ်" suffix
const autoCorrectTownship = (value) => {
  if (!value || value.trim() === '') return value;
  const str = value.trim();
  const match = str.match(/^(.+?)မြို့နယ်$/);
  if (match && !str.includes(' မြို့နယ်')) return `${match[1].trim()} မြို့နယ်`;
  return str;
};

// Auto-correct District: ensure space before "ခရိုင်" suffix
const autoCorrectDistrict = (value) => {
  if (!value || value.trim() === '') return value;
  const str = value.trim();
  const match = str.match(/^(.+?)ခရိုင်$/);
  if (match && !str.includes(' ခရိုင်')) return `${match[1].trim()} ခရိုင်`;
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

// Detect Ward/Village/Group type
const detectWardVillageGroupType = (value) => {
  if (!value || typeof value !== 'string') return 'unknown';
  const str = value.trim();
  if (str.includes('ရပ်ကွက်')) return 'ward';
  if (str.includes('အုပ်စု')) return 'group';
  if (str.includes('ရွာ')) return 'village';
  return 'unknown';
};

// Get types from comma-separated ward_village_group
const getWardVillageGroupTypes = (value) => {
  if (!value || typeof value !== 'string') return ['unknown'];
  const parts = value.split(/[,၊]/).map(p => p.trim()).filter(p => p !== '');
  if (parts.length === 0) return ['unknown'];
  const types = parts.map(part => detectWardVillageGroupType(autoCorrectWardVillageGroup(part)));
  return [...new Set(types.filter(t => t !== 'unknown'))];
};

// Validate Ward/Village/Group format
const validateWardVillageGroup = (value) => {
  if (!value || typeof value !== 'string' || value.trim() === '') return 'Value is required';
  const corrected = autoCorrectWardVillageGroup(value.trim());
  if (detectWardVillageGroupType(corrected) === 'unknown') {
    return `Must contain "ရပ်ကွက်" (Ward), "ရွာ" (Village), or "အုပ်စု" (Group)`;
  }
  return null;
};

// Validate household-level ID requirements (mirrors CsvUploader)
const validateHouseholdIDRequirements = (data) => {
  const errors = [];
  const households = data.reduce((acc, row) => {
    const hn = row.household_no || 'UNKNOWN';
    if (!acc[hn]) acc[hn] = [];
    acc[hn].push(row);
    return acc;
  }, {});
  Object.entries(households).forEach(([householdNo, members]) => {
    const hasTaangLandID = members.some(m => m.taang_land_id_no && m.taang_land_id_no.trim() !== '');
    const previousIDCount = members.filter(m => m.previous_id_no && m.previous_id_no.trim() !== '').length;
    if (!hasTaangLandID) errors.push({ householdNo, issue: "No Ta'ang Land ID", detail: "At least one family member must have a Ta'ang Land ID No.", rowNumbers: members.map((_, i) => i + 2).slice(0, 3) });
    if (previousIDCount < 1) errors.push({ householdNo, issue: 'No Previous ID', detail: 'At least one family member must have a Previous ID No. (NRC).', rowNumbers: members.map((_, i) => i + 2).slice(0, 3) });
  });
  return errors;
};

// ============ EXCEL CHECKER COMPONENT ============

const REQUIRED_FIELDS = [
  { key: 'ward_village_group', label: 'Ward/Village/Group', required: true },
  { key: 'township', label: 'Township', required: true },
  { key: 'district', label: 'District', required: true },
  { key: 'gender', label: 'Gender', required: true },
  { key: 'household_relationship', label: 'Household Relationship', required: true },
  { key: 'name', label: 'Name', required: false },
  { key: 'fathers_name', label: "Father's Name", required: false },
  { key: 'mothers_name', label: "Mother's Name", required: false },
  { key: 'occupation', label: 'Occupation', required: false },
  { key: 'nationality', label: 'Nationality', required: false },
  { key: 'religious', label: 'Religious', required: false },
  { key: 'resident_status', label: 'Resident Status', required: false },
];

const MYANMAR_FIELDS = [
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

const ExcelHeaderMap = {
  'Household No.': 'household_no',
  'Name': 'name',
  'Date of birth': 'date_of_birth',
  'Gender': 'gender',
  "Father's Name": 'fathers_name',
  "Mother's Name": 'mothers_name',
  'Household Relationship': 'household_relationship',
  'Occupation': 'occupation',
  'Previous ID No.': 'previous_id_no',
  "Ta'ang Land ID No.": 'taang_land_id_no',
  'Nationality': 'nationality',
  'Resident Status': 'resident_status',
  'Religious': 'religious',
  'House NO.': 'house_no',
  'Ward / Village / Group': 'ward_village_group',
  'Township': 'township',
  'District': 'district',
  'Submission Date': 'submission_date',
};

const ExcelChecker = () => {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [checkResults, setCheckResults] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    errors: true,
    warnings: false,
    valid: false,
  });
  const fileInputRef = useRef(null);

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Convert Excel file to array of arrays (CSV-like)
  const excelToJson = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellText: true, cellDates: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Process and validate data
  const processData = (rawData) => {
    if (!rawData || rawData.length < 2) {
      throw new Error('Excel file is empty or has no data rows');
    }

    const headers = rawData[0].map(h => String(h).trim());
    const rows = rawData.slice(1);

    let currentHouseholdNo = '';
    let currentWard = '';
    let currentTownship = '';
    let currentDistrict = '';

    const errors = [];
    const warnings = [];
    const validRows = [];
    let processedCount = 0;

    rows.forEach((row, index) => {
      const rowData = {};
      headers.forEach((header, i) => {
        const key = ExcelHeaderMap[header];
        if (key) {
          rowData[key] = row[i] !== undefined ? String(row[i]).trim() : '';
        }
      });

      // Forward fill logic (with auto-format + auto-correct, mirrors CsvUploader)
      if (rowData.household_no && rowData.household_no !== '') {
        currentHouseholdNo = formatHouseholdNo(ensureUnicode(rowData.household_no));
      } else if (index === 0 && !currentHouseholdNo) {
        currentHouseholdNo = 'UNKNOWN-1';
      }
      if (rowData.ward_village_group && rowData.ward_village_group !== '') {
        currentWard = autoCorrectWardVillageGroup(ensureUnicode(rowData.ward_village_group));
      }
      if (rowData.township && rowData.township !== '') {
        currentTownship = autoCorrectTownship(ensureUnicode(rowData.township));
      }
      if (rowData.district && rowData.district !== '') {
        currentDistrict = autoCorrectDistrict(ensureUnicode(rowData.district));
      }

      // Apply forward-filled values
      const wardTypes = getWardVillageGroupTypes(currentWard);
      const parsedRow = {
        household_no: currentHouseholdNo,
        name: ensureUnicode(rowData.name || ''),
        date_of_birth: rowData.date_of_birth || '',
        gender: ensureUnicode(rowData.gender || ''),
        fathers_name: ensureUnicode(rowData.fathers_name || ''),
        mothers_name: ensureUnicode(rowData.mothers_name || ''),
        household_relationship: ensureUnicode(rowData.household_relationship || ''),
        occupation: ensureUnicode(rowData.occupation || ''),
        previous_id_no: ensureUnicode(rowData.previous_id_no || ''),
        taang_land_id_no: ensureUnicode(rowData.taang_land_id_no || ''),
        nationality: ensureUnicode(rowData.nationality || ''),
        resident_status: ensureUnicode(rowData.resident_status || ''),
        religious: ensureUnicode(rowData.religious || ''),
        house_no: ensureUnicode(rowData.house_no || ''),
        ward_village_group: currentWard,
        ward_village_group_type: wardTypes,
        township: currentTownship,
        district: currentDistrict,
        submission_date: rowData.submission_date || '',
        address: ensureUnicode(`${rowData.house_no || ''}, ${currentWard}, ${currentTownship}, ${currentDistrict}`),
      };

      // Skip completely empty rows
      const isEmpty = !parsedRow.name && !parsedRow.household_no && !parsedRow.gender;
      if (isEmpty) return;

      processedCount++;
      const rowNum = index + 2; // Excel row number (1-indexed + header)

      // Check for missing required fields
      const missingFields = [];
      if (!parsedRow.ward_village_group) missingFields.push('Ward/Village/Group');
      if (!parsedRow.township) missingFields.push('Township');
      if (!parsedRow.district) missingFields.push('District');
      if (!parsedRow.gender) missingFields.push('Gender');
      if (!parsedRow.household_relationship) missingFields.push('Household Relationship');

      // Validate Ward/Village/Group format
      const wardFormatError = validateWardVillageGroup(parsedRow.ward_village_group);
      if (wardFormatError && parsedRow.ward_village_group) missingFields.push(`Ward format: ${wardFormatError}`);

      // Check Myanmar text quality
      const spellingIssues = [];
      for (const field of MYANMAR_FIELDS) {
        const issue = validateMyanmarText(parsedRow[field.key]);
        if (issue) {
          spellingIssues.push({
            field: field.label,
            value: parsedRow[field.key],
            issue: issue
          });
        }
      }

      // Categorize as error or warning
      if (missingFields.length > 0) {
        errors.push({
          rowNumber: rowNum,
          data: parsedRow,
          missingFields,
          spellingIssues,
          severity: 'error'
        });
      } else if (spellingIssues.length > 0) {
        warnings.push({
          rowNumber: rowNum,
          data: parsedRow,
          spellingIssues,
          severity: 'warning'
        });
        validRows.push(parsedRow);
      } else {
        validRows.push(parsedRow);
      }
    });

    // Validate household-level ID requirements (mirrors CsvUploader)
    const allRows = [...errors.map(e => e.data), ...warnings.map(w => w.data), ...validRows];
    const householdIDErrors = validateHouseholdIDRequirements(allRows);
    householdIDErrors.forEach(err => {
      errors.push({
        rowNumber: err.rowNumbers.join(', ') + '...',
        data: { name: `Household: ${err.householdNo}` },
        missingFields: [`${err.issue}: ${err.detail}`],
        spellingIssues: [],
        severity: 'error'
      });
    });

    return {
      totalRows: processedCount,
      errors,
      warnings,
      validRows,
      isValid: errors.length === 0
    };
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExtension && !validTypes.includes(file.type)) {
      alert('Please upload an Excel file (.xlsx, .xls) or CSV file (.csv)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setLoading(true);
    setFileName(file.name);
    setCheckResults(null);

    try {
      let jsonData;

      if (file.name.toLowerCase().endsWith('.csv')) {
        // Handle CSV directly
        const text = await file.text();
        const result = Papa.parse(text, { header: false, skipEmptyLines: 'greedy' });
        jsonData = result.data;
      } else {
        // Handle Excel
        jsonData = await excelToJson(file);
      }

      const results = processData(jsonData);
      setCheckResults(results);

      // Auto-expand sections based on results
      setExpandedSections({
        summary: true,
        errors: results.errors.length > 0,
        warnings: results.warnings.length > 0,
        valid: results.errors.length === 0 && results.warnings.length === 0,
      });

    } catch (err) {
      console.error('File processing error:', err);
      alert(err.message || 'Failed to process file. Please check the format.');
    } finally {
      setLoading(false);
    }
  };

  // Download corrected CSV
  const downloadCorrectedCSV = () => {
    if (!checkResults || checkResults.validRows.length === 0) return;

    const csvHeaders = [
      'Household No.', 'Name', 'Date of birth', 'Gender', "Father's Name",
      "Mother's Name", 'Household Relationship', 'Occupation', 'Previous ID No.',
      "Ta'ang Land ID No.", 'Nationality', 'Resident Status', 'Religious',
      'House NO.', 'Ward / Village / Group', 'Township', 'District', 'Submission Date'
    ];

    const csvRows = checkResults.validRows.map(row => [
      row.household_no,
      row.name,
      row.date_of_birth,
      row.gender,
      row.fathers_name,
      row.mothers_name,
      row.household_relationship,
      row.occupation,
      row.previous_id_no,
      row.taang_land_id_no,
      row.nationality,
      row.resident_status,
      row.religious,
      row.house_no,
      row.ward_village_group,
      row.township,
      row.district,
      row.submission_date
    ]);

    const csv = Papa.unparse({
      fields: csvHeaders,
      data: csvRows
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `corrected_${fileName.replace(/\.[^/.]+$/, '')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Download error report
  const downloadErrorReport = () => {
    if (!checkResults || (checkResults.errors.length === 0 && checkResults.warnings.length === 0)) return;

    const reportLines = [
      ['HDC - Ta\'ang Household Database Checker - Error Report'],
      ['Generated:', new Date().toLocaleString()],
      ['Original File:', fileName],
      [''],
      ['SUMMARY'],
      ['Total Rows Processed:', checkResults.totalRows],
      ['Errors:', checkResults.errors.length],
      ['Warnings:', checkResults.warnings.length],
      ['Valid Rows:', checkResults.validRows.length],
      [''],
    ];

    if (checkResults.errors.length > 0) {
      reportLines.push(['ERRORS (Must Fix)'], ['Row Number', 'Name', 'Missing Fields', 'Myanmar Text Issues']);
      checkResults.errors.forEach(err => {
        reportLines.push([
          err.rowNumber,
          err.data.name || 'N/A',
          err.missingFields?.join(', ') || '',
          err.spellingIssues?.map(s => `${s.field}: "${s.value}" (${s.issue})`).join('; ') || ''
        ]);
      });
      reportLines.push(['']);
    }

    if (checkResults.warnings.length > 0) {
      reportLines.push(['WARNINGS (Review Recommended)'], ['Row Number', 'Name', 'Myanmar Text Issues']);
      checkResults.warnings.forEach(warn => {
        reportLines.push([
          warn.rowNumber,
          warn.data.name || 'N/A',
          warn.spellingIssues.map(s => `${s.field}: "${s.value}" (${s.issue})`).join('; ')
        ]);
      });
    }

    const csv = Papa.unparse(reportLines);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `error_report_${fileName.replace(/\.[^/.]+$/, '')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Reset checker
  const resetChecker = () => {
    setCheckResults(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Render checklist item
  const ChecklistItem = ({ icon: Icon, label, status, count }) => (
    <div className="flex items-center justify-between p-3 bg-white border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#F3F4F6] text-[#1A1A1A]" style={{ borderRadius: '0px' }}>
          <Icon size={18} />
        </div>
        <span className="font-medium text-[#1A1A1A]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {status === 'pass' && <CheckCircle2 size={20} style={{ color: '#2E7D32' }} />}
        {status === 'fail' && <AlertCircle size={20} style={{ color: '#B71C1C' }} />}
        {status === 'warning' && <AlertTriangle size={20} style={{ color: '#E65100' }} />}
        {count !== undefined && (
          <span className="font-bold text-[#1A1A1A]">
            {count}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white p-6 border border-[#E5E7EB] mb-8" style={{ borderRadius: '0px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-[#F3F4F6] text-[#1A1A1A] p-2" style={{ borderRadius: '0px' }}>
          <ClipboardCheck size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">HDC: Ta'ang Household Database Checker</h2>
          <p className="text-sm text-[#737373]">
            Validate Excel/CSV files before uploading to the database
          </p>
        </div>
      </div>

      {/* File Upload Area */}
      {!checkResults && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col items-center justify-center w-full h-40 border border-dashed border-[#E5E7EB] cursor-pointer bg-[#FAFAFA] hover:bg-[#F3F4F6] transition-colors" style={{ borderRadius: '0px' }}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FileSpreadsheet size={40} className="text-[#737373] mb-3" />
              <p className="text-sm text-[#737373] font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-[#737373] mt-1">.XLSX, .XLS, or .CSV files</p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={loading}
              ref={fileInputRef}
            />
          </label>

          {loading && (
            <div className="flex items-center justify-center gap-3 font-medium p-4" style={{ borderRadius: '0px', backgroundColor: '#EEF2F5', border: '1px solid #B0BEC5', color: '#4A6572' }}>
              <Loader2 className="animate-spin" size={20} style={{ color: '#4A6572' }} />
              Converting Excel to CSV and validating data...
            </div>
          )}
        </div>
      )}

      {/* Check Results */}
      {checkResults && (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="border border-[#E5E7EB] overflow-hidden">
            <button
              onClick={() => toggleSection('summary')}
              className="w-full flex items-center justify-between p-4 bg-[#FAFAFA] hover:bg-[#F3F4F6] transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileCheck size={20} className="text-[#737373]" />
                <span className="font-bold text-[#1A1A1A]">Validation Summary</span>
                <span className="text-sm text-[#737373]">({fileName})</span>
              </div>
              {expandedSections.summary ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {expandedSections.summary && (
              <div className="p-4 space-y-3">
                {/* Overall Status */}
                <div className={`p-4 flex items-center gap-3 border ${
                  checkResults.isValid
                    ? checkResults.warnings.length > 0
                      ? 'bg-[#FAFAFA] border-[#E5E7EB]'
                      : 'bg-[#FAFAFA] border-[#E5E7EB]'
                    : 'bg-[#FAFAFA] border-[#E5E7EB]'
                }`} style={{ borderRadius: '0px' }}>
                  {checkResults.isValid ? (
                    checkResults.warnings.length > 0 ? (
                      <>
                        <AlertTriangle size={24} className="text-[#737373]" />
                        <div>
                          <p className="font-bold text-[#1A1A1A]">Ready with Warnings</p>
                          <p className="text-sm text-[#737373]">
                            File can be uploaded but review warnings first
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={24} style={{ color: '#2E7D32' }} />
                        <div>
                          <p className="font-bold" style={{ color: '#1B5E20' }}>All Checks Passed</p>
                          <p className="text-sm text-[#737373]">
                            File is ready for database upload
                          </p>
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      <AlertCircle size={24} style={{ color: '#B71C1C' }} />
                      <div>
                        <p className="font-bold" style={{ color: '#B71C1C' }}>Validation Failed</p>
                        <p className="text-sm text-[#737373]">
                          Fix errors in Excel before uploading
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Checklist Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ChecklistItem
                    icon={Table}
                    label="Total Rows"
                    status="pass"
                    count={checkResults.totalRows}
                  />
                  <ChecklistItem
                    icon={FileCheck}
                    label="Valid Rows"
                    status={checkResults.validRows.length === checkResults.totalRows ? 'pass' : 'warning'}
                    count={checkResults.validRows.length}
                  />
                  <ChecklistItem
                    icon={AlertCircle}
                    label="Errors (Must Fix)"
                    status={checkResults.errors.length === 0 ? 'pass' : 'fail'}
                    count={checkResults.errors.length}
                  />
                  <ChecklistItem
                    icon={AlertTriangle}
                    label="Warnings (Review)"
                    status={checkResults.warnings.length === 0 ? 'pass' : 'warning'}
                    count={checkResults.warnings.length}
                  />
                </div>

                {/* Myanmar Text Check */}
                <div className="mt-4 p-3 bg-[#FAFAFA] border border-[#E5E7EB]">
                  <p className="text-sm font-semibold text-[#1A1A1A] mb-2">Myanmar Text Validation</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-xs border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>
                      <CheckCircle2 size={12} className="text-[#1A1A1A]" />
                      Zawgyi → Unicode conversion
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-xs border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>
                      <CheckCircle2 size={12} className="text-[#1A1A1A]" />
                      Duplicate medial detection
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-xs border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>
                      <CheckCircle2 size={12} className="text-[#1A1A1A]" />
                      Invalid sequence detection
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-xs border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>
                      <CheckCircle2 size={12} className="text-[#1A1A1A]" />
                      Mixed encoding detection
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Errors Section */}
          {checkResults.errors.length > 0 && (
            <div className="border border-[#E5E7EB] overflow-hidden">
              <button
                onClick={() => toggleSection('errors')}
                className="w-full flex items-center justify-between p-4 bg-[#FAFAFA] hover:bg-[#F3F4F6] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="text-[#1A1A1A]" />
                  <span className="font-bold text-[#1A1A1A]">Errors ({checkResults.errors.length})</span>
                  <span className="text-xs text-[#737373] bg-[#F3F4F6] px-2 py-0.5" style={{ borderRadius: '0px' }}>Must Fix</span>
                </div>
                {expandedSections.errors ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {expandedSections.errors && (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
                      <tr>
                        <th className="px-3 py-2 text-xs font-semibold text-[#737373] w-20">Excel Row</th>
                        <th className="px-3 py-2 text-xs font-semibold text-[#737373]">Name</th>
                        <th className="px-3 py-2 text-xs font-semibold text-[#737373]">Missing Required Fields</th>
                        <th className="px-3 py-2 text-xs font-semibold text-[#737373]">Myanmar Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {checkResults.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-[#F3F4F6]">
                          <td className="px-3 py-2 text-sm font-bold text-[#1A1A1A]">#{err.rowNumber}</td>
                          <td className="px-3 py-2 text-sm text-[#1A1A1A]">{err.data.name || 'N/A'}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {err.missingFields?.map((field, i) => (
                                <span key={i} className="text-xs bg-[#F3F4F6] text-[#1A1A1A] px-2 py-0.5 border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>
                                  {field}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {err.spellingIssues?.map((issue, i) => (
                              <div key={i} className="text-xs text-[#737373] mb-1">
                                {issue.field}: "{issue.value}" ({issue.issue})
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Warnings Section */}
          {checkResults.warnings.length > 0 && (
            <div className="border border-[#E5E7EB] overflow-hidden">
              <button
                onClick={() => toggleSection('warnings')}
                className="w-full flex items-center justify-between p-4 bg-[#FAFAFA] hover:bg-[#F3F4F6] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className="text-[#737373]" />
                  <span className="font-bold text-[#1A1A1A]">Warnings ({checkResults.warnings.length})</span>
                  <span className="text-xs text-[#737373] bg-[#F3F4F6] px-2 py-0.5" style={{ borderRadius: '0px' }}>Review Recommended</span>
                </div>
                {expandedSections.warnings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {expandedSections.warnings && (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
                      <tr>
                        <th className="px-3 py-2 text-xs font-semibold text-[#737373] w-20">Excel Row</th>
                        <th className="px-3 py-2 text-xs font-semibold text-[#737373]">Name</th>
                        <th className="px-3 py-2 text-xs font-semibold text-[#737373]">Myanmar Text Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {checkResults.warnings.map((warn, idx) => (
                        <tr key={idx} className="hover:bg-[#F3F4F6]">
                          <td className="px-3 py-2 text-sm font-bold text-[#1A1A1A]">#{warn.rowNumber}</td>
                          <td className="px-3 py-2 text-sm text-[#1A1A1A]">{warn.data.name || 'N/A'}</td>
                          <td className="px-3 py-2">
                            {warn.spellingIssues.map((issue, i) => (
                              <div key={i} className="text-xs text-[#737373] mb-1">
                                {issue.field}: "{issue.value}" ({issue.issue})
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Valid Rows Preview */}
          {checkResults.validRows.length > 0 && (
            <div className="border border-[#E5E7EB] overflow-hidden">
              <button
                onClick={() => toggleSection('valid')}
                className="w-full flex items-center justify-between p-4 bg-[#FAFAFA] hover:bg-[#F3F4F6] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-[#1A1A1A]" />
                  <span className="font-bold text-[#1A1A1A]">Valid Rows Preview ({checkResults.validRows.length})</span>
                </div>
                {expandedSections.valid ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {expandedSections.valid && (
                <div className="p-4 overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB] sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-xs font-semibold text-[#737373]">Household</th>
                        <th className="px-2 py-2 text-xs font-semibold text-[#737373]">Name</th>
                        <th className="px-2 py-2 text-xs font-semibold text-[#737373]">Gender</th>
                        <th className="px-2 py-2 text-xs font-semibold text-[#737373]">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {checkResults.validRows.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#F3F4F6]">
                          <td className="px-2 py-1.5 text-[#1A1A1A]">{row.household_no}</td>
                          <td className="px-2 py-1.5 text-[#1A1A1A] font-medium">{row.name}</td>
                          <td className="px-2 py-1.5 text-[#737373]">{row.gender}</td>
                          <td className="px-2 py-1.5 text-[#737373] text-xs">{row.township}, {row.district}</td>
                        </tr>
                      ))}
                      {checkResults.validRows.length > 20 && (
                        <tr>
                          <td colSpan={4} className="px-2 py-2 text-center text-xs text-[#737373] italic">
                            ... and {checkResults.validRows.length - 20} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-[#E5E7EB]">
            {checkResults.validRows.length > 0 && (
              <button
                onClick={downloadCorrectedCSV}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white hover:bg-[#737373] transition-colors"
                style={{ borderRadius: '0px' }}
              >
                <Download size={18} />
                Download Corrected CSV
              </button>
            )}

            {(checkResults.errors.length > 0 || checkResults.warnings.length > 0) && (
              <button
                onClick={downloadErrorReport}
                className="flex items-center gap-2 px-4 py-2 bg-[#F3F4F6] text-[#1A1A1A] border border-[#E5E7EB] hover:bg-[#E5E7EB] transition-colors"
                style={{ borderRadius: '0px' }}
              >
                <FileWarning size={18} />
                Download Error Report
              </button>
            )}

            <button
              onClick={resetChecker}
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#1A1A1A] border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors ml-auto"
              style={{ borderRadius: '0px' }}
            >
              <X size={18} />
              Check Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelChecker;
