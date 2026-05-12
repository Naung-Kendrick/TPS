import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { supabase } from '../lib/supabase';
import {
  ScanLine, Search, X, CheckCircle2, AlertCircle, Loader2,
  User, Home, MapPin, CreditCard, Hash, Camera, Keyboard,
  ZoomIn, ZoomOut, Users
} from 'lucide-react';

const IDCardScanner = () => {
  const [mode, setMode] = useState('manual');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 });
  const [scanFlash, setScanFlash] = useState(false);
  const [familyModal, setFamilyModal] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [familyLoading, setFamilyLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const trackRef = useRef(null);
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

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    trackRef.current = null;
    setScanning(false);
    setZoom(1);
    setZoomRange({ min: 1, max: 4 });
  }, []);

  const startCamera = async () => {
    setError(null);
    setResult(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // Always allow CSS zoom 1–4x; also enable hardware zoom if supported
      setZoomRange({ min: 1, max: 4 });
      setZoom(1);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start QR decode loop
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const tick = () => {
        const video = videoRef.current;
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          setScanFlash(true);
          setTimeout(() => setScanFlash(false), 400);
          stopCamera();
          setInputValue(code.data);
          lookupID(code.data);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setScanning(false);
      setError('Camera error: ' + (err?.message || 'Could not access camera.'));
    }
  };

  const handleZoomChange = async (val) => {
    const z = parseFloat(val);
    setZoom(z);
    // Apply CSS scale zoom on video element (always works)
    if (videoRef.current) {
      videoRef.current.style.transform = `scale(${z})`;
      videoRef.current.style.transformOrigin = 'center center';
    }
    // Also try hardware zoom if the device supports it
    if (trackRef.current) {
      try {
        const caps = trackRef.current.getCapabilities?.() || {};
        if (caps.zoom) {
          const hwZoom = caps.zoom.min + (z - 1) * (caps.zoom.max - caps.zoom.min) / 3;
          await trackRef.current.applyConstraints({ advanced: [{ zoom: hwZoom }] });
        }
      } catch (_) {}
    }
  };

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

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
    setFamilyModal(false);
    setFamilyMembers([]);
    if (inputRef.current) inputRef.current.focus();
  };

  const openFamilyModal = async () => {
    if (!result?.household_no) return;
    setFamilyModal(true);
    setFamilyLoading(true);
    const { data } = await supabase
      .from('households')
      .select('*')
      .eq('household_no', result.household_no)
      .order('created_at', { ascending: true });
    // Sort: head first, then spouse, then children
    const order = { 'ဦးစီး': 1, 'ဇနီး': 2, 'ခင်ပွန်း': 2, 'သား': 3, 'သမီး': 3 };
    const sorted = (data || []).sort((a, b) =>
      (order[a.household_relationship] || 99) - (order[b.household_relationship] || 99)
    );
    setFamilyMembers(sorted);
    setFamilyLoading(false);
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
        <div className="mb-6">
          {!scanning ? (
            <div className="bg-white border border-[#E5E7EB] p-6" style={{ borderRadius: '0px' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-[#F3F4F6] p-2" style={{ borderRadius: '0px' }}>
                  <ScanLine size={20} className="text-[#1A1A1A]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">QR Code Camera Scanner</p>
                  <p className="text-xs text-[#737373]">Point camera at the QR code on the ID card</p>
                </div>
              </div>
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-5 py-2 bg-[#1A1A1A] text-white text-sm font-medium hover:bg-[#737373] transition-colors"
                style={{ borderRadius: '0px' }}
              >
                <Camera size={16} />
                Start Camera
              </button>
            </div>
          ) : (
            /* ── Fullscreen Camera Overlay ── */
            <div style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              backgroundColor: '#000',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Video */}
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.15s ease', transformOrigin: 'center center' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Dark vignette overlay with card cutout */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Semi-dark mask around the card frame */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <mask id="cutout">
                      <rect width="100%" height="100%" fill="white" />
                      <rect x="50%" y="50%" width="78vw" height="49vw"
                        transform="translate(-39vw,-24.5vw)"
                        rx="4" ry="4" fill="black" />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#cutout)" />
                </svg>

                {/* Card frame with corner brackets */}
                <div style={{
                  position: 'relative',
                  width: '78vw', height: '49vw',
                  maxWidth: '560px', maxHeight: '352px',
                }}
                >
                  {/* Scan flash */}
                  {scanFlash && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      backgroundColor: 'rgba(255,255,255,0.35)',
                      pointerEvents: 'none', zIndex: 2,
                    }} />
                  )}

                  {/* Corner brackets — top-left */}
                  <div style={{ position:'absolute', top:0, left:0, width:28, height:28,
                    borderTop:'3px solid #4FC3F7', borderLeft:'3px solid #4FC3F7' }} />
                  {/* top-right */}
                  <div style={{ position:'absolute', top:0, right:0, width:28, height:28,
                    borderTop:'3px solid #4FC3F7', borderRight:'3px solid #4FC3F7' }} />
                  {/* bottom-left */}
                  <div style={{ position:'absolute', bottom:0, left:0, width:28, height:28,
                    borderBottom:'3px solid #4FC3F7', borderLeft:'3px solid #4FC3F7' }} />
                  {/* bottom-right */}
                  <div style={{ position:'absolute', bottom:0, right:0, width:28, height:28,
                    borderBottom:'3px solid #4FC3F7', borderRight:'3px solid #4FC3F7' }} />

                  {/* Animated scan line */}
                  <div style={{
                    position: 'absolute', left: 8, right: 8, height: '2px',
                    background: 'linear-gradient(90deg, transparent, #4FC3F7, transparent)',
                    animation: 'scanline 2s linear infinite',
                    zIndex: 1,
                  }} />
                </div>
              </div>

              {/* Top bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
                paddingBottom: '16px',
                paddingLeft: '20px',
                paddingRight: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
              }}>
                <div className="flex items-center gap-2">
                  <ScanLine size={18} color="#4FC3F7" />
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600', letterSpacing: '0.05em' }}>ID CARD SCANNER</span>
                </div>
                <button
                  onClick={stopCamera}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} color="#fff" />
                </button>
              </div>

              {/* Hint text */}
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, calc(-50% + 30vw))',
                maxWidth: '78vw',
                textAlign: 'center',
                marginTop: '8px',
              }}>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', margin: 0 }}>
                  Align the ID card within the frame to scan QR code
                </p>
              </div>

              {/* Bottom bar — zoom */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                paddingTop: '20px',
                paddingLeft: '24px',
                paddingRight: '24px',
                paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 60%, transparent)',
                display: 'flex', alignItems: 'center', gap: '16px',
              }}>
                {/* Zoom level badge */}
                <span style={{ color: '#4FC3F7', fontSize: '11px', fontWeight: '700', minWidth: '32px', textAlign: 'center', letterSpacing: '0.03em' }}>
                  {parseFloat(zoom).toFixed(1)}×
                </span>
                <button
                  onClick={() => handleZoomChange(Math.max(zoomRange.min, zoom - 0.5))}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <ZoomOut size={22} color="#fff" />
                </button>
                <input
                  type="range"
                  min={zoomRange.min}
                  max={zoomRange.max}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => handleZoomChange(e.target.value)}
                  style={{ flex: 1, accentColor: '#4FC3F7', cursor: 'pointer', height: '6px', touchAction: 'none' }}
                />
                <button
                  onClick={() => handleZoomChange(Math.min(zoomRange.max, zoom + 0.5))}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <ZoomIn size={22} color="#fff" />
                </button>
              </div>

              <style>{`
                @keyframes scanline {
                  0%   { top: 8px; }
                  50%  { top: calc(100% - 10px); }
                  100% { top: 8px; }
                }
              `}</style>
            </div>
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
          <div className="p-4 border-b border-[#E5E7EB]">
            <p className="text-xs font-semibold text-[#737373] uppercase tracking-widest mb-3">Address</p>
            <InfoRow icon={Home} label="House No." value={result.house_no} />
            <InfoRow icon={MapPin} label="Ward / Village / Group" value={result.ward_village_group} />
            <InfoRow icon={MapPin} label="Township" value={result.township} />
            <InfoRow icon={MapPin} label="District" value={result.district} />
            {result.address && (
              <InfoRow icon={MapPin} label="Full Address" value={result.address} />
            )}
          </div>

          {/* View Family Button */}
          <div className="p-4">
            <button
              onClick={openFamilyModal}
              className="flex items-center gap-2 w-full justify-center py-2.5 border border-[#1A1A1A] text-[#1A1A1A] text-sm font-medium hover:bg-[#1A1A1A] hover:text-white transition-colors"
              style={{ borderRadius: '0px' }}
            >
              <Users size={16} />
              View All Family Members
            </button>
          </div>
        </div>
      )}

      {/* Family Modal */}
      {familyModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            width: '100%', maxWidth: '95vw',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            border: '1px solid #E5E7EB',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#FAFAFA',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={16} style={{ color: '#1A1A1A' }} />
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Family Roster: {result.household_no}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{familyMembers.length} member{familyMembers.length !== 1 ? 's' : ''}</span>
                <button onClick={() => setFamilyModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#737373' }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body — scrollable table */}
            <div style={{ overflowY: 'auto', overflowX: 'auto', flex: 1 }}>
              {familyLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px' }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: '#1A1A1A' }} />
                  <span style={{ fontSize: '12px', color: '#737373' }}>Loading family members...</span>
                </div>
              ) : familyMembers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#737373', fontSize: '12px' }}>No family members found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
                      {['No.', 'Name', 'Date of Birth', 'Gender', "Father's Name", "Mother's Name", 'Relationship', 'Occupation', 'Previous ID No.', "Ta'ang Land ID No.", 'Nationality', 'Resident Status', 'Religious', 'Submission Date'].map((h, i) => (
                        <th key={i} style={{ padding: '8px 8px', fontSize: '9.5px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {familyMembers.map((m, i) => {
                      const isMe = m.taang_land_id_no === result.taang_land_id_no;
                      const rowBg = isMe ? '#F3F4F6' : '#FFFFFF';
                      const td = (val) => <td style={{ padding: '7px 8px', whiteSpace: 'nowrap', color: '#737373' }}>{val || '—'}</td>;
                      return (
                        <tr key={m.id || i} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: rowBg }}>
                          <td style={{ padding: '7px 8px', color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>{i + 1}</td>
                          <td style={{ padding: '7px 8px', fontWeight: isMe ? 700 : 600, whiteSpace: 'nowrap', color: '#1A1A1A' }}>
                            {m.name}
                            {m.household_relationship === 'ဦးစီး' && <span style={{ marginLeft: '4px', border: '1px solid #1A1A1A', padding: '0 3px', fontSize: '8px', fontWeight: 700 }}>HEAD</span>}
                            {isMe && <span style={{ marginLeft: '4px', backgroundColor: '#1A1A1A', color: '#fff', padding: '0 4px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.05em' }}>YOU</span>}
                          </td>
                          {td(m.date_of_birth)}
                          {td(m.gender)}
                          {td(m.fathers_name)}
                          {td(m.mothers_name)}
                          {td(m.household_relationship)}
                          {td(m.occupation)}
                          {td(m.previous_id_no)}
                          {td(m.taang_land_id_no)}
                          {td(m.nationality)}
                          {td(m.resident_status)}
                          {td(m.religious)}
                          {td(m.submission_date || (m.created_at ? m.created_at.split('T')[0] : null))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: '#737373' }}>{familyMembers.length} member{familyMembers.length !== 1 ? 's' : ''} in household</span>
              <button
                onClick={() => setFamilyModal(false)}
                style={{ padding: '6px 20px', backgroundColor: '#1A1A1A', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '600', cursor: 'pointer', letterSpacing: '0.05em' }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IDCardScanner;
