const APP = {
  data: null,
  summary: null,
  charts: {},
  colors: {
    blue900: "#0b1f3a",
    blue700: "#174f87",
    blue500: "#2678bf",
    teal: "#0f766e",
    amber: "#b7791f",
    gray: "#64748b",
    grayLight: "#d9e2ec",
    red: "#b42318"
  }
};

const VOLVO = "VOLVO";
const MONTHS = [
  { number: 1, name: "Enero", short: "Ene" },
  { number: 2, name: "Febrero", short: "Feb" },
  { number: 3, name: "Marzo", short: "Mar" },
  { number: 4, name: "Abril", short: "Abr" }
];

const selectors = {
  market: document.getElementById("marketFilter"),
  ccaa: document.getElementById("ccaaFilter"),
  brand: document.getElementById("brandFilter"),
  status: document.getElementById("statusMessage")
};

function numberFormat(value) {
  return new Intl.NumberFormat("es-ES").format(value || 0);
}

function percentFormat(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n.d.";
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function variationClass(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "neutral";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function sum(records) {
  return records.reduce((total, row) => total + row.units, 0);
}

function pct(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function yoy(current, previous) {
  return previous ? (current - previous) / previous : null;
}

function groupSum(records, keyFn) {
  const grouped = new Map();
  records.forEach((row) => {
    const key = keyFn(row);
    grouped.set(key, (grouped.get(key) || 0) + row.units);
  });
  return grouped;
}

function applyFilters(records, filters) {
  return records.filter((row) => {
    if (filters.market !== "Todos" && row.market !== filters.market) return false;
    if (filters.ccaa !== "Todas" && row.ccaa !== filters.ccaa) return false;
    if (filters.brand !== "Todas" && row.brand !== filters.brand) return false;
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
        variation: yoy(units2026, units2025),
        share: pct(units2026, total2026)
      };
    })
    .sort((a, b) => b.units2026 - a.units2026 || a.name.localeCompare(b.name, "es"))
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function buildBrandCcaaMatrix(records2026, brandRanking, ccaaRanking) {
  const brands = brandRanking.map((row) => row.brand);
  const communities = ccaaRanking.map((row) => row.ccaa);
  const ccaaTotals = groupSum(records2026, (row) => row.ccaa);
  const longRows = [];

  communities.forEach((ccaa) => {
    brands.forEach((brand) => {
      const units = sum(records2026.filter((row) => row.ccaa === ccaa && row.brand === brand));
      longRows.push({
        ccaa,
        brand,
        units,
        shareOfCommunity: pct(units, ccaaTotals.get(ccaa) || 0)
      });
    });
  });

  return { brands, communities, longRows };
}

function buildSummary(records, filters) {
  const scoped = applyFilters(records, filters);
  const records2026 = scoped.filter((row) => row.year === 2026);
  const records2025 = scoped.filter((row) => row.year === 2025);
  const total2026 = sum(records2026);
  const total2025 = sum(records2025);
  const volvo2026 = sum(records2026.filter((row) => row.brand === VOLVO));
  const volvo2025 = sum(records2025.filter((row) => row.brand === VOLVO));

  const brandRanking = buildRanking(records2026, records2025, "brand", "brand");
  const ccaaRanking = buildRanking(records2026, records2025, "ccaa", "ccaa");
  const marketPerformance = buildRanking(records2026, records2025, "market", "market").map((row) => {
    const currentMarket = records2026.filter((item) => item.market === row.market);
    const volvoMarket = sum(currentMarket.filter((item) => item.brand === VOLVO));
    return { ...row, volvo2026: volvoMarket, volvoShare: pct(volvoMarket, row.units2026) };
  });

  const volvoShareByCcaa = ccaaRanking
    .map((row) => {
      const currentCcaa = records2026.filter((item) => item.ccaa === row.ccaa);
      const priorCcaa = records2025.filter((item) => item.ccaa === row.ccaa);
      const totalCcaa2026 = sum(currentCcaa);
      const totalCcaa2025 = sum(priorCcaa);
      const volvoCcaa2026 = sum(currentCcaa.filter((item) => item.brand === VOLVO));
      const volvoCcaa2025 = sum(priorCcaa.filter((item) => item.brand === VOLVO));
      return {
        ccaa: row.ccaa,
        total2026: totalCcaa2026,
        total2025: totalCcaa2025,
        variation: yoy(totalCcaa2026, totalCcaa2025),
        volvo2026: volvoCcaa2026,
        volvo2025: volvoCcaa2025,
        volvoVariation: yoy(volvoCcaa2026, volvoCcaa2025),
        volvoShare: pct(volvoCcaa2026, totalCcaa2026)
      };
    })
    .sort((a, b) => (b.volvoShare ?? -1) - (a.volvoShare ?? -1) || b.total2026 - a.total2026);

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
      marketVariation: yoy(market2026, market2025),
      volvo2026: volvoMonth2026,
      volvo2025: volvoMonth2025,
      volvoVariation: yoy(volvoMonth2026, volvoMonth2025),
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
    .map((row) => ({ ...row, differenceVsVolvo: row.units2026 - volvo2026 }))
    .sort((a, b) => b.units2026 - a.units2026);

  const highVolvoShare = volvoShareByCcaa.filter((row) => row.total2026 > 0).slice(0, 5);
  const lowVolvoShare = [...volvoShareByCcaa]
    .filter((row) => row.total2026 > 0)
    .sort((a, b) => (a.volvoShare ?? 0) - (b.volvoShare ?? 0) || b.total2026 - a.total2026)
    .slice(0, 5);
  const brandCcaaMatrix = buildBrandCcaaMatrix(records2026, brandRanking, ccaaRanking);
  const leaderBrand = brandRanking[0] || null;
  const volvoRank = brandRanking.find((row) => row.brand === VOLVO) || null;
  const bestMarket =
    [...marketPerformance]
      .filter((row) => row.units2025 > 0)
      .sort((a, b) => (b.variation ?? -Infinity) - (a.variation ?? -Infinity))[0] || null;

  return {
    filters,
    kpis: {
      totalMarket2026: total2026,
      totalMarket2025: total2025,
      marketVariation: yoy(total2026, total2025),
      volvo2026,
      volvo2025,
      volvoVariation: yoy(volvo2026, volvo2025),
      volvoShare2026: pct(volvo2026, total2026),
      volvoRank: volvoRank?.rank || null,
      brandCount: brandRanking.length,
      leaderBrand: leaderBrand
        ? { brand: leaderBrand.brand, units2026: leaderBrand.units2026, differenceVsVolvo: leaderBrand.units2026 - volvo2026 }
        : null,
      leaderCcaaByVolume: ccaaRanking[0] ? { ccaa: ccaaRanking[0].ccaa, units2026: ccaaRanking[0].units2026 } : null,
      leaderVolvoShareCcaa: highVolvoShare[0]
        ? { ccaa: highVolvoShare[0].ccaa, share: highVolvoShare[0].volvoShare, volvo2026: highVolvoShare[0].volvo2026, total2026: highVolvoShare[0].total2026 }
        : null,
      lowestVolvoShareCcaa: lowVolvoShare[0]
        ? { ccaa: lowVolvoShare[0].ccaa, share: lowVolvoShare[0].volvoShare, volvo2026: lowVolvoShare[0].volvo2026, total2026: lowVolvoShare[0].total2026 }
        : null,
      bestMarket
    },
    brandRanking,
    ccaaRanking,
    brandMarketShare: brandRanking.map((row) => ({ brand: row.brand, units2026: row.units2026, share: row.share })),
    volvoShareByCcaa,
    monthlyEvolution,
    competitors,
    volvoHighShareCommunities: highVolvoShare,
    volvoLowShareCommunities: lowVolvoShare,
    brandCcaaMatrix,
    marketPerformance,
    territorialTable: [...volvoShareByCcaa].sort((a, b) => b.total2026 - a.total2026)
  };
}

function createOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

function populateSelect(select, values, allValue, allLabel) {
  select.innerHTML = "";
  select.appendChild(createOption(allValue, allLabel));
  values.forEach((value) => select.appendChild(createOption(value, value)));
}

function getFilters() {
  return {
    market: selectors.market.value || "Todos",
    ccaa: selectors.ccaa.value || "Todas",
    brand: selectors.brand.value || "Todas"
  };
}

function setStatus(message) {
  selectors.status.textContent = message || "";
  selectors.status.hidden = !message;
}

function destroyChart(id) {
  if (APP.charts[id]) {
    APP.charts[id].destroy();
    APP.charts[id] = null;
  }
}

function chartOptions(extra = {}) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { boxWidth: 12, color: APP.colors.gray } },
      tooltip: {
        callbacks: {
          label(context) {
            const raw = context.raw;
            if (context.dataset?.isPercent) return `${context.dataset.label}: ${percentFormat(raw)}`;
            return `${context.dataset.label || context.label}: ${numberFormat(raw)}`;
          }
        }
      }
    },
    scales: {
      x: { ticks: { color: APP.colors.gray }, grid: { color: "#eef3f8" } },
      y: { ticks: { color: APP.colors.gray }, grid: { color: "#eef3f8" } }
    },
  };

  return {
    ...base,
    ...extra,
    plugins: {
      ...base.plugins,
      ...(extra.plugins || {})
    },
    scales: extra.scales || base.scales
  };
}

function renderCharts(summary) {
  if (!window.Chart) {
    setStatus("Chart.js no se ha cargado. Ejecuta npm install o usa npm run serve con conexion disponible.");
    return;
  }

  const palette = [
    APP.colors.blue700,
    APP.colors.blue500,
    APP.colors.teal,
    APP.colors.amber,
    "#6b7280",
    "#334155",
    "#7c3aed",
    "#0f766e",
    "#dc6b19",
    "#4f46e5"
  ];

  destroyChart("brandRankingChart");
  APP.charts.brandRankingChart = new Chart(document.getElementById("brandRankingChart"), {
    type: "bar",
    data: {
      labels: summary.brandRanking.slice(0, 12).map((row) => row.brand),
      datasets: [
        {
          label: "Unidades 2026",
          data: summary.brandRanking.slice(0, 12).map((row) => row.units2026),
          backgroundColor: summary.brandRanking.slice(0, 12).map((row) => (row.brand === VOLVO ? APP.colors.blue500 : APP.colors.blue900)),
          borderRadius: 4
        }
      ]
    },
    options: chartOptions({ indexAxis: "y", plugins: { legend: { display: false } } })
  });

  destroyChart("brandShareChart");
  const shareRows = summary.brandMarketShare.slice(0, 8);
  const otherUnits = summary.brandMarketShare.slice(8).reduce((acc, row) => acc + row.units2026, 0);
  const doughnutRows = otherUnits ? [...shareRows, { brand: "Resto", units2026: otherUnits }] : shareRows;
  APP.charts.brandShareChart = new Chart(document.getElementById("brandShareChart"), {
    type: "doughnut",
    data: {
      labels: doughnutRows.map((row) => row.brand),
      datasets: [
        {
          label: "Unidades 2026",
          data: doughnutRows.map((row) => row.units2026),
          backgroundColor: doughnutRows.map((row, index) => (row.brand === VOLVO ? APP.colors.blue500 : palette[index % palette.length])),
          borderColor: "#ffffff",
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: { labels: { boxWidth: 12, color: APP.colors.gray } },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${numberFormat(context.raw)}`;
            }
          }
        }
      }
    }
  });

  destroyChart("monthlyChart");
  APP.charts.monthlyChart = new Chart(document.getElementById("monthlyChart"), {
    data: {
      labels: summary.monthlyEvolution.map((row) => row.short),
      datasets: [
        {
          type: "bar",
          label: "Mercado 2026",
          data: summary.monthlyEvolution.map((row) => row.market2026),
          backgroundColor: APP.colors.blue900,
          borderRadius: 4,
          yAxisID: "y"
        },
        {
          type: "line",
          label: "Volvo 2026",
          data: summary.monthlyEvolution.map((row) => row.volvo2026),
          borderColor: APP.colors.blue500,
          backgroundColor: APP.colors.blue500,
          tension: 0.3,
          pointRadius: 4,
          yAxisID: "y1"
        }
      ]
    },
    options: chartOptions({
      scales: {
        y: { beginAtZero: true, ticks: { color: APP.colors.gray }, grid: { color: "#eef3f8" } },
        y1: { beginAtZero: true, position: "right", ticks: { color: APP.colors.blue500 }, grid: { drawOnChartArea: false } },
        x: { ticks: { color: APP.colors.gray }, grid: { display: false } }
      }
    })
  });

  destroyChart("volvoCcaaShareChart");
  const ccaaShare = summary.volvoShareByCcaa.filter((row) => row.total2026 > 0).slice(0, 17);
  APP.charts.volvoCcaaShareChart = new Chart(document.getElementById("volvoCcaaShareChart"), {
    type: "bar",
    data: {
      labels: ccaaShare.map((row) => row.ccaa),
      datasets: [
        {
          label: "Cuota Volvo",
          data: ccaaShare.map((row) => row.volvoShare || 0),
          backgroundColor: APP.colors.blue500,
          borderRadius: 4,
          isPercent: true
        }
      ]
    },
    options: chartOptions({
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: APP.colors.gray, callback: (value) => percentFormat(value, 0) },
          grid: { color: "#eef3f8" }
        },
        y: { ticks: { color: APP.colors.gray }, grid: { display: false } }
      }
    })
  });

  destroyChart("competitorChart");
  APP.charts.competitorChart = new Chart(document.getElementById("competitorChart"), {
    type: "bar",
    data: {
      labels: summary.competitors.map((row) => row.brand),
      datasets: [
        {
          label: "2026",
          data: summary.competitors.map((row) => row.units2026),
          backgroundColor: summary.competitors.map((row) => (row.brand === VOLVO ? APP.colors.blue500 : APP.colors.blue900)),
          borderRadius: 4
        },
        {
          label: "2025",
          data: summary.competitors.map((row) => row.units2025),
          backgroundColor: APP.colors.grayLight,
          borderRadius: 4
        }
      ]
    },
    options: chartOptions()
  });
}

function renderKpis(summary) {
  const kpis = summary.kpis;
  setText("kpiTotal2026", numberFormat(kpis.totalMarket2026));
  setText("kpiTotal2025", `2025: ${numberFormat(kpis.totalMarket2025)}`);
  setText("kpiVolvo2026", numberFormat(kpis.volvo2026));
  setText("kpiVolvo2025", `2025: ${numberFormat(kpis.volvo2025)}`);
  setText("kpiVolvoShare", percentFormat(kpis.volvoShare2026));
  setText("kpiVolvoRank", kpis.volvoRank ? `#${kpis.volvoRank}` : "n.d.");
  setText("kpiBrandCount", kpis.brandCount ? `de ${kpis.brandCount} marcas` : "sin ranking");
  setText("kpiMarketVariation", percentFormat(kpis.marketVariation));
  setText("kpiVolvoVariation", percentFormat(kpis.volvoVariation));
  setText("kpiLeaderCcaa", kpis.leaderCcaaByVolume?.ccaa || "n.d.");
  setText("kpiLeaderCcaaUnits", kpis.leaderCcaaByVolume ? `${numberFormat(kpis.leaderCcaaByVolume.units2026)} unidades` : "-");
  setText("kpiLeaderVolvoShare", kpis.leaderVolvoShareCcaa?.ccaa || "n.d.");
  setText("kpiLeaderVolvoShareValue", kpis.leaderVolvoShareCcaa ? percentFormat(kpis.leaderVolvoShareCcaa.share) : "-");

  ["kpiMarketVariation", "kpiVolvoVariation"].forEach((id) => {
    const element = document.getElementById(id);
    const value = id === "kpiMarketVariation" ? kpis.marketVariation : kpis.volvoVariation;
    element.className = variationClass(value);
  });
}

function cell(value, className = "") {
  return `<td class="${className}">${value}</td>`;
}

function renderTable(tableId, headers, rows) {
  const table = document.getElementById(tableId);
  const headerHtml = `<thead><tr>${headers.map((header, index) => `<th class="${index === 0 ? "text" : ""}">${header}</th>`).join("")}</tr></thead>`;
  const bodyHtml = `<tbody>${rows.join("") || `<tr>${cell("Sin datos disponibles", "text")}<td colspan="${Math.max(headers.length - 1, 1)}"></td></tr>`}</tbody>`;
  table.innerHTML = headerHtml + bodyHtml;
}

function renderTables(summary) {
  renderTable(
    "territorialTable",
    ["CCAA", "Mercado 2026", "Volvo 2026", "Cuota Volvo"],
    summary.territorialTable.map(
      (row) =>
        `<tr>${cell(row.ccaa, "text")}${cell(numberFormat(row.total2026))}${cell(numberFormat(row.volvo2026))}${cell(percentFormat(row.volvoShare))}</tr>`
    )
  );

  renderTable(
    "brandsTable",
    ["#", "Marca", "2026", "2025", "Var.", "Cuota"],
    summary.brandRanking.map((row) => {
      const varClass = variationClass(row.variation);
      return `<tr>${cell(row.rank)}${cell(row.brand, "text")}${cell(numberFormat(row.units2026))}${cell(numberFormat(row.units2025))}${cell(percentFormat(row.variation), varClass)}${cell(percentFormat(row.share))}</tr>`;
    })
  );

  renderTable(
    "ccaaTable",
    ["#", "CCAA", "2026", "2025", "Var.", "Cuota"],
    summary.ccaaRanking.map((row) => {
      const varClass = variationClass(row.variation);
      return `<tr>${cell(row.rank)}${cell(row.ccaa, "text")}${cell(numberFormat(row.units2026))}${cell(numberFormat(row.units2025))}${cell(percentFormat(row.variation), varClass)}${cell(percentFormat(row.share))}</tr>`;
    })
  );

  renderTable(
    "volvoCcaaTable",
    ["CCAA", "Mercado 2026", "Volvo 2026", "Volvo 2025", "Var. Volvo", "Cuota Volvo"],
    summary.volvoShareByCcaa.map((row) => {
      const varClass = variationClass(row.volvoVariation);
      return `<tr>${cell(row.ccaa, "text")}${cell(numberFormat(row.total2026))}${cell(numberFormat(row.volvo2026))}${cell(numberFormat(row.volvo2025))}${cell(percentFormat(row.volvoVariation), varClass)}${cell(percentFormat(row.volvoShare))}</tr>`;
    })
  );

  renderTable(
    "competitorsTable",
    ["Marca", "2026", "2025", "Var.", "Cuota", "Dif. vs Volvo"],
    summary.competitors.map((row) => {
      const varClass = variationClass(row.variation);
      return `<tr>${cell(row.brand, "text")}${cell(numberFormat(row.units2026))}${cell(numberFormat(row.units2025))}${cell(percentFormat(row.variation), varClass)}${cell(percentFormat(row.share))}${cell(numberFormat(row.differenceVsVolvo))}</tr>`;
    })
  );

  renderTable(
    "matrixTable",
    ["CCAA", "Marca", "Unidades 2026", "Cuota en CCAA"],
    summary.brandCcaaMatrix.longRows.map(
      (row) =>
        `<tr>${cell(row.ccaa, "text")}${cell(row.brand, "text")}${cell(numberFormat(row.units))}${cell(percentFormat(row.shareOfCommunity))}</tr>`
    )
  );
}

function renderConclusions(summary) {
  const kpis = summary.kpis;
  const conclusions = [];

  if (kpis.volvoRank) {
    conclusions.push(`Volvo Trucks ocupa la posicion ${kpis.volvoRank} en el ranking filtrado, con una cuota del ${percentFormat(kpis.volvoShare2026)}.`);
  } else {
    conclusions.push("Volvo Trucks no registra matriculaciones en el filtro seleccionado.");
  }

  if (kpis.leaderBrand) {
    const diff = kpis.leaderBrand.differenceVsVolvo;
    conclusions.push(
      diff === 0
        ? `Volvo Trucks lidera el ranking junto a ${kpis.leaderBrand.brand}.`
        : `La diferencia frente al lider ${kpis.leaderBrand.brand} es de ${numberFormat(Math.abs(diff))} unidades.`
    );
  }

  if (kpis.leaderVolvoShareCcaa) {
    conclusions.push(
      `${kpis.leaderVolvoShareCcaa.ccaa} es la comunidad con mayor cuota Volvo: ${percentFormat(kpis.leaderVolvoShareCcaa.share)} sobre ${numberFormat(kpis.leaderVolvoShareCcaa.total2026)} unidades de mercado.`
    );
  }

  if (kpis.lowestVolvoShareCcaa) {
    conclusions.push(
      `${kpis.lowestVolvoShareCcaa.ccaa} presenta la menor cuota Volvo dentro del mercado filtrado: ${percentFormat(kpis.lowestVolvoShareCcaa.share)}.`
    );
  }

  if (kpis.bestMarket) {
    conclusions.push(
      `${kpis.bestMarket.market} muestra el mejor comportamiento interanual del filtro, con una variacion del ${percentFormat(kpis.bestMarket.variation)}.`
    );
  }

  document.getElementById("conclusionsList").innerHTML = conclusions.map((item) => `<li>${item}</li>`).join("");
}

function renderMethodology(data, filters) {
  const quality = data.quality || {};
  const notes = [
    {
      title: "Alcance temporal",
      body: "El dashboard considera enero, febrero, marzo y abril de 2026, y compara contra el mismo periodo de 2025 cuando existe base disponible."
    },
    {
      title: "Filtros aplicados",
      body: `Mercado: ${filters.market}. Comunidad autónoma: ${filters.ccaa}. Marca: ${filters.brand}. Los filtros afectan a KPIs, gráficos, tablas y conclusiones.`
    },
    {
      title: "Campos disponibles",
      body: "Mercado, CCAA, Marca, Año, Mes y Unidades. La marca Volvo Trucks se identifica como VOLVO en el fichero."
    },
    {
      title: "Control de calidad",
      body: `${numberFormat(quality.validRowsInScope)} registros válidos en alcance. ${numberFormat(quality.invalidRowsCount)} filas inválidas excluidas. Fuente procesada: ${quality.sourceSheet || "n.d."}.`
    }
  ];

  const inconsistencyCount = Object.values(quality.nameInconsistencies || {}).reduce((acc, rows) => acc + rows.length, 0);
  notes.push({
    title: "Limitaciones del fichero",
    body:
      inconsistencyCount > 0
        ? `Se detectaron ${inconsistencyCount} agrupaciones con variantes de nombre, normalizadas antes del cálculo.`
        : "No se han detectado variantes relevantes de nombres tras la normalización aplicada."
  });

  document.getElementById("methodologyNotes").innerHTML = notes
    .map((note) => `<article class="note-block"><h3>${note.title}</h3><p>${note.body}</p></article>`)
    .join("");
}

function renderActiveFilters(filters) {
  const active = [];
  if (filters.market !== "Todos") active.push(filters.market);
  if (filters.ccaa !== "Todas") active.push(filters.ccaa);
  if (filters.brand !== "Todas") active.push(filters.brand);
  setText("activeFiltersLabel", active.length ? `Filtros: ${active.join(" · ")}` : "Filtros: todos");
}

function renderDashboard() {
  const filters = getFilters();
  const summary = buildSummary(APP.data.records, filters);
  APP.summary = summary;

  if (summary.kpis.totalMarket2026 === 0 && summary.kpis.totalMarket2025 === 0) {
    setStatus("No hay datos disponibles para el filtro seleccionado.");
  } else {
    setStatus("");
  }

  renderActiveFilters(filters);
  renderKpis(summary);
  renderCharts(summary);
  renderTables(summary);
  renderConclusions(summary);
  renderMethodology(APP.data, filters);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv() {
  const summary = APP.summary;
  if (!summary) return;

  const sections = [];
  const addSection = (title, headers, rows) => {
    sections.push([title]);
    sections.push(headers);
    rows.forEach((row) => sections.push(row));
    sections.push([]);
  };

  addSection(
    "Ranking marcas",
    ["Rank", "Marca", "Unidades 2026", "Unidades 2025", "Variacion", "Cuota"],
    summary.brandRanking.map((row) => [row.rank, row.brand, row.units2026, row.units2025, row.variation ?? "", row.share ?? ""])
  );
  addSection(
    "Ranking CCAA",
    ["Rank", "CCAA", "Unidades 2026", "Unidades 2025", "Variacion", "Cuota"],
    summary.ccaaRanking.map((row) => [row.rank, row.ccaa, row.units2026, row.units2025, row.variation ?? "", row.share ?? ""])
  );
  addSection(
    "Volvo por CCAA",
    ["CCAA", "Mercado 2026", "Volvo 2026", "Volvo 2025", "Variacion Volvo", "Cuota Volvo"],
    summary.volvoShareByCcaa.map((row) => [row.ccaa, row.total2026, row.volvo2026, row.volvo2025, row.volvoVariation ?? "", row.volvoShare ?? ""])
  );
  addSection(
    "Competidores",
    ["Marca", "Unidades 2026", "Unidades 2025", "Variacion", "Cuota", "Dif vs Volvo"],
    summary.competitors.map((row) => [row.brand, row.units2026, row.units2025, row.variation ?? "", row.share ?? "", row.differenceVsVolvo])
  );
  addSection(
    "Marca x CCAA",
    ["CCAA", "Marca", "Unidades 2026", "Cuota en CCAA"],
    summary.brandCcaaMatrix.longRows.map((row) => [row.ccaa, row.brand, row.units, row.shareOfCommunity ?? ""])
  );

  const csv = sections.map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dashboard_volvo_trucks_tablas.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function loadData() {
  if (window.DASHBOARD_DATA) return window.DASHBOARD_DATA;
  const response = await fetch("data/dashboard_data.json");
  if (!response.ok) throw new Error("No se pudo cargar data/dashboard_data.json");
  return response.json();
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll(".tables-panel .table-wrap").forEach((wrap) => {
        wrap.hidden = wrap.id !== `${button.dataset.table}Wrap`;
      });
    });
  });
}

function initEvents() {
  [selectors.market, selectors.ccaa, selectors.brand].forEach((select) => {
    select.addEventListener("change", renderDashboard);
  });
  document.getElementById("resetFilters").addEventListener("click", () => {
    selectors.market.value = "Todos";
    selectors.ccaa.value = "Todas";
    selectors.brand.value = "Todas";
    renderDashboard();
  });
  document.getElementById("exportCsv").addEventListener("click", exportCsv);
  document.getElementById("printDashboard").addEventListener("click", () => window.print());
}

async function init() {
  try {
    APP.data = await loadData();
    populateSelect(selectors.market, APP.data.dimensions.markets, "Todos", "Todos");
    populateSelect(selectors.ccaa, APP.data.dimensions.communities, "Todas", "Todas");
    populateSelect(selectors.brand, APP.data.dimensions.brands, "Todas", "Todas");
    setText("generatedDate", `Informe generado: ${new Date(APP.data.meta.generatedAt).toLocaleString("es-ES")}`);
    initTabs();
    initEvents();
    renderDashboard();
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  }
}

document.addEventListener("DOMContentLoaded", init);
