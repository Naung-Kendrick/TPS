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
  if (/(\u1039)\1/.test(str)) issues.push('Duplicate virama');
  if (/(\u1037)\1+/.test(str)) issues.push('Repeated dot below (့)');
  if (/(\u1038)\1+/.test(str)) issues.push('Repeated visarga (း)');

  // 2. Invalid sequences: vowel sign before consonant without proper structure
  // ေ (U+1031) should appear before a consonant cluster in display but in Unicode it comes after
  // In proper Unicode, ေ is stored AFTER the consonant. If we see ေ followed by non-Myanmar or end, it's wrong

  // 3. Multiple ေ in one syllable
  if (/\u1031[^\u1000-\u102A\u1040-\u1049]*\u1031/.test(str)) issues.push('Multiple ေ in sequence');

  // 4. Stacking mark ္ (U+1039) not followed by a valid consonant
  if (/\u1039[^\u1000-\u102A]/.test(str)) issues.push('Invalid stacking (္ not followed by consonant)');
  if (/\u1039$/.test(str)) issues.push('Stacking mark at end of text');

  // 5. Mixed encoding artifacts — Latin characters mixed into Myanmar words
  // (exclude common separators like -, /, .)
  const myanmarSegments = str.split(/[\s,\-\/\.\(\)0-9၀-၉]+/);
  for (const seg of myanmarSegments) {
    if (/[\u1000-\u109F]/.test(seg) && /[a-zA-Z]/.test(seg)) {
      issues.push('Latin characters mixed with Myanmar');
      break;
    }
  }

  return issues.length > 0 ? issues.join('; ') : null;
};

// Shared: run validation + Supabase upsert for a flat array of parsed rows
const processAndUpload = async (formattedData, setValidationErrors, setShowModal, setLoading, setSuccessMsg, onUploadSuccess, fileInputRef) => {
  const errorsFound = [];

  formattedData.forEach((parsedRow, index) => {
    const missingFields = [];
    if (!parsedRow.ward_village_group) missingFields.push('Ward/Village/Group');
    if (!parsedRow.township) missingFields.push('Township');
    if (!parsedRow.district) missingFields.push('District');
    if (!parsedRow.gender) missingFields.push('Gender');
    if (!parsedRow.household_relationship) missingFields.push('Household Relationship');

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
      const issue = validateMyanmarText(parsedRow[field.key]);
      if (issue) spellingIssues.push(`${field.label}: "${parsedRow[field.key]}" (${issue})`);
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

  for (let i = 0; i < formattedData.length; i++) {
    const rowData = formattedData[i];
    const { data: existing } = await supabase
      .from('households')
      .select('id')
      .eq('name', rowData.name || '')
      .eq('household_no', rowData.household_no || '')
      .eq('date_of_birth', rowData.date_of_birth || '')
      .eq('gender', rowData.gender || '')
      .eq('fathers_name', rowData.fathers_name || '')
      .eq('previous_id_no', rowData.previous_id_no || '')
      .limit(1);

    if (existing && existing.length > 0) { duplicateCount++; continue; }

    const { error: supabaseError } = await supabase.from('households').insert(rowData);
    if (supabaseError) dbErrors.push(`Row ${i + 2}: ${supabaseError.message}`);
    else successCount++;
  }

  const parts = [];
  if (successCount > 0) parts.push(`Inserted ${successCount} new records`);
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
              household_no: ensureUnicode(String(hhId).trim()),
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
              township: ensureUnicode(loc.township || m.township || ''),
              district: ensureUnicode(loc.district || m.district || ''),
              submission_date: m.submission_date || '',
              address: ensureUnicode(`${loc.house_no || ''}, ${loc.ward_village || ''}, ${loc.township || ''}, ${loc.district || ''}`),
            });
          }
        }

        if (formattedData.length === 0) throw new Error('JSON file has no member records.');

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

            // Household Number forward-fill
            if (rawHn && rawHn.trim() !== '') currentHouseholdNo = rawHn.trim();
            else if (index === 0 && (!rawHn || rawHn.trim() === '')) currentHouseholdNo = 'UNKNOWN-1';

            // Region forward-fills
            if (rawWard && rawWard.trim() !== '') currentWard = rawWard.trim();
            if (rawTownship && rawTownship.trim() !== '') currentTownship = rawTownship.trim();
            if (rawDistrict && rawDistrict.trim() !== '') currentDistrict = rawDistrict.trim();

            const cell = (key) => (row[key] || '').trim();
            const parsedRow = {
              household_no: ensureUnicode(currentHouseholdNo),
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
              ward_village_group: ensureUnicode(currentWard),
              township: ensureUnicode(currentTownship),
              district: ensureUnicode(currentDistrict),
              submission_date: cell('Submission Date'),
              address: ensureUnicode(`${cell('House NO.')}, ${currentWard}, ${currentTownship}, ${currentDistrict}`)
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
              const issue = validateMyanmarText(parsedRow[field.key]);
              if (issue) {
                spellingIssues.push(`${field.label}: "${parsedRow[field.key]}" (${issue})`);
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

          // 4. Delegate to shared upload processor
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
    <div className="bg-white p-6 border border-[#E5E7EB] mb-8" style={{ borderRadius: '0px' }}>
      <div className="flex items-center gap-3 mb-4">
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
          <div className="flex items-center gap-3 text-[#1A1A1A] font-medium p-4 bg-[#F3F4F6]" style={{ borderRadius: '0px' }}>
            <Loader2 className="animate-spin" size={20} />
            Processing and validating your file...
          </div>
        )}

        {successMsg && !loading && (
          <div className="flex items-center gap-3 text-[#1A1A1A] font-medium p-4 bg-[#F3F4F6] border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>
            <CheckCircle2 size={20} />
            {successMsg}
          </div>
        )}
      </div>

      {/* ERROR MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>

            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB] bg-[#FAFAFA]">
              <div className="flex items-center gap-3 text-[#1A1A1A]">
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

              <div className="border border-[#E5E7EB] overflow-hidden">
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
                              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wide">Missing Fields:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {err.missingFields.split(', ').map((field, i) => (
                                  <span key={i} className="inline-block bg-[#F3F4F6] text-[#1A1A1A] px-2 py-0.5 text-xs border border-[#E5E7EB] font-medium" style={{ borderRadius: '0px' }}>
                                    {field}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {err.spellingIssues && (
                            <div>
                              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wide">⚠ Myanmar Text Errors:</span>
                              <div className="mt-1 space-y-1">
                                {err.spellingIssues.map((issue, i) => (
                                  <div key={i} className="bg-[#FAFAFA] text-[#1A1A1A] px-2 py-1 text-xs border border-[#E5E7EB] font-medium" style={{ borderRadius: '0px' }}>
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
                className="px-6 py-2.5 bg-[#1A1A1A] text-white font-medium hover:bg-[#737373] transition-colors"
                style={{ borderRadius: '0px' }}
              >
                Cancel Upload & Fix Excel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CsvUploader;
