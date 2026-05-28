export const ROLE_LABELS = {
  system:   { label: 'System Admin',          color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  master:   { label: 'Master Admin',          color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  admin:    { label: 'Regional Admin',        color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  regional: { label: 'Regional Admin',        color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  ops:      { label: 'Operations',            color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  field:    { label: 'Field Staff',           color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
};

export const ACCESS_LABELS = {
  central:      { label: 'Central',      color: '#1F2937', bg: '#F3F4F6', border: '#E5E7EB' },
  district:     { label: 'District',     color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  township:     { label: 'Township',     color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
  viewer:       { label: 'Viewer',       color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  sub_township: { label: 'Sub-Township', color: '#B45309', bg: '#FFF7ED', border: '#FED7AA' },
};

export function getProfileType(role, accessLevel) {
  // normalize legacy or undefined roles
  const normalizedRole = role === 'admin' || role === 'regional' ? 'regional' : (role || 'field');
  const normalizedLevel = accessLevel || 'central';

  // 1. Head system administrator (System/Master Admin @ Central)
  if (normalizedRole === 'system' || normalizedRole === 'master') {
    return {
      typicalPerson: 'Head system administrator',
      roleName: 'System Admin',
      accessLevel: 'Central',
      color: '#DC2626',
      bg: '#FEF2F2',
      border: '#FECACA'
    };
  }

  // 2. Central Officer & District officer (manager) (Regional Admin)
  if (normalizedRole === 'regional') {
    if (normalizedLevel === 'central') {
      return {
        typicalPerson: 'Central Immigration Officer',
        roleName: 'Regional Admin',
        accessLevel: "Ta'ang Land",
        color: '#0F766E',
        bg: '#F0FDFA',
        border: '#CCFBF1'
      };
    }
    return {
      typicalPerson: 'District officer (manager)',
      roleName: 'Regional Admin',
      accessLevel: normalizedLevel === 'viewer' ? 'Viewer' : 'District',
      color: '#7C3AED',
      bg: '#F5F3FF',
      border: '#DDD6FE'
    };
  }

  // 3. Township officer (Operations @ Township or default Township field)
  if (normalizedRole === 'ops') {
    return {
      typicalPerson: 'Township officer',
      roleName: 'Operations Staff',
      accessLevel: 'Township',
      color: '#2563EB',
      bg: '#EFF6FF',
      border: '#BFDBFE'
    };
  }

  // 4. Field Staff mappings based on access level
  if (normalizedRole === 'field') {
    if (normalizedLevel === 'viewer') {
      return {
        typicalPerson: 'View-only observer (district)',
        roleName: 'Field Staff',
        accessLevel: 'Viewer',
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A'
      };
    }
    if (normalizedLevel === 'sub_township') {
      return {
        typicalPerson: 'View-only observer (township)',
        roleName: 'Field Staff',
        accessLevel: 'Sub-Township',
        color: '#B45309',
        bg: '#FFF7ED',
        border: '#FED7AA'
      };
    }
    if (normalizedLevel === 'township') {
      return {
        typicalPerson: 'Township officer',
        roleName: 'Field Staff',
        accessLevel: 'Township',
        color: '#059669',
        bg: '#ECFDF5',
        border: '#A7F3D0'
      };
    }
    // Fallback central field staff
    return {
      typicalPerson: 'Township officer',
      roleName: 'Field Staff',
      accessLevel: 'Central',
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0'
    };
  }

  // General fallback
  return {
    typicalPerson: 'Township officer',
    roleName: ROLE_LABELS[normalizedRole]?.label || 'Field Staff',
    accessLevel: ACCESS_LABELS[normalizedLevel]?.label || 'Central',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0'
  };
}
