import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import {
  ScanLine, Search, X, CheckCircle2, AlertCircle, Loader2,
  User, Home, MapPin, CreditCard, Hash, Camera, Keyboard
} from 'lucide-react';

const IDCardScanner = () => {
  const [mode, setMode] = useState('manual'); // 'manual' | 'camera'
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const inputRef = useRef(null);

  // Extract the core numeric part from any format:
  // "No - 01003821959002978", "No-01003821959002978", "01003821959002978", etc.
  const extractNumericID = (raw) => {
    if (!raw) return null;
    const trimmed = raw.trim();
    // Try to extract digits after "No" + optional separators
    const match = trimmed.match(/No[\s\-–:]+([0-9]+)/i);
    if (match) return match[1].trim();
    // Extract any long digit sequence (ID numbers are typically 15+ digits)
    const digits = trimmed.match(/[0-9]{8,}/);
    if (digits) return digits[0];
    return trimmed;
  };

  const lookupID = async (rawId) => {
    const numericId = extractNumericID(rawId);
    if (!numericId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    // Try multiple strategies to find the record:
    // 1. Exact match on extracted number
    // 2. ilike match (handles stored with/without prefix, extra spaces)
    let data = null;
    let dbError = null;

    // Strategy 1: exact match
    const res1 = await supabase
      .from('households')
      .select('name, household_no, taang_land_id_no, house_no, ward_village_group, township, district, address, gender, date_of_birth, nationality, occupation, household_relationship')
      .eq('taang_land_id_no', numericId)
      .limit(1)
      .maybeSingle();

    if (res1.data) {
      data = res1.data;
    } else {
      // Strategy 2: partial ilike — covers "No - 01003..." stored format
      const res2 = await supabase
        .from('households')
        .select('name, household_no, taang_land_id_no, house_no, ward_village_group, township, district, address, gender, date_of_birth, nationality, occupation, household_relationship')
        .ilike('taang_land_id_no', `%${numericId}%`)
        .limit(1)
        .maybeSingle();

      data = res2.data;
      dbError = res2.error;
    }

    setLoading(false);

    if (dbError) {
      setError('Database error: ' + dbError.message);
      return;
    }

    if (!data) {
      setError(`No record found for Ta'ang Land ID: ${numericId}`);
      return;
    }

    setResult(data);
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    lookupID(inputValue.trim());
  };

  const startCamera = async () => {
    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const html5Qr = new Html5Qrcode('qr-reader');
      html5QrRef.current = html5Qr;

      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          stopCamera();
          setInputValue(decodedText);
          lookupID(decodedText);
        },
        () => {}
      );
    } catch (err) {
      setScanning(false);
      setError('Camera error: ' + (err?.message || 'Could not access camera.'));
    }
  };

  const stopCamera = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch (_) {}
      html5QrRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  const handleModeSwitch = (m) => {
    stopCamera();
    setMode(m);
    setResult(null);
    setError(null);
    setInputValue('');
  };

  const reset = () => {
    stopCamera();
    setResult(null);
    setError(null);
    setInputValue('');
    if (inputRef.current) inputRef.current.focus();
  };

  const InfoRow = ({ icon: Icon, label, value }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 py-3 border-b border-[#E5E7EB] last:border-b-0">
        <div className="p-1.5 bg-[#F3F4F6] mt-0.5" style={{ borderRadius: '0px' }}>
          <Icon size={14} className="text-[#737373]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#737373] uppercase tracking-wide font-semibold mb-0.5">{label}</p>
          <p className="text-sm text-[#1A1A1A] font-medium break-words">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>
          ID CARD SCANNER
        </h2>
        <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>
          Scan QR code or enter Ta'ang Land ID to verify household records.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex border border-[#E5E7EB] mb-6" style={{ borderRadius: '0px' }}>
        <button
          onClick={() => handleModeSwitch('manual')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors"
          style={{
            borderRadius: '0px',
            backgroundColor: mode === 'manual' ? '#1A1A1A' : '#FFFFFF',
            color: mode === 'manual' ? '#FFFFFF' : '#737373',
            border: 'none',
            borderRight: '1px solid #E5E7EB',
          }}
        >
          <Keyboard size={15} />
          Manual Entry
        </button>
        <button
          onClick={() => handleModeSwitch('camera')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors"
          style={{
            borderRadius: '0px',
            backgroundColor: mode === 'camera' ? '#1A1A1A' : '#FFFFFF',
            color: mode === 'camera' ? '#FFFFFF' : '#737373',
            border: 'none',
          }}
        >
          <Camera size={15} />
          QR Camera Scan
        </button>
      </div>

      {/* Manual Entry */}
      {mode === 'manual' && (
        <div className="bg-white border border-[#E5E7EB] p-6 mb-6" style={{ borderRadius: '0px' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-[#F3F4F6] p-2" style={{ borderRadius: '0px' }}>
              <CreditCard size={20} className="text-[#1A1A1A]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">Enter Ta'ang Land ID</p>
              <p className="text-xs text-[#737373]">Type or paste the ID number from the card</p>
            </div>
          </div>
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g. 01003821959002978"
              className="flex-1 px-3 py-2 border border-[#E5E7EB] text-sm text-[#1A1A1A] bg-[#FAFAFA] focus:outline-none focus:border-[#1A1A1A]"
              style={{ borderRadius: '0px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em' }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-[#1A1A1A] text-white text-sm font-medium hover:bg-[#737373] transition-colors disabled:opacity-40"
              style={{ borderRadius: '0px' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>
      )}

      {/* Camera QR Scanner */}
      {mode === 'camera' && (
        <div className="bg-white border border-[#E5E7EB] p-6 mb-6" style={{ borderRadius: '0px' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-[#F3F4F6] p-2" style={{ borderRadius: '0px' }}>
              <ScanLine size={20} className="text-[#1A1A1A]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">QR Code Camera Scanner</p>
              <p className="text-xs text-[#737373]">Point camera at the QR code on the ID card</p>
            </div>
          </div>

          {/* QR Reader container */}
          <div
            id="qr-reader"
            ref={scannerRef}
            className="w-full bg-[#FAFAFA] border border-[#E5E7EB] overflow-hidden"
            style={{ borderRadius: '0px', minHeight: scanning ? '320px' : '0px' }}
          />

          <div className="flex gap-2 mt-4">
            {!scanning ? (
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-5 py-2 bg-[#1A1A1A] text-white text-sm font-medium hover:bg-[#737373] transition-colors"
                style={{ borderRadius: '0px' }}
              >
                <Camera size={16} />
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 px-5 py-2 bg-[#F3F4F6] text-[#1A1A1A] border border-[#E5E7EB] text-sm font-medium hover:bg-[#E5E7EB] transition-colors"
                style={{ borderRadius: '0px' }}
              >
                <X size={16} />
                Stop Camera
              </button>
            )}
          </div>

          {scanning && (
            <p className="mt-3 text-xs text-[#737373] flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              Scanning... align QR code within the frame
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 p-4 bg-[#F3F4F6] border border-[#E5E7EB] mb-4" style={{ borderRadius: '0px' }}>
          <Loader2 size={18} className="animate-spin text-[#1A1A1A]" />
          <span className="text-sm text-[#1A1A1A] font-medium">Looking up record in database...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-start gap-3 p-4 bg-[#FAFAFA] border border-[#E5E7EB] mb-4" style={{ borderRadius: '0px' }}>
          <AlertCircle size={18} className="text-[#1A1A1A] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#1A1A1A]">Record Not Found</p>
            <p className="text-xs text-[#737373] mt-0.5">{error}</p>
          </div>
          <button onClick={reset} className="text-[#737373] hover:text-[#1A1A1A]" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Result Card */}
      {result && !loading && (
        <div className="bg-white border border-[#E5E7EB]" style={{ borderRadius: '0px' }}>
          {/* Result Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB] bg-[#FAFAFA]">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-[#1A1A1A]" />
              <div>
                <p className="text-sm font-bold text-[#1A1A1A]">Record Verified</p>
                <p className="text-xs text-[#737373]">Match found in household database</p>
              </div>
            </div>
            <button
              onClick={reset}
              className="text-[#737373] hover:text-[#1A1A1A] transition-colors"
              style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Identity Section */}
          <div className="p-4 border-b border-[#E5E7EB]">
            <p className="text-xs font-semibold text-[#737373] uppercase tracking-widest mb-3">Identity</p>
            <InfoRow icon={User} label="Full Name" value={result.name} />
            <InfoRow icon={CreditCard} label="Ta'ang Land ID No." value={result.taang_land_id_no} />
            <InfoRow icon={Hash} label="Household No." value={result.household_no} />
            <InfoRow icon={User} label="Gender" value={result.gender} />
            <InfoRow icon={User} label="Date of Birth" value={result.date_of_birth} />
            <InfoRow icon={User} label="Nationality" value={result.nationality} />
            <InfoRow icon={User} label="Occupation" value={result.occupation} />
            <InfoRow icon={User} label="Household Relationship" value={result.household_relationship} />
          </div>

          {/* Address Section */}
          <div className="p-4">
            <p className="text-xs font-semibold text-[#737373] uppercase tracking-widest mb-3">Address</p>
            <InfoRow icon={Home} label="House No." value={result.house_no} />
            <InfoRow icon={MapPin} label="Ward / Village / Group" value={result.ward_village_group} />
            <InfoRow icon={MapPin} label="Township" value={result.township} />
            <InfoRow icon={MapPin} label="District" value={result.district} />
            {result.address && (
              <InfoRow icon={MapPin} label="Full Address" value={result.address} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IDCardScanner;
