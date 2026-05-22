import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import logo from '../assets/fonts/IDTL_logo.png';

const TpsAuthenticator = ({ onPassed }) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError('');
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = async () => {
    const code = digits.join('');
    if (code.length < 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('verify_access_token', {
        candidate: code,
      });

      if (rpcError) throw rpcError;

      if (data === true) {
        onPassed();
      } else {
        triggerError('Invalid access code. Please check with your system administrator.');
      }
    } catch (err) {
      if (err.message?.includes('locked')) {
        triggerError('Access token is locked due to too many failed attempts. Contact system admin.');
      } else if (err.message?.includes('expired')) {
        triggerError('Access token has expired. Contact system admin to issue a new one.');
      } else {
        triggerError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerError = (msg) => {
    setError(msg);
    setDigits(['', '', '', '', '', '']);
    setShake(true);
    setTimeout(() => setShake(false), 600);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const allFilled = digits.every(d => d !== '');

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F3F4F6',
      padding: '16px',
    }}>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          15%      { transform: translateX(-8px); }
          30%      { transform: translateX(8px); }
          45%      { transform: translateX(-6px); }
          60%      { transform: translateX(6px); }
          75%      { transform: translateX(-3px); }
          90%      { transform: translateX(3px); }
        }
        .tps-auth-shake { animation: shake 0.55s ease; }
        .tps-digit:focus { outline: none; border-color: #1A1A1A !important; background-color: #FFFFFF !important; }
        .tps-digit::selection { background: transparent; }
      `}</style>

      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderTop: '3px solid #1A1A1A',
      }}>

        {/* Dark header */}
        <div style={{
          backgroundColor: '#1A1A1A',
          padding: '28px 32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '52px', height: '52px',
            backgroundColor: '#FFFFFF',
            border: '2px solid #FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img src={logo} alt="IDTL" style={{ width: '90%', height: '90%', objectFit: 'contain' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              TPS AUTHENTICATOR
            </div>
            <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Ta'ang Population System
            </div>
          </div>
        </div>

        {/* Warning strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 16px',
          backgroundColor: '#FDF2F2',
          borderBottom: '1px solid #FECACA',
        }}>
          <ShieldAlert size={13} style={{ color: '#B71C1C', flexShrink: 0 }} />
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#B71C1C', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Authorized Personnel Only. Entry is Monitored.
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '32px' }}>

          {/* 6-digit input boxes */}
          <div
            className={shake ? 'tps-auth-shake' : ''}
            style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}
            onPaste={handlePaste}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                className="tps-digit"
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={{
                  width: '48px', height: '56px',
                  textAlign: 'center',
                  fontSize: '22px', fontWeight: '700',
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#1A1A1A',
                  backgroundColor: d ? '#F9FAFB' : '#FAFAFA',
                  border: `1px solid ${error ? '#FECACA' : '#E5E7EB'}`,
                  borderRadius: '0',
                  transition: 'border-color 120ms, background-color 120ms',
                  caretColor: 'transparent',
                }}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              padding: '10px 12px', marginBottom: '16px',
              backgroundColor: '#FDF2F2', border: '1px solid #FECACA',
            }}>
              <AlertCircle size={13} style={{ color: '#B71C1C', flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '11px', color: '#B71C1C', fontWeight: '500', lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !allFilled}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '12px',
              backgroundColor: allFilled && !loading ? '#1A1A1A' : '#E5E7EB',
              color: allFilled && !loading ? '#FFFFFF' : '#9CA3AF',
              border: 'none', cursor: allFilled && !loading ? 'pointer' : 'not-allowed',
              fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase',
              transition: 'background-color 150ms, color 150ms',
            }}
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Verifying...</>
              : <><ChevronRight size={14} /> Authenticate</>
            }
          </button>

        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 32px 14px',
          borderTop: '1px solid #E5E7EB',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: '9px', color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            IDTL · Ta'ang Land Immigration Dept. · Confidential System
          </span>
        </div>
      </div>
    </div>
  );
};

export default TpsAuthenticator;
