import React, { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';

const CsvUploader = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorLogs, setErrorLogs] = useState([]);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setErrorLogs([]);
    setSuccessMsg(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy', // Ignores completely empty lines and lines with just empty commas
      encoding: "UTF-8", // Explicitly set UTF-8 for Burmese characters
      // 1. Trim and Clean Headers automatically
      transformHeader: (header) => {
        return header.trim().replace(/\s+/g, ' '); 
      },
      complete: async (results) => {
        try {
          if (results.errors.length > 0) {
            console.warn("PapaParse parsing warnings:", results.errors);
          }

          // 2. Mapping the cleaned headers to Supabase columns
          const formattedData = results.data.map(row => ({
            household_no: row['Household No.'],
            name: row['Name'],
            date_of_birth: row['Date of birth'],
            gender: row['Gender'],
            fathers_name: row["Father's Name"],
            mothers_name: row["Mother's Name"],
            household_relationship: row['Household Relationship'],
            occupation: row['Occupation'],
            previous_id_no: row['Previous ID No.'],
            taang_land_id_no: row["Ta'ang Land ID No."],
            nationality: row['Nationality'],
            resident_status: row['Resident Status'],
            religious: row['Religious'],
            house_no: row['House NO.'],
            ward_village_group: row['Ward / Village / Group'],
            township: row['Township'],
            district: row['District'],
            submission_date: row['Submission Date'],
            // Combine address fields just in case
            address: `${row['House NO.'] || ''}, ${row['Ward / Village / Group'] || ''}, ${row['Township'] || ''}, ${row['District'] || ''}`
          }));

          if (formattedData.length === 0) {
            throw new Error('The CSV file is empty or formatted incorrectly.');
          }

          let successCount = 0;
          let duplicateCount = 0;
          let newErrors = [];

          // 3. Error Logging & Duplicate Prevention: Insert row-by-row
          for (let i = 0; i < formattedData.length; i++) {
            const rowData = formattedData[i];
            
            // Duplicate Check: See if this person already exists in the database
            const { data: existing } = await supabase
              .from('households')
              .select('id')
              .eq('name', rowData.name || '')
              .eq('household_no', rowData.household_no || '')
              .limit(1);

            if (existing && existing.length > 0) {
              duplicateCount++;
              continue; // Skip insertion, it's a duplicate!
            }
            
            // Insert new record
            const { error: supabaseError } = await supabase
              .from('households')
              .insert(rowData);

            if (supabaseError) {
              newErrors.push(`Row ${i + 2} (Name: ${rowData.name || 'Unknown'}): ${supabaseError.message}`);
            } else {
              successCount++;
            }
          }

          if (newErrors.length > 0) {
            setErrorLogs(newErrors);
            setSuccessMsg(`Inserted ${successCount} new records. Skipped ${duplicateCount} duplicates. Encountered ${newErrors.length} errors.`);
          } else {
            setSuccessMsg(`Successfully inserted ${successCount} new records! (Skipped ${duplicateCount} duplicates)`);
          }

          if (onUploadSuccess && successCount > 0) {
            onUploadSuccess(); // Refresh the list if at least one row succeeded
          }
          
        } catch (err) {
          console.error("Upload error:", err);
          setErrorLogs([err.message || 'An error occurred during upload.']);
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setLoading(false);
        setErrorLogs([`Error reading CSV file: ${err.message}`]);
      }
    });
  };

  return (
    <div className="csv-uploader">
      <h2>Bulk Upload Households (CSV)</h2>
      
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload} 
        disabled={loading}
      />
      
      {loading && (
        <p style={{ color: '#646cff', fontWeight: 'bold' }}>
          Processing CSV and inserting data... Please wait.
        </p>
      )}
      
      {successMsg && (
        <p style={{ color: '#42b883', fontWeight: 'bold', margin: '1rem 0' }}>
          {successMsg}
        </p>
      )}

      {errorLogs.length > 0 && (
        <div style={{ background: '#ffebee', padding: '1rem', borderRadius: '8px', color: '#c62828', textAlign: 'left', marginTop: '1rem' }}>
          <h4 style={{ marginTop: 0 }}>Import Errors ({errorLogs.length}):</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem' }}>
            {errorLogs.slice(0, 10).map((err, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{err}</li>
            ))}
          </ul>
          {errorLogs.length > 10 && <p>...and {errorLogs.length - 10} more errors.</p>}
        </div>
      )}
    </div>
  );
};

export default CsvUploader;
