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

// Normalize mixed nationalities for display (e.g., 'ဗမာ+ရှမ်း' → 'ဗမာ')
// Database keeps original, UI/Print shows only first nationality
const normalizeNationalityDisplay = (nationality) => {
  if (!nationality || typeof nationality !== 'string') return nationality;
  // Split by + or / and take the first part, then trim
  const firstPart = nationality.split(/[+\/]/)[0];
  return firstPart ? firstPart.trim() : nationality;
};

// Get unique normalized nationalities sorted by total count desc
const getUniqueNormalizedNats = (allNationalities, natCounts) => {
  const aggregated = allNationalities.reduce((acc, n) => {
    const normalized = normalizeNationalityDisplay(n);
    const count = natCounts?.[n] || 0;
    acc[normalized] = (acc[normalized] || 0) + count;
    return acc;
  }, {});
  return Object.entries(aggregated)
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
};

// Get aggregated count for a normalized nationality
const getAggregatedNatCount = (natCounts, normalizedNat, allNationalities) => {
  if (!natCounts) return 0;
  return allNationalities.reduce((sum, n) => {
    if (normalizeNationalityDisplay(n) === normalizedNat) {
      return sum + (natCounts[n] || 0);
    }
    return sum;
  }, 0);
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
  // Use normalized aggregated nationalities (same as UI display)
  const uniqueNormalizedNats = getUniqueNormalizedNats(allNationalities, totalStats.natCounts);
  const natHeaders = uniqueNormalizedNats;
  const hdr4b = [
    'No.', groupLabel, 'Male', 'Female', 'Total',
    ...natHeaders
  ];

  const dataRows2 = wardStats.map((w, i) => [
    i + 1, w.name, w.male, w.female, w.total,
    ...uniqueNormalizedNats.map(n => getAggregatedNatCount(w.natCounts, n, allNationalities))
  ]);

  const totalRow2 = [
    '', 'TOTAL', totalStats.male, totalStats.female, totalStats.total,
    ...uniqueNormalizedNats.map(n => {
      const aggregated = allNationalities.reduce((sum, raw) => {
        if (normalizeNationalityDisplay(raw) === n) {
          return sum + (totalStats.natCounts?.[raw] || 0);
        }
        return sum;
      }, 0);
      return aggregated;
    })
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
    ...uniqueNormalizedNats.map(() => ({ wch: 18 })),
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
  // Limit religion columns to prevent overflow, use narrow width for vertical headers
  const MAX_REL_COLS = 15;
  const displayReligions = allReligions.slice(0, MAX_REL_COLS);
  const hasMoreReligions = allReligions.length > MAX_REL_COLS;
  const relThs = displayReligions.map(r => `<th class="vertical" style="width:28px">${safeHtml(r)}</th>`).join('');

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
      ${displayReligions.map(r => `<td class="num">${w.relCounts[r] ? toMM(w.relCounts[r]) : '-'}</td>`).join('')}
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
      ${displayReligions.map(r => `<td class="num bold">${totalStats.relCounts[r] ? toMM(totalStats.relCounts[r]) : '-'}</td>`).join('')}
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
          ${displayReligions.length > 0 ? `<th colspan="${displayReligions.length}" class="group-header">ကိုးကွယ်သည့်ဘာသာ</th>` : ''}
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
        ${displayReligions.map(r => `<td class="num bold">${totalStats.relCounts[r] ? toMM(totalStats.relCounts[r]) : '-'}</td>`).join('')}
      </tr>`;
    const truncationNote = hasMoreReligions 
      ? `<div style="font-size:8px;color:#666;margin-top:4px;font-style:italic;">Showing top ${MAX_REL_COLS} of ${allReligions.length} religions. View full statistics online.</div>` 
      : '';
    return `<div class="section-title">${safeHtml(title)}</div><table>${hdr}<tbody>${rows}${totR}</tbody></table>${truncationNote}`;
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
  // Use normalized aggregated nationalities (same as UI display)
  // Limit nationality columns to prevent overflow, use narrow width for vertical headers
  const uniqueNormalizedNats = getUniqueNormalizedNats(allNationalities, totalStats.natCounts);
  const MAX_NAT_COLS = 12;
  const displayNats = uniqueNormalizedNats.slice(0, MAX_NAT_COLS);
  const hasMoreNats = uniqueNormalizedNats.length > MAX_NAT_COLS;
  const natThs = displayNats.map(n => `<th class="vertical" style="width:32px">${safeHtml(n)}</th>`).join('');

  const makeTable2Block = (title, colLabel, statsArr) => {
    if (!statsArr || statsArr.length === 0) return '';
    const hdr = `
      <thead>
        <tr>
          <th rowspan="2" style="width:3%">စဉ်</th>
          <th rowspan="2" style="min-width:70px">${safeHtml(colLabel)}</th>
          <th colspan="3" class="group-header">လူဦးရေပေါင်း</th>
          ${displayNats.length > 0 ? `<th colspan="${displayNats.length}" class="group-header">လူမျိုးအလိုက်</th>` : ''}
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
        ${displayNats.map(n => `<td class="num">${toMM(getAggregatedNatCount(w.natCounts, n, allNationalities)) || '-'}</td>`).join('')}
      </tr>`).join('');
    const totR = `
      <tr class="total-row">
        <td class="num"></td>
        <td class="name bold">စုစုပေါင်း</td>
        <td class="num bold">${toMM(totalStats.male)}</td>
        <td class="num bold">${toMM(totalStats.female)}</td>
        <td class="num bold green">${toMM(totalStats.total)}</td>
        ${displayNats.map(n => `<td class="num bold">${toMM(getAggregatedNatCount(totalStats.natCounts, n, allNationalities)) || '-'}</td>`).join('')}
      </tr>`;
    const natTruncationNote = hasMoreNats 
      ? `<div style="font-size:8px;color:#666;margin-top:4px;font-style:italic;">Showing top ${MAX_NAT_COLS} of ${uniqueNormalizedNats.length} nationalities. View full statistics online.</div>` 
      : '';
    return `<div class="section-title">${safeHtml(title)}</div><table>${hdr}<tbody>${rows}${totR}</tbody></table>${natTruncationNote}`;
  };

  const makeTable2Row = (w, i) => `
    <tr>
      <td class="num">${toMM(i + 1)}</td>
      <td class="name">${safeHtml(w.name)}</td>
      <td class="num">${toMM(w.male)}</td>
      <td class="num">${toMM(w.female)}</td>
      <td class="num bold green">${toMM(w.total)}</td>
      ${displayNats.map(n => `<td class="num">${toMM(getAggregatedNatCount(w.natCounts, n, allNationalities)) || '-'}</td>`).join('')}
    </tr>`;

  const table2TotalRow = `
    <tr class="total-row">
      <td class="num"></td>
      <td class="name bold">စုစုပေါင်း</td>
      <td class="num bold">${toMM(totalStats.male)}</td>
      <td class="num bold">${toMM(totalStats.female)}</td>
      <td class="num bold green">${toMM(totalStats.total)}</td>
      ${displayNats.map(n => `<td class="num bold">${toMM(getAggregatedNatCount(totalStats.natCounts, n, allNationalities)) || '-'}</td>`).join('')}
    </tr>`;

  const table2Header = `
    <thead>
      <tr>
        <th rowspan="2" style="width:3%">စဉ်</th>
        <th rowspan="2" style="min-width:70px">${safeHtml(groupLabel)}</th>
        <th colspan="3" class="group-header">လူဦးရေပေါင်း</th>
        ${displayNats.length > 0 ? `<th colspan="${displayNats.length}" class="group-header">လူမျိုးအလိုက်</th>` : ''}
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
      font-family: 'Pyidaungsu', 'Padauk', 'Myanmar Text', 'Times New Roman', Times, serif;
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
    .section-title { 
      font-size: 10px; 
      font-weight: 700; 
      text-transform: uppercase; 
      letter-spacing: 0.8px; 
      margin: 10px 0 6px; 
      border-bottom: 2px solid #1A1A1A; 
      padding-bottom: 4px;
      color: #1A1A1A;
    }

    /* ── Table ── */
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 12px; 
      table-layout: fixed;
      border: 2px solid #000000;
    }
    th, td { 
      border: 1px solid #000000;
      padding: 10px 14px; 
      font-size: 9px; 
      vertical-align: middle; 
      line-height: 1.6;
      white-space: nowrap;
    }
    thead th { 
      background: #E8E8E8 !important; 
      font-weight: 700; 
      text-align: center;
      color: #000000;
      letter-spacing: 0.3px;
      border-bottom: 2px solid #000000;
      border-top: 1px solid #000000;
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }
    thead th:first-child { border-left: 1px solid #000000; }
    thead th:last-child { border-right: 1px solid #000000; }
    th.group-header { 
      background: #D4D4D4 !important; 
      color: #000000;
      font-weight: 700;
      border-bottom: 2px solid #000000;
    }
    th.vertical { 
      writing-mode: vertical-rl; 
      transform: rotate(180deg); 
      white-space: nowrap; 
      padding: 12px 6px; 
      font-size: 8px;
      line-height: 1.4;
    }
    td { 
      border: 1px solid #000000;
      background: #FFFFFF;
    }
    td.num { 
      text-align: center; 
      font-family: 'Courier New', monospace; 
      font-weight: 500;
      color: #000000;
    }
    td.name { 
      text-align: left; 
      font-weight: 500; 
      white-space: nowrap;
    }
    td.bold { font-weight: 700; }
    td.green { 
      color: #000000; 
      font-weight: 700;
    }
    tbody tr:nth-child(even) td {
      background: #F5F5F5;
    }
    tbody tr:hover td {
      background: #E8E8E8;
    }
    tr.total-row td { 
      background: #E8E8E8 !important; 
      font-weight: 700;
      border-top: 2px solid #000000;
      border-bottom: 2px solid #000000;
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }

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


// ─────────────────────────────────────────────────────────────────────────────
// PRINT — Demographic Dashboard (legal landscape)
// ─────────────────────────────────────────────────────────────────────────────
export const printDemographicDashboard = ({
  totalStats, allReligions, allNationalities, allOccupations,
  selectedDistrict, selectedTownship, selectedWard, selectedGroup, selectedVillage,
}) => {
  const flagUrl = new URL(taangFlag,  window.location.href).href;
  const logoUrl = new URL(taangLogo, window.location.href).href;
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: '2-digit' });

  const parts = [];
  if (selectedDistrict) parts.push(selectedDistrict);
  if (selectedTownship) parts.push(selectedTownship);
  if (selectedWard)     parts.push(selectedWard);
  if (selectedGroup)    parts.push(selectedGroup);
  if (selectedVillage)  parts.push(selectedVillage);
  const filterLine = parts.length > 0 ? parts.join(' / ') : 'All Districts';

  const total  = totalStats.total  || 0;
  const male   = totalStats.male   || 0;
  const female = totalStats.female || 0;
  const withId = totalStats.withId || 0;
  const idPct  = total > 0 ? ((withId / total) * 100).toFixed(1) : '0.0';

  // ── Age group rows ────────────────────────────────────────────────────────
  const AGE_GROUPS = [
    { labelEn: '0–4',   mKey: 'ag0_4m',   fKey: 'ag0_4f'   },
    { labelEn: '5–13',  mKey: 'ag5_13m',  fKey: 'ag5_13f'  },
    { labelEn: '14–17', mKey: 'ag14_17m', fKey: 'ag14_17f' },
    { labelEn: '18–25', mKey: 'ag18_25m', fKey: 'ag18_25f' },
    { labelEn: '26–59', mKey: 'ag26_59m', fKey: 'ag26_59f' },
    { labelEn: '60+',   mKey: 'ag60pm',   fKey: 'ag60pf'   },
  ];

  const maxSide = Math.max(...AGE_GROUPS.map(x => Math.max(totalStats[x.mKey] || 0, totalStats[x.fKey] || 0)), 1);

  const ageRows = [...AGE_GROUPS].reverse().map(g => {
    const m    = totalStats[g.mKey] || 0;
    const f    = totalStats[g.fKey] || 0;
    const t    = m + f;
    const tPct = total > 0 ? ((t / total) * 100).toFixed(1) : '0.0';
    const mW   = ((m / maxSide) * 100).toFixed(1);
    const fW   = ((f / maxSide) * 100).toFixed(1);
    return `
      <tr>
        <td class="num">${m.toLocaleString()}</td>
        <td class="bar-male">
          <div style="display:flex;justify-content:flex-end;height:10px;">
            <div style="width:${mW}%;height:10px;background:#4A6572 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
          </div>
        </td>
        <td class="age-label-cell">${safeHtml(g.labelEn)}</td>
        <td class="bar-female">
          <div style="display:flex;justify-content:flex-start;height:10px;">
            <div style="width:${fW}%;height:10px;background:#A1887F !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
          </div>
        </td>
        <td class="num">${f.toLocaleString()}</td>
        <td class="num bold green">${t.toLocaleString()}</td>
        <td class="num">${tPct}%</td>
      </tr>`;
  }).join('');

  // ── Stat row builder (bars scaled to section max, not % of total) ─────────
  const makeStatRows = (data, color) => {
    const sorted = [...data].sort((a, b) => b.c - a.c);
    const maxC   = sorted[0]?.c || 1;
    return sorted.map(({ label, c }) => {
      const barW = ((c / maxC) * 100).toFixed(1);
      const pct  = total > 0 ? ((c / total) * 100).toFixed(1) : '0.0';
      return `
        <tr style="page-break-inside:avoid">
          <td class="name">${safeHtml(label)}</td>
          <td class="bar-cell-simple">
            <div class="simple-bar" style="width:${barW}%;background:${color} !important;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
          </td>
          <td class="num bold">${c.toLocaleString()}</td>
          <td class="num">${pct}%</td>
        </tr>`;
    }).join('');
  };

  // Use normalized aggregated nationalities (same as UI display)
  const uniqueNormalizedNats = getUniqueNormalizedNats(allNationalities, totalStats.natCounts);

  const relData  = allReligions    .map(r => ({ label: r, c: totalStats.relCounts?.[r] || 0 }));
  const natData  = uniqueNormalizedNats.map(n => ({
    label: n,
    c: allNationalities.reduce((sum, raw) => {
      if (normalizeNationalityDisplay(raw) === n) {
        return sum + (totalStats.natCounts?.[raw] || 0);
      }
      return sum;
    }, 0)
  }));
  const occData  = allOccupations  .map(o => ({ label: o, c: totalStats.occCounts?.[o] || 0 }));

  const relRows  = makeStatRows(relData,  '#8D6E63');
  const natRows  = makeStatRows(natData,  '#2E7D32');
  const occRows  = makeStatRows(occData,  '#00695C');

  // Side-by-side only when both sections are small enough to fit two columns
  const sideBySide = relData.length <= 12 && natData.length <= 12;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Demographic Dashboard — ${safeHtml(filterLine)}</title>
  <style>
    @page { size: legal landscape; margin: 5mm 6mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Pyidaungsu', 'Padauk', 'Myanmar Text', 'Times New Roman', Times, serif;
      font-size: 8.5px; color: #000; background: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* ── Toolbar ── */
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

    /* ── Page ── */
    .page { position: relative; z-index: 1; padding: 2px 4px 4px; }

    /* ── Document header ── */
    .header { display: flex; align-items: center; padding-bottom: 3px; margin-bottom: 2px; }
    .header .logo { width: 44px; flex: 0 0 44px; }
    .header .logo img { width: 40px; height: auto; }
    .header .center { flex: 1; text-align: center; }
    .header .center .org  { font-size: 11px; font-weight: 700; letter-spacing: 0.4px; }
    .header .center .dept { font-size: 9px; margin-top: 1px; }
    .header .center .doc-title { font-size: 9px; margin-top: 2px; font-style: italic; color: #333; }
    .header .flag { width: 44px; flex: 0 0 44px; text-align: right; }
    .header .flag img { width: 38px; height: auto; border: 1px solid #000; }
    .rule { border-top: 1px solid #000; border-bottom: 1px solid #000; height: 2px; margin: 0 0 4px; }

    /* ── Filter bar ── */
    .filter-bar {
      font-size: 8px; margin-bottom: 5px;
      display: flex; justify-content: space-between; align-items: center;
      border: 1px solid #ccc; padding: 2px 6px; background: #f9f9f9;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }

    /* ── Summary strip ── */
    .summary-strip { display: flex; gap: 4px; margin-bottom: 5px; }
    .summary-card {
      flex: 1; border: 1px solid #ccc; padding: 4px 7px;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
    .summary-card .s-label { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 2px; }
    .summary-card .s-val   { font-size: 16px; font-weight: 700; color: #000; font-family: 'Courier New', monospace; line-height: 1; }
    .sc-green  { border-top: 3px solid #2E7D32 !important; }
    .sc-blue   { border-top: 3px solid #4A6572 !important; }
    .sc-brown  { border-top: 3px solid #A1887F !important; }

    /* ── Section title ── */
    .section-title { 
      font-size: 10px; 
      font-weight: 700; 
      text-transform: uppercase; 
      letter-spacing: 0.8px; 
      margin: 10px 0 6px; 
      border-bottom: 2px solid #1A1A1A; 
      padding-bottom: 4px;
      color: #1A1A1A;
    }

    /* ── Two-column layout ── */
    .two-col { display: flex; gap: 8px; margin-bottom: 8px; }
    .two-col .col { flex: 1; }

    /* ── Stat table (religion / nationality / occupation) ── */
    .stat-table { width: 100%; border-collapse: collapse; }
    .stat-table td { border: 1px solid #ddd; padding: 2px 4px; font-size: 8px; vertical-align: middle; line-height: 1.2; }
    .stat-table td.name { 
      font-weight: 500; 
      min-width: 80px; 
      max-width: 140px; 
      word-break: break-word; 
      overflow-wrap: anywhere;
      line-height: 1.6;
      padding: 10px 10px;
    }
    .stat-table td.num  { 
      text-align: center; 
      font-family: 'Courier New', monospace; 
      white-space: nowrap; 
      width: 42px;
      font-weight: 500;
      color: #333;
    }
    .stat-table td.bold { font-weight: 700; }
    .stat-table td.green { 
      color: #2E7D32; 
      font-weight: 700;
    }
    .stat-table td.bar-cell-simple { 
      width: 120px; 
      padding: 8px;
    }
    .simple-bar { 
      height: 10px; 
      min-width: 1px;
      border-radius: 2px;
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }

    /* ── Age Pyramid table ── */
    .pyramid-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .pyramid-table td { border: 1px solid #ddd; padding: 2px 4px; font-size: 8px; vertical-align: middle; line-height: 1.2; }
    .pyramid-table td.num { 
      text-align: center; 
      font-family: 'Courier New', monospace; 
      width: 36px; 
      white-space: nowrap;
      font-weight: 500;
      color: #333;
    }
    .pyramid-table td.bold { font-weight: 700; }
    .pyramid-table td.green { 
      color: #2E7D32; 
      font-weight: 700;
    }
    .pyramid-table td.bar-male { 
      width: 28%; 
      padding: 8px; 
    }
    .pyramid-table td.bar-female { 
      width: 28%; 
      padding: 8px; 
    }
    .pyramid-table td.bar-male > div,
    .pyramid-table td.bar-female > div {
      border-radius: 2px;
    }
    .pyramid-table td.age-label-cell { 
      font-size: 8px; 
      font-weight: 700; 
      text-align: center; 
      width: 60px; 
      white-space: nowrap; 
      color: #1A1A1A;
      background: #FAFAFA;
    }

    /* ── Legend ── */
    .legend { display: flex; gap: 10px; font-size: 7px; color: #555; margin-bottom: 2px; align-items: center; }
    .legend-swatch { display: inline-block; width: 16px; height: 7px; margin-right: 3px; vertical-align: middle;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    /* ── Footer ── */
    .doc-footer { margin-top: 5px; padding-top: 2px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 7px; color: #444; }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>Demographic Dashboard — Print Preview</h1>
    <div class="btns">
      <button class="primary" onclick="window.print()">Print / Save as PDF</button>
      <button onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="watermark"><img src="${logoUrl}" alt="" /></div>

  <div class="page">
    <!-- ── Document Header ── -->
    <div class="header">
      <div class="logo"><img src="${logoUrl}" alt="IDTL Logo" /></div>
      <div class="center">
        <div class="org">Ta'ang Land Government</div>
        <div class="dept">Ta'ang Land Immigration Department (IDTL)</div>
        <div class="doc-title">Demographic Dashboard Report — လူဦးရေဆိုင်ရာ အစီရင်ခံစာ</div>
      </div>
      <div class="flag"><img src="${flagUrl}" alt="Ta'ang Flag" /></div>
    </div>
    <div class="rule"></div>

    <!-- ── Filter bar ── -->
    <div class="filter-bar">
      <span><b>Location Filter:</b> ${safeHtml(filterLine)}</span>
      <span><b>Printed:</b> ${safeHtml(dateStr)}</span>
    </div>

    <!-- ── Summary strip ── -->
    <div class="summary-strip">
      <div class="summary-card sc-green">
        <div class="s-label">Total Population · လူဦးရေပေါင်း</div>
        <div class="s-val">${total.toLocaleString()}</div>
      </div>
      <div class="summary-card sc-blue">
        <div class="s-label">Male · ကျား</div>
        <div class="s-val">${male.toLocaleString()}</div>
      </div>
      <div class="summary-card sc-brown">
        <div class="s-label">Female · မ</div>
        <div class="s-val">${female.toLocaleString()}</div>
      </div>
    </div>

    <!-- ── Age Pyramid ── -->
    <div class="section-title">FUNCTIONAL AGE GROUPS</div>
    <div class="legend">
      <span><span class="legend-swatch" style="background:#4A6572"></span>Male</span>
      <span><span class="legend-swatch" style="background:#A1887F"></span>Female</span>
      <span style="color:#999">— Bars scaled to largest single-side count; oldest age group at top</span>
    </div>
    <table class="pyramid-table">
      <thead>
        <tr>
          <th style="width:32px">Male</th>
          <th style="width:28%;text-align:right;padding:2px 6px;">← Male</th>
          <th style="width:58px;text-align:center">Age Group</th>
          <th style="width:28%;text-align:left;padding:2px 6px;">Female →</th>
          <th style="width:32px">Female</th>
          <th style="width:36px">Total</th>
          <th style="width:32px">%</th>
        </tr>
      </thead>
      <tbody>${ageRows}</tbody>
    </table>

    <!-- ── Religion + Nationality ── -->
    ${sideBySide ? `<div class="two-col">
      <div class="col">
        <div class="section-title">RELIGIOUS STATISTICS</div>
        <table class="stat-table" style="page-break-inside:auto">
          <thead><tr>
            <th style="text-align:left;padding:2px 4px">Religion</th>
            <th>Bar (scaled to largest)</th>
            <th style="width:42px">Count</th>
            <th style="width:36px">%</th>
          </tr></thead>
          <tbody>${relRows || '<tr><td colspan="4" style="text-align:center;color:#999">No data</td></tr>'}</tbody>
        </table>
      </div>
      <div class="col">
        <div class="section-title">NATIONALITY STATISTICS</div>
        <table class="stat-table" style="page-break-inside:auto">
          <thead><tr>
            <th style="text-align:left;padding:2px 4px">Nationality</th>
            <th>Bar (scaled to largest)</th>
            <th style="width:42px">Count</th>
            <th style="width:36px">%</th>
          </tr></thead>
          <tbody>${natRows || '<tr><td colspan="4" style="text-align:center;color:#999">No data</td></tr>'}</tbody>
        </table>
      </div>
    </div>` : `
    <div class="section-title">RELIGIOUS STATISTICS</div>
    <table class="stat-table" style="page-break-inside:auto">
      <thead><tr>
        <th style="text-align:left;padding:2px 4px">Religion</th>
        <th>Bar (scaled to largest)</th>
        <th style="width:42px">Count</th>
        <th style="width:36px">%</th>
      </tr></thead>
      <tbody>${relRows || '<tr><td colspan="4" style="text-align:center;color:#999">No data</td></tr>'}</tbody>
    </table>
    <div class="section-title">NATIONALITY STATISTICS</div>
    <table class="stat-table" style="page-break-inside:auto">
      <thead><tr>
        <th style="text-align:left;padding:2px 4px">Nationality</th>
        <th>Bar (scaled to largest)</th>
        <th style="width:42px">Count</th>
        <th style="width:36px">%</th>
      </tr></thead>
      <tbody>${natRows || '<tr><td colspan="4" style="text-align:center;color:#999">No data</td></tr>'}</tbody>
    </table>`}

    <!-- ── Occupation ── -->
    <div class="section-title">OCCUPATION STATISTICS</div>
    <table class="stat-table" style="page-break-inside:auto">
      <thead><tr>
        <th style="text-align:left;padding:2px 4px">Occupation</th>
        <th>Bar (scaled to largest)</th>
        <th style="width:42px">Count</th>
        <th style="width:36px">%</th>
      </tr></thead>
      <tbody>${occRows || '<tr><td colspan="4" style="text-align:center;color:#999">No data</td></tr>'}</tbody>
    </table>

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
  if (!w) { alert('Please allow popups to print the demographic dashboard report.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
};
