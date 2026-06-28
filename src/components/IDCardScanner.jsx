import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { supabase } from '../lib/supabase';
import { pushNotification, NOTIF_TYPES } from '../lib/notifications';
import TpsScrollWrapper from './layout/TpsScrollWrapper';
import {
  ScanLine, Search, X, CheckCircle2, AlertCircle, Loader2,
  User, Home, MapPin, CreditCard, Hash, Camera, Keyboard,
  ZoomIn, Users, Zap, RotateCcw, Target, ShieldCheck,
  Calendar, Globe, Briefcase, HeartHandshake, Layers, Building, Landmark, Compass, UserCheck
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
  const [verificationRef, setVerificationRef] = useState(null);
  const [verifiedAt, setVerifiedAt] = useState(null);

  // Advanced camera controls state
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const generateVerifRef = (householdNo, idNo) => {
    const seed = (householdNo || '') + (idNo || '') + Date.now();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    return `TPS-VRF-${datePart}-${hex}`;
  };

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

  // Audio chime notifications using Web Audio API for offline zero-latency playback
  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, ctx.currentTime);
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.1);
      gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  };

  const playFailureSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(164.81, ctx.currentTime);
      gain1.gain.setValueAtTime(0.18, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(130.81, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
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
      playFailureSound();
      return;
    }

    if (!data) {
      setError(`No record found for Ta'ang Land ID: ${numericId}`);
      playFailureSound();
      return;
    }

    const ref = generateVerifRef(data.household_no, data.taang_land_id_no);
    setVerificationRef(ref);
    setVerifiedAt(new Date());
    setResult(data);
    playSuccessSound();
    pushNotification({
      type: NOTIF_TYPES.VERIFICATION,
      title: 'Verification Complete',
      message: `${data.name || 'Unknown'} · ${ref}`,
    });
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
    setTorchOn(false);
    setHasTorch(false);
    setZoom(1);
    setZoomRange({ min: 1, max: 4 });
  }, []);

  const startCameraWithMode = async (modeToUse) => {
    setError(null);
    setResult(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: modeToUse || facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // Check torch capability
      try {
        const caps = track.getCapabilities?.() || {};
        if (caps.torch) setHasTorch(true);
      } catch (_) {}

      // Always allow CSS zoom 1–4x; also enable hardware zoom if supported
      setZoomRange({ min: 1, max: 4 });
      setZoom(1);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start QR decode loop — tries 0°, 90°, 180°, 270° for any-angle scanning
      const canvas = canvasRef.current;
      const rotCanvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const rotCtx = rotCanvas.getContext('2d');

      const tryDecode = (imgData, w, h) =>
        jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' })?.data || null;

      const tick = () => {
        const video = videoRef.current;
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const W = video.videoWidth, H = video.videoHeight;
        canvas.width = W; canvas.height = H;
        ctx.drawImage(video, 0, 0, W, H);

        // 0° — normal
        let qrData = tryDecode(ctx.getImageData(0, 0, W, H), W, H);

        // 90° clockwise
        if (!qrData) {
          rotCanvas.width = H; rotCanvas.height = W;
          rotCtx.save(); rotCtx.translate(H, 0); rotCtx.rotate(Math.PI / 2);
          rotCtx.drawImage(canvas, 0, 0); rotCtx.restore();
          qrData = tryDecode(rotCtx.getImageData(0, 0, H, W), H, W);
        }

        // 180°
        if (!qrData) {
          rotCanvas.width = W; rotCanvas.height = H;
          rotCtx.save(); rotCtx.translate(W, H); rotCtx.rotate(Math.PI);
          rotCtx.drawImage(canvas, 0, 0); rotCtx.restore();
          qrData = tryDecode(rotCtx.getImageData(0, 0, W, H), W, H);
        }

        // 270° clockwise
        if (!qrData) {
          rotCanvas.width = H; rotCanvas.height = W;
          rotCtx.save(); rotCtx.translate(0, W); rotCtx.rotate(-Math.PI / 2);
          rotCtx.drawImage(canvas, 0, 0); rotCtx.restore();
          qrData = tryDecode(rotCtx.getImageData(0, 0, H, W), H, W);
        }

        if (qrData) {
          setScanFlash(true);
          setTimeout(() => setScanFlash(false), 400);
          stopCamera();
          setInputValue(qrData);
          lookupID(qrData);
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

  const startCamera = () => startCameraWithMode(facingMode);

  const toggleTorch = async () => {
    if (!trackRef.current) return;
    try {
      const nextTorch = !torchOn;
      await trackRef.current.applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    stopCamera();
    setTimeout(() => {
      startCameraWithMode(nextMode);
    }, 200);
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
    setVerificationRef(null);
    setVerifiedAt(null);
    if (inputRef.current) inputRef.current.focus();
  };

  const openFamilyModal = async () => {
    if (!result?.household_no) return;
    if (familyModal) {
      setFamilyModal(false);
      return;
    }
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
    <div className="flex flex-col gap-8 p-6 sm:p-8 xl:p-10 max-w-7xl xl:max-w-[1440px] mx-auto">
      {/* Page Header */}
      <div>
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
              style={{ borderRadius: '0px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              onMouseOver={e => { if (!loading && inputValue.trim()) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = '#1A1A1A'; } }}
              onMouseOut={e => { if (!loading && inputValue.trim()) { e.currentTarget.style.backgroundColor = '#1A1A1A'; e.currentTarget.style.color = '#FFFFFF'; } }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px',
                backgroundColor: '#1A1A1A',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: '500',
                border: '1px solid #1A1A1A',
                borderRadius: '0px',
                cursor: loading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: loading || !inputValue.trim() ? 0.5 : 1,
                transition: 'background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1)'
              }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {loading ? 'SEARCHING...' : 'SEARCH'}
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
                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = '#1A1A1A'; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#1A1A1A'; e.currentTarget.style.color = '#FFFFFF'; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: '#1A1A1A',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: '500',
                  border: '1px solid #1A1A1A',
                  borderRadius: '0px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1)'
                }}
              >
                <Camera size={13} />
                START CAMERA
              </button>
            </div>
          ) : (
            /* ── TPS Main Theme QR Camera Overlay ── */
            <div style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              backgroundColor: '#1A1A1A',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Video Stream */}
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
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none', zIndex: 5
              }}>
                {/* Viewfinder Target Frame (Standard ID Card Ratio) */}
                <div style={{
                  position: 'relative',
                  width: '82vw', height: '51.5vw',
                  maxWidth: '480px', maxHeight: '300px',
                  boxShadow: '0 0 0 9999px rgba(26, 26, 26, 0.82)',
                  pointerEvents: 'auto'
                }}>
                  {/* Scan flash */}
                  {scanFlash && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.35)',
                      pointerEvents: 'none', zIndex: 2,
                    }} />
                  )}

                  {/* Sharp corner brackets matching TPS theme */}
                  <div style={{ position:'absolute', top:-2, left:-2, width:30, height:30,
                    borderTop:'3.5px solid #FFFFFF', borderLeft:'3.5px solid #FFFFFF' }} />
                  <div style={{ position:'absolute', top:-2, right:-2, width:30, height:30,
                    borderTop:'3.5px solid #FFFFFF', borderRight:'3.5px solid #FFFFFF' }} />
                  <div style={{ position:'absolute', bottom:-2, left:-2, width:30, height:30,
                    borderBottom:'3.5px solid #FFFFFF', borderLeft:'3.5px solid #FFFFFF' }} />
                  <div style={{ position:'absolute', bottom:-2, right:-2, width:30, height:30,
                    borderBottom:'3.5px solid #FFFFFF', borderRight:'3.5px solid #FFFFFF' }} />

                  {/* Animated crisp scan laser line */}
                  <div style={{
                    position: 'absolute', left: 2, right: 2, height: '2px',
                    background: 'linear-gradient(90deg, transparent, #FFFFFF, transparent)',
                    boxShadow: '0 0 10px #FFFFFF',
                    animation: 'scanline 2s ease-in-out infinite alternate',
                    zIndex: 1,
                  }} />
                </div>

                {/* Instruction Banner positioned cleanly below frame */}
                <div style={{ marginTop: '24px', pointerEvents: 'auto' }}>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border border-[#404040]">
                    <p style={{ color: '#D4D4D4', fontSize: '11px', fontWeight: '600', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      ALIGN ID CARD QR CODE WITHIN FRAME
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Bar matching TPS Topbar/Header */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
                paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: '#1A1A1A',
                borderBottom: '1px solid #333333',
                zIndex: 10
              }}>
                <div className="flex items-center gap-3">
                  <ScanLine size={18} className="text-white" />
                  <div>
                    <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'var(--font-headline)' }}>
                      ID CARD SCANNER
                    </span>
                    <p style={{ color: '#9CA3AF', fontSize: '10px', margin: 0, letterSpacing: '0.02em' }}>
                      TA'ANG LAND IMMIGRATION DEPT.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Torch toggle */}
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      style={{
                        backgroundColor: torchOn ? '#FFFFFF' : '#262626',
                        color: torchOn ? '#1A1A1A' : '#FFFFFF',
                        border: '1px solid #404040', borderRadius: '0px', width: 36, height: 36, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
                      }}
                    >
                      <Zap size={16} />
                    </button>
                  )}
                  {/* Camera switcher */}
                  <button
                    type="button"
                    onClick={switchCamera}
                    style={{
                      backgroundColor: '#262626', color: '#FFFFFF',
                      border: '1px solid #404040', borderRadius: '0px', width: 36, height: 36, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <RotateCcw size={16} />
                  </button>
                  {/* Close button */}
                  <button
                    type="button"
                    onClick={stopCamera}
                    style={{
                      backgroundColor: '#262626', color: '#FFFFFF',
                      border: '1px solid #404040', borderRadius: '0px', width: 36, height: 36, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>



              {/* Bottom Control Toolbar */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                paddingTop: '16px',
                paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
                backgroundColor: '#1A1A1A',
                borderTop: '1px solid #333333',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                zIndex: 10
              }}>
                {/* Zoom Chips */}
                <div className="flex items-center gap-2 bg-[#262626] p-1 border border-[#404040]">
                  <span className="text-[10px] text-gray-400 px-2 font-mono uppercase font-bold">ZOOM</span>
                  {[1, 1.5, 2, 3].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleZoomChange(val)}
                      className={`px-3 py-1 text-xs font-bold font-mono transition-all ${zoom === val ? 'bg-white text-black' : 'text-gray-300 hover:bg-[#333333]'}`}
                      style={{ borderRadius: '0px' }}
                    >
                      {val.toFixed(1)}×
                    </button>
                  ))}
                </div>
              </div>

              <style>{`
                @keyframes scanline {
                  0%   { top: 4px; }
                  100% { top: calc(100% - 6px); }
                }
              `}</style>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 p-4 mb-4" style={{ borderRadius: '0px', backgroundColor: '#EEF2F5', border: '1px solid #B0BEC5' }}>
          <Loader2 size={18} className="animate-spin" style={{ color: '#4A6572' }} />
          <span className="text-sm font-medium" style={{ color: '#4A6572' }}>Looking up record in database...</span>
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
        <div className="bg-white border border-[#E5E7EB]" style={{ borderRadius: '0px', borderLeft: '3px solid #1D4ED8' }}>

          {/* ── Verification Stamp Header ── */}
          <div className="tps-success-enter" style={{ backgroundColor: '#1D4ED8', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Stamp seal */}
                <div style={{
                  width: '36px', height: '36px', border: '2px solid rgba(255,255,255,0.6)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <CheckCircle2 size={18} color="#FFFFFF" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>VERIFIED</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.65)', marginTop: '2px', letterSpacing: '0.04em' }}>Ta'ang Land Immigration Dept. · TPS</div>
                </div>
              </div>
              <button
                onClick={reset}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <X size={14} color="#fff" />
              </button>
            </div>
          </div>

          {/* ── Reference strip ── */}
          <div style={{
            backgroundColor: '#F3F4F6', borderBottom: '1px solid #E5E7EB',
            padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '8.5px', fontWeight: '700', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ref No.</span>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#1A1A1A', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{verificationRef}</span>
            </div>
            <span style={{ fontSize: '8.5px', color: '#737373', letterSpacing: '0.04em' }}>
              {verifiedAt && verifiedAt.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
            </span>
          </div>

          {/* Identity Section */}
          <div className="p-4 border-b border-[#E5E7EB]">
            <p className="text-xs font-semibold text-[#737373] uppercase tracking-widest mb-3">Identity</p>
            <InfoRow icon={User} label="Full Name" value={result.name} />
            <InfoRow icon={CreditCard} label="Ta'ang Land ID No." value={result.taang_land_id_no} />
            <InfoRow icon={Hash} label="Household No." value={result.household_no} />
            <InfoRow icon={UserCheck} label="Gender" value={result.gender} />
            <InfoRow icon={Calendar} label="Date of Birth" value={result.date_of_birth} />
            <InfoRow icon={Globe} label="Nationality" value={result.nationality} />
            <InfoRow icon={Briefcase} label="Occupation" value={result.occupation} />
            <InfoRow icon={HeartHandshake} label="Household Relationship" value={result.household_relationship} />
          </div>

          {/* Address Section */}
          <div className="p-4 border-b border-[#E5E7EB]">
            <p className="text-xs font-semibold text-[#737373] uppercase tracking-widest mb-3">Address</p>
            <InfoRow icon={Home} label="House No." value={result.house_no} />
            <InfoRow icon={Layers} label="Ward / Village / Group" value={result.ward_village_group} />
            <InfoRow icon={Building} label="Township" value={result.township} />
            <InfoRow icon={Landmark} label="District" value={result.district} />
            {result.address && (
              <InfoRow icon={Compass} label="Full Address" value={result.address} />
            )}
          </div>

          {/* View Family Button & Inline Roster */}
          <div className="p-4">
            <button
              onClick={openFamilyModal}
              onMouseOver={e => { e.currentTarget.style.backgroundColor = familyModal ? '#FFFFFF' : '#1A1A1A'; e.currentTarget.style.color = familyModal ? '#1A1A1A' : '#FFFFFF'; }}
              onMouseOut={e => { e.currentTarget.style.backgroundColor = familyModal ? '#1A1A1A' : '#FFFFFF'; e.currentTarget.style.color = familyModal ? '#FFFFFF' : '#1A1A1A'; }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center',
                padding: '8px 16px',
                backgroundColor: familyModal ? '#1A1A1A' : '#FFFFFF',
                color: familyModal ? '#FFFFFF' : '#1A1A1A',
                fontSize: '11px',
                fontWeight: '500',
                border: '1px solid #1A1A1A',
                borderRadius: '0px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                transition: 'background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1)'
              }}
            >
              <Users size={13} />
              {familyModal ? 'Close Family Records' : 'View All Family Members'}
            </button>
          </div>

          {/* Inline Family Records Box directly below button */}
          {familyModal && (
            <div className="tps-panel-enter border-t border-[#E5E7EB] bg-[#FAFAFA] p-4 sm:p-6">
              <div className="bg-white border border-[#E5E7EB]">
                <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAFAFA]">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-[#1A1A1A]" />
                    <span className="text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider">
                      Family Records: {result.household_no}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#737373] uppercase tracking-wider font-mono">
                      {familyMembers.length} member{familyMembers.length !== 1 ? 's' : ''}
                    </span>
                    <button onClick={() => setFamilyModal(false)} className="text-[#737373] hover:text-[#1A1A1A]">
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {familyLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-[#4A6572]">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-xs font-medium">Loading family members...</span>
                  </div>
                ) : familyMembers.length === 0 ? (
                  <div className="text-center py-10 text-[#737373] text-xs">No family members found.</div>
                ) : (
                  <TpsScrollWrapper>
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
                          {['No.', 'Name', 'Date of Birth', 'Gender', "Father's Name", "Mother's Name", 'Relationship', 'Occupation', 'Previous ID No.', "Ta'ang Land ID No.", 'Nationality', 'Resident Status', 'Religious', 'Submission Date'].map((h, i) => (
                            <th key={i} className="px-3 py-2 text-[10px] font-semibold text-[#737373] uppercase tracking-wider border-b border-[#E5E7EB]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {familyMembers.map((m, i) => {
                          const isMe = m.taang_land_id_no === result.taang_land_id_no;
                          const rowBg = isMe ? 'bg-[#F3F4F6]' : 'bg-white';
                          return (
                            <tr key={m.id || i} className={`border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors ${rowBg}`}>
                              <td className="px-3 py-2 text-[#9CA3AF] font-mono font-semibold">{i + 1}</td>
                              <td className="px-3 py-2 font-medium text-[#1A1A1A]">
                                {m.name}
                                {m.household_relationship === 'ဦးစီး' && <span className="ml-1.5 border border-[#1A1A1A] px-1 py-0.5 text-[8px] font-bold">HEAD</span>}
                                {isMe && <span className="ml-1.5 bg-[#1A1A1A] text-white px-1 py-0.5 text-[8px] font-bold tracking-wider">YOU</span>}
                              </td>
                              <td className="px-3 py-2 text-[#737373] font-mono">{m.date_of_birth || '—'}</td>
                              <td className="px-3 py-2 text-[#737373]">{m.gender || '—'}</td>
                              <td className="px-3 py-2 text-[#737373]">{m.fathers_name || '—'}</td>
                              <td className="px-3 py-2 text-[#737373]">{m.mothers_name || '—'}</td>
                              <td className="px-3 py-2 text-[#737373] font-medium">{m.household_relationship || '—'}</td>
                              <td className="px-3 py-2 text-[#737373]">{m.occupation || '—'}</td>
                              <td className="px-3 py-2 text-[#737373] font-mono">{m.previous_id_no || '—'}</td>
                              <td className="px-3 py-2 text-[#737373] font-mono">{m.taang_land_id_no || '—'}</td>
                              <td className="px-3 py-2 text-[#737373]">{m.nationality || '—'}</td>
                              <td className="px-3 py-2 text-[#737373]">{m.resident_status || '—'}</td>
                              <td className="px-3 py-2 text-[#737373]">{m.religious || '—'}</td>
                              <td className="px-3 py-2 text-[#737373] font-mono">{m.submission_date || (m.created_at ? m.created_at.split('T')[0] : '—')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </TpsScrollWrapper>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IDCardScanner;
