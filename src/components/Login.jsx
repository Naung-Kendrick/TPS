import React, { useState } from 'react';
import { Lock, User, Hash, Eye, EyeOff, ShieldAlert, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import logo from '../assets/fonts/IDTL_logo.png';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    pinCode: ''
  });
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.username || !formData.pinCode) {
      setError('ကျေးဇူးပြု၍ အချက်အလက်အားလုံး ပြည့်စုံစွာ ဖြည့်စွက်ပါ။ (Please fill all fields)');
      setLoading(false);
      return;
    }

    try {
      // 1. Sign in with Supabase Auth
      // Fix: If a password manager auto-fills the full email, don't append @tps.idtl twice
      const finalEmail = formData.username.includes('@')
        ? formData.username
        : `${formData.username}@tps.idtl`;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: finalEmail,
        password: formData.pinCode,
      });

      if (authError) throw authError;

      // 2. Fetch User Profile for role and display name
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        profileError.userId = authData.user.id;
        throw profileError;
      }

      // 3. Stamp last_seen_at so the user list shows accurate online status
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', authData.user.id);

      // 4. Success - pass full user data including role to App
      onLogin?.({
        ...authData.user,
        profile: profile,
        role: profile.role
      });

    } catch (err) {
      console.error('Login error:', err);
      // Surface exact backend errors for debugging
      if (err.message === 'Invalid login credentials') {
        setError('အသုံးပြုသူအမည် သို့မဟုတ် လျှို့ဝှက်နံပါတ် မှားယွင်းနေပါသည်။ (Invalid username or PIN)');
      } else if (err.message === 'Email not confirmed') {
        setError('Error: Your account is pending email confirmation. Please turn off "Confirm Email" in Supabase Auth Settings.');
      } else if (err.code === 'PGRST116') {
        setError(`Error: Authentication succeeded, but your user profile is missing or blocked. \nUUID: ${err.userId}\nIf this matches what you inserted, your Supabase 'Row Level Security' (RLS) is blocking the read.`);
      } else {
        setError(`System Error: ${err.message} (Code: ${err.code || 'N/A'})`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper" style={{
      minHeight: '100vh',
      width: '100%',
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      padding: '1rem',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div className="login-card" style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'white',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header Branding */}
        <div style={{
          backgroundColor: '#1A1A1A',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          color: 'white'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 1.5rem',
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 4px rgba(255,255,255,0.1)'
          }}>
            <img
              src={logo}
              alt="IDTL Logo"
              style={{ width: '80%', height: '80%', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{
            fontSize: '1.25rem',
            fontWeight: '800',
            letterSpacing: '0.05em',
            margin: 0,
            textTransform: 'uppercase'
          }}>
            TPS Authentication
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: '#A3A3A3',
            marginTop: '0.5rem',
            fontWeight: '500'
          }}>
            Immigration Department of Ta'ang Land
          </p>
        </div>

        {/* Security Banner */}
        <div style={{
          backgroundColor: '#FEF2F2',
          borderBottom: '1px solid #FEE2E2',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <ShieldAlert size={18} color="#DC2626" />
          <span style={{ fontSize: '0.75rem', color: '#991B1B', fontWeight: '600' }}>
            OFFICIAL ACCESS ONLY. AUTHORIZED PERSONNEL ONLY.
          </span>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
          {error && (
            <div className="tps-shake" style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FEE2E2',
              color: '#B91C1C',
              padding: '0.75rem',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {error}
            </div>
          )}

          {/* Username */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#4B5563',
              marginBottom: '0.4rem',
              textTransform: 'uppercase',
              letterSpacing: '0.025em'
            }}>
              Username <span style={{ color: '#9CA3AF', fontWeight: '400', fontSize: '0.7rem' }}>အသုံးပြုသူအမည်</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                color: '#9CA3AF'
              }}>
                <User size={18} />
              </div>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter username"
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#F9FAFB',
                  fontSize: '1rem',
                  outline: 'none',
                  borderRadius: 0
                }}
              />
            </div>
          </div>

          {/* PIN Code */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#4B5563',
              marginBottom: '0.4rem',
              textTransform: 'uppercase',
              letterSpacing: '0.025em'
            }}>
              PIN Code <span style={{ color: '#9CA3AF', fontWeight: '400', fontSize: '0.7rem' }}>လျှို့ဝှက်နံပါတ်</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                color: '#9CA3AF'
              }}>
                <Lock size={18} />
              </div>
              <input
                type={showPin ? "text" : "password"}
                name="pinCode"
                value={formData.pinCode}
                onChange={handleChange}
                placeholder="••••"
                style={{
                  width: '100%',
                  padding: '0.75rem 2.5rem 0.75rem 2.5rem',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#F9FAFB',
                  fontSize: '1rem',
                  outline: 'none',
                  borderRadius: 0,
                  letterSpacing: showPin ? 'normal' : '0.5em'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer',
                  padding: 0, display: 'flex', alignItems: 'center'
                }}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>


          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#1A1A1A',
              color: 'white',
              padding: '1rem',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: 0
            }}
          >
            {loading ? 'Authenticating...' : (
              <>
                Sign In <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          padding: '1.5rem 2rem',
          borderTop: '1px solid #F3F4F6',
          textAlign: 'center',
          backgroundColor: '#FAFAFA'
        }}>
          <p style={{
            fontSize: '0.75rem',
            color: '#6B7280',
            margin: 0,
            lineHeight: 1.5
          }}>
            SYSTEM VERSION: 2.0.4-RELEASE<br />
            © {new Date().getFullYear()} IDTL CIVIL REGISTRY SERVICE
          </p>
        </div>
      </div>

      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }

        /* Responsive Overrides */
        @media (max-width: 480px) {
          .login-wrapper {
            padding: 0 !important;
            background-color: white !important;
            align-items: flex-start !important;
          }
          .login-card {
            max-width: 100% !important;
            height: 100vh !important;
            border: none !important;
            box-shadow: none !important;
          }
          .login-header {
            padding: 3rem 1.5rem 1.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
