import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { zg2uni } from 'rabbit-node';
import { AlertCircle, X, CheckCircle2, Upload, FileSpreadsheet, Loader2 } from 'lucide-react';

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

const CsvUploader = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]); // Modal state
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

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

            const parsedRow = {
              household_no: ensureUnicode(currentHouseholdNo),
              name: ensureUnicode(row['Name']),
              date_of_birth: row['Date of birth'],
              gender: ensureUnicode(row['Gender']),
              fathers_name: ensureUnicode(row["Father's Name"]),
              mothers_name: ensureUnicode(row["Mother's Name"]),
              household_relationship: ensureUnicode(row['Household Relationship']),
              occupation: ensureUnicode(row['Occupation']),
              previous_id_no: ensureUnicode(row['Previous ID No.']),
              taang_land_id_no: ensureUnicode(row["Ta'ang Land ID No."]),
              nationality: ensureUnicode(row['Nationality']),
              resident_status: ensureUnicode(row['Resident Status']),
              religious: ensureUnicode(row['Religious']),
              house_no: ensureUnicode(row['House NO.']),
              ward_village_group: ensureUnicode(currentWard),
              township: ensureUnicode(currentTownship),
              district: ensureUnicode(currentDistrict),
              submission_date: row['Submission Date'],
              address: ensureUnicode(`${row['House NO.'] || ''}, ${currentWard || ''}, ${currentTownship || ''}, ${currentDistrict || ''}`)
            };

            // 2. Strict Validation Check (After Forward-Fill)
            const missingFields = [];
            if (!parsedRow.ward_village_group) missingFields.push('Ward/Village/Group');
            if (!parsedRow.township) missingFields.push('Township');
            if (!parsedRow.district) missingFields.push('District');
            if (!parsedRow.gender) missingFields.push('Gender');
            if (!parsedRow.household_relationship) missingFields.push('Household Relationship');

            // 3. Error Tracking
            if (missingFields.length > 0) {
              errorsFound.push({
                rowNumber: index + 2, // Excel Row offset
                name: parsedRow.name || 'No Name Provided',
                missingFields: missingFields.join(', ')
              });
            }

            return parsedRow;
          });

          if (formattedData.length === 0) {
            throw new Error('The CSV file is empty or formatted incorrectly.');
          }

          // 4. Block Upload if Errors Exist -> Trigger UI Modal
          if (errorsFound.length > 0) {
            setValidationErrors(errorsFound);
            setShowModal(true);
            setLoading(false);
            if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
            return; // STOP EXECUTION! Do not send to Supabase!
          }

          // 5. Success State -> Proceed with insertion
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
              .limit(1);

            if (existing && existing.length > 0) {
              duplicateCount++;
              continue; 
            }
            
            const { error: supabaseError } = await supabase
              .from('households')
              .insert(rowData);

            if (supabaseError) {
              dbErrors.push(`Row ${i + 2}: ${supabaseError.message}`);
            } else {
              successCount++;
            }
          }

          if (dbErrors.length > 0) {
            setSuccessMsg(`Inserted ${successCount} records. Skipped ${duplicateCount} duplicates. Encountered ${dbErrors.length} DB errors.`);
          } else {
            setSuccessMsg(`Successfully inserted ${successCount} new records! (Skipped ${duplicateCount} duplicates)`);
          }

          if (onUploadSuccess && successCount > 0) {
            onUploadSuccess();
          }
          
        } catch (err) {
          console.error("Upload error:", err);
          alert(err.message || 'An error occurred during upload.');
        } finally {
          setLoading(false);
          if(fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (err) => {
        setLoading(false);
        alert(`Error reading CSV file: ${err.message}`);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  const closeErrorModal = () => {
    setShowModal(false);
    setValidationErrors([]);
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-primary/10 text-primary p-2 rounded-lg">
          <Upload size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Bulk Upload Households (CSV)</h2>
          <p className="text-sm text-slate-500">Upload your exported Excel data safely.</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <FileSpreadsheet size={32} className="text-slate-400 mb-2" />
            <p className="text-sm text-slate-500 font-medium">Click to upload or drag and drop</p>
            <p className="text-xs text-slate-400">.CSV files only</p>
          </div>
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={loading}
            ref={fileInputRef}
          />
        </label>
        
        {loading && (
          <div className="flex items-center gap-3 text-primary font-medium p-4 bg-blue-50 rounded-lg">
            <Loader2 className="animate-spin" size={20} />
            Processing and validating your file...
          </div>
        )}
        
        {successMsg && !loading && (
          <div className="flex items-center gap-3 text-green-700 font-medium p-4 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle2 size={20} />
            {successMsg}
          </div>
        )}
      </div>

      {/* ERROR MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-red-100 bg-red-50 rounded-t-2xl">
              <div className="flex items-center gap-3 text-red-600">
                <AlertCircle size={24} />
                <h3 className="text-xl font-bold">Validation Failed: Upload Blocked</h3>
              </div>
              <button onClick={closeErrorModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-slate-600 mb-4 font-medium">
                We found <span className="text-red-600 font-bold">{validationErrors.length}</span> errors in your CSV file. You must fix these missing fields in Excel before we can upload this file to the database.
              </p>
              
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-500 w-24">Excel Row</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-500 w-1/3">Name</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-500">Missing Mandatory Field(s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {validationErrors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-slate-700">#{err.rowNumber}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{err.name}</td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">
                          {err.missingFields.split(', ').map((field, i) => (
                            <span key={i} className="inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded mr-1 mb-1 text-xs border border-red-200">
                              {field}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end rounded-b-2xl">
              <button 
                onClick={closeErrorModal}
                className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors focus:ring-4 focus:ring-slate-200"
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
