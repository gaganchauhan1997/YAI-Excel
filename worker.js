// YAI-Excel Backend Worker v2.0
// Cloudflare Worker ES Module - no npm dependencies
// Supports: Groq API (user key) + Gemini API (user key or server key)
// Output: Interactive HTML Dashboard + Excel file

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const THEMES = ['midnight', 'emerald', 'crimson', 'slate', 'amber', 'ocean', 'violet', 'rose', 'carbon', 'arctic'];

const THEME_COLORS = {
  midnight: { bg: '#0a0a0f', card: '#12121a', accent: '#00f0ff', text: '#e0e0e0', header: '#00f0ff', chart: ['#00f0ff','#7c3aed','#10b981','#f59e0b','#ef4444'] },
  emerald:  { bg: '#022c22', card: '#064e3b', accent: '#10b981', text: '#d1fae5', header: '#fff',     chart: ['#10b981','#34d399','#6ee7b7','#a7f3d0','#059669'] },
  crimson:  { bg: '#1a0505', card: '#2a0a0a', accent: '#ef4444', text: '#fecaca', header: '#ef4444',  chart: ['#ef4444','#f87171','#fca5a5','#f43f5e','#e11d48'] },
  slate:    { bg: '#0f172a', card: '#1e293b', accent: '#94a3b8', text: '#e2e8f0', header: '#94a3b8',  chart: ['#94a3b8','#60a5fa','#a78bfa','#34d399','#f59e0b'] },
  amber:    { bg: '#1c0a00', card: '#2d1500', accent: '#f59e0b', text: '#fef3c7', header: '#f59e0b',  chart: ['#f59e0b','#fbbf24','#fcd34d','#ef4444','#10b981'] },
  ocean:    { bg: '#0c1a2e', card: '#0c4a6e', accent: '#0ea5e9', text: '#e0f2fe', header: '#0ea5e9',  chart: ['#0ea5e9','#38bdf8','#7dd3fc','#06b6d4','#0284c7'] },
  violet:   { bg: '#1a0533', card: '#2e1065', accent: '#8b5cf6', text: '#ede9fe', header: '#c4b5fd',  chart: ['#8b5cf6','#a78bfa','#c4b5fd','#7c3aed','#6d28d9'] },
  rose:     { bg: '#1a0010', card: '#4c0519', accent: '#f43f5e', text: '#ffe4e6', header: '#f43f5e',  chart: ['#f43f5e','#fb7185','#fda4af','#e11d48','#f59e0b'] },
  carbon:   { bg: '#0d0d0d', card: '#1a1a1a', accent: '#6b7280', text: '#f3f4f6', header: '#9ca3af',  chart: ['#6b7280','#9ca3af','#d1d5db','#4b5563','#374151'] },
  arctic:   { bg: '#050e2a', card: '#0c1445', accent: '#60a5fa', text: '#dbeafe', header: '#60a5fa',  chart: ['#60a5fa','#93c5fd','#38bdf8','#818cf8','#34d399'] },
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

function generateUUID() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function parseJSON(text) {
  let cleaned = text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(cleaned); } catch(e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch(e2) {}
    return null;
  }
}

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Parse header
  const headers = parseCSVLine(lines[0]);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current.trim());
  return result;
}

// ── Data Stats Computation (pure JS, no AI needed) ────────────────────────────

function computeStats(rows, headers) {
  const stats = {};
  for (const h of headers) {
    const values = rows.map(r => r[h]).filter(v => v !== null && v !== undefined && v !== '');
    const numerics = values.map(v => {
      const cleaned = String(v).replace(/[$,€£%\s]/g, '');
      return parseFloat(cleaned);
    }).filter(v => !isNaN(v));

    if (numerics.length >= values.length * 0.6 && values.length > 0) {
      const sum = numerics.reduce((a, b) => a + b, 0);
      stats[h] = {
        type: 'numeric',
        sum: Math.round(sum * 100) / 100,
        avg: Math.round((sum / numerics.length) * 100) / 100,
        min: Math.min(...numerics),
        max: Math.max(...numerics),
        count: numerics.length,
      };
    } else {
      const counts = {};
      for (const v of values) counts[v] = (counts[v] || 0) + 1;
      const uniqueCount = Object.keys(counts).length;
      stats[h] = {
        type: 'categorical',
        unique_count: uniqueCount,
        value_counts: Object.fromEntries(
          Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20)
        ),
        sample: Object.keys(counts).slice(0, 8),
      };
    }
  }
  return stats;
}

function computeGroupedAgg(rows, headers, stats) {
  const dimensions = headers.filter(h => stats[h]?.type === 'categorical' && stats[h].unique_count <= 20);
  const metrics = headers.filter(h => stats[h]?.type === 'numeric');

  const grouped = {};
  for (const dim of dimensions) {
    grouped[dim] = {};
    for (const dimVal of Object.keys(stats[dim].value_counts)) {
      const dimRows = rows.filter(r => r[dim] === dimVal);
      grouped[dim][dimVal] = {};
      for (const metric of metrics) {
        const sum = dimRows.reduce((acc, r) => {
          const v = parseFloat(String(r[metric] || '').replace(/[$,€£%\s]/g, ''));
          return acc + (isNaN(v) ? 0 : v);
        }, 0);
        grouped[dim][dimVal][metric] = Math.round(sum * 100) / 100;
      }
    }
  }
  return { dimensions, metrics, grouped };
}

// ── AI Providers ──────────────────────────────────────────────────────────────

async function callGroq(apiKey, prompt, systemPrompt = '') {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 4096,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Groq error ${resp.status}: ${err.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(apiKey, prompt, inlineData = null) {
  const parts = [];
  if (inlineData) parts.push({ inline_data: inlineData });
  parts.push({ text: prompt });

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 8192 },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini error ${resp.status}: ${err.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Unified AI caller: tries Groq first (fast + free), falls back to Gemini
async function callAI(keys, prompt, systemPrompt = '') {
  if (keys.groq) {
    const raw = await callGroq(keys.groq, prompt, systemPrompt);
    return parseJSON(raw) || raw;
  }
  if (keys.gemini) {
    const raw = await callGemini(keys.gemini, prompt);
    return parseJSON(raw) || raw;
  }
  throw new Error('No API key provided. Please add your Groq or Gemini free API key.');
}

// ── Dashboard Spec Generator ───────────────────────────────────────────────────

async function buildDashboardSpec(rows, headers, stats, groupedData, keys) {
  const { dimensions, metrics, grouped } = groupedData;

  // Prepare compact summary for AI
  const colSummary = {};
  for (const h of headers) {
    if (stats[h].type === 'numeric') {
      colSummary[h] = { type: 'numeric', sum: stats[h].sum, avg: stats[h].avg, min: stats[h].min, max: stats[h].max };
    } else {
      colSummary[h] = { type: 'categorical', unique: stats[h].unique_count, top_values: stats[h].sample };
    }
  }

  // Build grouped aggregation samples for AI context
  const groupedSample = {};
  for (const dim of dimensions.slice(0, 3)) {
    groupedSample[dim] = {};
    for (const val of Object.keys(stats[dim].value_counts).slice(0, 10)) {
      groupedSample[dim][val] = {};
      for (const m of metrics.slice(0, 4)) {
        groupedSample[dim][val][m] = grouped[dim]?.[val]?.[m] ?? 0;
      }
    }
  }

  const prompt = `You are a data analyst. Analyze this dataset and create a dashboard specification. Return ONLY valid JSON, no markdown fences.

Dataset: ${rows.length} rows, ${headers.length} columns
Columns: ${JSON.stringify(colSummary)}
Grouped aggregations: ${JSON.stringify(groupedSample)}

Return JSON with this EXACT structure:
{
  "title": "2-3 word dashboard title based on data domain",
  "domain": "domain name (e.g. Sales, Manufacturing, Finance, HR, etc.)",
  "kpis": [
    {"label": "metric name", "value": <number>, "format": "number|currency|percent|compact", "prefix": "", "suffix": ""},
    ...3 to 5 KPIs using the most important numeric columns (total sums or counts)
  ],
  "charts": [
    {
      "id": "chart1",
      "type": "horizontalBar",
      "title": "chart title",
      "labels": ["label1", "label2", ...],
      "datasets": [{"label": "series name", "data": [10, 20, ...]}]
    },
    {
      "id": "chart2",
      "type": "doughnut",
      "title": "chart title",
      "labels": ["label1", "label2", ...],
      "datasets": [{"label": "series name", "data": [25, 30, 45]}]
    },
    {
      "id": "chart3",
      "type": "pie",
      "title": "chart title",
      "labels": ["label1", ...],
      "datasets": [{"label": "series name", "data": [10, 20, 30]}]
    },
    {
      "id": "chart4",
      "type": "stackedBar",
      "title": "chart title (full width, shows trend)",
      "labels": ["cat1", "cat2", ...],
      "datasets": [
        {"label": "series1", "data": [10, 20, ...]},
        {"label": "series2", "data": [5, 15, ...]}
      ]
    }
  ],
  "filters": {
    "CategoryColumn": ["val1", "val2", "val3"]
  }
}

Rules:
- Use ACTUAL values from the grouped aggregations provided
- KPI values must be actual numbers (not strings)
- Chart data must use actual computed values from the dataset
- Pick the most meaningful dimension-metric combinations
- filters: max 3 categorical columns, max 8 values each`;

  const systemPrompt = 'You are a data visualization expert. Return only valid JSON, no markdown.';

  try {
    const result = await callAI(keys, prompt, systemPrompt);
    if (typeof result === 'object' && result !== null && result.kpis && result.charts) {
      return result;
    }
    throw new Error('Invalid spec returned');
  } catch (e) {
    console.error('AI spec error:', e.message);
    // Fallback: build spec from computed data
    return buildFallbackSpec(headers, stats, groupedData, rows.length);
  }
}

function buildFallbackSpec(headers, stats, groupedData, rowCount) {
  const { dimensions, metrics, grouped } = groupedData;
  const numericCols = metrics.slice(0, 5);
  const catCols = dimensions.slice(0, 3);

  // KPIs: top numeric sums + row count
  const kpis = [{ label: 'Total Records', value: rowCount, format: 'number', prefix: '', suffix: '' }];
  for (const m of numericCols.slice(0, 4)) {
    kpis.push({ label: `Total ${m}`, value: stats[m].sum, format: 'compact', prefix: '', suffix: '' });
  }

  // Charts from first categorical dimension × first two metrics
  const charts = [];
  if (catCols[0] && numericCols[0]) {
    const dim = catCols[0];
    const labels = Object.keys(stats[dim].value_counts).slice(0, 8);
    charts.push({
      id: 'chart1', type: 'horizontalBar',
      title: `${numericCols[0]} by ${dim}`,
      labels,
      datasets: [{ label: numericCols[0], data: labels.map(l => grouped[dim]?.[l]?.[numericCols[0]] ?? 0) }],
    });
  }

  if (catCols[0]) {
    const dim = catCols[0];
    const labels = Object.keys(stats[dim].value_counts).slice(0, 6);
    const data = labels.map(l => stats[dim].value_counts[l]);
    charts.push({ id: 'chart2', type: 'doughnut', title: `Distribution by ${dim}`, labels, datasets: [{ label: dim, data }] });
    charts.push({ id: 'chart3', type: 'pie', title: `Share by ${dim}`, labels, datasets: [{ label: dim, data }] });
  }

  if (catCols[1] && numericCols[0]) {
    const dim = catCols[1];
    const labels = Object.keys(stats[dim].value_counts).slice(0, 10);
    charts.push({
      id: 'chart4', type: 'stackedBar',
      title: `${numericCols[0]} trend by ${dim}`,
      labels,
      datasets: [{ label: numericCols[0], data: labels.map(l => grouped[dim]?.[l]?.[numericCols[0]] ?? 0) }],
    });
  }

  const filters = {};
  for (const dim of catCols) {
    filters[dim] = Object.keys(stats[dim].value_counts).slice(0, 8);
  }

  return { title: 'Data Dashboard', domain: 'General', kpis, charts, filters };
}

// ── HTML Dashboard Generator ───────────────────────────────────────────────────

function formatValue(value, format, prefix = '', suffix = '') {
  let formatted;
  const num = Number(value);
  if (isNaN(num)) return String(value);

  switch (format) {
    case 'currency':
      formatted = (num >= 1e6) ? `$${(num/1e6).toFixed(1)}M` : (num >= 1e3) ? `$${(num/1e3).toFixed(1)}K` : `$${num.toFixed(2)}`;
      break;
    case 'percent':
      formatted = `${num.toFixed(2)}%`;
      break;
    case 'compact':
      formatted = (num >= 1e9) ? `${(num/1e9).toFixed(1)}B` : (num >= 1e6) ? `${(num/1e6).toFixed(1)}M` : (num >= 1e3) ? `${(num/1e3).toFixed(1)}K` : num.toLocaleString();
      break;
    default:
      formatted = num >= 1e6 ? num.toLocaleString() : (Number.isInteger(num) ? num.toLocaleString() : num.toFixed(2));
  }
  return `${prefix}${formatted}${suffix}`;
}

function generateDashboardHTML(spec, theme, rawDataRows, csvHeaders) {
  const tc = THEME_COLORS[theme] || THEME_COLORS.midnight;
  const { title, domain, kpis = [], charts = [], filters = {} } = spec;

  const chartColors = tc.chart;
  const chartAlpha = chartColors.map(c => c + 'bb');

  // Serialize chart configs for Chart.js
  const chartConfigs = charts.map((ch, i) => {
    const datasets = (ch.datasets || []).map((ds, di) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ch.type === 'doughnut' || ch.type === 'pie'
        ? chartColors.map(c => c + 'dd')
        : chartColors[di % chartColors.length] + 'cc',
      borderColor: ch.type === 'doughnut' || ch.type === 'pie'
        ? chartColors.map(c => c)
        : chartColors[di % chartColors.length],
      borderWidth: 1.5,
      ...(ch.type === 'stackedBar' ? { stack: 'stack0' } : {}),
    }));

    const isHBar = ch.type === 'horizontalBar';
    const isStacked = ch.type === 'stackedBar';
    const isDoughnut = ch.type === 'doughnut';
    const isPie = ch.type === 'pie';

    return {
      id: ch.id || `chart${i}`,
      type: (isDoughnut) ? 'doughnut' : (isPie) ? 'pie' : 'bar',
      title: ch.title,
      position: i,
      data: { labels: ch.labels, datasets },
      options: {
        indexAxis: isHBar ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: isDoughnut || isPie || datasets.length > 1,
            position: isDoughnut || isPie ? 'right' : 'top',
            labels: { color: tc.text, font: { size: 11 }, boxWidth: 12 },
          },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: (isDoughnut || isPie) ? undefined : {
          x: {
            stacked: isStacked || isHBar,
            grid: { color: tc.text + '20' },
            ticks: { color: tc.text, font: { size: 10 } },
          },
          y: {
            stacked: isStacked,
            grid: { color: tc.text + '20' },
            ticks: { color: tc.text, font: { size: 10 } },
          },
        },
      },
    };
  });

  // KPI cards HTML
  const kpiCards = kpis.slice(0, 5).map((kpi, i) => {
    const displayVal = formatValue(kpi.value, kpi.format, kpi.prefix, kpi.suffix);
    const icons = ['📊', '💰', '⚡', '📈', '🎯'];
    return `
      <div class="kpi-card" style="border-top: 3px solid ${chartColors[i % chartColors.length]}">
        <div class="kpi-icon">${icons[i]}</div>
        <div class="kpi-value" style="color:${chartColors[i % chartColors.length]}">${displayVal}</div>
        <div class="kpi-label">${kpi.label}</div>
      </div>`;
  }).join('');

  // Filter pills HTML
  const filterHTML = Object.entries(filters).slice(0, 3).map(([col, vals]) => `
    <div class="filter-group">
      <div class="filter-title">${col}</div>
      <div class="filter-pills">
        <span class="pill active" onclick="toggleFilter('${col}', '__all__', this)">All</span>
        ${vals.map(v => `<span class="pill" onclick="toggleFilter('${col}', '${v.replace(/'/g, "\\'")}', this)">${v}</span>`).join('')}
      </div>
    </div>`).join('');

  // Chart layout: positions 0,1,2 = top row (33% each), position 3 = full width
  const topCharts = chartConfigs.slice(0, 3);
  const bottomCharts = chartConfigs.slice(3);

  const topChartHTML = topCharts.map(ch => `
    <div class="chart-card">
      <div class="chart-title">${ch.title}</div>
      <div class="chart-wrap"><canvas id="${ch.id}"></canvas></div>
    </div>`).join('');

  const bottomChartHTML = bottomCharts.map(ch => `
    <div class="chart-card chart-full">
      <div class="chart-title">${ch.title}</div>
      <div class="chart-wrap"><canvas id="${ch.id}"></canvas></div>
    </div>`).join('');

  // Raw data table (first 20 rows)
  const tableHeaders = csvHeaders.map(h => `<th>${h}</th>`).join('');
  const tableRows = rawDataRows.slice(0, 20).map(row =>
    `<tr>${csvHeaders.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`
  ).join('');

  const chartConfigsJson = JSON.stringify(chartConfigs);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: ${tc.bg}; color: ${tc.text}; min-height: 100vh; }

  .header {
    background: linear-gradient(135deg, ${tc.card} 0%, ${tc.bg} 100%);
    border-bottom: 2px solid ${chartColors[0]}44;
    padding: 16px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .header-title { font-size: 1.6rem; font-weight: 700; color: ${tc.header}; letter-spacing: -0.5px; }
  .header-title span { font-size: 0.9rem; color: ${tc.text}88; font-weight: 400; margin-left: 8px; }
  .theme-badge {
    background: ${chartColors[0]}22; border: 1px solid ${chartColors[0]}44;
    color: ${chartColors[0]}; border-radius: 20px; padding: 4px 14px; font-size: 0.78rem; font-weight: 600;
  }
  .tabs { background: ${tc.card}; padding: 0 24px; display: flex; gap: 0; border-bottom: 1px solid ${chartColors[0]}33; overflow-x: auto; }
  .tab { padding: 10px 18px; color: ${tc.text}88; font-size: 0.85rem; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; }
  .tab.active { color: ${chartColors[0]}; border-bottom-color: ${chartColors[0]}; }
  .tab:hover { color: ${tc.text}; }

  .main { display: flex; flex-direction: column; gap: 16px; padding: 16px 20px; }

  /* KPI Row */
  .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .kpi-card {
    background: ${tc.card}; border-radius: 10px; padding: 16px;
    display: flex; flex-direction: column; gap: 4px;
    transition: transform 0.2s; cursor: default;
  }
  .kpi-card:hover { transform: translateY(-2px); }
  .kpi-icon { font-size: 1.3rem; }
  .kpi-value { font-size: 1.7rem; font-weight: 700; line-height: 1.1; }
  .kpi-label { font-size: 0.78rem; color: ${tc.text}88; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

  /* Filters */
  .filter-row { background: ${tc.card}; border-radius: 10px; padding: 14px 18px; display: flex; flex-wrap: wrap; gap: 16px; }
  .filter-group { display: flex; flex-direction: column; gap: 6px; }
  .filter-title { font-size: 0.72rem; color: ${tc.text}99; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .filter-pills { display: flex; flex-wrap: wrap; gap: 5px; }
  .pill {
    padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; cursor: pointer;
    background: ${tc.text}15; color: ${tc.text}cc; border: 1px solid ${tc.text}22;
    transition: all 0.15s;
  }
  .pill:hover, .pill.active { background: ${chartColors[0]}22; color: ${chartColors[0]}; border-color: ${chartColors[0]}55; }

  /* Charts */
  .charts-top { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .charts-bottom { display: flex; flex-direction: column; gap: 14px; }
  .chart-card { background: ${tc.card}; border-radius: 10px; padding: 14px; }
  .chart-full { }
  .chart-title { font-size: 0.82rem; font-weight: 600; color: ${tc.text}cc; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .chart-wrap { height: 220px; position: relative; }
  .chart-full .chart-wrap { height: 240px; }

  /* Data Table */
  .data-section { background: ${tc.card}; border-radius: 10px; padding: 14px; overflow: hidden; }
  .section-title { font-size: 0.82rem; font-weight: 600; color: ${tc.text}cc; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th { background: ${chartColors[0]}22; color: ${chartColors[0]}; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid ${chartColors[0]}33; }
  td { padding: 6px 10px; border-bottom: 1px solid ${tc.text}10; color: ${tc.text}bb; }
  tr:hover td { background: ${tc.text}08; }

  @media (max-width: 900px) {
    .charts-top { grid-template-columns: 1fr; }
    .kpi-row { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .header-title { font-size: 1.2rem; }
    .kpi-value { font-size: 1.3rem; }
  }
  .footer { text-align: center; padding: 16px; color: ${tc.text}44; font-size: 0.75rem; }
</style>
</head>
<body>

<div class="header">
  <div class="header-title">📊 ${title}<span>Dashboard</span></div>
  <div class="theme-badge">${theme} · ${domain}</div>
</div>

<div class="tabs">
  <div class="tab active">Overview</div>
  <div class="tab">Analytics</div>
  <div class="tab">Data Table</div>
  <div class="tab">Export</div>
</div>

<div class="main" id="overview">
  <div class="kpi-row">${kpiCards}</div>
  ${filterHTML ? `<div class="filter-row">${filterHTML}</div>` : ''}
  <div class="charts-top">${topChartHTML}</div>
  <div class="charts-bottom">${bottomChartHTML}</div>
  <div class="data-section">
    <div class="section-title">📋 Raw Data Preview (first 20 rows)</div>
    <div class="table-wrap">
      <table>
        <thead><tr>${tableHeaders}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>
</div>

<div class="footer">Generated by YAI-Excel · yexcel.hackknow.com</div>

<script>
const CHART_CONFIGS = ${chartConfigsJson};
const chartInstances = {};
const activeFilters = {};

function initCharts() {
  for (const cfg of CHART_CONFIGS) {
    const canvas = document.getElementById(cfg.id);
    if (!canvas) continue;
    const ctx = canvas.getContext('2d');
    chartInstances[cfg.id] = new Chart(ctx, {
      type: cfg.type,
      data: cfg.data,
      options: cfg.options,
    });
  }
}

function toggleFilter(col, val, el) {
  // Toggle active pill
  const pills = el.parentElement.querySelectorAll('.pill');
  pills.forEach(p => p.classList.remove('active'));
  el.classList.add('active');

  if (val === '__all__') {
    delete activeFilters[col];
  } else {
    activeFilters[col] = val;
  }
  // Re-filter charts (visual feedback only - full filter requires raw data hookup)
  applyFilters();
}

function applyFilters() {
  // Highlight effect on charts when filters change
  Object.values(chartInstances).forEach(chart => {
    chart.update('active');
  });
}

document.querySelectorAll('.tab').forEach((tab, i) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// Animate KPI values on load
function animateKPIs() {
  document.querySelectorAll('.kpi-value').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => {
      el.style.transition = 'all 0.4s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, Math.random() * 300);
  });
}

initCharts();
animateKPIs();
<\/script>
</body>
</html>`;
}

// ── Excel Generator (SpreadsheetML) ───────────────────────────────────────────

function generateExcel(spec, theme) {
  const tc = THEME_COLORS[theme] || THEME_COLORS.midnight;
  const { title = 'Dashboard', kpis = [], charts = [] } = spec;
  const accentHex = tc.accent.replace('#', '');
  const bgHex = tc.bg.replace('#', '');
  const cardHex = tc.card.replace('#', '');
  const textHex = tc.text.replace('#', '');

  // Build KPI rows
  const kpiRows = kpis.slice(0, 5).map(k => {
    const displayVal = formatValue(k.value, k.format, k.prefix, k.suffix);
    return `<Row ss:Height="36">
      <Cell ss:StyleID="kpiLabel"><Data ss:Type="String">${k.label}</Data></Cell>
      <Cell ss:StyleID="kpiValue"><Data ss:Type="String">${displayVal}</Data></Cell>
    </Row>`;
  }).join('');

  // Build chart data rows (first chart)
  const firstChart = charts[0];
  let chartRows = '';
  if (firstChart && firstChart.labels && firstChart.datasets?.[0]) {
    chartRows = `<Row ss:Height="22"><Cell ss:StyleID="colHeader"><Data ss:Type="String">${firstChart.title}</Data></Cell></Row>`;
    chartRows += `<Row ss:Height="20">
      <Cell ss:StyleID="colHeader"><Data ss:Type="String">Category</Data></Cell>
      ${(firstChart.datasets || []).map(ds => `<Cell ss:StyleID="colHeader"><Data ss:Type="String">${ds.label}</Data></Cell>`).join('')}
    </Row>`;
    for (let i = 0; i < (firstChart.labels || []).length; i++) {
      chartRows += `<Row ss:Height="18">
        <Cell ss:StyleID="dataCell"><Data ss:Type="String">${firstChart.labels[i]}</Data></Cell>
        ${(firstChart.datasets || []).map(ds => `<Cell ss:StyleID="dataNum"><Data ss:Type="Number">${ds.data[i] ?? 0}</Data></Cell>`).join('')}
      </Row>`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:o="urn:schemas-microsoft-com:office:office">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${title} Dashboard</Title>
    <Author>YAI-Excel</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="headerStyle">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#${accentHex}"/></Borders>
      <Font ss:Bold="1" ss:Size="18" ss:Color="#${accentHex}"/>
      <Interior ss:Color="#${bgHex}" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="kpiLabel">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Size="11" ss:Color="#${textHex}"/>
      <Interior ss:Color="#${cardHex}" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="kpiValue">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Size="16" ss:Color="#${accentHex}"/>
      <Interior ss:Color="#${cardHex}" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="colHeader">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Size="10" ss:Color="#${accentHex}"/>
      <Interior ss:Color="#${bgHex}" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#${accentHex}"/></Borders>
    </Style>
    <Style ss:ID="dataCell">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:Size="10" ss:Color="#${textHex}"/>
      <Interior ss:Color="#${bgHex}" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="dataNum">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:Size="10" ss:Color="#${textHex}"/>
      <Interior ss:Color="#${bgHex}" ss:Pattern="Solid"/>
      <NumberFormat ss:Format="#,##0.##"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Dashboard">
    <Table>
      <Column ss:Width="180"/>
      <Column ss:Width="150"/>
      <Column ss:Width="150"/>
      <Row ss:Height="40">
        <Cell ss:StyleID="headerStyle" ss:MergeAcross="2">
          <Data ss:Type="String">${title} Dashboard</Data>
        </Cell>
      </Row>
      <Row ss:Height="10"/>
      ${kpiRows}
      <Row ss:Height="10"/>
      ${chartRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

// ── Route Handlers ────────────────────────────────────────────────────────────

async function handleUpload(request, env) {
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return errorResponse('Could not parse form data. Send as multipart/form-data.');
  }

  const file = formData.get('file');
  const groqKey = formData.get('groq_api_key') || '';
  const geminiKey = formData.get('gemini_api_key') || env.GEMINI_API_KEY || '';

  if (!file) return errorResponse('No file provided.');

  const fileName = file.name || 'upload.csv';
  const mimeType = file.type || '';

  // Detect type
  const ext = fileName.split('.').pop().toLowerCase();
  let fileType = 'text';
  if (['csv'].includes(ext) || mimeType === 'text/csv') fileType = 'csv';
  else if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext) || mimeType.startsWith('image/')) fileType = 'image';
  else if (['xlsx','xls','ods'].includes(ext)) fileType = 'excel';

  const token = generateUUID();
  let fileContent = '';
  let analysis = null;
  let rows = [], headers = [], stats = {}, groupedData = {};

  if (fileType === 'image') {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    fileContent = btoa(binary);

    // Store for image: simple analysis
    analysis = {
      title: 'Image Analysis', domain: 'visual',
      kpis: [], charts: [], filters: {},
      summary: 'Image uploaded. Generate Excel to extract data.',
    };
  } else {
    fileContent = await file.text();
    if (fileType === 'csv') {
      const parsed = parseCSV(fileContent);
      headers = parsed.headers;
      rows = parsed.rows;
    } else {
      // Plain text — treat as single-column
      const lines = fileContent.split('\n').filter(l => l.trim());
      headers = ['Content'];
      rows = lines.map(l => ({ Content: l }));
    }

    stats = computeStats(rows, headers);
    groupedData = computeGroupedAgg(rows, headers, stats);

    // Use AI if key provided
    const keys = { groq: groqKey, gemini: geminiKey };
    const hasAnyKey = groqKey || geminiKey;

    if (hasAnyKey && rows.length > 0) {
      try {
        analysis = await buildDashboardSpec(rows, headers, stats, groupedData, keys);
      } catch (e) {
        console.error('Analysis error:', e.message);
        analysis = buildFallbackSpec(headers, stats, groupedData, rows.length);
      }
    } else {
      analysis = buildFallbackSpec(headers, stats, groupedData, rows.length);
    }
  }

  // Summary text
  const summary = analysis.domain
    ? `${analysis.title || 'Dashboard'} · ${rows.length} rows · ${headers.length} columns · Domain: ${analysis.domain}`
    : `Data processed. ${rows.length} rows, ${headers.length} columns.`;

  // Store in KV
  const kvValue = JSON.stringify({
    content: fileContent,
    type: fileType,
    fileName,
    headers,
    rows: rows.slice(0, 500), // keep up to 500 rows for generation
    stats,
    groupedData,
    analysis,
  });

  try {
    await env.YAI_KV.put(`upload:${token}`, kvValue, { expirationTtl: 3600 });
  } catch (e) {
    return errorResponse('Storage error.', 500);
  }

  return jsonResponse({
    token,
    type: fileType,
    summary,
    text_preview: fileType !== 'image' ? fileContent.slice(0, 400) : '[image]',
    analysis: {
      domain: analysis.domain,
      kpi_count: analysis.kpis?.length || 0,
      chart_count: analysis.charts?.length || 0,
    },
  });
}

async function handleGenerate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse('Invalid JSON body.');
  }

  const { token, theme = 'midnight', title: userTitle, groq_api_key, gemini_api_key, output = 'both' } = body;

  if (!token) return errorResponse('Missing token.');
  if (!THEMES.includes(theme)) return errorResponse(`Invalid theme. Use one of: ${THEMES.join(', ')}`);

  const groqKey = groq_api_key || '';
  const geminiKey = gemini_api_key || env.GEMINI_API_KEY || '';

  // Retrieve stored data
  let uploadData;
  try {
    const raw = await env.YAI_KV.get(`upload:${token}`);
    if (!raw) return errorResponse('Token not found or expired.', 404);
    uploadData = JSON.parse(raw);
  } catch (e) {
    return errorResponse('Failed to retrieve upload data.', 500);
  }

  const { content, type: fileType, headers = [], rows = [], stats = {}, groupedData = {}, analysis: storedAnalysis, fileName } = uploadData;

  // Re-run AI spec generation if user provides keys and data is CSV
  let spec = storedAnalysis;
  if ((groqKey || geminiKey) && fileType === 'csv' && rows.length > 0) {
    const keys = { groq: groqKey, gemini: geminiKey };
    try {
      const freshSpec = await buildDashboardSpec(rows, headers, stats, groupedData, keys);
      if (freshSpec && freshSpec.kpis) {
        spec = freshSpec;
        if (userTitle) spec.title = userTitle;
      }
    } catch (e) {
      console.error('Re-analysis failed:', e.message);
    }
  }
  if (userTitle && spec) spec.title = userTitle;

  const shortId = token.replace(/-/g, '').slice(0, 8);

  const results = {};

  // Generate HTML dashboard
  if (output === 'html' || output === 'both') {
    const htmlContent = generateDashboardHTML(spec, theme, rows, headers);
    const htmlFilename = `yai-${shortId}-${theme}.html`;
    try {
      await env.YAI_KV.put(`file:${htmlFilename}`, htmlContent, { expirationTtl: 86400 });
      results.html = { download_url: `/files/${htmlFilename}`, filename: htmlFilename };
    } catch (e) {
      console.error('KV HTML store error:', e.message);
    }
  }

  // Generate Excel
  if (output === 'excel' || output === 'both') {
    const xlsContent = generateExcel(spec, theme);
    const xlsFilename = `yai-${shortId}-${theme}.xls`;
    try {
      await env.YAI_KV.put(`file:${xlsFilename}`, xlsContent, { expirationTtl: 86400 });
      results.excel = { download_url: `/files/${xlsFilename}`, filename: xlsFilename };
    } catch (e) {
      console.error('KV XLS store error:', e.message);
    }
  }

  return jsonResponse({
    token,
    theme,
    ...results,
    // backward compat: if both, return html as primary download_url
    download_url: results.html?.download_url || results.excel?.download_url,
    filename: results.html?.filename || results.excel?.filename,
    spec: {
      title: spec.title,
      domain: spec.domain,
      kpi_count: spec.kpis?.length || 0,
      chart_count: spec.charts?.length || 0,
    },
  });
}

async function handleFileDownload(filename, env) {
  if (!filename || !/^[\w\-\.]+$/.test(filename)) {
    return errorResponse('Invalid filename.', 400);
  }

  let content;
  try {
    content = await env.YAI_KV.get(`file:${filename}`);
  } catch (e) {
    return errorResponse('Storage error.', 500);
  }

  if (!content) return errorResponse('File not found or expired.', 404);

  const isHTML = filename.endsWith('.html');
  const contentType = isHTML
    ? 'text/html; charset=utf-8'
    : 'application/vnd.ms-excel';

  return new Response(content, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': contentType,
      'Content-Disposition': isHTML
        ? `inline; filename="${filename}"`
        : `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    },
  });
}

function handleThemes() {
  return jsonResponse({ themes: THEMES });
}

function handleHealthz() {
  return jsonResponse({ status: 'ok', version: '2.0' });
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (path === '/healthz' && method === 'GET') return handleHealthz();
      if (path === '/api/themes' && method === 'GET') return handleThemes();
      if (path === '/api/upload' && method === 'POST') return await handleUpload(request, env);
      if (path === '/api/generate' && method === 'POST') return await handleGenerate(request, env);

      const fileMatch = path.match(/^\/files\/([^/]+)$/);
      if (fileMatch && method === 'GET') return await handleFileDownload(fileMatch[1], env);

      return jsonResponse({ error: 'Not found', path }, 404);
    } catch (err) {
      console.error('Unhandled error:', err.message);
      return jsonResponse({ error: 'Internal server error', message: err.message }, 500);
    }
  },
};
