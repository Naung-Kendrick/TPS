import * as XLSX from 'xlsx';
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

  // ── Rows ─────────────────────────────────────────────────────────────────────
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

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Household Registration — ${safeHtml(householdNo)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; }
    body {
      font-family: 'Padauk', 'Myanmar Text', 'Times New Roman', Times, serif;
      font-size: 10.5px; color: #000; background: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page { position: relative; padding: 6px 10px 8px 10px; min-height: calc(100vh - 42px); display: flex; flex-direction: column; }
    .watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
    .watermark img { width: 44%; max-width: 420px; height: auto; opacity: 0.06; }
    .content { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; }
    .content .push { flex: 1; min-height: 12px; }

    /* ── Header ── */
    .header { display: flex; align-items: center; gap: 0; padding-bottom: 6px; margin-bottom: 5px; }
    .header .spacer { width: 70px; flex: 0 0 70px; }
    .header .center { flex: 1; text-align: center; }
    .header .center .title { font-size: 19px; font-weight: 700; letter-spacing: 0.5px; }
    .header .center .subtitle { font-size: 12px; margin-top: 2px; }
    .header .center .dept { font-size: 11px; margin-top: 2px; font-style: italic; }
    .header .flag { width: 70px; height: auto; flex: 0 0 70px; text-align: right; }
    .header .flag img { width: 60px; height: auto; display: inline-block; border: 1px solid #000; }
    .rule-double { border-top: 1px solid #000; border-bottom: 1px solid #000; height: 3px; margin: 0 0 8px 0; }

    /* ── Info table ── */
    .info { width: 100%; border-collapse: collapse; margin-bottom: 7px; font-size: 10.5px; }
    .info td { padding: 2px 4px; vertical-align: top; }
    .info .lbl { font-weight: 700; white-space: nowrap; }
    .info .val { border-bottom: 1px dotted #000; min-width: 60px; padding-bottom: 1px; }

    /* ── Data table ── */
    table.data { width: 100%; border-collapse: collapse; }
    table.data th, table.data td { border: 1px solid #000; padding: 3px 4px; font-size: 9.5px; vertical-align: middle; }
    table.data thead th { background: #ececec; font-weight: 700; text-align: center; }
    table.data tbody td { text-align: left; }
    table.data tbody td.num { text-align: center; }
    .head-badge { display: inline-block; margin-left: 3px; padding: 0 3px; border: 1px solid #000; font-size: 7.5px; font-weight: 700; letter-spacing: 0.5px; }

    /* ── Stats bar ── */
    .stats-bar {
      margin: 8px 0 6px;
      padding: 5px 10px;
      border: 1px solid #bbb;
      background: #f0f0f0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      display: flex; align-items: center; gap: 0;
      font-size: 10px; font-family: 'Segoe UI', Arial, sans-serif;
    }
    .stats-bar .item { padding: 0 12px; }
    .stats-bar .item:first-child { padding-left: 0; }
    .stats-bar .sep { color: #999; }
    .stats-bar b { font-weight: 700; }

    /* ── Signatures ── */
    .footer { margin-top: 22px; display: flex; justify-content: space-between; gap: 32px; }
    .sig { flex: 1; text-align: center; font-size: 10.5px; }
    .sig-line { border-top: 1px solid #000; margin: 30px 8% 4px 8%; }
    .sig .role { font-weight: 700; }
    .sig .name { font-style: italic; color: #333; margin-top: 1px; font-size: 9.5px; }

    /* ── Doc footer ── */
    .doc-footer { margin-top: 12px; padding-top: 4px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 9px; color: #333; }

    /* ── Print toolbar ── */
    .actions { position: sticky; top: 0; z-index: 10; background: #f4f4f4; border-bottom: 1px solid #ccc; padding: 7px 14px; display: flex; justify-content: space-between; align-items: center; font-family: 'Segoe UI', Arial, sans-serif; }
    .actions h1 { margin: 0; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #333; font-weight: 600; }
    .actions .btns button { background: #fff; color: #111; border: 1px solid #111; padding: 5px 14px; font-size: 11px; cursor: pointer; margin-left: 6px; }
    .actions .btns button.primary { background: #111; color: #fff; }
    @media print {
      .actions { display: none !important; }
      .page { padding: 0; min-height: 190mm; }
      table.data thead th { background: #ececec !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
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
    <div class="watermark"><img id="flagImg" src="${logoUrl}" alt="" /></div>

    <div class="content">
      <div class="header">
        <div class="spacer"></div>
        <div class="center">
          <div class="title">Ta'ang Land Government</div>
          <div class="subtitle">Ta'ang Land Immigration Department</div>
          <div class="dept">Household Registration &mdash; ${safeHtml(first.household_no || householdNo) || ''}</div>
        </div>
        <div class="flag"><img src="${flagUrl}" alt="Ta'ang Flag" /></div>
      </div>
      <div class="rule-double"></div>

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

      <!-- ── Summary stats bar ── -->
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
