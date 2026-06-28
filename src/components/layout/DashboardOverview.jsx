import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, UserPlus, Home, CheckCircle, Edit3, UserCheck, AlertTriangle, Download, Plus } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, subtitle, trendType }) => (
  <div style={{
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    flex: 1,
    minWidth: '250px'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
      <div style={{
        backgroundColor: '#EFF6FF',
        color: 'var(--primary-color)',
        padding: '0.75rem',
        borderRadius: '8px',
        display: 'flex'
      }}>
        <Icon size={24} />
      </div>
      <div style={{
        backgroundColor: trendType === 'positive' ? '#D1FAE5' : '#FEE2E2',
        color: trendType === 'positive' ? '#059669' : '#DC2626',
        padding: '0.25rem 0.5rem',
        borderRadius: '16px',
        fontSize: '0.75rem',
        fontWeight: '600'
      }}>
        {trend}
      </div>
    </div>
    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>{title}</div>
    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)' }}>{value}</div>
    <div style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{subtitle}</div>
  </div>
);

const ActivityItem = ({ icon: Icon, title, desc, time, type }) => {
  const getIconColor = () => {
    switch(type) {
      case 'success': return { bg: '#D1FAE5', color: '#059669' };
      case 'info': return { bg: '#EFF6FF', color: 'var(--primary-color)' };
      case 'warning': return { bg: '#FEF3C7', color: '#D97706' };
      case 'danger': return { bg: '#FEE2E2', color: '#DC2626' };
      default: return { bg: '#F3F4F6', color: '#6B7280' };
    }
  };
  const colors = getIconColor();

  return (
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{
        backgroundColor: colors.bg,
        color: colors.color,
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{title}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.4', marginBottom: '0.25rem' }}>{desc}</div>
        <div style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{time}</div>
      </div>
    </div>
  );
};

const DashboardOverview = () => {
  const [stats, setStats] = useState({ totalHouseholds: 0, totalPopulation: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      // Get unique households
      const { count: hCount } = await supabase.from('households').select('household_no', { count: 'exact', head: true });
      // Get total population
      const { count: pCount } = await supabase.from('households').select('*', { count: 'exact', head: true });
      
      setStats({
        totalHouseholds: hCount || 0,
        totalPopulation: pCount || 0
      });
    };
    fetchStats();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>မင်္ဂလာပါ၊ စနစ်အုပ်ချုပ်သူ</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>နေပြည်တော်၊ ဇမ္ဗူသီရိမြို့နယ် လူဦးရေစိစစ်မှု မျက်နှာပြင်မှ ကြိုဆိုပါသည်။</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            backgroundColor: 'white', border: '1px solid #E2E8F0', color: 'var(--text-primary)'
          }}>
            <Download size={18} />
            PDF ဒေါင်းလုဒ်ရယူရန်
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            backgroundColor: 'var(--primary-color)', color: 'white'
          }}>
            <Plus size={18} />
            အသစ်ထည့်သွင်းရန်
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="tps-stagger" style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <StatCard 
          icon={Users}
          title="စုစုပေါင်း အိမ်ထောင်စုအရေအတွက်"
          value={stats.totalHouseholds.toLocaleString('my-MM')}
          trend="+၁.၂% ယခင်လထက်"
          trendType="positive"
          subtitle="အတည်ပြုပြီးသော အချက်အလက်များ"
        />
        <StatCard 
          icon={UserCheck}
          title="စုစုပေါင်း လူဦးရေစာရင်း"
          value={stats.totalPopulation.toLocaleString('my-MM')}
          trend="+၃.၅% ယခင်လထက်"
          trendType="positive"
          subtitle="မှတ်ပုံတင်ပြီးသူ အရေအတွက်"
        />
        <StatCard 
          icon={Home}
          title="ယခုလအတွင်း မှတ်ပုံတင်မှုအသစ်"
          value="၄၅"
          trend="-၂.၁% ယခင်လထက်"
          trendType="danger"
          subtitle="စိစစ်ဆဲ အိမ်ထောင်စုစာရင်းများ"
        />
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Chart Area Placeholder */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>လူဦးရေတိုးတက်မှုနှုန်း (၂၀၂၃-၂၀၂၄)</h3>
            <span style={{ backgroundColor: '#F1F5F9', padding: '0.25rem 0.75rem', borderRadius: '16px', fontSize: '0.75rem' }}>နှစ်အလိုက်</span>
          </div>
          {/* Simple CSS Chart Representation */}
          <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '2%', paddingBottom: '2rem', borderBottom: '1px solid #E2E8F0', position: 'relative' }}>
            <div style={{ width: '12%', backgroundColor: '#BFDBFE', height: '30%', borderRadius: '4px 4px 0 0' }}></div>
            <div style={{ width: '12%', backgroundColor: '#93C5FD', height: '45%', borderRadius: '4px 4px 0 0' }}></div>
            <div style={{ width: '12%', backgroundColor: '#60A5FA', height: '35%', borderRadius: '4px 4px 0 0' }}></div>
            <div style={{ width: '12%', backgroundColor: '#3B82F6', height: '60%', borderRadius: '4px 4px 0 0' }}></div>
            <div style={{ width: '12%', backgroundColor: '#2563EB', height: '50%', borderRadius: '4px 4px 0 0' }}></div>
            <div style={{ width: '12%', backgroundColor: '#1D4ED8', height: '75%', borderRadius: '4px 4px 0 0' }}></div>
            <div style={{ width: '12%', backgroundColor: '#1E40AF', height: '65%', borderRadius: '4px 4px 0 0' }}></div>
            <div style={{ width: '12%', backgroundColor: '#1E3A8A', height: '90%', borderRadius: '4px 4px 0 0' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', color: '#6B7280', fontSize: '0.75rem' }}>
            <span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span><span>JUL</span><span>AUG</span>
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem' }}>လတ်တလော လုပ်ရှားမှုများ</h3>
          
          <ActivityItem 
            icon={CheckCircle} type="success"
            title="ဦးအေးမင်း (အိမ်ထောင်စုအမှတ် - ၂၃၄)"
            desc="အချက်အလက်များကို အောင်မြင်စွာ အတည်ပြုပြီးပါပြီ။"
            time="၂ မိနစ်ခန့်က"
          />
          <ActivityItem 
            icon={Edit3} type="info"
            title="ဒေါ်လှလှဝင်း (အိမ်ထောင်စုအမှတ် - ၅၆၇)"
            desc="နေရပ်လိပ်စာ အပြောင်းအလဲ ပြုလုပ်ခဲ့ပါသည်။"
            time="၁၅ မိနစ်ခန့်က"
          />
          <ActivityItem 
            icon={UserPlus} type="info"
            title="အိမ်ထောင်စုအသစ် မှတ်ပုံတင်ခြင်း"
            desc="အောင်ဇေယျရပ်ကွက်မှ အိမ်ထောင်စုသစ် (၁) ခု ထည့်သွင်းခဲ့သည်။"
            time="၁ နာရီခန့်က"
          />
          <ActivityItem 
            icon={AlertTriangle} type="danger"
            title="စာရင်းစစ်ဆေးရန် လိုအပ်ချက်"
            desc="ရပ်ကွက် (၄) ရှိ အိမ်ထောင်စု (၃) ခု၏ အချက်အလက်များ လွဲမှားနေသည်။"
            time="၃ နာရီခန့်က"
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
