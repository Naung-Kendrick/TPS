import * as XLSX from 'xlsx';
import taangFlag from '../assets/taang_flag.jpg';
import taangLogo from '../assets/logo.jpg';
import { buildExportFilename } from './exportFilename';

const escVal = (v) => (v === null || v === undefined ? '' : v);

const safeHtml = (v) => {
  if (v === null || v === undefined || v === '') return '';
  return String(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
};

export const exportHouseholdExcel = (householdNo, members) => {
  if (!members || members.length === 0) return;
  const first = members[0] || {};
  const aoa = [
    ['', '', '', '', '', "Ta'ang Land Government", '', '', '', '', '', '', '', "Ta'ang Flag"],
    ['', '', '', '', '', "Ta'ang Land Immigration Department"],
    [
      `District - ${escVal(first.district)}`, '', '', '',
      `Ward / Village / Group - ${escVal(first.ward_village_group)}`, '', '', '', '', '', '', '',
      `Household No. - ${escVal(first.household_no || householdNo)}`
    ],
    [
      `Township - ${escVal(first.township)}`, '', '', '', '', '', '', '', '', '', '', '',
      `House NO. - ${escVal(first.house_no)}`
    ],
    [],
    ['No.', 'Name', 'Date of birth', 'Gender', "Father's Name", "Mother's Name",
      'Household Relationship', 'Occupation', 'Previous ID No.', "Ta'ang Land ID No.",
      'Nationality', 'Resident Status', 'Religious', 'Submission Date'],
    ...members.map((m, i) => [
      i + 1,
      escVal(m.name),
      escVal(m.date_of_birth),
      escVal(m.gender),
      escVal(m.fathers_name),
      escVal(m.mothers_name),
      escVal(m.household_relationship),
      escVal(m.occupation),
      escVal(m.previous_id_no),
      escVal(m.taang_land_id_no),
      escVal(m.nationality),
      escVal(m.resident_status),
      escVal(m.religious),
      escVal(m.submission_date || (m.created_at ? m.created_at.split('T')[0] : ''))
    ])
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 5 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 5 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } },
    { s: { r: 2, c: 12 }, e: { r: 2, c: 13 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
    { s: { r: 3, c: 12 }, e: { r: 3, c: 13 } },
  ];
  ws['!cols'] = [
    { wch: 5 }, { wch: 18 }, { wch: 14 }, { wch: 8 }, { wch: 18 }, { wch: 18 },
    { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
    { wch: 12 }, { wch: 16 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Household');
  const head = members.find(m => m.household_relationship === 'ဦးစီး') || first;
  XLSX.writeFile(wb, buildExportFilename({
    type: 'household',
    district: first.district,
    township: first.township,
    ward: first.ward_village_group,
    householdNo,
    headName: head.name,
    ext: 'xlsx',
  }));
};

export const printHouseholdPdf = (householdNo, members) => {
  if (!members || members.length === 0) return;
  const first = members[0] || {};
  const rowsHtml = members.map((m, i) => `
    <tr>
      <td class="num">${i + 1}</td>
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
    </tr>
  `).join('');

  const flagUrl = new URL(taangFlag, window.location.href).href;
  const logoUrl = new URL(taangLogo, window.location.href).href;
  const now = new Date();
  const issuedOn = now.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: '2-digit' });
  const refNo = `TLID/HH/${safeHtml(householdNo) || '-----'}/${now.getFullYear()}`;
  const totalMembers = members.length;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Household Registration — ${safeHtml(householdNo)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Padauk', 'Myanmar Text', 'Times New Roman', Times, serif;
      font-size: 11px; color: #000; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .page { position: relative; padding: 6px 10px 10px 10px; }
    .watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
    .watermark img { width: 50%; max-width: 460px; height: auto; opacity: 0.06; }
    .content { position: relative; z-index: 1; }
    .header { display: flex; align-items: center; gap: 16px; padding-bottom: 8px; margin-bottom: 6px; }
    .header .logo { width: 78px; height: 78px; flex: 0 0 78px; }
    .header .logo img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .header .center { flex: 1; text-align: center; }
    .header .center .title { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header .center .subtitle { font-size: 13px; margin-top: 2px; }
    .header .center .dept { font-size: 12px; margin-top: 2px; font-style: italic; }
    .header .flag { width: 78px; height: auto; flex: 0 0 78px; }
    .header .flag img { width: 100%; height: auto; display: block; border: 1px solid #000; }
    .rule-double { border-top: 1px solid #000; border-bottom: 1px solid #000; height: 3px; margin: 0 0 10px 0; }
    .info { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
    .info td { padding: 3px 6px; vertical-align: top; }
    .info .lbl { font-weight: 700; white-space: nowrap; }
    .info .val { border-bottom: 1px dotted #000; min-width: 80px; padding-bottom: 1px; }
    table.data { width: 100%; border-collapse: collapse; }
    table.data th, table.data td { border: 1px solid #000; padding: 4px 5px; font-size: 10px; vertical-align: middle; }
    table.data thead th { background: #ececec; font-weight: 700; text-align: center; font-size: 10px; }
    table.data tbody td { text-align: left; }
    table.data tbody td.num { text-align: center; }
    .head-badge { display: inline-block; margin-left: 4px; padding: 0 4px; border: 1px solid #000; font-size: 8px; font-weight: 700; letter-spacing: 0.5px; }
    .footer { margin-top: 28px; display: flex; justify-content: space-between; gap: 40px; }
    .sig { flex: 1; text-align: center; font-size: 11px; }
    .sig-line { border-top: 1px solid #000; margin: 36px 8% 4px 8%; }
    .sig .role { font-weight: 700; }
    .sig .name { font-style: italic; color: #333; margin-top: 1px; font-size: 10px; }
    .doc-footer { margin-top: 16px; padding-top: 4px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 9px; color: #333; }
    .actions { position: sticky; top: 0; z-index: 10; background: #f4f4f4; border-bottom: 1px solid #ccc; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; font-family: 'Segoe UI', Arial, sans-serif; }
    .actions h1 { margin: 0; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #333; font-weight: 600; }
    .actions .btns button { background: #fff; color: #111; border: 1px solid #111; padding: 6px 14px; font-size: 11px; letter-spacing: 0.5px; cursor: pointer; margin-left: 6px; }
    .actions .btns button.primary { background: #111; color: #fff; }
    @media print { .actions { display: none; } .page { padding: 0; } }
  </style>
</head>
<body>
  <div class="actions">
    <h1>Household Registration — Print Preview</h1>
    <div class="btns">
      <button class="primary" onclick="window.print()">Print / Save as PDF</button>
      <button onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="page">
    <div class="watermark"><img id="flagImg" src="${logoUrl}" alt="Ta'ang Logo Watermark" /></div>

    <div class="content">
      <div class="header">
        <div class="logo"><img src="${logoUrl}" alt="Ta'ang Logo" /></div>
        <div class="center">
          <div class="title">Ta'ang Land Government</div>
          <div class="subtitle">Ta'ang Land Immigration Department</div>
          <div class="dept">Household Registration</div>
        </div>
        <div class="flag"><img src="${flagUrl}" alt="Ta'ang Flag" /></div>
      </div>
      <div class="rule-double"></div>

      <table class="info">
        <tr>
          <td style="width:50%"><span class="lbl">District:</span> <span class="val">${safeHtml(first.district) || '&nbsp;'}</span></td>
          <td style="width:50%" align="right"><span class="lbl">Household No.:</span> <span class="val">${safeHtml(first.household_no || householdNo) || '&nbsp;'}</span></td>
        </tr>
        <tr>
          <td><span class="lbl">Township:</span> <span class="val">${safeHtml(first.township) || '&nbsp;'}</span></td>
          <td align="right"><span class="lbl">House No.:</span> <span class="val">${safeHtml(first.house_no) || '&nbsp;'}</span></td>
        </tr>
        <tr>
          <td colspan="2"><span class="lbl">Ward / Village / Group:</span> <span class="val">${safeHtml(first.ward_village_group) || '&nbsp;'}</span></td>
        </tr>
      </table>

      <table class="data">
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
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div class="footer">
        <div class="sig">
          <div class="sig-line"></div>
          <div class="role">Head of Household</div>
          <div class="name">Signature &amp; Date</div>
        </div>
        <div class="sig">
          <div class="sig-line"></div>
          <div class="role">Verifying Officer</div>
          <div class="name">Name, Rank &amp; Signature</div>
        </div>
        <div class="sig">
          <div class="sig-line"></div>
          <div class="role">Authorising Officer</div>
          <div class="name">Ta'ang Land Immigration Dept.</div>
        </div>
      </div>

      <div class="doc-footer">
        <span>Ref. ${safeHtml(refNo)}</span>
        <span>Total Members: ${totalMembers}</span>
        <span>Issued: ${safeHtml(issuedOn)}</span>
      </div>
    </div>
  </div>

  <script>
    (function(){
      function doPrint(){ setTimeout(function(){ window.focus(); window.print(); }, 200); }
      var img = document.getElementById('flagImg');
      if (img && !img.complete) {
        img.addEventListener('load', doPrint);
        img.addEventListener('error', doPrint);
      } else {
        window.addEventListener('load', doPrint);
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
