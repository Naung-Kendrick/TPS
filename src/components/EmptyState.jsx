import React from 'react';
import { Search, FileX, WifiOff, AlertCircle, ShieldOff, ServerCrash, RefreshCw } from 'lucide-react';

const CONFIGS = {
  'no-search': {
    Icon: Search,
    title: 'Start Searching',
    defaultMessage: 'Enter a search term above to find records.',
    accent: '#E5E7EB',
    iconColor: '#9CA3AF',
  },
  'no-results': {
    Icon: FileX,
    title: 'No Records Found',
    defaultMessage: 'No records match your search criteria. Try adjusting the filters.',
    accent: '#E5E7EB',
    iconColor: '#9CA3AF',
  },
  'offline': {
    Icon: WifiOff,
    title: 'No Internet Connection',
    defaultMessage: 'The device is offline. Cached data may be available. Reconnect to fetch live records.',
    accent: '#FCA5A5',
    iconColor: '#DC2626',
  },
  'error': {
    Icon: AlertCircle,
    title: 'Something Went Wrong',
    defaultMessage: 'An unexpected error occurred. Please try again.',
    accent: '#FCA5A5',
    iconColor: '#DC2626',
  },
  'permission': {
    Icon: ShieldOff,
    title: 'Access Denied',
    defaultMessage: 'You do not have permission to view this data. Contact your system administrator.',
    accent: '#FCD34D',
    iconColor: '#D97706',
  },
  'server': {
    Icon: ServerCrash,
    title: 'Server Unavailable',
    defaultMessage: 'The database server could not be reached. Please check your connection and try again.',
    accent: '#FCA5A5',
    iconColor: '#DC2626',
  },
};

const EmptyState = ({
  type = 'no-results',
  title,
  message,
  action,       // { label: string, onClick: fn }
  detail,       // optional technical detail (e.g. error.message)
  compact = false,
}) => {
  const cfg = CONFIGS[type] || CONFIGS['no-results'];
  const Icon = cfg.Icon;
  const isError = ['offline', 'error', 'permission', 'server'].includes(type);

  return (
    <div className={isError ? 'tps-shake' : ''} style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: compact ? '32px 24px' : '64px 32px',
      textAlign: 'center',
      borderLeft: isError ? `3px solid ${cfg.accent}` : '3px solid transparent',
      backgroundColor: isError ? `${cfg.accent}18` : 'transparent',
      minHeight: compact ? '140px' : '260px',
    }}>
      {/* Icon */}
      <div style={{
        width: '48px', height: '48px',
        backgroundColor: '#F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '16px', flexShrink: 0,
      }}>
        <Icon size={22} color={cfg.iconColor} strokeWidth={1.5} />
      </div>

      {/* Title */}
      <div style={{
        fontSize: '11px', fontWeight: '700', color: '#1A1A1A',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: '8px',
      }}>
        {title || cfg.title}
      </div>

      {/* Message */}
      <div style={{
        fontSize: '12px', color: '#737373',
        lineHeight: 1.6, maxWidth: '340px',
        marginBottom: detail || action ? '16px' : 0,
      }}>
        {message || cfg.defaultMessage}
      </div>

      {/* Technical detail (e.g. error.message) */}
      {detail && (
        <div style={{
          fontSize: '10px', color: '#9CA3AF',
          fontFamily: 'monospace', letterSpacing: '0.02em',
          backgroundColor: '#F3F4F6',
          padding: '6px 12px',
          maxWidth: '400px', wordBreak: 'break-word',
          marginBottom: action ? '16px' : 0,
        }}>
          {detail}
        </div>
      )}

      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 18px',
            backgroundColor: '#1A1A1A', color: '#FFFFFF',
            border: 'none', cursor: 'pointer',
            fontSize: '10px', fontWeight: '700',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}
        >
          {action.icon && <RefreshCw size={12} />}
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
