import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import taangFlag from '../assets/taang_flag.jpg';
import taangLogo from '../assets/fonts/IDTL_logo.png';
import { buildExportFilename } from './exportFilename';

const escVal = (v) => (v === null || v === undefined ? '' : v);

const toMyanmarNum = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const map = { '0':'၀','1':'၁','2':'၂','3':'၃','4':'၄','5':'၅','6':'၆','7':'၇','8':'၈','9':'၉' };
  return String(v).replace(/[0-9]/g, d => map[d]);
};

const safeHtml = (v) => {
  if (v === null || v === undefined || v === '') return '';
  return String(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
};

export const exportHouseholdExcel = async (householdNo, members) => {
  if (!members || members.length === 0) return;
  const first = members[0] || {};

  // ── Age helpers for summary statistics ──
  const myanmarToArabic = { '၀':'0','၁':'1','၂':'2','၃':'3','၄':'4','၅':'5','၆':'6','၇':'7','၈':'8','၉':'9' };
  const parseAge = (dateStr) => {
    if (!dateStr) return null;
    const s = String(dateStr).split('').map(c => myanmarToArabic[c] ?? c).join('');
    const parts = s.split(/[.\-\/]/);
    if (parts.length < 3) return null;
    const [d, m, y] = parts.map(Number);
    if (isNaN(d) || isNaN(m) || isNaN(y) || y < 1900) return null;
    const dob = new Date(y, m - 1, d);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())) age--;
    return age;
  };

  const isMale   = (g) => { const s = (g || '').trim(); return s === 'က' || s === 'male' || s.toLowerCase() === 'male'; };
  const isFemale = (g) => { const s = (g || '').trim(); return s === 'မ' || s === 'female' || s.toLowerCase() === 'female'; };

  const totalMembers = members.length;
  const maleCount    = members.filter(m => isMale(m.gender)).length;
  const femaleCount  = members.filter(m => isFemale(m.gender)).length;
  const ages         = members.map(m => parseAge(m.date_of_birth));
  const under16      = ages.filter(a => a !== null && a < 16).length;
  const age1660      = ages.filter(a => a !== null && a >= 16 && a <= 60).length;
  const above60      = ages.filter(a => a !== null && a > 60).length;

  const head = members.find(m => m.household_relationship === 'ဦးစီး') || first;
  const filename = buildExportFilename({
    type: 'household',
    district: first.district,
    township: first.township,
    ward: first.ward_village_group,
    householdNo,
    headName: head.name,
    ext: 'xlsx',
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Household Members');

  worksheet.columns = [
    { key: 'no', width: 6 },
    { key: 'name', width: 24 },
    { key: 'dob', width: 14 },
    { key: 'gender', width: 9 },
    { key: 'father', width: 20 },
    { key: 'mother', width: 20 },
    { key: 'rel', width: 14 },
    { key: 'occ', width: 20 },
    { key: 'prevId', width: 18 },
    { key: 'taangId', width: 20 },
    { key: 'nat', width: 14 },
    { key: 'status', width: 14 },
    { key: 'religion', width: 12 },
    { key: 'subDate', width: 16 }
  ];

  const applyBorder = (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  };

  // ── Header titles ──
  worksheet.mergeCells('A1:N1');
  const c1 = worksheet.getCell('A1');
  c1.value = "Ta'ang Land Government";
  c1.font = { name: 'Pyidaungsu', size: 16, bold: true };
  c1.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 24;

  worksheet.mergeCells('A2:N2');
  const c2 = worksheet.getCell('A2');
  c2.value = "Ta'ang Land Immigration Department";
  c2.font = { name: 'Pyidaungsu', size: 12, bold: true };
  c2.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 18;

  worksheet.mergeCells('A3:N3');
  const c3 = worksheet.getCell('A3');
  c3.value = `Household Registration — ${first.household_no || householdNo}`;
  c3.font = { name: 'Pyidaungsu', size: 10, italic: true };
  c3.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(3).height = 16;

  // ── Info block row 5 ──
  const r5 = worksheet.getRow(5);
  r5.getCell(1).value = "District:";
  r5.getCell(1).font = { name: 'Pyidaungsu', bold: true, size: 11 };
  r5.getCell(2).value = first.district;
  r5.getCell(2).font = { name: 'Pyidaungsu', size: 11 };
  worksheet.mergeCells('B5:D5');
  
  r5.getCell(5).value = "Ward / Village / Group:";
  r5.getCell(5).font = { name: 'Pyidaungsu', bold: true, size: 11 };
  r5.getCell(6).value = first.ward_village_group;
  r5.getCell(6).font = { name: 'Pyidaungsu', size: 11 };
  worksheet.mergeCells('F5:K5');
  
  r5.getCell(12).value = "Household No.:";
  r5.getCell(12).font = { name: 'Pyidaungsu', bold: true, size: 11 };
  r5.getCell(13).value = first.household_no || householdNo;
  r5.getCell(13).font = { name: 'Pyidaungsu', size: 11 };
  worksheet.mergeCells('M5:N5');
  r5.height = 20;

  // ── Info block row 6 ──
  const r6 = worksheet.getRow(6);
  r6.getCell(1).value = "Township:";
  r6.getCell(1).font = { name: 'Pyidaungsu', bold: true, size: 11 };
  r6.getCell(2).value = first.township;
  r6.getCell(2).font = { name: 'Pyidaungsu', size: 11 };
  worksheet.mergeCells('B6:D6');
  
  r6.getCell(12).value = "House No.:";
  r6.getCell(12).font = { name: 'Pyidaungsu', bold: true, size: 11 };
  r6.getCell(13).value = toMyanmarNum(first.house_no);
  r6.getCell(13).font = { name: 'Pyidaungsu', size: 11 };
  worksheet.mergeCells('M6:N6');
  r6.height = 20;

  // ── Table headers at Row 8 ──
  const headers = [
    'No.', 'Name', 'Date of Birth', 'Gender', "Father's Name", "Mother's Name",
    'Relationship', 'Occupation', 'Previous ID No.', "Ta'ang Land ID No.",
    'Nationality', 'Resident Status', 'Religious', 'Submission Date'
  ];
  const r8 = worksheet.getRow(8);
  headers.forEach((h, idx) => {
    const cell = r8.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Pyidaungsu', size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8E8E8' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(cell);
  });
  r8.height = 26;

  // ── Members rows starting at Row 9 ──
  members.forEach((m, i) => {
    const rowIdx = 9 + i;
    const row = worksheet.getRow(rowIdx);
    const isEven = i % 2 === 1;
    const bg = isEven ? 'FFF5F5F5' : 'FFFFFFFF';

    const cells = [
      { val: toMyanmarNum(i + 1), align: 'center' },
      { val: `${m.name}${m.household_relationship === 'ဦးစီး' ? ' [HEAD]' : ''}`, align: 'left', bold: true },
      { val: m.date_of_birth, align: 'center' },
      { val: m.gender, align: 'center' },
      { val: m.fathers_name, align: 'left' },
      { val: m.mothers_name, align: 'left' },
      { val: m.household_relationship, align: 'center' },
      { val: m.occupation, align: 'left' },
      { val: m.previous_id_no, align: 'center' },
      { val: m.taang_land_id_no, align: 'center' },
      { val: m.nationality, align: 'center' },
      { val: m.resident_status, align: 'center' },
      { val: m.religious, align: 'center' },
      { val: m.submission_date || (m.created_at ? m.created_at.split('T')[0] : ''), align: 'center' }
    ];

    cells.forEach((c, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = c.val;
      cell.font = { name: 'Pyidaungsu', size: 11, bold: c.bold || false };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bg }
      };
      cell.alignment = { horizontal: c.align, vertical: 'middle', wrapText: true };
      applyBorder(cell);
    });
    row.height = 22;
  });

  // ── Summary statistics row ──
  const footerIdx = 9 + members.length;
  worksheet.mergeCells(`A${footerIdx}:N${footerIdx}`);
  const footerCell = worksheet.getCell(`A${footerIdx}`);
  footerCell.value = `Total Members: ${toMyanmarNum(totalMembers)}  |  Male: ${toMyanmarNum(maleCount)}  |  Female: ${toMyanmarNum(femaleCount)}  |  Under 16: ${toMyanmarNum(under16)}  |  16 – 60: ${toMyanmarNum(age1660)}  |  Above 60: ${toMyanmarNum(above60)}`;
  footerCell.font = { name: 'Pyidaungsu', size: 11, bold: true };
  footerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFAFAFA' }
  };
  footerCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  
  for (let c = 1; c <= 14; c++) {
    applyBorder(worksheet.getRow(footerIdx).getCell(c));
  }
  worksheet.getRow(footerIdx).height = 24;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const printHouseholdPdf = (householdNo, members) => {
  if (!members || members.length === 0) return;
  const first = members[0] || {};

  // ── Age helpers ──────────────────────────────────────────────────────────────
  const myanmarToArabic = { '၀':'0','၁':'1','၂':'2','၃':'3','၄':'4','၅':'5','၆':'6','၇':'7','၈':'8','၉':'9' };
  const parseAge = (dateStr) => {
    if (!dateStr) return null;
    const s = String(dateStr).split('').map(c => myanmarToArabic[c] ?? c).join('');
    const parts = s.split(/[.\-\/]/);
    if (parts.length < 3) return null;
    const [d, m, y] = parts.map(Number);
    if (isNaN(d) || isNaN(m) || isNaN(y) || y < 1900) return null;
    const dob = new Date(y, m - 1, d);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())) age--;
    return age;
  };

  const isMale   = (g) => { const s = (g || '').trim(); return s === 'က' || s === 'male' || s.toLowerCase() === 'male'; };
  const isFemale = (g) => { const s = (g || '').trim(); return s === 'မ' || s === 'female' || s.toLowerCase() === 'female'; };

  const totalMembers = members.length;
  const maleCount    = members.filter(m => isMale(m.gender)).length;
  const femaleCount  = members.filter(m => isFemale(m.gender)).length;
  const ages         = members.map(m => parseAge(m.date_of_birth));
  const under16      = ages.filter(a => a !== null && a < 16).length;
  const age1660      = ages.filter(a => a !== null && a >= 16 && a <= 60).length;
  const above60      = ages.filter(a => a !== null && a > 60).length;

  const flagUrl = new URL(taangFlag, window.location.href).href;
  const logoUrl = new URL(taangLogo, window.location.href).href;
  const now = new Date();
  const issuedOn = now.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: '2-digit' });
  const refNo = `TLID/HH/${safeHtml(householdNo) || '-----'}/${now.getFullYear()}`;

  // ── Chunk members into pages of 15 ───────────────────────────────────────────
  const ROWS_PER_PAGE = 15;
  const chunks = [];
  for (let i = 0; i < members.length; i += ROWS_PER_PAGE) {
    chunks.push(members.slice(i, i + ROWS_PER_PAGE));
  }
  const totalPages = chunks.length;

  const tableHeader = `
    <thead>
      <tr>
        <th style="width:3%">No.</th>
        <th>Name</th>
        <th>Date of Birth</th>
        <th>Gender</th>
        <th>Father's Name</th>
        <th>Mother's Name</th>
        <th>Relationship</th>
        <th>Occupation</th>
        <th>Previous ID No.</th>
        <th>Ta'ang Land ID No.</th>
        <th>Nationality</th>
        <th>Resident Status</th>
        <th>Religious</th>
        <th>Submission Date</th>
      </tr>
    </thead>`;

  const infoBlock = `
    <table class="info">
      <tr>
        <td style="width:60%" valign="top">
          <div><span class="lbl">District:</span> <span class="val">${safeHtml(first.district) || '&nbsp;'}</span></div>
          <div style="margin-top:3px"><span class="lbl">Township:</span> <span class="val">${safeHtml(first.township) || '&nbsp;'}</span></div>
          <div style="margin-top:3px"><span class="lbl">Ward / Village / Group:</span> <span class="val">${safeHtml(first.ward_village_group) || '&nbsp;'}</span></div>
        </td>
        <td style="width:40%;" valign="top" align="right">
          <table style="border-collapse:collapse;width:auto;margin-left:auto">
            <tr>
              <td style="white-space:nowrap;font-weight:700;padding:2px 6px 2px 0;vertical-align:top">Household No.:</td>
              <td style="border-bottom:1px dotted #000;padding:2px 0 1px 0;vertical-align:top">${safeHtml(first.household_no || householdNo) || '&nbsp;'}</td>
            </tr>
            <tr>
              <td style="white-space:nowrap;font-weight:700;padding:3px 6px 2px 0;vertical-align:top">House No.:</td>
              <td style="border-bottom:1px dotted #000;padding:3px 0 1px 0;vertical-align:top">${toMyanmarNum(first.house_no) || '&nbsp;'}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const pagesHtml = chunks.map((chunk, ci) => {
    const isLast = ci === totalPages - 1;
    const globalOffset = ci * ROWS_PER_PAGE;
    const rowsHtml = chunk.map((m, i) => `
      <tr>
        <td class="num">${globalOffset + i + 1}</td>
        <td><b>${safeHtml(m.name)}</b>${m.household_relationship === 'ဦးစီး' ? ' <span class="head-badge">HEAD</span>' : ''}</td>
        <td>${safeHtml(m.date_of_birth)}</td>
        <td>${safeHtml(m.gender)}</td>
        <td>${safeHtml(m.fathers_name)}</td>
        <td>${safeHtml(m.mothers_name)}</td>
        <td>${safeHtml(m.household_relationship)}</td>
        <td>${safeHtml(m.occupation)}</td>
        <td>${safeHtml(m.previous_id_no)}</td>
        <td>${safeHtml(m.taang_land_id_no)}</td>
        <td>${safeHtml(m.nationality)}</td>
        <td>${safeHtml(m.resident_status)}</td>
        <td>${safeHtml(m.religious)}</td>
        <td>${safeHtml(m.submission_date || (m.created_at ? m.created_at.split('T')[0] : ''))}</td>
      </tr>`).join('');

    return `
    <div class="page${ci > 0 ? ' page-break' : ''}">
      <div class="watermark"><img src="${logoUrl}" alt="" /></div>
      <div class="content">
        <div class="header">
          <div class="spacer"></div>
          <div class="center">
            <div class="title">Ta'ang Land Government</div>
            <div class="subtitle">Ta'ang Land Immigration Department</div>
            <div class="dept">Household Registration &mdash; ${safeHtml(first.household_no || householdNo) || ''}${totalPages > 1 ? ` &nbsp; (Page ${ci + 1} / ${totalPages})` : ''}</div>
          </div>
          <div class="flag"><img src="${flagUrl}" alt="Ta'ang Flag" /></div>
        </div>
        <div class="rule-double"></div>
        ${infoBlock}
        <table class="data">${tableHeader}<tbody>${rowsHtml}</tbody></table>
        ${isLast ? `
        <div class="stats-bar">
          <span class="item"><b>Total Members: ${totalMembers}</b></span>
          <span class="sep">&nbsp;|&nbsp;</span>
          <span class="item">Male: <b>${maleCount}</b></span>
          <span class="item">Female: <b>${femaleCount}</b></span>
          <span class="sep">&nbsp;|&nbsp;</span>
          <span class="item">Under 16: <b>${under16}</b></span>
          <span class="item">16 – 60: <b>${age1660}</b></span>
          <span class="item">Above 60: <b>${above60}</b></span>
        </div>
        <div class="push"></div>
        <div class="footer">
          <div class="sig"><div class="sig-line"></div><div class="role">Verifying Officer</div><div class="name">Name, Rank &amp; Signature</div></div>
          <div class="sig"><div class="sig-line"></div><div class="role">Authorising Officer</div><div class="name">Ta'ang Land Immigration Dept.</div></div>
        </div>` : '<div class="push"></div>'}
        <div class="doc-footer">
          <span>Ref. ${safeHtml(refNo)}</span>
          <span>Issued: ${safeHtml(issuedOn)}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Household Registration — ${safeHtml(householdNo)}</title>
  <style>
    @page { size: legal landscape; margin: 3mm; }
    @font-face {
      font-family: 'Pyidaungsu';
      src: url('/assets/fonts/Pyidaungsu.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; }
    body {
      font-family: 'Pyidaungsu', 'Padauk', 'Myanmar Text', 'Times New Roman', Times, serif;
      font-size: 10px; color: #000; background: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page { position: relative; padding: 6px 10px 8px 10px; min-height: calc(100vh - 42px); display: flex; flex-direction: column; }
    .page-break { page-break-before: always; }
    .watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
    .watermark img { width: 44%; max-width: 420px; height: auto; opacity: 0.06; }
    .content { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; }
    .content .push { flex: 1; min-height: 12px; }

    /* ── Header ── */
    .header { display: flex; align-items: center; gap: 0; padding-bottom: 5px; margin-bottom: 4px; }
    .header .spacer { width: 60px; flex: 0 0 60px; }
    .header .center { flex: 1; text-align: center; }
    .header .center .title { font-size: 17px; font-weight: 700; letter-spacing: 0.5px; }
    .header .center .subtitle { font-size: 11px; margin-top: 2px; }
    .header .center .dept { font-size: 10px; margin-top: 2px; font-style: italic; }
    .header .flag { width: 60px; height: auto; flex: 0 0 60px; text-align: right; }
    .header .flag img { width: 52px; height: auto; display: inline-block; border: 1px solid #000; }
    .rule-double { border-top: 1px solid #000; border-bottom: 1px solid #000; height: 3px; margin: 0 0 6px 0; }

    /* ── Info table ── */
    .info { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10px; }
    .info td { padding: 2px 4px; vertical-align: top; }
    .info .lbl { font-weight: 700; white-space: nowrap; }
    .info .val { border-bottom: 1px dotted #000; min-width: 60px; padding-bottom: 1px; }

    /* ── Data table ── */
    table.data { width: 100%; border-collapse: collapse; }
    table.data th, table.data td { border: 1px solid #000; padding: 3px 4px; font-size: 9px; vertical-align: middle; }
    table.data thead th { background: #ececec !important; font-weight: 700; text-align: center;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    table.data tbody td { text-align: left; }
    table.data tbody td.num { text-align: center; }
    .head-badge { display: inline-block; margin-left: 3px; padding: 0 3px; border: 1px solid #000; font-size: 7px; font-weight: 700; letter-spacing: 0.5px; }

    /* ── Stats bar ── */
    .stats-bar {
      margin: 6px 0 5px; padding: 4px 10px;
      border: 1px solid #bbb; background: #f0f0f0 !important;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      display: flex; align-items: center; gap: 0;
      font-size: 9.5px; font-family: 'Segoe UI', Arial, sans-serif;
    }
    .stats-bar .item { padding: 0 10px; }
    .stats-bar .item:first-child { padding-left: 0; }
    .stats-bar .sep { color: #999; }
    .stats-bar b { font-weight: 700; }

    /* ── Signatures ── */
    .footer { margin-top: 16px; display: flex; justify-content: space-between; gap: 32px; }
    .sig { flex: 1; text-align: center; font-size: 10px; }
    .sig-line { border-top: 1px solid #000; margin: 28px 8% 4px 8%; }
    .sig .role { font-weight: 700; }
    .sig .name { font-style: italic; color: #333; margin-top: 1px; font-size: 9px; }

    /* ── Doc footer ── */
    .doc-footer { margin-top: 10px; padding-top: 3px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 8.5px; color: #333; }

    /* ── Print toolbar ── */
    .actions { position: sticky; top: 0; z-index: 10; background: #f4f4f4; border-bottom: 1px solid #ccc; padding: 7px 14px; display: flex; justify-content: space-between; align-items: center; font-family: 'Segoe UI', Arial, sans-serif; }
    .actions h1 { margin: 0; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #333; font-weight: 600; }
    .actions .btns button { background: #fff; color: #111; border: 1px solid #111; padding: 5px 14px; font-size: 11px; cursor: pointer; margin-left: 6px; }
    .actions .btns button.primary { background: #111; color: #fff; }
    @media print { .actions { display: none !important; } }
  </style>
</head>
<body>
  <div class="actions">
    <h1>Household Registration — Print Preview (${totalPages} page${totalPages > 1 ? 's' : ''})</h1>
    <div class="btns">
      <button class="primary" onclick="window.print()">Print / Save as PDF</button>
      <button onclick="window.close()">Close</button>
    </div>
  </div>

  ${pagesHtml}

  <script>
    (function(){
      var imgs = document.images, loaded = 0;
      function tryPrint(){ if(++loaded >= imgs.length){ setTimeout(function(){ window.focus(); window.print(); }, 300); } }
      if(imgs.length === 0){ setTimeout(function(){ window.focus(); window.print(); }, 300); return; }
      for(var i=0;i<imgs.length;i++){
        if(imgs[i].complete) tryPrint();
        else { imgs[i].addEventListener('load', tryPrint); imgs[i].addEventListener('error', tryPrint); }
      }
    })();
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1100,height=800');
  if (!w) {
    alert('Please allow popups to print the household registration.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
};

export const exportAllExcel = async (data, activeFilters) => {
  if (!data || data.length === 0) return;

  const now = new Date();

  // Filename logic matching exportAllJson
  const sanitize = (str) => String(str || '').trim().replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '_') || null;
  const today = now.toISOString().split('T')[0];
  const locationText = activeFilters.ward || activeFilters.group || activeFilters.village;
  const fileParts = [
    sanitize(activeFilters.district),
    sanitize(activeFilters.township),
    sanitize(locationText),
  ].filter(Boolean);
  const prefix = fileParts.length ? fileParts.join('_') : 'TPS_FullExport';
  const filename = `${prefix}_${today}.xlsx`;

  // Sort by household_no (natural sort order) and household_relationship priority
  const relationshipOrder = { 'ဦးစီး': 1, 'ဇနီး': 2, 'ခင်ပွန်း': 2, 'သား': 3, 'သမီး': 3 };
  const sortedData = [...data].sort((a, b) => {
    const hhA = String(a.household_no || '');
    const hhB = String(b.household_no || '');
    if (hhA !== hhB) {
      return hhA.localeCompare(hhB, undefined, { numeric: true, sensitivity: 'base' });
    }
    const orderA = relationshipOrder[a.household_relationship] || 99;
    const orderB = relationshipOrder[b.household_relationship] || 99;
    return orderA - orderB;
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Central Database');

  const applyBorder = (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  };

  // ── Exact English column headers expected by /upload (CsvUploader.jsx) at Row 1 ──
  const headers = [
    'Household No.',
    'Name',
    'Date of birth',
    'Gender',
    "Father's Name",
    "Mother's Name",
    'Household Relationship',
    'Occupation',
    'Previous ID No.',
    "Ta'ang Land ID No.",
    'Nationality',
    'Resident Status',
    'Religious',
    'House NO.',
    'Ward / Village / Group',
    'Township',
    'District',
    'Submission Date'
  ];

  const r1 = worksheet.getRow(1);
  headers.forEach((h, idx) => {
    const cell = r1.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Pyidaungsu', size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(cell);
  });
  r1.height = 26;

  // ── Member rows starting at Row 2 ──
  let currentHh = '';
  let hhCount = 0;

  sortedData.forEach((m, i) => {
    const rowIdx = 2 + i;
    const row = worksheet.getRow(rowIdx);

    if (m.household_no !== currentHh) {
      currentHh = m.household_no;
      hhCount++;
    }
    const isEvenHh = hhCount % 2 === 0;
    const bg = isEvenHh ? 'FFF5F5F5' : 'FFFFFFFF';

    // Must be raw database unformatted values so that they match exactly when imported!
    const cells = [
      { val: m.household_no, align: 'center' },
      { val: m.name, align: 'left', bold: true },
      { val: m.date_of_birth, align: 'center' },
      { val: m.gender, align: 'center' },
      { val: m.fathers_name, align: 'left' },
      { val: m.mothers_name, align: 'left' },
      { val: m.household_relationship, align: 'center' },
      { val: m.occupation, align: 'left' },
      { val: m.previous_id_no, align: 'center' },
      { val: m.taang_land_id_no, align: 'center' },
      { val: m.nationality, align: 'center' },
      { val: m.resident_status, align: 'center' },
      { val: m.religious, align: 'center' },
      { val: m.house_no, align: 'center' },
      { val: m.ward_village_group, align: 'left' },
      { val: m.township, align: 'left' },
      { val: m.district, align: 'left' },
      { val: m.submission_date || (m.created_at ? m.created_at.split('T')[0] : ''), align: 'center' }
    ];

    cells.forEach((c, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = c.val;
      cell.font = { name: 'Pyidaungsu', size: 10, bold: c.bold || false };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { horizontal: c.align, vertical: 'middle', wrapText: true };
      applyBorder(cell);
    });
    row.height = 22;
  });

  // Column key definitions matching headers for width calculations
  worksheet.columns = [
    { key: 'hhNo', width: 18 },
    { key: 'name', width: 24 },
    { key: 'dob', width: 14 },
    { key: 'gender', width: 9 },
    { key: 'father', width: 20 },
    { key: 'mother', width: 20 },
    { key: 'rel', width: 14 },
    { key: 'occ', width: 20 },
    { key: 'prevId', width: 18 },
    { key: 'taangId', width: 20 },
    { key: 'nat', width: 14 },
    { key: 'status', width: 14 },
    { key: 'religion', width: 12 },
    { key: 'houseNo', width: 12 },
    { key: 'ward', width: 20 },
    { key: 'township', width: 18 },
    { key: 'district', width: 16 },
    { key: 'subDate', width: 16 }
  ];

  // Adjust widths dynamically based on content length
  worksheet.columns.forEach((column) => {
    let maxLen = column.width || 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.row > 1 && cell.value) {
        let len = String(cell.value).length;
        if (len > maxLen) maxLen = len;
      }
    });
    column.width = Math.min(Math.max(maxLen + 4, 10), 32);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
