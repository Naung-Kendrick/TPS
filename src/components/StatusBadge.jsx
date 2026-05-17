import React from 'react';

const StatusBadge = ({ status }) => {
  const s = String(status || 'active').toLowerCase();

  let label = 'ACTIVE';
  let styles = {
    backgroundColor: '#ECFDF5',
    color: '#065F46',
    border: '1px solid #A7F3D0'
  };

  if (s === 'deceased') {
    label = 'DECEASED';
    styles = {
      backgroundColor: '#FEF2F2',
      color: '#991B1B',
      border: '1px solid #FECACA'
    };
  } else if (s === 'migrated') {
    label = 'MIGRATED';
    styles = {
      backgroundColor: '#EFF6FF',
      color: '#1E40AF',
      border: '1px solid #BFDBFE'
    };
  } else if (s === 'inactive') {
    label = 'INACTIVE';
    styles = {
      backgroundColor: '#F9FAFB',
      color: '#374151',
      border: '1px solid #E5E7EB'
    };
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 6px',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      ...styles
    }}>
      {label}
    </span>
  );
};

export default StatusBadge;
