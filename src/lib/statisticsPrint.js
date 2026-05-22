import * as XLSX from 'xlsx';
import taangFlag from '../assets/taang_flag.jpg';
import taangLogo from '../assets/fonts/IDTL_logo.png';

const safeHtml = (v) => {
  if (v === null || v === undefined || v === '') return '';
  return String(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
};

const toMM = (num) => {
  if (num === null || num === undefined) return '0';
  const map = { '0':'၀','1':'၁','2':'၂','3':'၃','4':'၄','5':'၅','6':'၆','7':'၇','8':'၈','9':'၉' };
  return String(num).replace(/[0-9]/g, d => map[d]);
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export const exportStatisticsExcel = ({
  groupLabel, wardStats, totalStats, allReligions, allNationalities,
  selectedDistrict, selectedTownship, selectedWard, selectedGroup, selectedVillage,
  isAtWardLevel, wardStatsList, villageStatsList, groupStatsList,
}) => {
  const wb = XLSX.utils.book_new();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');

  const parts = [];
  if (selectedDistrict) parts.push(`District: ${selectedDistrict}`);
  if (selectedTownship) parts.push(`Township: ${selectedTownship}`);
  if (selectedWard)     parts.push(`Ward: ${selectedWard}`);
  if (selectedGroup)    parts.push(`Group: ${selectedGroup}`);
  if (selectedVillage)  parts.push(`Village: ${selectedVillage}`);
  const filterLine = parts.length > 0 ? parts.join(' | ') : 'All Districts';

  // ── Sheet 1: Population, Age, Religion ──────────────────────────────────────
  const relHeaders = allReligions.map(r => r);
  const hdr1 = [
    "Ta'ang Land Immigration Department — Population Statistics",
    '', '', '', '', '', '', '', '', '', '', '', '', ...relHeaders.map(() => '')
  ];
  const hdr2 = [`Filter: ${filterLine}`, `Printed: ${dateStr}`];
  const hdr3 = [];
  const hdr4 = [
    'No.', groupLabel, 'Households',
    'Male', 'Female', 'Total',
    '<16 Male', '<16 Female', '<16 Total',
    '16-60 Male', '16-60 Female', '16-60 Total',
    '>60 Male', '>60 Female', '>60 Total',
    ...relHeaders
  ];

  const dataRows1 = wardStats.map((w, i) => [
    i + 1, w.name, w.households,
    w.male, w.female, w.total,
    w.u16m, w.u16f, w.u16m + w.u16f,
    w.b1660m, w.b1660f, w.b1660m + w.b1660f,
    w.a60m, w.a60f, w.a60m + w.a60f,
    ...allReligions.map(r => w.relCounts[r] || 0)
  ]);

  const totalRow1 = [
    '', 'TOTAL', totalStats.households,
    totalStats.male, totalStats.female, totalStats.total,
    totalStats.u16m, totalStats.u16f, totalStats.u16m + totalStats.u16f,
    totalStats.b1660m, totalStats.b1660f, totalStats.b1660m + totalStats.b1660f,
    totalStats.a60m, totalStats.a60f, totalStats.a60m + totalStats.a60f,
    ...allReligions.map(r => totalStats.relCounts[r] || 0)
  ];

  const aoa1 = [hdr1, hdr2, hdr3, hdr4, ...dataRows1, totalRow1];
  const ws1 = XLSX.utils.aoa_to_sheet(aoa1);

  const colCount1 = hdr4.length;
  ws1['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount1 - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount1 - 1 } },
  ];
  ws1['!cols'] = [
    { wch: 5 }, { wch: 22 }, { wch: 11 },
    { wch: 9 }, { wch: 9 }, { wch: 10 },
    { wch: 9 }, { wch: 9 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 9 }, { wch: 9 }, { wch: 10 },
    ...allReligions.map(() => ({ wch: 18 }))
  ];
  ws1['!rows'] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 12 }, { hpt: 36 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Population, Age, Religion');

  // ── Sheet 2: Nationality ─────────────────────────────────────────────────────
  const natHeaders = allNationalities.map(n => n);
  const hdr4b = [
    'No.', groupLabel, 'Male', 'Female', 'Total',
    ...natHeaders
  ];

  const dataRows2 = wardStats.map((w, i) => [
    i + 1, w.name, w.male, w.female, w.total,
    ...allNationalities.map(n => w.natCounts[n] || 0)
  ]);

  const totalRow2 = [
    '', 'TOTAL', totalStats.male, totalStats.female, totalStats.total,
    ...allNationalities.map(n => totalStats.natCounts[n] || 0)
  ];

  const aoa2 = [
    ["Ta'ang Land Immigration Department — Nationality Statistics"],
    [`Filter: ${filterLine}`, `Printed: ${dateStr}`],
    [],
    hdr4b,
    ...dataRows2,
    totalRow2
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
  const colCount2 = hdr4b.length;
  ws2['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount2 - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount2 - 1 } },
  ];
  ws2['!cols'] = [
    { wch: 5 }, { wch: 22 }, { wch: 9 }, { wch: 9 }, { wch: 10 },
    ...allNationalities.map(() => ({ wch: 18 })),
    { wch: 14 }
  ];
  ws2['!rows'] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 12 }, { hpt: 36 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Nationality');

  const suffix = selectedVillage || selectedGroup || selectedWard || selectedTownship || selectedDistrict || 'All';
  const filename = `TPS_Statistics_${suffix.replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_')}_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, filename);
};

// ─────────────────────────────────────────────────────────────────────────────
// PRINT — Legal size (8.5" × 14") landscape
// ─────────────────────────────────────────────────────────────────────────────
export const printStatistics = ({
  groupLabel, wardStats, totalStats, allReligions, allNationalities,
  selectedDistrict, selectedTownship, selectedWard, selectedGroup, selectedVillage,
  isAtWardLevel, wardStatsList, villageStatsList, groupStatsList,
}) => {
  const flagUrl  = new URL(taangFlag,  window.location.href).href;
  const logoUrl  = new URL(taangLogo, window.location.href).href;
  const now      = new Date();
  const dateStr  = now.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: '2-digit' });

  const parts = [];
  if (selectedDistrict) parts.push(selectedDistrict);
  if (selectedTownship) parts.push(selectedTownship);
  if (selectedWard)     parts.push(selectedWard);
  if (selectedGroup)    parts.push(selectedGroup);
  if (selectedVillage)  parts.push(selectedVillage);
  const filterLine = parts.length > 0 ? parts.join(' / ') : 'All Districts';

  const levelSuffix = selectedTownship
    ? '(WARD / GROUP / VILLAGE)'
    : selectedDistrict
      ? '(TOWNSHIP)'
      : '(DISTRICT)';

  // ── Helpers ──────────────────────────────────────────────────────────────────
  // Fit everything on one page - no chunking

  // ── Table 1: Population, Age, Religion ──────────────────────────────────────
  const relThs = allReligions.map(r => `<th class="vertical">${safeHtml(r)}</th>`).join('');

  const table1Header = `
    <thead>
      <tr>
        <th rowspan="2" style="width:3%">စဉ်</th>
        <th rowspan="2" style="min-width:70px">${safeHtml(groupLabel)}</th>
        <th rowspan="2">အထစ</th>
        <th colspan="3" class="group-header">လူဦးရေပေါင်း</th>
        <th colspan="3" class="group-header">၁၆ နှစ်အောက်</th>
        <th colspan="3" class="group-header">၁၆ - ၆၀ နှစ်</th>
        <th colspan="3" class="group-header">၆၀ နှစ်အထက်</th>
        ${allReligions.length > 0 ? `<th colspan="${allReligions.length}" class="group-header">ကိုးကွယ်သည့်ဘာသာ</th>` : ''}
      </tr>
      <tr>
        <th>ကျား</th><th>မ</th><th>ပေါင်း</th>
        <th>ကျား</th><th>မ</th><th>ပေါင်း</th>
        <th>ကျား</th><th>မ</th><th>ပေါင်း</th>
        <th>ကျား</th><th>မ</th><th>ပေါင်း</th>
        ${relThs}
      </tr>
    </thead>`;

  const makeTable1Row = (w, i) => `
    <tr>
      <td class="num">${toMM(i + 1)}</td>
      <td class="name">${safeHtml(w.name)}</td>
      <td class="num">${toMM(w.households)}</td>
      <td class="num">${toMM(w.male)}</td>
      <td class="num">${toMM(w.female)}</td>
      <td class="num bold green">${toMM(w.total)}</td>
      <td class="num">${toMM(w.u16m)}</td>
      <td class="num">${toMM(w.u16f)}</td>
      <td class="num">${toMM(w.u16m + w.u16f)}</td>
      <td class="num">${toMM(w.b1660m)}</td>
      <td class="num">${toMM(w.b1660f)}</td>
      <td class="num">${toMM(w.b1660m + w.b1660f)}</td>
      <td class="num">${toMM(w.a60m)}</td>
      <td class="num">${toMM(w.a60f)}</td>
      <td class="num">${toMM(w.a60m + w.a60f)}</td>
      ${allReligions.map(r => `<td class="num">${w.relCounts[r] ? toMM(w.relCounts[r]) : '-'}</td>`).join('')}
    </tr>`;

  const table1TotalRow = `
    <tr class="total-row">
      <td class="num"></td>
      <td class="name bold">စုစုပေါင်း</td>
      <td class="num bold">${toMM(totalStats.households)}</td>
      <td class="num bold">${toMM(totalStats.male)}</td>
      <td class="num bold">${toMM(totalStats.female)}</td>
      <td class="num bold green">${toMM(totalStats.total)}</td>
      <td class="num bold">${toMM(totalStats.u16m)}</td>
      <td class="num bold">${toMM(totalStats.u16f)}</td>
      <td class="num bold">${toMM(totalStats.u16m + totalStats.u16f)}</td>
      <td class="num bold">${toMM(totalStats.b1660m)}</td>
      <td class="num bold">${toMM(totalStats.b1660f)}</td>
      <td class="num bold">${toMM(totalStats.b1660m + totalStats.b1660f)}</td>
      <td class="num bold">${toMM(totalStats.a60m)}</td>
      <td class="num bold">${toMM(totalStats.a60f)}</td>
      <td class="num bold">${toMM(totalStats.a60m + totalStats.a60f)}</td>
      ${allReligions.map(r => `<td class="num bold">${totalStats.relCounts[r] ? toMM(totalStats.relCounts[r]) : '-'}</td>`).join('')}
    </tr>`;

  const makeTable1Block = (title, colLabel, statsArr) => {
    if (!statsArr || statsArr.length === 0) return '';
    const hdr = `
      <thead>
        <tr>
          <th rowspan="2" style="width:3%">စဉ်</th>
          <th rowspan="2" style="min-width:70px">${safeHtml(colLabel)}</th>
          <th rowspan="2">အထစ</th>
          <th colspan="3" class="group-header">လူဦးရေပေါင်း</th>
          <th colspan="3" class="group-header">၁၆ နှစ်အောက်</th>
          <th colspan="3" class="group-header">၁၆ - ၆၀ နှစ်</th>
          <th colspan="3" class="group-header">၆၀ နှစ်အထက်</th>
          ${allReligions.length > 0 ? `<th colspan="${allReligions.length}" class="group-header">ကိုးကွယ်သည့်ဘာသာ</th>` : ''}
        </tr>
        <tr>
          <th>ကျား</th><th>မ</th><th>ပေါင်း</th>
          <th>ကျား</th><th>မ</th><th>ပေါင်း</th>
          <th>ကျား</th><th>မ</th><th>ပေါင်း</th>
          <th>ကျား</th><th>မ</th><th>ပေါင်း</th>
          ${relThs}
        </tr>
      </thead>`;
    const rows = statsArr.map((w, i) => makeTable1Row(w, i)).join('');
    const totR = `
      <tr class="total-row">
        <td class="num"></td>
        <td class="name bold">စုစုပေါင်း</td>
        <td class="num bold">${toMM(totalStats.households)}</td>
        <td class="num bold">${toMM(totalStats.male)}</td>
        <td class="num bold">${toMM(totalStats.female)}</td>
        <td class="num bold green">${toMM(totalStats.total)}</td>
        <td class="num bold">${toMM(totalStats.u16m)}</td>
        <td class="num bold">${toMM(totalStats.u16f)}</td>
        <td class="num bold">${toMM(totalStats.u16m + totalStats.u16f)}</td>
        <td class="num bold">${toMM(totalStats.b1660m)}</td>
        <td class="num bold">${toMM(totalStats.b1660f)}</td>
        <td class="num bold">${toMM(totalStats.b1660m + totalStats.b1660f)}</td>
        <td class="num bold">${toMM(totalStats.a60m)}</td>
        <td class="num bold">${toMM(totalStats.a60f)}</td>
        <td class="num bold">${toMM(totalStats.a60m + totalStats.a60f)}</td>
        ${allReligions.map(r => `<td class="num bold">${totalStats.relCounts[r] ? toMM(totalStats.relCounts[r]) : '-'}</td>`).join('')}
      </tr>`;
    return `<div class="section-title">${safeHtml(title)}</div><table>${hdr}<tbody>${rows}${totR}</tbody></table>`;
  };

  const prefixedVillageStats = selectedGroup
    ? (villageStatsList || []).map(v => ({ ...v, name: `${selectedGroup} — ${v.name}` }))
    : (villageStatsList || []);

  const table1Html = isAtWardLevel
    ? [
        makeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (WARDS)', 'ရပ်ကွက်', wardStatsList || []),
        makeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (GROUPS)', 'ကျေးရွာအုပ်စု', groupStatsList || []),
        makeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (VILLAGES)', 'ကျေးရွာ', prefixedVillageStats),
      ].join('')
    : `<div class="section-title">SUMMARY TABLE (1) — POPULATION, AGE &amp; RELIGION ${safeHtml(levelSuffix)}</div>
       <table>${table1Header}<tbody>${wardStats.map((w, i) => makeTable1Row(w, i)).join('')}${table1TotalRow}</tbody></table>`;

  // ── Table 2: Nationality ─────────────────────────────────────────────────────
  const natThs = allNationalities.map(n => `<th class="vertical">${safeHtml(n)}</th>`).join('');

  const makeTable2Block = (title, colLabel, statsArr) => {
    if (!statsArr || statsArr.length === 0) return '';
    const hdr = `
      <thead>
        <tr>
          <th rowspan="2" style="width:3%">စဉ်</th>
          <th rowspan="2" style="min-width:70px">${safeHtml(colLabel)}</th>
          <th colspan="3" class="group-header">လူဦးရေပေါင်း</th>
          ${allNationalities.length > 0 ? `<th colspan="${allNationalities.length}" class="group-header">လူမျိုးအလိုက်</th>` : ''}
        </tr>
        <tr>
          <th>ကျား</th><th>မ</th><th>ပေါင်း</th>
          ${natThs}
        </tr>
      </thead>`;
    const rows = statsArr.map((w, i) => `
      <tr>
        <td class="num">${toMM(i + 1)}</td>
        <td class="name">${safeHtml(w.name)}</td>
        <td class="num">${toMM(w.male)}</td>
        <td class="num">${toMM(w.female)}</td>
        <td class="num bold green">${toMM(w.total)}</td>
        ${allNationalities.map(n => `<td class="num">${w.natCounts[n] ? toMM(w.natCounts[n]) : '-'}</td>`).join('')}
      </tr>`).join('');
    const totR = `
      <tr class="total-row">
        <td class="num"></td>
        <td class="name bold">စုစုပေါင်း</td>
        <td class="num bold">${toMM(totalStats.male)}</td>
        <td class="num bold">${toMM(totalStats.female)}</td>
        <td class="num bold green">${toMM(totalStats.total)}</td>
        ${allNationalities.map(n => `<td class="num bold">${totalStats.natCounts[n] ? toMM(totalStats.natCounts[n]) : '-'}</td>`).join('')}
      </tr>`;
    return `<div class="section-title">${safeHtml(title)}</div><table>${hdr}<tbody>${rows}${totR}</tbody></table>`;
  };

  const makeTable2Row = (w, i) => `
    <tr>
      <td class="num">${toMM(i + 1)}</td>
      <td class="name">${safeHtml(w.name)}</td>
      <td class="num">${toMM(w.male)}</td>
      <td class="num">${toMM(w.female)}</td>
      <td class="num bold green">${toMM(w.total)}</td>
      ${allNationalities.map(n => `<td class="num">${w.natCounts[n] ? toMM(w.natCounts[n]) : '-'}</td>`).join('')}
    </tr>`;

  const table2TotalRow = `
    <tr class="total-row">
      <td class="num"></td>
      <td class="name bold">စုစုပေါင်း</td>
      <td class="num bold">${toMM(totalStats.male)}</td>
      <td class="num bold">${toMM(totalStats.female)}</td>
      <td class="num bold green">${toMM(totalStats.total)}</td>
      ${allNationalities.map(n => `<td class="num bold">${totalStats.natCounts[n] ? toMM(totalStats.natCounts[n]) : '-'}</td>`).join('')}
    </tr>`;

  const table2Header = `
    <thead>
      <tr>
        <th rowspan="2" style="width:3%">စဉ်</th>
        <th rowspan="2" style="min-width:70px">${safeHtml(groupLabel)}</th>
        <th colspan="3" class="group-header">လူဦးရေပေါင်း</th>
        ${allNationalities.length > 0 ? `<th colspan="${allNationalities.length}" class="group-header">လူမျိုးအလိုက်</th>` : ''}
      </tr>
      <tr>
        <th>ကျား</th><th>မ</th><th>ပေါင်း</th>
        ${natThs}
      </tr>
    </thead>`;

  const table2Html = isAtWardLevel
    ? [
        makeTable2Block('SUMMARY TABLE (2) — NATIONALITY (WARDS)', 'ရပ်ကွက်', wardStatsList || []),
        makeTable2Block('SUMMARY TABLE (2) — NATIONALITY (GROUPS)', 'ကျေးရွာအုပ်စု', groupStatsList || []),
        makeTable2Block('SUMMARY TABLE (2) — NATIONALITY (VILLAGES)', 'ကျေးရွာ', prefixedVillageStats),
      ].join('')
    : `<div class="section-title">SUMMARY TABLE (2) — NATIONALITY ${levelSuffix}</div>
       <table>${table2Header}<tbody>${wardStats.map((w, i) => makeTable2Row(w, i)).join('')}${table2TotalRow}</tbody></table>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Population Statistics — ${safeHtml(filterLine)}</title>
  <style>
    @page { size: legal landscape; margin: 5mm 6mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Padauk', 'Myanmar Text', 'Times New Roman', Times, serif;
      font-size: 8.5px; color: #000; background: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* ── Toolbar (screen only) ── */
    .toolbar {
      position: sticky; top: 0; z-index: 10;
      background: #f4f4f4; border-bottom: 1px solid #ccc;
      padding: 7px 14px; display: flex; justify-content: space-between; align-items: center;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .toolbar h1 { margin: 0; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #333; font-weight: 600; }
    .toolbar .btns button { background: #fff; color: #111; border: 1px solid #111; padding: 5px 14px; font-size: 11px; cursor: pointer; margin-left: 6px; }
    .toolbar .btns button.primary { background: #111; color: #fff; }
    @media print { .toolbar { display: none !important; } }

    /* ── Watermark ── */
    .watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
    .watermark img { width: 38%; max-width: 380px; opacity: 0.055; }

    /* ── Page wrapper ── */
    .page { position: relative; z-index: 1; padding: 2px 4px 4px; }

    /* ── Header ── */
    .header { display: flex; align-items: center; padding-bottom: 3px; margin-bottom: 2px; }
    .header .logo { width: 44px; flex: 0 0 44px; }
    .header .logo img { width: 40px; height: auto; }
    .header .center { flex: 1; text-align: center; }
    .header .center .org { font-size: 11px; font-weight: 700; letter-spacing: 0.4px; }
    .header .center .dept { font-size: 9px; margin-top: 1px; }
    .header .center .doc-title { font-size: 9px; margin-top: 2px; font-style: italic; color: #333; }
    .header .flag { width: 44px; flex: 0 0 44px; text-align: right; }
    .header .flag img { width: 38px; height: auto; border: 1px solid #000; }
    .rule { border-top: 1px solid #000; border-bottom: 1px solid #000; height: 2px; margin: 0 0 4px; }

    /* ── Filter line ── */
    .filter-bar {
      font-size: 8px; margin-bottom: 4px;
      display: flex; justify-content: space-between; align-items: center;
      border: 1px solid #ccc; padding: 2px 6px; background: #f9f9f9;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }

    /* ── Section title ── */
    .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 6px 0 3px; border-bottom: 1px solid #000; padding-bottom: 2px; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
    th, td { border: 1px solid #000; padding: 2px 3px; font-size: 8px; vertical-align: middle; line-height: 1.15; }
    thead th { background: #e8e8e8 !important; font-weight: 700; text-align: center;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    th.group-header { background: #d4d4d4 !important; }
    th.vertical { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; padding: 4px 2px; font-size: 7px; }
    td.num { text-align: center; font-family: 'Courier New', monospace; }
    td.name { text-align: left; font-weight: 500; white-space: normal; word-break: break-word; min-width: 80px; max-width: 140px; }
    td.bold { font-weight: 700; }
    td.green { color: #2E7D32; }
    tr.total-row td { background: #f0f0f0 !important; font-weight: 700;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    /* ── Doc footer ── */
    .doc-footer { margin-top: 6px; padding-top: 2px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 7px; color: #444; }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>Population Statistics — Print Preview</h1>
    <div class="btns">
      <button class="primary" onclick="window.print()">Print / Save as PDF</button>
      <button onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="watermark"><img src="${logoUrl}" alt="" /></div>

  <div class="page">
    <!-- ── Header ── -->
    <div class="header">
      <div class="logo"><img src="${logoUrl}" alt="IDTL Logo" /></div>
      <div class="center">
        <div class="org">Ta'ang Land Government</div>
        <div class="dept">Ta'ang Land Immigration Department (IDTL)</div>
        <div class="doc-title">Population Statistics Report</div>
      </div>
      <div class="flag"><img src="${flagUrl}" alt="Ta'ang Flag" /></div>
    </div>
    <div class="rule"></div>

    <div class="filter-bar">
      <span><b>Location Filter:</b> ${safeHtml(filterLine)}</span>
      <span><b>Printed:</b> ${safeHtml(dateStr)}</span>
    </div>

    ${table1Html}
    ${table2Html}

    <div class="doc-footer">
      <span>Ta'ang Land Immigration Department &mdash; Confidential</span>
      <span>Printed: ${safeHtml(dateStr)}</span>
    </div>
  </div>

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

  const w = window.open('', '_blank', 'width=1300,height=860');
  if (!w) { alert('Please allow popups to print the statistics report.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
};
