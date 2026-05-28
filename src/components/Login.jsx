import React, { useState, useRef, useEffect } from 'react';
import { Lock, User, Eye, EyeOff, ShieldAlert, ChevronRight, Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import logo from '../assets/fonts/IDTL_logo.png';

const RESEND_COOLDOWN = 60; // seconds before user can resend OTP
const SKIP_OTP = false;  // ← set false to re-enable OTP

const Login = ({ onLogin }) => {
  // Step 1: username+PIN  →  Step 2: email OTP
  const [step, setStep]           = useState(1);
  const [formData, setFormData]   = useState({ username: '', pinCode: '' });
  const [showPin, setShowPin]     = useState(false);
  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [pendingUser, setPendingUser] = useState(null); // holds authData after PIN success
  const [cooldown, setCooldown]   = useState(0);
  const otpRefs = useRef([]);
  const cooldownRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(cooldownRef.current);
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const maskEmail = (email) => {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const visible = user.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(user.length - 2, 2))}@${domain}`;
  };

  // ── Step 1: Verify username + PIN, then send OTP ──────────────────────────
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.username || !formData.pinCode) {
      setError('ကျေးဇူးပြု၍ အချက်အလက်အားလုံး ပြည့်စုံစွာ ဖြည့်စွက်ပါ။ (Please fill all fields)');
      setLoading(false);
      return;
    }

    try {
      const finalEmail = formData.username.includes('@')
        ? formData.username
        : `${formData.username}@tps.idtl`;

      // 1. Verify credentials
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: finalEmail,
        password: formData.pinCode,
      });
      if (authError) throw authError;

      // 2. Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, is_active, last_seen_at, access_level, allowed_districts, allowed_townships')
        .eq('id', authData.user.id)
        .single();
      if (profileError) { profileError.userId = authData.user.id; throw profileError; }

      // 3. Send OTP (skip if SKIP_OTP is enabled)
      if (SKIP_OTP) {
        await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', authData.user.id);
        onLogin?.({
          ...authData.user,
          profile,
          role: profile.role,
          access_level: profile.access_level || 'central',
          allowed_districts: profile.allowed_districts || [],
          allowed_townships: profile.allowed_townships || [],
        });
        return;
      }

      const { data: otpResult, error: otpFnError } = await supabase.functions.invoke('send-otp', {
        body: { user_id: authData.user.id },
      });
      // otpFnError.context has the actual response body on non-2xx
      if (otpFnError) {
        let msg = 'Failed to send OTP.';
        try {
          const body = await otpFnError.context?.json?.();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      if (otpResult?.error) throw new Error(otpResult.error);

      // 4. Move to step 2
      setPendingUser({ authData, profile });
      setMaskedEmail(otpResult.masked_email || '');
      startCooldown();
      setStep(2);

    } catch (err) {
      console.error('Login error:', err);
      if (err.message === 'Invalid login credentials') {
        setError('အသုံးပြုသူအမည် သို့မဟုတ် လျှို့ဝှက်နံပါတ် မှားယွင်းနေပါသည်။ (Invalid username or PIN)');
      } else if (err.message === 'Email not confirmed') {
        setError('Error: Turn off "Confirm Email" in Supabase Auth Settings.');
      } else if (err.code === 'PGRST116') {
        setError(`Profile missing. UUID: ${err.userId}`);
      } else {
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ────────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);
    if (cleaned && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  // ── Step 2: Verify OTP and complete login ─────────────────────────────────
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const token = otp.join('');
    if (token.length < 6) { setError('Please enter all 6 digits.'); return; }
    setLoading(true);
    setError('');

    try {
      const { data: verifyResult, error: verifyFnError } = await supabase.functions.invoke('verify-otp', {
        body: { user_id: pendingUser.authData.user.id, code: token },
      });
      if (verifyFnError) throw new Error(verifyFnError.message || 'Verification failed.');
      if (verifyResult?.error) throw new Error(verifyResult.error);

      // Stamp last_seen_at
      await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', pendingUser.authData.user.id);

      onLogin?.({
        ...pendingUser.authData.user,
        profile: pendingUser.profile,
        role: pendingUser.profile.role,
        access_level: pendingUser.profile.access_level || 'central',
        allowed_districts: pendingUser.profile.allowed_districts || [],
        allowed_townships: pendingUser.profile.allowed_townships || [],
      });
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !pendingUser) return;
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { user_id: pendingUser.authData.user.id },
      });
      if (error) throw new Error(error.message || 'Failed to resend.');
      if (data?.error) throw new Error(data.error);
      startCooldown();
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(`Failed to resend: ${err.message}`);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem',
    border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB',
    fontSize: '1rem', outline: 'none', borderRadius: 0,
    fontFamily: "Inter, 'Pyidaungsu', sans-serif",
    boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.75rem', fontWeight: '700',
    color: '#4B5563', marginBottom: '0.4rem',
    textTransform: 'uppercase', letterSpacing: '0.025em',
  };
  const iconWrap = {
    position: 'absolute', left: '12px', top: '50%',
    transform: 'translateY(-50%)', color: '#9CA3AF',
  };
  const submitBtn = (disabled) => ({
    width: '100%', backgroundColor: disabled ? '#6B7280' : '#1A1A1A',
    color: 'white', padding: '1rem', border: 'none', fontWeight: '700',
    fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '0.5rem', borderRadius: 0, transition: 'background-color 120ms',
  });

  return (
    <div className="login-wrapper" style={{
      minHeight: '100vh', width: '100%', flex: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'transparent', padding: '1rem',
      fontFamily: "Inter, 'Pyidaungsu', system-ui, sans-serif",
    }}>
      <div className="login-card" style={{
        width: '100%', maxWidth: '440px', backgroundColor: 'white',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ backgroundColor: '#1A1A1A', padding: '2.5rem 2rem', textAlign: 'center', color: 'white' }}>
          <div style={{
            width: '80px', height: '80px', margin: '0 auto 1.5rem',
            backgroundColor: 'white', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 0 0 4px rgba(255,255,255,0.1)',
          }}>
            <img src={logo} alt="IDTL Logo" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>
            TPS Authentication
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#A3A3A3', marginTop: '0.5rem', fontWeight: '500' }}>
            Immigration Department of Ta'ang Land
          </p>
          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: s === step ? '24px' : '8px', height: '4px', borderRadius: '2px',
                backgroundColor: s === step ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
                transition: 'all 200ms',
              }} />
            ))}
          </div>
        </div>

        {/* Security Banner */}
        <div style={{
          backgroundColor: '#FEF2F2', borderBottom: '1px solid #FEE2E2',
          padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <ShieldAlert size={18} color="#DC2626" />
          <span style={{ fontSize: '0.75rem', color: '#991B1B', fontWeight: '600' }}>
            OFFICIAL ACCESS ONLY — AUTHORIZED PERSONNEL ONLY
          </span>
        </div>

        {/* ── STEP 1: Username + PIN ── */}
        {step === 1 && (
          <form onSubmit={handlePinSubmit} style={{ padding: '2rem' }}>
            {error && (
              <div className="tps-shake" style={{
                backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#B91C1C',
                padding: '0.75rem', fontSize: '0.8rem', marginBottom: '1.5rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              }}>
                <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>
                Username <span style={{ color: '#9CA3AF', fontWeight: '400', fontSize: '0.7rem' }}>အသုံးပြုသူအမည်</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><User size={18} /></div>
                <input type="text" name="username" value={formData.username} onChange={handleChange}
                  placeholder="Enter username" style={inputStyle} autoComplete="username" />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>
                PIN Code <span style={{ color: '#9CA3AF', fontWeight: '400', fontSize: '0.7rem' }}>လျှို့ဝှက်နံပါတ်</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><Lock size={18} /></div>
                <input type={showPin ? 'text' : 'password'} name="pinCode" value={formData.pinCode}
                  onChange={handleChange} placeholder="••••"
                  style={{ ...inputStyle, paddingRight: '2.5rem', letterSpacing: showPin ? 'normal' : '0.5em' }}
                  autoComplete="current-password" />
                <button type="button" onClick={() => setShowPin(!showPin)} style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center',
                }}>
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={submitBtn(loading)}>
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Verifying...</>
                : <>Continue <ChevronRight size={18} /></>}
            </button>
          </form>
        )}

        {/* ── STEP 2: Email OTP ── */}
        {step === 2 && (
          <form onSubmit={handleOtpSubmit} style={{ padding: '2rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem',
              padding: '0.75rem', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
            }}>
              <Mail size={16} color="#15803D" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', color: '#15803D', fontWeight: '600' }}>
                6-digit code sent to <strong>{maskedEmail}</strong>
              </span>
            </div>

            {error && (
              <div className="tps-shake" style={{
                backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#B91C1C',
                padding: '0.75rem', fontSize: '0.8rem', marginBottom: '1.25rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              }}>
                <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>
                Verification Code <span style={{ color: '#9CA3AF', fontWeight: '400', fontSize: '0.7rem' }}>အတည်ပြုကုဒ်</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '0.5rem' }}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    style={{
                      width: '48px', height: '56px', textAlign: 'center',
                      fontSize: '22px', fontWeight: '700', fontFamily: 'monospace',
                      border: `1px solid ${digit ? '#1A1A1A' : '#D1D5DB'}`,
                      backgroundColor: digit ? '#F9FAFB' : '#FAFAFA',
                      outline: 'none', borderRadius: 0,
                      transition: 'border-color 120ms',
                    }}
                  />
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                {cooldown > 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                    Resend in {cooldown}s
                  </span>
                ) : (
                  <button type="button" onClick={handleResend} style={{
                    background: 'none', border: 'none', color: '#1A1A1A', fontSize: '0.75rem',
                    cursor: 'pointer', textDecoration: 'underline', padding: 0, fontWeight: '600',
                  }}>
                    Resend Code
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => { setStep(1); setOtp(['','','','','','']); setError(''); }}
                style={{ ...submitBtn(false), width: 'auto', padding: '1rem 1.25rem', backgroundColor: 'white', color: '#1A1A1A', border: '1px solid #E5E7EB' }}>
                <ArrowLeft size={16} />
              </button>
              <button type="submit" disabled={loading || otp.join('').length < 6}
                style={{ ...submitBtn(loading || otp.join('').length < 6), flex: 1 }}>
                {loading
                  ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Verifying...</>
                  : <><CheckCircle2 size={16} /> Verify &amp; Sign In</>}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div style={{
          padding: '1.25rem 2rem', borderTop: '1px solid #F3F4F6',
          textAlign: 'center', backgroundColor: '#FAFAFA',
        }}>
          <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
            Ta'ang Population System
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        @media (max-width: 480px) {
          .login-wrapper { padding: 0 !important; background-color: white !important; align-items: flex-start !important; }
          .login-card { max-width: 100% !important; min-height: 100vh !important; border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;
