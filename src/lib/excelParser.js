import ExcelJS from 'exceljs';

const toMyanmarDigits = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const map = { '0': '၀', '1': '၁', '2': '၂', '3': '၃', '4': '၄', '5': '၅', '6': '၆', '7': '၇', '8': '၈', '9': '၉' };
  return String(val).replace(/[0-9]/g, (d) => map[d]);
};

const formatUtcDateDdMmYyyy = (dt) => {
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
};

const extractExcelJsCellText = (cell) => {
  if (!cell) return '';
  let val = cell.value;
  if (val === null || val === undefined) return '';

  // Unwrap formula objects
  if (typeof val === 'object' && !(val instanceof Date)) {
    if ('result' in val) {
      val = val.result;
    } else if (Array.isArray(val.richText)) {
      return val.richText.map((rt) => rt.text || '').join('');
    } else if ('text' in val) {
      return String(val.text || '');
    } else if ('error' in val) {
      return '';
    }
  }

  if (val === null || val === undefined) return '';
  if (val instanceof Date) return formatUtcDateDdMmYyyy(val);

  if (typeof val === 'number') {
    const fmt = String(cell.numFmt || '');
    if (fmt.includes('0455') || fmt.includes('455')) {
      return toMyanmarDigits(val);
    }
    return String(val);
  }

  return String(val);
};

const readXlsxWithExcelJs = async (arrayBuffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel file has no sheets.');

  const matrix = [];
  let maxCols = 0;

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = [];
    // ExcelJS row.values is 1-based; iterate up to cellCount
    const colCount = Math.max(row.cellCount || 0, row.values.length - 1);
    if (colCount > maxCols) maxCols = colCount;
    for (let c = 1; c <= colCount; c++) {
      values.push(extractExcelJsCellText(row.getCell(c)));
    }
    if (values.some((v) => String(v).trim() !== '')) {
      matrix.push(values);
    }
  });

  // Pad rows to uniform width
  return matrix.map((r) => {
    while (r.length < maxCols) r.push('');
    return r;
  });
};

const FORBIDDEN_HEADER_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Parses an uploaded .xlsx file into an Array of Arrays (rows of strings) via ExcelJS.
 * Legacy binary .xls files are rejected instead of using the unpatched `xlsx` package.
 *
 * @param {File} file
 * @returns {Promise<string[][]>}
 */
export async function parseExcelToAoA(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
    throw new Error('Legacy .xls files are not supported for security reasons. Please save the file as .xlsx or .csv and upload again.');
  }
  const buffer = await file.arrayBuffer();
  return readXlsxWithExcelJs(buffer);
}

/**
 * Parses an uploaded .xlsx or .xls file into header-keyed row objects
 * matching PapaParse `{ header: true }` output.
 *
 * @param {File} file
 * @returns {Promise<Record<string, string>[]>}
 */
export async function parseExcelToHeaderObjects(file) {
  const matrix = await parseExcelToAoA(file);
  if (!matrix || matrix.length < 2) return [];

  const headers = matrix[0].map((h) => String(h ?? '').trim().replace(/\s+/g, ' '));
  return matrix.slice(1).map((row) => {
    const obj = {};
    headers.forEach((hdr, idx) => {
      if (hdr && !FORBIDDEN_HEADER_KEYS.has(hdr)) {
        Object.defineProperty(obj, hdr, {
          value: row[idx] !== undefined && row[idx] !== null ? String(row[idx]) : '',
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    });
    return obj;
  });
}
