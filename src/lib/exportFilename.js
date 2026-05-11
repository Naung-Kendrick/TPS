/**
 * Builds a human-readable export filename.
 *
 * Single household:  [District]_[Township]_[Ward]_[HouseholdNo]_[HeadName]_[YYYY-MM-DD].ext
 * Full export:       TPS_FullExport_[YYYY-MM-DD].ext
 *
 * @param {object} opts
 * @param {'household'|'full'} opts.type
 * @param {string}  [opts.district]
 * @param {string}  [opts.township]
 * @param {string}  [opts.ward]
 * @param {string}  [opts.householdNo]
 * @param {string}  [opts.headName]        - Name of the head of household (ဦးစီး)
 * @param {'xlsx'|'json'|'pdf'} opts.ext
 * @returns {string}
 */
export function buildExportFilename({ type, district, township, ward, householdNo, headName, ext }) {
  const sanitize = (str) =>
    String(str || '')
      .trim()
      .replace(/[\/\\:*?"<>|]/g, '')   // remove filesystem-illegal chars
      .replace(/\s+/g, '_')            // spaces → underscore
      .replace(/_+/g, '_')             // collapse runs
      .replace(/^_|_$/g, '')           // trim edges
      || 'Unknown';

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (type === 'household') {
    const parts = [
      sanitize(district),
      sanitize(township),
      sanitize(ward),
      sanitize(householdNo),
      sanitize(headName),
      today,
    ];
    return `${parts.join('_')}.${ext}`;
  }

  return `TPS_FullExport_${today}.${ext}`;
}
