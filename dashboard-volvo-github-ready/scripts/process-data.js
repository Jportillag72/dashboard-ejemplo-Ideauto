const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const INPUT_FILE = process.env.INPUT_FILE
  ? path.resolve(process.env.INPUT_FILE)
  : path.join(PROJECT_ROOT, "data", "matriculaciones_camiones_pesados.xlsx");
const OUTPUT_JSON = path.join(PROJECT_ROOT, "data", "dashboard_data.json");
const OUTPUT_JS = path.join(PROJECT_ROOT, "data", "dashboard_data.js");

const INCLUDED_MARKETS = new Set(["CAMION RIGIDO", "TRACTOCAMION"]);
const INCLUDED_YEARS = new Set([2025, 2026]);
const INCLUDED_MONTHS = new Set([1, 2, 3, 4]);
const VOLVO = "VOLVO";

const MONTHS = [
  { number: 1, name: "Enero", short: "Ene" },
  { number: 2, name: "Febrero", short: "Feb" },
  { number: 3, name: "Marzo", short: "Mar" },
  { number: 4, name: "Abril", short: "Abr" }
];

const HEADER_ALIASES = {
  market: ["MERCADO"],
  ccaa: [
    "CCAA NORMALIZADA",
    "COMUNIDAD AUTONOMA NORMALIZADA",
    "CCAA",
    "COMUNIDAD AUTONOMA",
    "COMUNIDAD",
    "CCAA ORIGINAL"
  ],
  brand: ["MARCA", "FABRICANTE"],
  year: ["ANO", "ANIO", "AÑO", "YEAR", "EJERCICIO"],
  month: ["MES", "MONTH"],
  units: ["UNIDADES", "MATRICULACIONES", "UNITS", "VOLUMEN"]
};

const CCAA_CANONICAL = new Map([
  ["ANDALUCIA", "Andalucía"],
  ["ARAGON", "Aragón"],
  ["ASTURIAS", "Asturias"],
  ["PRINCIPADO DE ASTURIAS", "Asturias"],
  ["BALEARES", "Islas Baleares"],
  ["ILLES BALEARS", "Islas Baleares"],
  ["ISLAS BALEARES", "Islas Baleares"],
  ["CANARIAS", "Canarias"],
  ["CANTABRIA", "Cantabria"],
  ["CASTILLA LA MANCHA", "Castilla-La Mancha"],
  ["CASTILLA-LA MANCHA", "Castilla-La Mancha"],
  ["CASTILLA Y LEON", "Castilla y León"],
  ["CATALUNA", "Cataluña"],
  ["CATALUNYA", "Cataluña"],
  ["COMUNIDAD VALENCIANA", "Comunidad Valenciana"],
  ["COMUNITAT VALENCIANA", "Comunidad Valenciana"],
  ["VALENCIA", "Comunidad Valenciana"],
  ["EXTREMADURA", "Extremadura"],
  ["GALICIA", "Galicia"],
  ["MADRID", "Comunidad de Madrid"],
  ["COMUNIDAD DE MADRID", "Comunidad de Madrid"],
  ["MURCIA", "Región de Murcia"],
  ["REGION DE MURCIA", "Región de Murcia"],
  ["NAVARRA", "Navarra"],
  ["COMUNIDAD FORAL DE NAVARRA", "Navarra"],
  ["PAIS VASCO", "País Vasco"],
  ["EUSKADI", "País Vasco"],
  ["LA RIOJA", "La Rioja"],
  ["RIOJA", "La Rioja"],
  ["CEUTA", "Ceuta"],
  ["MELILLA", "Melilla"],
  ["CEUTA Y MELILLA", "Ceuta y Melilla"]
]);

const MARKET_CANONICAL = new Map([
  ["CAMION RIGIDO", "Camión Rígido"],
  ["CAMION RÍGIDO", "Camión Rígido"],
  ["CAMIÓN RIGIDO", "Camión Rígido"],
  ["CAMIÓN RÍGIDO", "Camión Rígido"],
  ["TRACTOCAMION", "Tractocamión"],
  ["TRACTOCAMIÓN", "Tractocamión"]
]);

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function canonicalMarket(value) {
  const key = normalizeKey(value);
  return MARKET_CANONICAL.get(key) || toTitleCase(key);
}

function canonicalCcaa(value) {
  const key = normalizeKey(value);
  return CCAA_CANONICAL.get(key) || toTitleCase(key);
}

function canonicalBrand(value) {
  const key = normalizeKey(value);
  if (!key) return "";
  if (key.includes("VOLVO")) return VOLVO;
  if (key === "MERCEDES BENZ" || key === "MERCEDES-BENZ") return "MERCEDES-BENZ";
  return key;
}

function toTitleCase(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseYear(value) {
  const year = Number(String(value ?? "").replace(/[^\d-]/g, ""));
  return Number.isInteger(year) ? year : null;
}

function parseMonth(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const key = normalizeKey(value);
  const monthMap = new Map([
    ["ENERO", 1],
    ["ENE", 1],
    ["FEBRERO", 2],
    ["FEB", 2],
    ["MARZO", 3],
    ["MAR", 3],
    ["ABRIL", 4],
    ["ABR", 4],
    ["MAYO", 5],
    ["MAY", 5],
    ["JUNIO", 6],
    ["JUN", 6],
    ["JULIO", 7],
    ["JUL", 7],
    ["AGOSTO", 8],
    ["AGO", 8],
    ["SEPTIEMBRE", 9],
    ["SETIEMBRE", 9],
    ["SEP", 9],
    ["OCTUBRE", 10],
    ["OCT", 10],
    ["NOVIEMBRE", 11],
    ["NOV", 11],
    ["DICIEMBRE", 12],
    ["DIC", 12]
  ]);
  if (monthMap.has(key)) return monthMap.get(key);
  const numeric = Number(key);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function parseUnits(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cleanText(value);
  if (!text) return null;
  const normalized = text
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const units = Number(normalized);
  return Number.isFinite(units) ? units : null;
}

function pct(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function yoy(current, previous) {
  return previous ? (current - previous) / previous : null;
}

function sum(records) {
  return records.reduce((total, row) => total + row.units, 0);
}

function groupSum(records, keyFn) {
  const grouped = new Map();
  for (const row of records) {
    const key = keyFn(row);
    grouped.set(key, (grouped.get(key) || 0) + row.units);
  }
  return grouped;
}

function sortByUnitsDesc(a, b) {
  if (b.units2026 !== a.units2026) return b.units2026 - a.units2026;
  return String(a.name || a.brand || a.ccaa).localeCompare(String(b.name || b.brand || b.ccaa), "es");
}

function compactVariation(value) {
  return value === null || Number.isNaN(value) ? null : value;
}

function findDataSheet(workbook) {
  let bestCandidate = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false
    });

    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex += 1) {
      const row = rows[rowIndex].map(normalizeKey);
      const mapping = {};
      const missing = [];

      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        let index = -1;
        for (const alias of aliases.map(normalizeKey)) {
          index = row.findIndex((header) => header === alias);
          if (index >= 0) break;
        }
        if (index >= 0) mapping[field] = index;
        else missing.push(field);
      }

      const score = Object.keys(mapping).length;
      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = { sheetName, rows, headerIndex: rowIndex, mapping, missing, score };
      }

      if (missing.length === 0) {
        return { sheetName, rows, headerIndex: rowIndex, mapping, missing: [] };
      }
    }
  }

  const missing = bestCandidate?.missing || Object.keys(HEADER_ALIASES);
  throw new Error(
    `No se encontro una hoja con las columnas obligatorias. Faltan: ${missing.join(", ")}. ` +
      "Columnas esperadas: Mercado, CCAA, Marca, Ano, Mes y Unidades."
  );
}

function addVariant(variants, field, canonical, raw) {
  if (!canonical || !raw) return;
  if (!variants[field].has(canonical)) variants[field].set(canonical, new Set());
  variants[field].get(canonical).add(cleanText(raw));
}

function collectInconsistencies(variants) {
  const result = {};
  for (const [field, map] of Object.entries(variants)) {
    result[field] = Array.from(map.entries())
      .map(([canonical, rawValues]) => ({
        canonical,
        variants: Array.from(rawValues).sort((a, b) => a.localeCompare(b, "es"))
      }))
      .filter((item) => item.variants.length > 1);
  }
  return result;
}

function parseWorkbook() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`No se encontro el fichero de entrada: ${INPUT_FILE}`);
  }

  const workbook = XLSX.readFile(INPUT_FILE, { cellDates: false, raw: true });
  const dataSheet = findDataSheet(workbook);
  const variants = {
    market: new Map(),
    ccaa: new Map(),
    brand: new Map()
  };

  const records = [];
  const invalidRows = [];
  const excluded = {
    outsideMarketScope: 0,
    outsideTimeScope: 0,
    blankRows: 0
  };

  for (let i = dataSheet.headerIndex + 1; i < dataSheet.rows.length; i += 1) {
    const row = dataSheet.rows[i];
    const rawMarket = row[dataSheet.mapping.market];
    const rawCcaa = row[dataSheet.mapping.ccaa];
    const rawBrand = row[dataSheet.mapping.brand];
    const rawYear = row[dataSheet.mapping.year];
    const rawMonth = row[dataSheet.mapping.month];
    const rawUnits = row[dataSheet.mapping.units];

    if ([rawMarket, rawCcaa, rawBrand, rawYear, rawMonth, rawUnits].every((value) => cleanText(value) === "")) {
      excluded.blankRows += 1;
      continue;
    }

    const marketKey = normalizeKey(rawMarket);
    const market = canonicalMarket(rawMarket);
    const ccaa = canonicalCcaa(rawCcaa);
    const brand = canonicalBrand(rawBrand);
    const year = parseYear(rawYear);
    const month = parseMonth(rawMonth);
    const units = parseUnits(rawUnits);

    addVariant(variants, "market", market, rawMarket);
    addVariant(variants, "ccaa", ccaa, rawCcaa);
    addVariant(variants, "brand", brand, rawBrand);

    const rowErrors = [];
    if (!marketKey) rowErrors.push("Mercado vacio");
    if (!ccaa) rowErrors.push("CCAA vacia");
    if (!brand) rowErrors.push("Marca vacia");
    if (!Number.isInteger(year)) rowErrors.push("Ano no numerico");
    if (!month || month < 1 || month > 12) rowErrors.push("Mes no reconocido");
    if (units === null) rowErrors.push("Unidades no numericas");

    if (rowErrors.length) {
      invalidRows.push({
        rowNumber: i + 1,
        errors: rowErrors,
        sample: { rawMarket, rawCcaa, rawBrand, rawYear, rawMonth, rawUnits }
      });
      continue;
    }

    if (!INCLUDED_MARKETS.has(marketKey)) {
      excluded.outsideMarketScope += 1;
      continue;
    }

    if (!INCLUDED_YEARS.has(year) || !INCLUDED_MONTHS.has(month)) {
      excluded.outsideTimeScope += 1;
      continue;
    }

    records.push({
      market,
      marketKey,
      ccaa,
      ccaaKey: normalizeKey(ccaa),
      brand,
      year,
      month,
      monthName: MONTHS.find((item) => item.number === month)?.name || String(month),
      monthShort: MONTHS.find((item) => item.number === month)?.short || String(month),
      units
    });
  }

  return {
    workbook,
    dataSheet,
    records,
    quality: {
      inputFile: INPUT_FILE,
      sourceSheet: dataSheet.sheetName,
      parsedRows: dataSheet.rows.length - dataSheet.headerIndex - 1,
      validRowsInScope: records.length,
      invalidRowsCount: invalidRows.length,
      invalidRowsSample: invalidRows.slice(0, 20),
      excluded,
      nameInconsistencies: collectInconsistencies(variants)
    }
  };
}

function applyFilters(records, filters = {}) {
  return records.filter((row) => {
    if (filters.market && filters.market !== "Todos" && row.market !== filters.market) return false;
    if (filters.ccaa && filters.ccaa !== "Todas" && row.ccaa !== filters.ccaa) return false;
    if (filters.brand && filters.brand !== "Todas" && row.brand !== filters.brand) return false;
    return true;
  });
}

function buildRanking(records2026, records2025, key, label) {
  const current = groupSum(records2026, (row) => row[key]);
  const prior = groupSum(records2025, (row) => row[key]);
  const total2026 = sum(records2026);

  return Array.from(current.entries())
    .map(([name, units2026]) => {
      const units2025 = prior.get(name) || 0;
      return {
        [label]: name,
        name,
        units2026,
        units2025,
        variation: compactVariation(yoy(units2026, units2025)),
        share: pct(units2026, total2026)
      };
    })
    .sort(sortByUnitsDesc)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function buildBrandCcaaMatrix(records2026, brandRanking, ccaaRanking) {
  const brands = brandRanking.map((row) => row.brand);
  const communities = ccaaRanking.map((row) => row.ccaa);
  const ccaaTotals = groupSum(records2026, (row) => row.ccaa);

  const rows = brands.map((brand) => {
    const communityValues = communities.map((ccaa) => {
      const units = sum(records2026.filter((row) => row.brand === brand && row.ccaa === ccaa));
      return {
        ccaa,
        units,
        shareOfCommunity: pct(units, ccaaTotals.get(ccaa) || 0)
      };
    });

    return {
      brand,
      total: communityValues.reduce((acc, item) => acc + item.units, 0),
      communities: communityValues
    };
  });

  const longRows = [];
  for (const ccaa of communities) {
    for (const brand of brands) {
      const units = sum(records2026.filter((row) => row.brand === brand && row.ccaa === ccaa));
      longRows.push({
        ccaa,
        brand,
        units,
        shareOfCommunity: pct(units, ccaaTotals.get(ccaa) || 0)
      });
    }
  }

  return { brands, communities, rows, longRows };
}

function buildDashboard(records, filters = {}) {
  const scoped = applyFilters(records, filters);
  const records2026 = scoped.filter((row) => row.year === 2026);
  const records2025 = scoped.filter((row) => row.year === 2025);
  const total2026 = sum(records2026);
  const total2025 = sum(records2025);
  const volvo2026 = sum(records2026.filter((row) => row.brand === VOLVO));
  const volvo2025 = sum(records2025.filter((row) => row.brand === VOLVO));

  const brandRanking = buildRanking(records2026, records2025, "brand", "brand");
  const ccaaRanking = buildRanking(records2026, records2025, "ccaa", "ccaa");
  const marketRanking = buildRanking(records2026, records2025, "market", "market");
  const leaderBrand = brandRanking[0] || null;
  const volvoRank = brandRanking.find((row) => row.brand === VOLVO) || null;

  const volvoShareByCcaa = ccaaRanking
    .map((row) => {
      const currentCcaa = records2026.filter((item) => item.ccaa === row.ccaa);
      const priorCcaa = records2025.filter((item) => item.ccaa === row.ccaa);
      const ccaaTotal2026 = sum(currentCcaa);
      const ccaaTotal2025 = sum(priorCcaa);
      const ccaaVolvo2026 = sum(currentCcaa.filter((item) => item.brand === VOLVO));
      const ccaaVolvo2025 = sum(priorCcaa.filter((item) => item.brand === VOLVO));
      return {
        ccaa: row.ccaa,
        total2026: ccaaTotal2026,
        total2025: ccaaTotal2025,
        variation: compactVariation(yoy(ccaaTotal2026, ccaaTotal2025)),
        volvo2026: ccaaVolvo2026,
        volvo2025: ccaaVolvo2025,
        volvoVariation: compactVariation(yoy(ccaaVolvo2026, ccaaVolvo2025)),
        volvoShare: pct(ccaaVolvo2026, ccaaTotal2026)
      };
    })
    .sort((a, b) => {
      const shareDiff = (b.volvoShare ?? -1) - (a.volvoShare ?? -1);
      return shareDiff || b.total2026 - a.total2026 || a.ccaa.localeCompare(b.ccaa, "es");
    });

  const monthlyEvolution = MONTHS.map((month) => {
    const month2026 = records2026.filter((row) => row.month === month.number);
    const month2025 = records2025.filter((row) => row.month === month.number);
    const market2026 = sum(month2026);
    const market2025 = sum(month2025);
    const volvoMonth2026 = sum(month2026.filter((row) => row.brand === VOLVO));
    const volvoMonth2025 = sum(month2025.filter((row) => row.brand === VOLVO));
    return {
      ...month,
      market2026,
      market2025,
      marketVariation: compactVariation(yoy(market2026, market2025)),
      volvo2026: volvoMonth2026,
      volvo2025: volvoMonth2025,
      volvoVariation: compactVariation(yoy(volvoMonth2026, volvoMonth2025)),
      volvoShare: pct(volvoMonth2026, market2026)
    };
  });

  const competitorSet = new Set(
    brandRanking
      .filter((row) => row.brand !== VOLVO)
      .slice(0, 5)
      .map((row) => row.brand)
  );
  competitorSet.add(VOLVO);
  const competitors = brandRanking
    .filter((row) => competitorSet.has(row.brand))
    .map((row) => ({
      ...row,
      differenceVsVolvo: row.units2026 - volvo2026
    }))
    .sort(sortByUnitsDesc);

  const highVolvoShare = volvoShareByCcaa
    .filter((row) => row.total2026 > 0)
    .slice(0, 5);
  const lowVolvoShare = [...volvoShareByCcaa]
    .filter((row) => row.total2026 > 0)
    .sort((a, b) => {
      const shareDiff = (a.volvoShare ?? 0) - (b.volvoShare ?? 0);
      return shareDiff || b.total2026 - a.total2026 || a.ccaa.localeCompare(b.ccaa, "es");
    })
    .slice(0, 5);

  const brandCcaaMatrix = buildBrandCcaaMatrix(records2026, brandRanking, ccaaRanking);
  const marketPerformance = marketRanking.map((row) => {
    const currentMarket = records2026.filter((item) => item.market === row.market);
    const volvoMarket = sum(currentMarket.filter((item) => item.brand === VOLVO));
    return {
      ...row,
      volvo2026: volvoMarket,
      volvoShare: pct(volvoMarket, row.units2026)
    };
  });

  const leaderCcaaByVolume = ccaaRanking[0] || null;
  const leaderVolvoShareCcaa = highVolvoShare[0] || null;
  const lowestVolvoShareCcaa = lowVolvoShare[0] || null;
  const bestMarket = [...marketPerformance]
    .filter((row) => row.units2025 > 0)
    .sort((a, b) => (b.variation ?? -Infinity) - (a.variation ?? -Infinity))[0] || null;

  return {
    filters,
    kpis: {
      totalMarket2026: total2026,
      totalMarket2025: total2025,
      marketVariation: compactVariation(yoy(total2026, total2025)),
      volvo2026,
      volvo2025,
      volvoVariation: compactVariation(yoy(volvo2026, volvo2025)),
      volvoShare2026: pct(volvo2026, total2026),
      volvoRank: volvoRank?.rank || null,
      brandCount: brandRanking.length,
      leaderBrand: leaderBrand
        ? {
            brand: leaderBrand.brand,
            units2026: leaderBrand.units2026,
            differenceVsVolvo: leaderBrand.units2026 - volvo2026
          }
        : null,
      leaderCcaaByVolume: leaderCcaaByVolume
        ? { ccaa: leaderCcaaByVolume.ccaa, units2026: leaderCcaaByVolume.units2026 }
        : null,
      leaderVolvoShareCcaa: leaderVolvoShareCcaa
        ? {
            ccaa: leaderVolvoShareCcaa.ccaa,
            share: leaderVolvoShareCcaa.volvoShare,
            volvo2026: leaderVolvoShareCcaa.volvo2026,
            total2026: leaderVolvoShareCcaa.total2026
          }
        : null,
      lowestVolvoShareCcaa: lowestVolvoShareCcaa
        ? {
            ccaa: lowestVolvoShareCcaa.ccaa,
            share: lowestVolvoShareCcaa.volvoShare,
            volvo2026: lowestVolvoShareCcaa.volvo2026,
            total2026: lowestVolvoShareCcaa.total2026
          }
        : null,
      bestMarket
    },
    brandRanking,
    ccaaRanking,
    brandMarketShare: brandRanking.map((row) => ({
      brand: row.brand,
      units2026: row.units2026,
      share: row.share
    })),
    volvoShareByCcaa,
    monthlyEvolution,
    competitors,
    volvoHighShareCommunities: highVolvoShare,
    volvoLowShareCommunities: lowVolvoShare,
    brandCcaaMatrix,
    marketPerformance,
    territorialTable: volvoShareByCcaa.sort((a, b) => b.total2026 - a.total2026)
  };
}

function uniqueSorted(records, key) {
  return Array.from(new Set(records.map((row) => row[key]).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

function main() {
  const parsed = parseWorkbook();
  const dashboard = buildDashboard(parsed.records);
  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      title: "Dashboard ejecutivo · Camiones pesados España",
      subtitle: "Enero-abril 2026 · Foco Volvo Trucks",
      source: "Datos internos IDEAUTO a partir del fichero Excel adjunto",
      sourceFile: path.relative(PROJECT_ROOT, INPUT_FILE),
      sourceSheet: parsed.quality.sourceSheet,
      scope: {
        years: [2025, 2026],
        months: MONTHS,
        markets: ["Camión Rígido", "Tractocamión"],
        focusBrand: VOLVO
      }
    },
    dimensions: {
      markets: uniqueSorted(parsed.records, "market"),
      communities: uniqueSorted(parsed.records, "ccaa"),
      brands: uniqueSorted(parsed.records, "brand"),
      months: MONTHS
    },
    records: parsed.records,
    aggregates: dashboard,
    quality: parsed.quality
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    OUTPUT_JS,
    `window.DASHBOARD_DATA = ${JSON.stringify(output)};\n`,
    "utf8"
  );

  console.log(`Datos procesados: ${parsed.records.length} registros en alcance.`);
  console.log(`JSON generado: ${path.relative(PROJECT_ROOT, OUTPUT_JSON)}`);
  console.log(`JS generado para apertura local: ${path.relative(PROJECT_ROOT, OUTPUT_JS)}`);

  if (parsed.quality.invalidRowsCount > 0) {
    console.warn(`Aviso: ${parsed.quality.invalidRowsCount} filas invalidas excluidas.`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error al procesar datos: ${error.message}`);
  process.exit(1);
}
