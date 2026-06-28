import ExcelJS from 'exceljs';
import taangFlag from '../assets/taang_flag.jpg';
import taangLogo from '../assets/fonts/IDTL_logo.png';

const safeHtml = (v) => {
  if (v === null || v === undefined || v === '') return '';
  return String(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
};

const toMM = (num) => {
  if (num === null || num === undefined || num === '') return '0';
  const n = typeof num === 'number' ? num : Number(num);
  return isNaN(n) ? String(num) : n.toLocaleString('en-US');
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

// EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export const exportStatisticsExcel = async ({
  groupLabel, wardStats, totalStats, allReligions, allNationalities,
  selectedDistrict, selectedTownship, selectedWard, selectedGroup, selectedVillage,
  isAtWardLevel, wardStatsList, villageStatsList, groupStatsList,
}) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: '2-digit' });

  const parts = [];
  if (selectedDistrict) parts.push(selectedDistrict);
  if (selectedTownship) parts.push(selectedTownship);
  if (selectedWard)     parts.push(selectedWard);
  if (selectedGroup)    parts.push(selectedGroup);
  if (selectedVillage)  parts.push(selectedVillage);
  const filterLine = parts.length > 0 ? parts.join(' / ') : 'All Districts';

  const suffix = selectedVillage || selectedGroup || selectedWard || selectedTownship || selectedDistrict || 'All';
  const filename = `TPS_Statistics_${suffix.replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_')}_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.xlsx`;

  const levelSuffix = selectedTownship
    ? '(WARD / GROUP / VILLAGE)'
    : selectedDistrict
      ? '(TOWNSHIP)'
      : '(DISTRICT)';

  const displayReligions = allReligions;
  const displayNats = getUniqueNormalizedNats(allNationalities, totalStats.natCounts);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Population Statistics');

  const maxCols = Math.max(15 + displayReligions.length, 5 + displayNats.length);

  const applyBorder = (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  };

  // ── Header titles ──
  worksheet.mergeCells(1, 1, 1, maxCols);
  const c1 = worksheet.getCell(1, 1);
  c1.value = "Ta'ang Land Government";
  c1.font = { name: 'Pyidaungsu', size: 16, bold: true };
  c1.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 24;

  worksheet.mergeCells(2, 1, 2, maxCols);
  const c2 = worksheet.getCell(2, 1);
  c2.value = "Ta'ang Land Immigration Department (IDTL)";
  c2.font = { name: 'Pyidaungsu', size: 12, bold: true };
  c2.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 18;

  worksheet.mergeCells(3, 1, 3, maxCols);
  const c3 = worksheet.getCell(3, 1);
  c3.value = "Population Statistics Report";
  c3.font = { name: 'Pyidaungsu', size: 10, italic: true };
  c3.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(3).height = 16;

  // ── Info banner block ──
  worksheet.mergeCells(5, 1, 5, Math.floor(maxCols / 2));
  const fLeft = worksheet.getCell(5, 1);
  fLeft.value = `Location Filter: ${filterLine}`;
  fLeft.font = { name: 'Pyidaungsu', bold: true, size: 10 };
  fLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
  fLeft.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  worksheet.mergeCells(5, Math.floor(maxCols / 2) + 1, 5, maxCols);
  const fRight = worksheet.getCell(5, Math.floor(maxCols / 2) + 1);
  fRight.value = `Printed: ${dateStr}`;
  fRight.font = { name: 'Pyidaungsu', bold: true, size: 10 };
  fRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
  fRight.alignment = { horizontal: 'right', vertical: 'middle' };

  for (let c = 1; c <= maxCols; c++) {
    const cell = worksheet.getRow(5).getCell(c);
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: c === 1 ? { style: 'thin', color: { argb: 'FFCCCCCC' } } : undefined,
      right: c === maxCols ? { style: 'thin', color: { argb: 'FFCCCCCC' } } : undefined
    };
  }
  worksheet.getRow(5).height = 22;

  let currentLine = 7;

  // ── Helper to append Table 1 ──
  const writeTable1Block = (title, colLabel, statsArr) => {
    if (!statsArr || statsArr.length === 0) return;

    worksheet.mergeCells(currentLine, 1, currentLine, maxCols);
    const titleCell = worksheet.getCell(currentLine, 1);
    titleCell.value = title;
    titleCell.font = { name: 'Pyidaungsu', size: 11, bold: true };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(currentLine).height = 22;
    currentLine += 1;

    const row1 = currentLine;
    const row2 = currentLine + 1;
    const r1 = worksheet.getRow(row1);
    const r2 = worksheet.getRow(row2);

    r1.getCell(1).value = 'စဉ်';
    r1.getCell(2).value = colLabel;
    r1.getCell(3).value = 'အထစ';
    r1.getCell(4).value = 'လူဦးရေပေါင်း';
    r1.getCell(7).value = '၁၆ နှစ်အောက်';
    r1.getCell(10).value = '၁၆ - ၆၀ နှစ်';
    r1.getCell(13).value = '၆၀ နှစ်အထက်';
    if (displayReligions.length > 0) {
      r1.getCell(16).value = 'ကိုးကွယ်သည့်ဘာသာ';
    }

    r2.getCell(4).value = 'ကျား'; r2.getCell(5).value = 'မ'; r2.getCell(6).value = 'ပေါင်း';
    r2.getCell(7).value = 'ကျား'; r2.getCell(8).value = 'မ'; r2.getCell(9).value = 'ပေါင်း';
    r2.getCell(10).value = 'ကျား'; r2.getCell(11).value = 'မ'; r2.getCell(12).value = 'ပေါင်း';
    r2.getCell(13).value = 'ကျား'; r2.getCell(14).value = 'မ'; r2.getCell(15).value = 'ပေါင်း';
    displayReligions.forEach((r, idx) => {
      r2.getCell(16 + idx).value = r;
    });

    for (let c = 1; c <= 15 + displayReligions.length; c++) {
      const cell1 = r1.getCell(c);
      const cell2 = r2.getCell(c);
      applyBorder(cell1);
      applyBorder(cell2);
      cell1.font = { name: 'Pyidaungsu', size: 10, bold: true };
      cell2.font = { name: 'Pyidaungsu', size: 10, bold: true };
      cell1.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

      const isGroupHeader = (c >= 4 && c <= 15) || (c >= 16 && c <= 15 + displayReligions.length);
      const bg = isGroupHeader ? 'D4D4D4' : 'E8E8E8';
      cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
      cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
    }

    worksheet.mergeCells(row1, 1, row2, 1);
    worksheet.mergeCells(row1, 2, row2, 2);
    worksheet.mergeCells(row1, 3, row2, 3);
    worksheet.mergeCells(row1, 4, row1, 6);
    worksheet.mergeCells(row1, 7, row1, 9);
    worksheet.mergeCells(row1, 10, row1, 12);
    worksheet.mergeCells(row1, 13, row1, 15);
    if (displayReligions.length > 0) {
      worksheet.mergeCells(row1, 16, row1, 15 + displayReligions.length);
    }

    r1.height = 22;
    r2.height = 22;
    currentLine += 2;

    const tableSum = statsArr.reduce((acc, w) => {
      acc.households += (w.households || 0);
      acc.male       += (w.male || 0);
      acc.female     += (w.female || 0);
      acc.total      += (w.total || 0);
      acc.u16m       += (w.u16m || 0);
      acc.u16f       += (w.u16f || 0);
      acc.b1660m     += (w.b1660m || 0);
      acc.b1660f     += (w.b1660f || 0);
      acc.a60m       += (w.a60m || 0);
      acc.a60f       += (w.a60f || 0);
      displayReligions.forEach(r => {
        acc.relCounts[r] = (acc.relCounts[r] || 0) + (w.relCounts?.[r] || 0);
      });
      return acc;
    }, {
      households: 0, male: 0, female: 0, total: 0,
      u16m: 0, u16f: 0, b1660m: 0, b1660f: 0, a60m: 0, a60f: 0,
      relCounts: {}
    });

    statsArr.forEach((w, idx) => {
      const isEven = idx % 2 === 1;
      const bg = isEven ? 'FFF5F5F5' : 'FFFFFFFF';
      const row = worksheet.getRow(currentLine);

      const rowCells = [
        { val: toMM(idx + 1), align: 'center' },
        { val: w.name, align: 'left', bold: true },
        { val: toMM(w.households), align: 'center' },
        { val: toMM(w.male), align: 'center' },
        { val: toMM(w.female), align: 'center' },
        { val: toMM(w.total), align: 'center', bold: true },
        { val: toMM(w.u16m), align: 'center' },
        { val: toMM(w.u16f), align: 'center' },
        { val: toMM(w.u16m + w.u16f), align: 'center', bold: true },
        { val: toMM(w.b1660m), align: 'center' },
        { val: toMM(w.b1660f), align: 'center' },
        { val: toMM(w.b1660m + w.b1660f), align: 'center', bold: true },
        { val: toMM(w.a60m), align: 'center' },
        { val: toMM(w.a60f), align: 'center' },
        { val: toMM(w.a60m + w.a60f), align: 'center', bold: true }
      ];
      displayReligions.forEach(r => {
        const c = w.relCounts?.[r];
        rowCells.push({ val: c ? toMM(c) : '-', align: 'center' });
      });

      rowCells.forEach((c, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = c.val;
        cell.font = { name: 'Pyidaungsu', size: 10, bold: c.bold || false };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: c.align, vertical: 'middle', wrapText: true };
        applyBorder(cell);
      });
      row.height = 20;
      currentLine += 1;
    });

    const row = worksheet.getRow(currentLine);
    const totalCells = [
      { val: '', align: 'center' },
      { val: 'စုစုပေါင်း', align: 'left', bold: true },
      { val: toMM(tableSum.households), align: 'center', bold: true },
      { val: toMM(tableSum.male), align: 'center', bold: true },
      { val: toMM(tableSum.female), align: 'center', bold: true },
      { val: toMM(tableSum.total), align: 'center', bold: true },
      { val: toMM(tableSum.u16m), align: 'center', bold: true },
      { val: toMM(tableSum.u16f), align: 'center', bold: true },
      { val: toMM(tableSum.u16m + tableSum.u16f), align: 'center', bold: true },
      { val: toMM(tableSum.b1660m), align: 'center', bold: true },
      { val: toMM(tableSum.b1660f), align: 'center', bold: true },
      { val: toMM(tableSum.b1660m + tableSum.b1660f), align: 'center', bold: true },
      { val: toMM(tableSum.a60m), align: 'center', bold: true },
      { val: toMM(tableSum.a60f), align: 'center', bold: true },
      { val: toMM(tableSum.a60m + tableSum.a60f), align: 'center', bold: true }
    ];
    displayReligions.forEach(r => {
      const c = tableSum.relCounts?.[r];
      totalCells.push({ val: c ? toMM(c) : '-', align: 'center', bold: true });
    });

    totalCells.forEach((c, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = c.val;
      cell.font = { name: 'Pyidaungsu', size: 10, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      cell.alignment = { horizontal: c.align, vertical: 'middle', wrapText: true };
      applyBorder(cell);
    });
    row.height = 22;
    currentLine += 3;
  };

  // ── Helper to append Table 2 ──
  const writeTable2Block = (title, colLabel, statsArr) => {
    if (!statsArr || statsArr.length === 0) return;

    worksheet.mergeCells(currentLine, 1, currentLine, maxCols);
    const titleCell = worksheet.getCell(currentLine, 1);
    titleCell.value = title;
    titleCell.font = { name: 'Pyidaungsu', size: 11, bold: true };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(currentLine).height = 22;
    currentLine += 1;

    const row1 = currentLine;
    const row2 = currentLine + 1;
    const r1 = worksheet.getRow(row1);
    const r2 = worksheet.getRow(row2);

    r1.getCell(1).value = 'စဉ်';
    r1.getCell(2).value = colLabel;
    r1.getCell(3).value = 'လူဦးရေပေါင်း';
    if (displayNats.length > 0) {
      r1.getCell(6).value = 'လူမျိုးအလိုက်';
    }

    r2.getCell(3).value = 'ကျား'; r2.getCell(4).value = 'မ'; r2.getCell(5).value = 'ပေါင်း';
    displayNats.forEach((n, idx) => {
      r2.getCell(6 + idx).value = n;
    });

    for (let c = 1; c <= 5 + displayNats.length; c++) {
      const cell1 = r1.getCell(c);
      const cell2 = r2.getCell(c);
      applyBorder(cell1);
      applyBorder(cell2);
      cell1.font = { name: 'Pyidaungsu', size: 10, bold: true };
      cell2.font = { name: 'Pyidaungsu', size: 10, bold: true };
      cell1.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

      const isGroupHeader = c >= 3 && c <= 5 || (c >= 6 && c <= 5 + displayNats.length);
      const bg = isGroupHeader ? 'D4D4D4' : 'E8E8E8';
      cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
      cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
    }

    worksheet.mergeCells(row1, 1, row2, 1);
    worksheet.mergeCells(row1, 2, row2, 2);
    worksheet.mergeCells(row1, 3, row1, 5);
    if (displayNats.length > 0) {
      worksheet.mergeCells(row1, 6, row1, 5 + displayNats.length);
    }

    r1.height = 22;
    r2.height = 22;
    currentLine += 2;

    const tableSum = statsArr.reduce((acc, w) => {
      acc.male   += (w.male || 0);
      acc.female += (w.female || 0);
      acc.total  += (w.total || 0);
      displayNats.forEach(n => {
        acc.natCounts[n] = (acc.natCounts[n] || 0) + getAggregatedNatCount(w.natCounts, n, allNationalities);
      });
      return acc;
    }, { male: 0, female: 0, total: 0, natCounts: {} });

    statsArr.forEach((w, idx) => {
      const isEven = idx % 2 === 1;
      const bg = isEven ? 'FFF5F5F5' : 'FFFFFFFF';
      const row = worksheet.getRow(currentLine);

      const rowCells = [
        { val: toMM(idx + 1), align: 'center' },
        { val: w.name, align: 'left', bold: true },
        { val: toMM(w.male), align: 'center' },
        { val: toMM(w.female), align: 'center' },
        { val: toMM(w.total), align: 'center', bold: true }
      ];
      displayNats.forEach(n => {
        const c = getAggregatedNatCount(w.natCounts, n, allNationalities);
        rowCells.push({ val: c ? toMM(c) : '-', align: 'center' });
      });

      rowCells.forEach((c, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = c.val;
        cell.font = { name: 'Pyidaungsu', size: 10, bold: c.bold || false };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: c.align, vertical: 'middle', wrapText: true };
        applyBorder(cell);
      });
      row.height = 20;
      currentLine += 1;
    });

    const row = worksheet.getRow(currentLine);
    const totalCells = [
      { val: '', align: 'center' },
      { val: 'စုစုပေါင်း', align: 'left', bold: true },
      { val: toMM(tableSum.male), align: 'center', bold: true },
      { val: toMM(tableSum.female), align: 'center', bold: true },
      { val: toMM(tableSum.total), align: 'center', bold: true }
    ];
    displayNats.forEach(n => {
      const c = tableSum.natCounts[n];
      totalCells.push({ val: c ? toMM(c) : '-', align: 'center', bold: true });
    });

    totalCells.forEach((c, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = c.val;
      cell.font = { name: 'Pyidaungsu', size: 10, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      cell.alignment = { horizontal: c.align, vertical: 'middle', wrapText: true };
      applyBorder(cell);
    });
    row.height = 22;
    currentLine += 3;
  };

  const prefixedVillageStats = selectedGroup
    ? (villageStatsList || []).map(v => ({ ...v, name: `${selectedGroup} — ${v.name}` }))
    : (villageStatsList || []);

  // ── Write sequential dynamic tables ──
  if (isAtWardLevel) {
    if (selectedVillage) {
      writeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (VILLAGES)', 'ကျေးရွာ', prefixedVillageStats);
      writeTable2Block('SUMMARY TABLE (2) — NATIONALITY (VILLAGES)', 'ကျေးရွာ', prefixedVillageStats);
    } else if (selectedGroup) {
      writeTable1Block('GRAND TOTAL — POPULATION, AGE & RELIGION (GROUP WIDE)', 'အုပ်စုစုစုပေါင်း', [{ name: selectedGroup, ...totalStats }]);
      writeTable2Block('GRAND TOTAL — NATIONALITY (GROUP WIDE)', 'အုပ်စုစုစုပေါင်း', [{ name: selectedGroup, ...totalStats }]);
      writeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (VILLAGES)', 'ကျေးရွာ', prefixedVillageStats);
      writeTable2Block('SUMMARY TABLE (2) — NATIONALITY (VILLAGES)', 'ကျေးရွာ', prefixedVillageStats);
    } else if (selectedWard) {
      writeTable1Block('GRAND TOTAL — POPULATION, AGE & RELIGION (WARD WIDE)', 'ရပ်ကွက်စုစုပေါင်း', [{ name: selectedWard, ...totalStats }]);
      writeTable2Block('GRAND TOTAL — NATIONALITY (WARD WIDE)', 'ရပ်ကွက်စုစုပေါင်း', [{ name: selectedWard, ...totalStats }]);
      writeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (WARDS)', 'ရပ်ကွက်', wardStatsList || []);
      writeTable2Block('SUMMARY TABLE (2) — NATIONALITY (WARDS)', 'ရပ်ကွက်', wardStatsList || []);
    } else {
      writeTable1Block('GRAND TOTAL — POPULATION, AGE & RELIGION (TOWNSHIP WIDE)', 'မြို့နယ်စုစုပေါင်း', [{ name: selectedTownship || 'Township Total', ...totalStats }]);
      writeTable2Block('GRAND TOTAL — NATIONALITY (TOWNSHIP WIDE)', 'မြို့နယ်စုစုပေါင်း', [{ name: selectedTownship || 'Township Total', ...totalStats }]);
      writeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (WARDS)', 'ရပ်ကွက်', wardStatsList || []);
      writeTable2Block('SUMMARY TABLE (2) — NATIONALITY (WARDS)', 'ရပ်ကွက်', wardStatsList || []);
      writeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (GROUPS)', 'ကျေးရွာအုပ်စု', groupStatsList || []);
      writeTable2Block('SUMMARY TABLE (2) — NATIONALITY (GROUPS)', 'ကျေးရွာအုပ်စု', groupStatsList || []);
    }
  } else {
    writeTable1Block(`SUMMARY TABLE (1) — POPULATION, AGE & RELIGION ${levelSuffix}`, groupLabel, wardStats);
    writeTable2Block(`SUMMARY TABLE (2) — NATIONALITY ${levelSuffix}`, groupLabel, wardStats);
  }

  // Auto-fit column widths
  worksheet.columns.forEach((column) => {
    let maxLen = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.row > 7 && cell.value) {
        let len = String(cell.value).length;
        if (len > maxLen) maxLen = len;
      }
    });
    column.width = Math.min(Math.max(maxLen + 4, 10), 30);
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

    // Calculate correct sums for this specific table (statsArr)
    const tableSum = statsArr.reduce((acc, w) => {
      acc.households += (w.households || 0);
      acc.male       += (w.male || 0);
      acc.female     += (w.female || 0);
      acc.total      += (w.total || 0);
      acc.u16m       += (w.u16m || 0);
      acc.u16f       += (w.u16f || 0);
      acc.b1660m     += (w.b1660m || 0);
      acc.b1660f     += (w.b1660f || 0);
      acc.a60m       += (w.a60m || 0);
      acc.a60f       += (w.a60f || 0);
      displayReligions.forEach(r => {
        acc.relCounts[r] = (acc.relCounts[r] || 0) + (w.relCounts?.[r] || 0);
      });
      return acc;
    }, {
      households: 0, male: 0, female: 0, total: 0,
      u16m: 0, u16f: 0, b1660m: 0, b1660f: 0, a60m: 0, a60f: 0,
      relCounts: {}
    });

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
        <td class="num bold">${toMM(tableSum.households)}</td>
        <td class="num bold">${toMM(tableSum.male)}</td>
        <td class="num bold">${toMM(tableSum.female)}</td>
        <td class="num bold green">${toMM(tableSum.total)}</td>
        <td class="num bold">${toMM(tableSum.u16m)}</td>
        <td class="num bold">${toMM(tableSum.u16f)}</td>
        <td class="num bold">${toMM(tableSum.u16m + tableSum.u16f)}</td>
        <td class="num bold">${toMM(tableSum.b1660m)}</td>
        <td class="num bold">${toMM(tableSum.b1660f)}</td>
        <td class="num bold">${toMM(tableSum.b1660m + tableSum.b1660f)}</td>
        <td class="num bold">${toMM(tableSum.a60m)}</td>
        <td class="num bold">${toMM(tableSum.a60f)}</td>
        <td class="num bold">${toMM(tableSum.a60m + tableSum.a60f)}</td>
        ${displayReligions.map(r => `<td class="num bold">${tableSum.relCounts[r] ? toMM(tableSum.relCounts[r]) : '-'}</td>`).join('')}
      </tr>`;
    const truncationNote = hasMoreReligions 
      ? `<div style="font-size:8px;color:#666;margin-top:4px;font-style:italic;">Showing top ${MAX_REL_COLS} of ${allReligions.length} religions. View full statistics online.</div>` 
      : '';
    return `<div class="section-title">${safeHtml(title)}</div><table>${hdr}<tbody>${rows}${totR}</tbody></table>${truncationNote}`;
  };

  const prefixedVillageStats = selectedGroup
    ? (villageStatsList || []).map(v => ({ ...v, name: `${selectedGroup} — ${v.name}` }))
    : (villageStatsList || []);

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

    // Calculate correct sums for this specific table (statsArr)
    const tableSum = statsArr.reduce((acc, w) => {
      acc.male   += (w.male || 0);
      acc.female += (w.female || 0);
      acc.total  += (w.total || 0);
      displayNats.forEach(n => {
        acc.natCounts[n] = (acc.natCounts[n] || 0) + getAggregatedNatCount(w.natCounts, n, allNationalities);
      });
      return acc;
    }, { male: 0, female: 0, total: 0, natCounts: {} });

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
        <td class="num bold">${toMM(tableSum.male)}</td>
        <td class="num bold">${toMM(tableSum.female)}</td>
        <td class="num bold green">${toMM(tableSum.total)}</td>
        ${displayNats.map(n => `<td class="num bold">${toMM(tableSum.natCounts[n]) || '-'}</td>`).join('')}
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

  let tablesHtml = '';
  if (isAtWardLevel) {
    if (selectedVillage) {
      tablesHtml = [
        makeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (VILLAGES)', 'ကျေးရွာ', prefixedVillageStats),
        makeTable2Block('SUMMARY TABLE (2) — NATIONALITY (VILLAGES)', 'ကျေးရွာ', prefixedVillageStats),
      ].join('');
    } else if (selectedGroup) {
      tablesHtml = [
        makeTable1Block('GRAND TOTAL — POPULATION, AGE & RELIGION (GROUP WIDE)', 'အုပ်စုစုစုပေါင်း', [{ name: selectedGroup, ...totalStats }]),
        makeTable2Block('GRAND TOTAL — NATIONALITY (GROUP WIDE)', 'အုပ်စုစုစုပေါင်း', [{ name: selectedGroup, ...totalStats }]),
        makeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (VILLAGES)', 'ကျေးရွာ', prefixedVillageStats),
        makeTable2Block('SUMMARY TABLE (2) — NATIONALITY (VILLAGES)', 'ကျေးရွာ', prefixedVillageStats),
      ].join('');
    } else if (selectedWard) {
      tablesHtml = [
        makeTable1Block('GRAND TOTAL — POPULATION, AGE & RELIGION (WARD WIDE)', 'ရပ်ကွက်စုစုပေါင်း', [{ name: selectedWard, ...totalStats }]),
        makeTable2Block('GRAND TOTAL — NATIONALITY (WARD WIDE)', 'ရပ်ကွက်စုစုပေါင်း', [{ name: selectedWard, ...totalStats }]),
        makeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (WARDS)', 'ရပ်ကွက်', wardStatsList || []),
        makeTable2Block('SUMMARY TABLE (2) — NATIONALITY (WARDS)', 'ရပ်ကွက်', wardStatsList || []),
      ].join('');
    } else {
      tablesHtml = [
        makeTable1Block('GRAND TOTAL — POPULATION, AGE & RELIGION (TOWNSHIP WIDE)', 'မြို့နယ်စုစုပေါင်း', [{ name: selectedTownship || 'Township Total', ...totalStats }]),
        makeTable2Block('GRAND TOTAL — NATIONALITY (TOWNSHIP WIDE)', 'မြို့နယ်စုစုပေါင်း', [{ name: selectedTownship || 'Township Total', ...totalStats }]),
        makeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (WARDS)', 'ရပ်ကွက်', wardStatsList || []),
        makeTable2Block('SUMMARY TABLE (2) — NATIONALITY (WARDS)', 'ရပ်ကွက်', wardStatsList || []),
        makeTable1Block('SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (GROUPS)', 'ကျေးရွာအုပ်စု', groupStatsList || []),
        makeTable2Block('SUMMARY TABLE (2) — NATIONALITY (GROUPS)', 'ကျေးရွာအုပ်စု', groupStatsList || []),
      ].join('');
    }
  } else {
    tablesHtml = `
       <div class="section-title">SUMMARY TABLE (1) — POPULATION, AGE &amp; RELIGION ${safeHtml(levelSuffix)}</div>
       <table>${table1Header}<tbody>${wardStats.map((w, i) => makeTable1Row(w, i)).join('')}${table1TotalRow}</tbody></table>
       
       <div class="section-title">SUMMARY TABLE (2) — NATIONALITY ${safeHtml(levelSuffix)}</div>
       <table>${table2Header}<tbody>${wardStats.map((w, i) => makeTable2Row(w, i)).join('')}${table2TotalRow}</tbody></table>
      `;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Population Statistics — ${safeHtml(filterLine)}</title>
  <style>
    @page { size: legal landscape; margin: 3mm; }
    @font-face {
      font-family: 'Pyidaungsu';
      src: url('/assets/fonts/Pyidaungsu.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
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
    .header .center .doc-title { font-size: 9px; margin-top: 2px; color: #333; }
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
      white-space: normal;
      word-break: break-word;
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

    ${tablesHtml}

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
    @page { size: legal landscape; margin: 3mm; }
    @font-face {
      font-family: 'Pyidaungsu';
      src: url('/assets/fonts/Pyidaungsu.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
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
    .header .center .doc-title { font-size: 9px; margin-top: 2px; color: #333; }
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
