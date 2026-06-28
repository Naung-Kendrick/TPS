import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Download, FileSpreadsheet, HardDrive, Clock, CheckCircle2, RefreshCw, Filter, ShieldCheck, ChevronDown } from 'lucide-react';
import { deepEnsureUnicode } from './CsvUploader';
import { exportAllExcel } from '../lib/householdPrint';
import { getSecureItem, setSecureItem } from '../lib/secureStorage';

const BACKUP_LOGS_KEY = 'tps_backup_history_logs';

const CustomLocationSelect = ({ value, onChange, options, placeholder, disabled }) => {
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

  const selectedLabel = value || placeholder;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className="w-full p-2.5 text-xs bg-white border border-gray-300 rounded-none outline-none focus:border-gray-900 font-medium disabled:opacity-50 flex items-center justify-between cursor-pointer"
        style={{ marginTop: '4px', height: '38px' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel}
        </span>
        <ChevronDown size={12} color="#737373" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      {open && !disabled && (
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
          <div
            onClick={() => { onChange(''); setOpen(false); }}
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
          {options.map(opt => {
            const isSelected = value === opt;
            return (
              <div
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
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
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DatabaseBackup = ({ user }) => {
  const [districts, setDistricts] = useState([]);
  const [townships, setTownships] = useState([]);
  
  // Selection state — District & Township only
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTownship, setSelectedTownship] = useState('');

  // Stats & Loading
  const [recordCount, setRecordCount] = useState(null);
  const [memberCount, setMemberCount] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // History logs
  const [backupLogs, setBackupLogs] = useState([]);

  // Load backup history logs from secureStorage on mount
  useEffect(() => {
    try {
      const saved = getSecureItem(BACKUP_LOGS_KEY);
      if (saved) setBackupLogs(saved);
    } catch (_) {}
  }, []);

  // Fetch unique Districts on load
  useEffect(() => {
    async function loadDistricts() {
      try {
        const { data, error } = await supabase.from('households').select('district');
        if (!error && data) {
          const unique = Array.from(new Set(data.map(d => d.district).filter(Boolean))).sort();
          setDistricts(unique);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadDistricts();
  }, []);

  // Fetch unique Townships when District changes
  useEffect(() => {
    async function loadTownships() {
      if (!selectedDistrict) {
        setTownships([]);
        setSelectedTownship('');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('households')
          .select('township')
          .eq('district', selectedDistrict);
        if (!error && data) {
          const unique = Array.from(new Set(data.map(d => d.township).filter(Boolean))).sort();
          setTownships(unique);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadTownships();
  }, [selectedDistrict]);

  // Calculate live matching records count for District & Township
  useEffect(() => {
    async function calculateStats() {
      setLoadingStats(true);
      try {
        let query = supabase.from('households').select('id, household_no', { count: 'exact' });
        if (selectedDistrict) query = query.eq('district', selectedDistrict);
        if (selectedTownship) query = query.eq('township', selectedTownship);

        const { data, count, error } = await query;
        if (!error) {
          setMemberCount(count || 0);
          const uniqueHh = new Set((data || []).map(d => d.household_no).filter(Boolean));
          setRecordCount(uniqueHh.size);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingStats(false);
      }
    }
    calculateStats();
  }, [selectedDistrict, selectedTownship]);

  // Helper to construct clean filename formatted with Burmese/English District & Township
  const generateBackupFilename = (ext = 'json') => {
    const sanitize = (str) => String(str || '').trim().replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '_') || null;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

    const parts = [
      'TPS_Backup',
      sanitize(selectedDistrict) || 'ALL_DISTRICTS',
      sanitize(selectedTownship) || 'ALL_TOWNSHIPS',
      `${dateStr}_${timeStr}`
    ].filter(Boolean);

    return `${parts.join('_')}.${ext}`;
  };

  // Build structured nested JSON for backup
  const fetchBackupDataset = async () => {
    let query = supabase
      .from('households')
      .select('*')
      .order('district', { ascending: true })
      .order('township', { ascending: true })
      .order('household_no', { ascending: true });

    if (selectedDistrict) query = query.eq('district', selectedDistrict);
    if (selectedTownship) query = query.eq('township', selectedTownship);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const handleExportJson = async () => {
    setExporting(true);
    try {
      const rows = await fetchBackupDataset();
      const householdsMap = new Map();
      const order = [];

      for (const row of rows) {
        const hn = row.household_no || 'UNKNOWN';
        if (!householdsMap.has(hn)) {
          householdsMap.set(hn, []);
          order.push(hn);
        }
        householdsMap.get(hn).push(row);
      }

      const nowFormatted = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });

      const nestedData = {
        backup_metadata: {
          system: "Ta'ang Population System (TPS) — Civil Registry",
          authority: "Immigration Department of Ta'ang Land (IDTL)",
          backup_timestamp: nowFormatted,
          filters: {
            district: selectedDistrict || 'All Districts (ခရိုင်အားလုံး)',
            township: selectedTownship || 'All Townships (မြို့နယ်အားလုံး)',
          },
          total_households: order.length,
          total_members: rows.length,
          exported_by: user?.username || user?.email || 'System Officer'
        },
        households: order.map(hn => {
          const members = householdsMap.get(hn);
          const first = members[0] || {};
          return {
            household_no: hn,
            house_no: first.house_no || '',
            ward_village_group: first.ward_village_group || '',
            township: first.township || '',
            district: first.district || '',
            total_members: members.length,
            members: members.map(m => ({
              id: m.id,
              name: m.name || '',
              date_of_birth: m.date_of_birth || '',
              gender: m.gender || '',
              household_relationship: m.household_relationship || '',
              fathers_name: m.fathers_name || '',
              mothers_name: m.mothers_name || '',
              occupation: m.occupation || '',
              nationality: m.nationality || '',
              resident_status: m.resident_status || '',
              religious: m.religious || '',
              previous_id_no: m.previous_id_no || '',
              taang_land_id_no: m.taang_land_id_no || '',
              submission_date: m.submission_date || (m.created_at ? m.created_at.split('T')[0] : '')
            }))
          };
        })
      };

      const finalPayload = deepEnsureUnicode(nestedData);
      const filename = generateBackupFilename('json');
      const blob = new Blob([JSON.stringify(finalPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Save log
      const newLog = {
        id: crypto.randomUUID(),
        timestamp: nowFormatted,
        filename,
        format: 'JSON',
        district: selectedDistrict || 'All Districts',
        township: selectedTownship || 'All Townships',
        households: order.length,
        members: rows.length
      };

      const updatedLogs = [newLog, ...backupLogs].slice(0, 30);
      setBackupLogs(updatedLogs);
      setSecureItem(BACKUP_LOGS_KEY, updatedLogs);

    } catch (err) {
      alert('Backup Export Failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const rows = await fetchBackupDataset();
      const filename = generateBackupFilename('xlsx');
      await exportAllExcel(rows, {
        district: selectedDistrict,
        township: selectedTownship
      });

      const nowFormatted = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });
      const newLog = {
        id: crypto.randomUUID(),
        timestamp: nowFormatted,
        filename,
        format: 'Excel',
        district: selectedDistrict || 'All Districts',
        township: selectedTownship || 'All Townships',
        households: new Set(rows.map(r => r.household_no)).size,
        members: rows.length
      };

      const updatedLogs = [newLog, ...backupLogs].slice(0, 30);
      setBackupLogs(updatedLogs);
      setSecureItem(BACKUP_LOGS_KEY, updatedLogs);

    } catch (err) {
      alert('Excel Export Failed: ' + err.message);
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8 xl:p-10 max-w-7xl xl:max-w-[1440px] mx-auto bg-white">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <HardDrive size={22} className="text-gray-900" />
          <h2 style={{ fontSize: '20px', margin: 0, color: '#1A1A1A', fontWeight: '600', letterSpacing: '0.02em' }}>
            DATABASE BACKUP & ARCHIVAL (ဒေတာဘေ့စ် ဘက်အပ် ရယူရန်)
          </h2>
        </div>
        <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>
          Select District and Township to generate structured JSON backups with exact timestamps and geographic metadata.
        </p>
      </div>

      {/* Region Selection Grid (District & Township Only) */}
      <div className="border border-gray-200 p-6 bg-gray-50/50">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
          <Filter size={14} className="text-gray-700" />
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Select Regional Hierarchy (ခရိုင် / မြို့နယ်)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* District Select */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
              ခရိုင် (DISTRICT)
            </label>
            <CustomLocationSelect
              value={selectedDistrict}
              onChange={val => setSelectedDistrict(val)}
              options={districts}
              placeholder="-- ခရိုင်အားလုံး (ALL DISTRICTS) --"
              disabled={false}
            />
          </div>

          {/* Township Select */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
              မြို့နယ် (TOWNSHIP)
            </label>
            <CustomLocationSelect
              value={selectedTownship}
              onChange={val => setSelectedTownship(val)}
              options={townships}
              placeholder="-- မြို့နယ်အားလုံး (ALL TOWNSHIPS) --"
              disabled={!selectedDistrict}
            />
          </div>
        </div>
      </div>

      {/* Live Data Summary & Export Panel */}
      <div className="border border-gray-900 p-6 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Backup Coverage Summary (ရွေးချယ်ထားသော နယ်မြေ ဒေတာ)
            </span>
          </div>
          <div className="text-sm font-semibold text-gray-800 mt-2">
            {[selectedDistrict || 'ခရိုင်အားလုံး', selectedTownship || 'မြို့နယ်အားလုံး'].join(' ➔ ')}
          </div>
          <div className="flex items-center gap-6 mt-3 text-xs text-gray-600 font-mono">
            <div>
              <span>Households (အိမ်ထောင်စု): </span>
              <strong className="text-gray-900 text-sm">{loadingStats ? '...' : (recordCount ?? 0)}</strong>
            </div>
            <div>
              <span>Members (လူဦးရေ): </span>
              <strong className="text-gray-900 text-sm">{loadingStats ? '...' : (memberCount ?? 0)}</strong>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handleExportJson}
            disabled={exporting || loadingStats || memberCount === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white font-bold text-xs uppercase hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'GENERATING JSON...' : 'EXPORT JSON BACKUP (.json)'}
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel || loadingStats || memberCount === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-900 text-gray-900 font-bold text-xs uppercase hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {exportingExcel ? <RefreshCw size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {exportingExcel ? 'GENERATING EXCEL...' : 'EXPORT EXCEL BACKUP (.xlsx)'}
          </button>
        </div>
      </div>

      {/* Backup History Logs Table */}
      <div className="border border-gray-200 bg-white">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-gray-700" />
            <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
              RECENT BACKUP LOGS & LAST TIMESTAMP RECORD (ဘက်အပ် ရယူထားသော မှတ်တမ်းများ)
            </h3>
          </div>
          <span className="text-[11px] text-gray-500 font-mono">{backupLogs.length} RECORDED LOGS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-600 tracking-wider">
                <th className="p-3">NO.</th>
                <th className="p-3">DATE & TIME (နေ့ရက်နှင့် အချိန်)</th>
                <th className="p-3">REGION (ခရိုင် / မြို့နယ်)</th>
                <th className="p-3">FILE NAME</th>
                <th className="p-3 text-center">HOUSEHOLDS</th>
                <th className="p-3 text-center">MEMBERS</th>
                <th className="p-3 text-center">FORMAT</th>
                <th className="p-3 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {backupLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    No backup operations logged yet. Select a region above to generate your first backup file.
                  </td>
                </tr>
              ) : (
                backupLogs.map((log, index) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors font-sans">
                    <td className="p-3 font-mono text-gray-400">{index + 1}</td>
                    <td className="p-3 font-semibold text-gray-900 font-mono">{log.timestamp}</td>
                    <td className="p-3 font-medium text-gray-800">
                      {[log.district, log.township].filter(Boolean).join(' / ')}
                    </td>
                    <td className="p-3 font-mono text-xs text-blue-700">{log.filename}</td>
                    <td className="p-3 text-center font-mono font-semibold text-gray-900">{log.households}</td>
                    <td className="p-3 text-center font-mono font-semibold text-gray-900">{log.members}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-none border ${log.format === 'JSON' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                        {log.format}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                        <CheckCircle2 size={12} /> Saved
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DatabaseBackup;
