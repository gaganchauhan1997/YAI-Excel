// YAI-Excel Backend Worker v3.0 — "World's Best Excel Dashboard Generator"
// Pure XLSX output with embedded DrawingML charts (no HTML)
// 70% deterministic JS pipeline · 30% AI for titles/domain/labels
// Cloudflare Worker ES Module — no npm dependencies

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const THEMES = ['midnight', 'emerald', 'crimson', 'slate', 'amber', 'ocean', 'violet', 'rose', 'carbon', 'arctic'];

// Theme colours expressed as hex without "#" for XLSX (ARGB-friendly).
const THEME_COLORS = {
  midnight: { bg: '0A0A0F', card: '12121A', accent: '00F0FF', text: 'E0E0E0', header: '1A1A2E', chart: ['00F0FF', '7C3AED', '10B981', 'F59E0B', 'EF4444'] },
  emerald:  { bg: '022C22', card: '064E3B', accent: '10B981', text: 'D1FAE5', header: '064E3B', chart: ['10B981', '34D399', '6EE7B7', 'A7F3D0', '059669'] },
  crimson:  { bg: '1A0505', card: '2A0A0A', accent: 'EF4444', text: 'FECACA', header: '2A0A0A', chart: ['EF4444', 'F87171', 'FCA5A5', 'F43F5E', 'E11D48'] },
  slate:    { bg: '0F172A', card: '1E293B', accent: '94A3B8', text: 'E2E8F0', header: '1E293B', chart: ['94A3B8', '60A5FA', 'A78BFA', '34D399', 'F59E0B'] },
  amber:    { bg: '1C0A00', card: '2D1500', accent: 'F59E0B', text: 'FEF3C7', header: '2D1500', chart: ['F59E0B', 'FBBF24', 'FCD34D', 'EF4444', '10B981'] },
  ocean:    { bg: '0C1A2E', card: '0C4A6E', accent: '0EA5E9', text: 'E0F2FE', header: '0C4A6E', chart: ['0EA5E9', '38BDF8', '7DD3FC', '06B6D4', '0284C7'] },
  violet:   { bg: '1A0533', card: '2E1065', accent: '8B5CF6', text: 'EDE9FE', header: '2E1065', chart: ['8B5CF6', 'A78BFA', 'C4B5FD', '7C3AED', '6D28D9'] },
  rose:     { bg: '1A0010', card: '4C0519', accent: 'F43F5E', text: 'FFE4E6', header: '4C0519', chart: ['F43F5E', 'FB7185', 'FDA4AF', 'E11D48', 'F59E0B'] },
  carbon:   { bg: '0D0D0D', card: '1A1A1A', accent: '6B7280', text: 'F3F4F6', header: '1A1A1A', chart: ['6B7280', '9CA3AF', 'D1D5DB', '4B5563', '374151'] },
  arctic:   { bg: '050E2A', card: '0C1445', accent: '60A5FA', text: 'DBEAFE', header: '0C1445', chart: ['60A5FA', '93C5FD', '38BDF8', '818CF8', '34D399'] },
};

// ── Generic Utilities ─────────────────────────────────────────────────────────

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
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function parseJSONLoose(text) {
  let cleaned = String(text || '').trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(cleaned); } catch (e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch (e2) {}
    return null;
  }
}

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(idx) {
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellRef(row, col) { return colLetter(col) + row; }

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim()); cur = '';
    } else cur += c;
  }
  result.push(cur.trim());
  return result;
}

// ── Deterministic Statistics ──────────────────────────────────────────────────

function computeStats(rows, headers) {
  const stats = {};
  for (const h of headers) {
    const values = rows.map(r => r[h]).filter(v => v !== null && v !== undefined && v !== '');
    const numerics = values.map(v => {
      const cleaned = String(v).replace(/[$,€£₹%\s]/g, '');
      return parseFloat(cleaned);
    }).filter(v => !isNaN(v));
    if (numerics.length >= values.length * 0.6 && values.length > 0) {
      const sum = numerics.reduce((a, b) => a + b, 0);
      stats[h] = { type: 'numeric', sum: Math.round(sum * 100) / 100, avg: Math.round((sum / numerics.length) * 100) / 100, min: Math.min(...numerics), max: Math.max(...numerics), count: numerics.length };
    } else {
      const counts = {};
      for (const v of values) counts[v] = (counts[v] || 0) + 1;
      const uniqueCount = Object.keys(counts).length;
      stats[h] = { type: 'categorical', unique_count: uniqueCount, value_counts: Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20)), sample: Object.keys(counts).slice(0, 8) };
    }
  }
  return stats;
}

function isIdentifierColumn(name) {
  // Year / Month / Day / ID / Code / Number etc. — numeric but not a metric
  return /^(year|month|day|id|code|sku|isbn|upc|barcode|zip|pincode|postal|phone|fax|account_?no|order_?id|customer_?id|employee_?id|invoice|reference)$/i.test(name.trim())
      || /(_year|_month|_id|_code|_no|_number)$/i.test(name.trim());
}

function computeGroupedAgg(rows, headers, stats) {
  // First, ensure identifier-like numeric columns have value_counts populated so they can be used as dimensions
  for (const h of headers) {
    if (stats[h]?.type === 'numeric' && isIdentifierColumn(h)) {
      const counts = {};
      for (const r of rows) {
        const v = String(r[h] || '');
        if (v) counts[v] = (counts[v] || 0) + 1;
      }
      stats[h].value_counts = Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20));
      stats[h].sample = Object.keys(stats[h].value_counts).slice(0, 8);
      stats[h].unique_count = Object.keys(counts).length;
    }
  }
  const dimensions = headers.filter(h => {
    if (stats[h]?.type === 'categorical' && stats[h].unique_count <= 24) return true;
    if (stats[h]?.type === 'numeric' && isIdentifierColumn(h) && stats[h].unique_count <= 24) return true;
    return false;
  });
  const metrics = headers.filter(h => stats[h]?.type === 'numeric' && !isIdentifierColumn(h));
  const grouped = {};
  for (const dim of dimensions) {
    grouped[dim] = {};
    for (const dimVal of Object.keys(stats[dim].value_counts)) {
      const dimRows = rows.filter(r => r[dim] === dimVal);
      grouped[dim][dimVal] = {};
      for (const metric of metrics) {
        const sum = dimRows.reduce((acc, r) => {
          const v = parseFloat(String(r[metric] || '').replace(/[$,€£₹%\s]/g, ''));
          return acc + (isNaN(v) ? 0 : v);
        }, 0);
        grouped[dim][dimVal][metric] = Math.round(sum * 100) / 100;
      }
    }
  }
  return { dimensions, metrics, grouped };
}

function computeCrossAgg(rows, dimA, dimB, metric, statsA, statsB) {
  const out = {};
  const aVals = Object.keys(statsA.value_counts).slice(0, 12);
  const bVals = Object.keys(statsB.value_counts).slice(0, 12);
  for (const a of aVals) { out[a] = {}; for (const b of bVals) out[a][b] = 0; }
  for (const r of rows) {
    const a = r[dimA]; const b = r[dimB];
    if (!(a in out) || !(b in out[a])) continue;
    const v = parseFloat(String(r[metric] || '').replace(/[$,€£₹%\s]/g, ''));
    if (!isNaN(v)) out[a][b] += v;
  }
  for (const a of aVals) for (const b of bVals) out[a][b] = Math.round(out[a][b] * 100) / 100;
  return { aVals, bVals, matrix: out };
}

function guessDomain(headers) {
  const all = headers.join(' ').toLowerCase();
  if (all.match(/production|plant|defect|supervisor|shift|manufactur/)) return 'Manufacturing';
  if (all.match(/sale|revenue|customer|order|product/)) return 'Sales';
  if (all.match(/employee|salary|hire|department/)) return 'HR';
  if (all.match(/budget|expense|account|profit/)) return 'Finance';
  if (all.match(/student|grade|course|teacher/)) return 'Education';
  return 'Business';
}

// ── AI helpers (only for title, domain, labels — ~30% of intelligence) ────────

async function callGroq(apiKey, prompt, systemPrompt = '') {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile', messages, max_tokens: 1024, temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) throw new Error(`Groq ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(apiKey, prompt, inlineImage = null) {
  const parts = [];
  if (inlineImage) parts.push({ inline_data: inlineImage });  // { mime_type, data (base64) }
  parts.push({ text: prompt });
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.15, maxOutputTokens: 2048 } }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Dashboard Design Curriculum (teaching prompt for the AI) ──────────────────
// This prompt is sent to Groq/Gemini whenever we need a layout spec.
// It encodes the design principles so the AI generalises to ANY dataset,
// not just the example image we tested against.
const DASHBOARD_DESIGN_SYSTEM_PROMPT = `You are a senior dashboard designer who has shipped 1000+ Excel dashboards across Manufacturing, Sales, Finance, HR, Healthcare, Retail, Education and Logistics. You combine the rigor of a McKinsey analyst with the aesthetic eye of an Apple designer.

CORE PRINCIPLES (apply these to every dashboard you design):

1. HIERARCHY OF ATTENTION
   Title → 3-7 KPIs (top, biggest type) → 3-4 supporting charts → 1 wide trend/timeline chart at the bottom → 2-3 filter panels on each side. The reader's eye should sweep title → KPIs → charts → details, in that order.

2. KPI SELECTION
   Choose metrics that answer "is the business healthy?" — totals of revenue / volume / cost / efficiency. Avoid raw counts of identifier columns (year, id, code). Prefer SUM for monetary/volume metrics, AVERAGE for rates/percentages, COUNTA for record counts. Pick 4-6 KPIs; more becomes noise, fewer feels empty.

3. CHART TYPE → INTENT MAPPING
   - horizontalBar: rank entities ("which products generate the most revenue?"). Use when the dimension has long labels.
   - verticalBar/clusteredBar: compare two metrics across categories ("revenue vs cost by product").
   - doughnut: show share of total when categories are 3-8 ("which plant produced the most?").
   - pie: show share of total when categories are 3-6 and you want to emphasise dominance.
   - stackedBar (column): time-on-x, category-as-stack ("monthly revenue split by product line"). This is the timeline chart.
   - line: continuous trend over time when you want to emphasise change-over-time.
   - area: continuous trend with magnitude emphasis.
   - scatter: correlation between two numeric variables.

4. FILTER PANEL DESIGN
   Place 1-3 filters on the LEFT (the WHEN/WHO/WHERE dimensions — usually time and location) and 1-3 filters on the RIGHT (the WHAT — categorisation, products, segments). Each filter should have 2-12 selectable values.

5. COLOUR DISCIPLINE
   One accent colour for highlights (active filters, KPI numbers, chart 1 primary). Muted tones for backdrop. Avoid using all chart colours at full saturation.

6. TIMELINE / TREND CHART AT BOTTOM
   ALWAYS include a wide chart that shows the data over time when a time dimension exists (month, quarter, year, week, date). This is the "story" of the dashboard.

7. GENERALISATION
   The same design principles apply whether the data is sales, manufacturing, HR, or healthcare — only the column names change. Map the columns to roles: identifier, dimension (categorical, ≤24 unique), metric (numeric, not identifier), time (month/year/date/quarter).

OUTPUT CONTRACT (return ONE valid JSON object, nothing else):
{
  "title": "string — 3-6 word dashboard title using the domain",
  "domain": "string — Manufacturing|Sales|Finance|HR|Healthcare|Retail|Education|Logistics|Operations|...",
  "tabs": ["Overview", "<analysis area>", "<analysis area>", "<analysis area>", "<analysis area>"],

  "kpis": [
    { "column": "<existing metric column>", "label": "Friendly Label", "format": "compact|currency|percent|number", "aggregation": "sum|avg|count" }
    // 4-6 KPIs total
  ],

  "leftFilters": ["<dimension col>", "<dimension col>", "<dimension col>"],   // 1-3
  "rightFilters": ["<dimension col>", "<dimension col>", "<dimension col>"],  // 1-3

  "charts": [
    { "slot": "top-left",  "type": "horizontalBar|verticalBar|doughnut|pie|stackedBar|line|area",
      "dim": "<dimension col>", "metric": "<metric col>", "title": "Short chart title" },
    { "slot": "top-mid",   "type": "...", "dim": "...", "metric": "...", "title": "..." },
    { "slot": "top-right", "type": "...", "dim": "...", "metric": "...", "title": "..." },
    { "slot": "bottom",    "type": "stackedBar|line|area",
      "dimA": "<time-like dim>", "dimB": "<category dim>", "metric": "<metric>", "title": "..." }
    // Exactly 4 charts. Last one is the wide timeline.
  ]
}

CRITICAL RULES:
- Only use column names that actually exist in the supplied data summary.
- Never put an identifier column (year, id, code) into "kpis".
- The bottom chart MUST be a time/trend visualisation if any time-like dimension exists; otherwise pick the highest-variance dim.
- Vary the dimensions across the 4 charts — don't repeat the same dim 4 times.
- Vary the metrics where possible — show different facets of the data.
- When an image is provided, mirror its visual structure (number of KPIs, chart positions, filter positions) using the user's columns.`;

// Build a compact summary of the data that the AI can read in <500 tokens
function summariseColumns(headers, stats) {
  const summary = {};
  for (const h of headers) {
    if (stats[h].type === 'numeric') {
      summary[h] = {
        type: 'numeric',
        sum: stats[h].sum, avg: stats[h].avg, min: stats[h].min, max: stats[h].max,
      };
    } else {
      summary[h] = {
        type: 'categorical',
        unique: stats[h].unique_count,
        top: (stats[h].sample || []).slice(0, 6),
      };
    }
  }
  return summary;
}

// Optional image analysis — Gemini Vision extracts structural cues
// (number of KPIs, number of charts, chart positions, filter count, palette).
async function aiAnalyzeImage(keys, base64Image, mimeType = 'image/png') {
  if (!keys.gemini) return null;
  const prompt = `You are looking at a screenshot of a business dashboard. Extract ONLY the structural layout — do NOT invent column names. Return valid JSON:
{
  "approx_kpi_count": 1-10,
  "approx_chart_count": 0-8,
  "chart_types_seen": ["horizontalBar","verticalBar","stackedBar","pie","doughnut","line","area","scatter","table","map"],
  "left_filter_count": 0-5,
  "right_filter_count": 0-5,
  "has_timeline": true|false,
  "has_tabs": true|false,
  "tab_count": 0-8,
  "palette_mood": "dark|light|warm|cool|monochrome|colourful",
  "title_text_if_visible": "...",
  "tabs_text_if_visible": ["...", "..."],
  "kpi_labels_if_visible": ["...", "..."],
  "layout_notes": "1-2 sentences about how the elements are arranged"
}`;
  try {
    const raw = await callGemini(keys.gemini, prompt, { mime_type: mimeType, data: base64Image });
    return parseJSONLoose(raw);
  } catch (e) {
    console.error('Image analysis failed:', e.message);
    return null;
  }
}

// Main "design the dashboard" call — uses the teaching system prompt.
// Returns a full DashboardLayout spec OR null on failure.
async function aiDesignDashboard(keys, headers, stats, dims, metrics, imageHint = null, userPrompt = '') {
  if (!keys.groq && !keys.gemini) return null;
  const colSummary = summariseColumns(headers, stats);

  const userMsg = `Design a dashboard for this dataset.

USER COLUMNS:
${JSON.stringify(colSummary, null, 2)}

DETECTED DIMENSIONS: ${JSON.stringify(dims)}
DETECTED METRICS:    ${JSON.stringify(metrics)}
${imageHint ? `\nIMAGE REFERENCE (use this layout, but with the user's columns):\n${JSON.stringify(imageHint, null, 2)}\n` : ''}
${userPrompt ? `\nUSER NOTE: "${userPrompt}"\n` : ''}

Return the JSON layout described in the system instructions.`;

  try {
    let raw;
    if (keys.groq) {
      raw = await callGroq(keys.groq, userMsg, DASHBOARD_DESIGN_SYSTEM_PROMPT);
    } else {
      // Gemini supports system instructions through a combined prompt
      raw = await callGemini(keys.gemini, DASHBOARD_DESIGN_SYSTEM_PROMPT + '\n\n' + userMsg);
    }
    return parseJSONLoose(raw);
  } catch (e) {
    console.error('AI design failed:', e.message);
    return null;
  }
}

// ── Dashboard Spec Builder ────────────────────────────────────────────────────

// ── Tab name templates per domain (heuristic when AI is offline) ─────────────
const TAB_TEMPLATES = {
  Manufacturing: ['Overview', 'Production Analysis', 'Quality Analysis', 'Cost & Revenue', 'Efficiency & Downtime'],
  Sales:         ['Overview', 'Pipeline', 'Customers', 'Products', 'Forecast'],
  Finance:       ['Overview', 'P&L', 'Cash Flow', 'Balance Sheet', 'Variance'],
  HR:            ['Overview', 'Headcount', 'Compensation', 'Performance', 'Retention'],
  Retail:        ['Overview', 'Stores', 'Categories', 'Inventory', 'Promotions'],
  Healthcare:    ['Overview', 'Patients', 'Outcomes', 'Operations', 'Cost'],
  Education:     ['Overview', 'Enrollment', 'Performance', 'Attendance', 'Programs'],
  Logistics:     ['Overview', 'Routes', 'Fleet', 'On-Time', 'Cost'],
  Operations:    ['Overview', 'Throughput', 'Quality', 'Cost', 'Efficiency'],
  Business:      ['Overview', 'Performance', 'Distribution', 'Trends', 'Details'],
};

// Heuristic format detector — used when AI omits a format
function guessFormat(col, stats) {
  const lower = col.toLowerCase();
  if (/revenue|sales|cost|price|amount|profit|gmv|cogs|salary|wage|spend/.test(lower)) return 'currency';
  if (/efficien|percent|rate|ratio|margin|conversion|attrition|utiliz/.test(lower)) return 'percent';
  if ((stats[col]?.sum || 0) > 100000) return 'compact';
  return 'number';
}

async function finaliseSpec(rows, headers, keys, userPrompt = '', imageBase64 = null, imageMime = null) {
  const stats = computeStats(rows, headers);
  const { dimensions, metrics, grouped } = computeGroupedAgg(rows, headers, stats);

  // Step 1 — optional Gemini Vision analysis of an uploaded reference image.
  let imageHint = null;
  if (imageBase64 && keys.gemini) {
    imageHint = await aiAnalyzeImage(keys, imageBase64, imageMime || 'image/png');
  }

  // Step 2 — let the AI design the full layout (with image cues if available).
  const ai = await aiDesignDashboard(keys, headers, stats, dimensions, metrics, imageHint, userPrompt);

  // ── KPI resolution ──────────────────────────────────────────────────────────
  const aiKpis = Array.isArray(ai?.kpis) ? ai.kpis : [];
  let kpiCols = aiKpis.map(k => k.column).filter(c => metrics.includes(c));
  if (kpiCols.length < 4) {
    const sortedByImpact = [...metrics].sort((a, b) => stats[b].sum - stats[a].sum);
    for (const m of sortedByImpact) if (!kpiCols.includes(m) && kpiCols.length < 6) kpiCols.push(m);
  }
  kpiCols = kpiCols.slice(0, 6);

  const kpis = kpiCols.map((col, i) => {
    const aiKpi = aiKpis[i];
    const fmt = aiKpi?.format || guessFormat(col, stats);
    // Default aggregation: percent/rate columns average (summing percentages is meaningless),
    // everything else sums. AI can override this.
    let agg = aiKpi?.aggregation;
    if (!agg) agg = (fmt === 'percent' ? 'avg' : 'sum');
    const value = agg === 'avg' ? stats[col].avg
                : agg === 'count' ? stats[col].count
                : stats[col].sum;
    return {
      label: aiKpi?.label || col.replace(/[_]/g, ' ').replace(/(?<!^)(?=[A-Z])/g, ' '),
      value, column: col, aggregation: agg,
      format: fmt,
    };
  });

  // ── Filter panels ───────────────────────────────────────────────────────────
  const leftFilters = (ai?.leftFilters || dimensions.slice(0, 3)).filter(d => dimensions.includes(d)).slice(0, 3);
  if (leftFilters.length === 0 && dimensions.length) leftFilters.push(dimensions[0]);
  const remaining = dimensions.filter(d => !leftFilters.includes(d));
  const rightFilters = (ai?.rightFilters || remaining.slice(0, 3)).filter(d => dimensions.includes(d) && !leftFilters.includes(d)).slice(0, 3);

  // ── Chart resolution (4 slots: top-left, top-mid, top-right, bottom) ────────
  const aiCharts = Array.isArray(ai?.charts) ? ai.charts : [];
  const findChart = (slot) => aiCharts.find(c => (c.slot || '').toLowerCase() === slot);

  const pickDim = (preferred, fallbackIdx = 0) =>
    (preferred && dimensions.includes(preferred)) ? preferred : (dimensions[fallbackIdx] || dimensions[0]);
  const pickMetric = (preferred, fallbackIdx = 0) =>
    (preferred && metrics.includes(preferred)) ? preferred : (metrics[fallbackIdx] || metrics[0]);

  const monthish = dimensions.find(d => /month|date|quarter|period|week|year/i.test(d));
  const monthIdx = monthish ? dimensions.indexOf(monthish) : -1;

  function buildSingleChart(slot, defaultType, dimIdx, metricIdx) {
    const ai = findChart(slot);
    const dim = pickDim(ai?.dim, dimIdx);
    const metric = pickMetric(ai?.metric, metricIdx);
    const type = ai?.type || defaultType;
    const labels = dim ? Object.keys(stats[dim].value_counts).slice(0, 10) : [];
    const data = labels.map(l => grouped[dim]?.[l]?.[metric] ?? 0);
    return {
      type, slot,
      title: ai?.title || `${metric} by ${dim}`,
      labels, data, dim, metric,
    };
  }

  function buildTrendChart() {
    const ai = findChart('bottom');
    const dimA = pickDim(ai?.dimA, monthIdx >= 0 ? monthIdx : 0);
    let dimB = pickDim(ai?.dimB, 1);
    if (dimB === dimA) dimB = dimensions.find(d => d !== dimA) || dimA;
    const metric = pickMetric(ai?.metric, 0);
    const type = ai?.type || 'stackedBar';
    let labels = [], series = [];
    if (dimA && dimB && metric && dimA !== dimB) {
      const cross = computeCrossAgg(rows, dimA, dimB, metric, stats[dimA], stats[dimB]);
      labels = cross.aVals;
      series = cross.bVals.map(b => ({ name: b, data: cross.aVals.map(a => cross.matrix[a][b]) }));
    }
    return {
      type, slot: 'bottom',
      title: ai?.title || `${metric} by ${dimA} and ${dimB}`,
      labels, series, dimA, dimB, metric,
    };
  }

  const charts = [
    buildSingleChart('top-left',  'horizontalBar', 0, 0),
    buildSingleChart('top-mid',   'doughnut',      1, 0),
    buildSingleChart('top-right', 'pie',           2, 1),
    buildTrendChart(),
  ];

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const domain = ai?.domain || guessDomain(headers);
  const tabs = Array.isArray(ai?.tabs) && ai.tabs.length >= 2 ? ai.tabs.slice(0, 5) : (TAB_TEMPLATES[domain] || TAB_TEMPLATES.Business);

  return {
    title: ai?.title || `${domain} Dashboard`,
    domain,
    tabs,
    kpis,
    charts,
    leftFilters, rightFilters,
    filters: [...leftFilters, ...rightFilters].reduce((acc, d) => {
      acc[d] = Object.keys(stats[d].value_counts).slice(0, 12); return acc;
    }, {}),
    imageHint,
    stats, dimensions, metrics, rowCount: rows.length,
  };
}

// ── CRC32 + Pure-JS ZIP Writer (stored / no compression) ──────────────────────

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  const enc = new TextEncoder();
  const entries = [];
  const localChunks = [];
  let offset = 0;

  for (const name of Object.keys(files)) {
    const v = files[name];
    const data = v instanceof Uint8Array ? v : enc.encode(v);
    const nameBytes = enc.encode(name);
    const checksum = crc32(data);
    const size = data.length;
    const header = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034B50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0x21, true);
    dv.setUint32(14, checksum, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    header.set(nameBytes, 30);
    localChunks.push(header);
    localChunks.push(data);
    entries.push({ name, nameBytes, size, checksum, offset });
    offset += header.length + data.length;
  }

  const centralChunks = [];
  let centralSize = 0;
  for (const e of entries) {
    const cdh = new Uint8Array(46 + e.nameBytes.length);
    const dv = new DataView(cdh.buffer);
    dv.setUint32(0, 0x02014B50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0x21, true);
    dv.setUint32(16, e.checksum, true);
    dv.setUint32(20, e.size, true);
    dv.setUint32(24, e.size, true);
    dv.setUint16(28, e.nameBytes.length, true);
    dv.setUint16(30, 0, true);
    dv.setUint16(32, 0, true);
    dv.setUint16(34, 0, true);
    dv.setUint16(36, 0, true);
    dv.setUint32(38, 0, true);
    dv.setUint32(42, e.offset, true);
    cdh.set(e.nameBytes, 46);
    centralChunks.push(cdh);
    centralSize += cdh.length;
  }

  const eocd = new Uint8Array(22);
  const eocdDv = new DataView(eocd.buffer);
  eocdDv.setUint32(0, 0x06054B50, true);
  eocdDv.setUint16(4, 0, true);
  eocdDv.setUint16(6, 0, true);
  eocdDv.setUint16(8, entries.length, true);
  eocdDv.setUint16(10, entries.length, true);
  eocdDv.setUint32(12, centralSize, true);
  eocdDv.setUint32(16, offset, true);
  eocdDv.setUint16(20, 0, true);

  const totalSize = offset + centralSize + 22;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const c of localChunks) { out.set(c, pos); pos += c.length; }
  for (const c of centralChunks) { out.set(c, pos); pos += c.length; }
  out.set(eocd, pos);
  return out;
}

// ── XLSX XML Builders ─────────────────────────────────────────────────────────

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function buildContentTypes() {
  return `${XML_HEAD}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
<Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
<Override PartName="/xl/charts/chart3.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
<Override PartName="/xl/charts/chart4.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
</Types>`;
}

function buildRootRels() {
  return `${XML_HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildWorkbook() {
  return `${XML_HEAD}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Dashboard" sheetId="1" r:id="rId1"/>
<sheet name="Data" sheetId="2" r:id="rId2"/>
<sheet name="Excel Tutor" sheetId="3" r:id="rId3"/>
</sheets>
</workbook>`;
}

function buildWorkbookRels() {
  return `${XML_HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
}

function buildStyles(theme) {
  const tc = THEME_COLORS[theme] || THEME_COLORS.midnight;
  return `${XML_HEAD}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="5">
<numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/>
<numFmt numFmtId="165" formatCode="#,##0"/>
<numFmt numFmtId="166" formatCode="0.00&quot;%&quot;"/>
<numFmt numFmtId="167" formatCode="#,##0.0,&quot;K&quot;"/>
<numFmt numFmtId="168" formatCode="&quot;$&quot;#,##0.0,,&quot;M&quot;"/>
</numFmts>
<fonts count="14">
<font><sz val="11"/><color rgb="FF${tc.text}"/><name val="Calibri"/></font>
<font><b/><sz val="24"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><sz val="10"/><color rgb="FF9CA3AF"/><name val="Calibri"/></font>
<font><b/><sz val="22"/><color rgb="FF${tc.accent}"/><name val="Calibri"/></font>
<font><sz val="9"/><color rgb="FFB3B3B3"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FF60A5FA"/><u/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>
<font><b/><sz val="10"/><color rgb="FF${tc.accent}"/><name val="Calibri"/></font>
<font><sz val="9"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="10"/><color rgb="FF111827"/><name val="Calibri"/></font>
<font><sz val="8"/><color rgb="FF9CA3AF"/><name val="Calibri"/></font>
</fonts>
<fills count="16">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${tc.bg}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${tc.card}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${tc.header}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${tc.chart[0]}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${tc.chart[1]}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${tc.chart[2]}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${tc.chart[3]}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${tc.chart[4]}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFBEB"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${tc.accent}"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/></patternFill></fill>
</fills>
<borders count="6">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FF${tc.accent}"/></left><right style="thin"><color rgb="FF${tc.accent}"/></right><top style="thin"><color rgb="FF${tc.accent}"/></top><bottom style="thin"><color rgb="FF${tc.accent}"/></bottom></border>
<border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom></border>
<border><top style="thick"><color rgb="FF${tc.chart[0]}"/></top><left style="thin"><color rgb="FF333333"/></left><right style="thin"><color rgb="FF333333"/></right><bottom style="thin"><color rgb="FF333333"/></bottom></border>
<border><left style="thin"><color rgb="FF${tc.accent}"/></left><right style="thin"><color rgb="FF${tc.accent}"/></right><top style="thin"><color rgb="FF${tc.accent}"/></top><bottom style="medium"><color rgb="FF${tc.accent}"/></bottom></border>
<border><bottom style="thick"><color rgb="FF${tc.accent}"/></bottom></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="32">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="10" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="7" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="11" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="9" fillId="10" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="8" fillId="10" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="9" fillId="12" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="8" fillId="11" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="9" fillId="13" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="168" fontId="3" fillId="3" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="167" fontId="3" fillId="3" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="166" fontId="3" fillId="3" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="11" fillId="14" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="12" fillId="15" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="11" fillId="3" borderId="4" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="11" fillId="14" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="13" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="2" borderId="5" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="11" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="11" fillId="15" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="13" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="11" fillId="15" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="9" fillId="14" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="11" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

const S = {
  default: 0, title: 1, pageBg: 2, kpiValue: 3, kpiLabel: 4,
  sectionHeader: 5, subTitle: 6, tabInactive: 7,
  tutorH: 8, tutorBody: 9, tutorAlt: 10, tutorCode: 11, tutorTip: 12,
  filterHeader: 13, curr2: 14, num: 15, pct: 16,
  kpiCurrency: 17, kpiCompact: 18, kpiPct: 19,
  tabActive: 20, filterPill: 21, kpiBlank: 22, tabActiveBordered: 23,
  footerText: 24, sectionDivider: 25, chartBadge: 26,
  filterPillBg: 27, chartTitleRight: 28, filterPillActive: 29,
  pageBgIndent: 30, pageBgPad: 31,
};

class StringTable {
  constructor() { this.map = new Map(); this.list = []; }
  add(s) {
    if (s == null) s = '';
    s = String(s);
    if (this.map.has(s)) return this.map.get(s);
    const idx = this.list.length;
    this.map.set(s, idx); this.list.push(s);
    return idx;
  }
  toXml() {
    const items = this.list.map(s => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`).join('');
    return `${XML_HEAD}
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.list.length}" uniqueCount="${this.list.length}">${items}</sst>`;
  }
}

function strCellXml(ref, sst, value, style = 0) {
  const idx = sst.add(value);
  return `<c r="${ref}" t="s" s="${style}"><v>${idx}</v></c>`;
}
function numCellXml(ref, value, style = 0) {
  if (value == null || isNaN(value)) return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}
function blankCellXml(ref, style = 0) {
  return `<c r="${ref}" s="${style}"/>`;
}

// ── Dashboard sheet — pixel-faithful Manufacturing Dashboard layout ──────────
// Element inventory (everything visible in the reference image):
//   1.  Header banner with branding (rows 1-2)
//   2.  5-tab navigation strip with "Overview" active (row 3)
//   3.  Section sub-headers under the title (row 4)
//   4.  LEFT filter panel #1 - first dimension with pill buttons (rows 6-7)
//   5.  5 KPI cards with coloured top accent (rows 6-7)
//   6.  RIGHT filter panel #1 - second dimension (rows 6-7)
//   7.  LEFT filter panel #2 - third dimension (rows 10-11)
//   8.  Three small charts in a row: HBar | Doughnut | Pie  (rows 10-24)
//   9.  RIGHT filter panel #2 - fourth dimension (rows 10-11)
//   10. LEFT filter panel #3 - timeline / Month (rows 26-39)
//   11. Wide stacked-bar chart (rows 26-44) — the timeline view
//   12. RIGHT filter panel #3 - supervisor / fifth dimension (rows 26-39)
//   13. Chart number badges (01 / 02 / 03 / 04)
//   14. Footer with row count + generation timestamp (row 45)
function buildDashboardSheet(spec, theme, sst) {
  const tc = THEME_COLORS[theme] || THEME_COLORS.midnight;
  const title = spec.title || 'Business Dashboard';
  const domain = spec.domain || 'Business';

  // Column layout: A-B left filters | C spacer | D-M main | N spacer | O-P right filters
  const cols = `<cols>
<col min="1" max="2" width="13" customWidth="1"/>
<col min="3" max="3" width="2" customWidth="1"/>
<col min="4" max="13" width="12.5" customWidth="1"/>
<col min="14" max="14" width="2" customWidth="1"/>
<col min="15" max="16" width="13" customWidth="1"/>
</cols>`;

  // Cell map approach — set cell, then paint background last for any unset cell.
  const cellMap = new Map();
  const merges = [];
  function setStr(r, c, val, style = S.pageBg) {
    cellMap.set(cellRef(r, c), { type: 's', val, style });
  }
  function setNum(r, c, val, style = S.pageBg) {
    cellMap.set(cellRef(r, c), { type: 'n', val, style });
  }
  function setBg(r, c, style = S.pageBg) {
    if (!cellMap.has(cellRef(r, c))) cellMap.set(cellRef(r, c), { type: 'b', style });
  }
  function setMerge(r1, c1, r2, c2) {
    merges.push(`${cellRef(r1, c1)}:${cellRef(r2, c2)}`);
  }
  function fillBox(r1, c1, r2, c2, style) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) setBg(r, c, style);
  }

  // ───── ROW 1-2: TITLE BANNER ─────
  setStr(1, 0, `${title.toUpperCase()}  ·  IN EXCEL`, S.title);
  fillBox(1, 0, 2, 15, S.title);
  setMerge(1, 0, 2, 15);

  // Branding tag on the right side of the banner (printable)
  setStr(2, 0, `Built with YAI-Excel · ${domain}`, S.title);

  // ───── ROW 3: TAB STRIP (dynamic count, first tab active) ─────
  const tabs = (spec.tabs && spec.tabs.length >= 2) ? spec.tabs.slice(0, 6) : ['Overview', 'Details', 'Trends', 'Insights', 'Data'];
  // Distribute tabs across 16 columns
  const tabSpans = [];
  const baseWidth = Math.floor(16 / tabs.length);
  let cursor = 0;
  for (let i = 0; i < tabs.length; i++) {
    const w = (i === tabs.length - 1) ? (16 - cursor) : baseWidth;
    tabSpans.push([cursor, cursor + w - 1]);
    cursor += w;
  }
  for (let i = 0; i < tabs.length; i++) {
    const [c0, c1] = tabSpans[i];
    const style = i === 0 ? S.tabActiveBordered : S.tabInactive;
    setStr(3, c0, tabs[i], style);
    for (let c = c0 + 1; c <= c1; c++) setBg(3, c, style);
    setMerge(3, c0, 3, c1);
  }

  // ───── ROW 4: spacer with bottom-divider line ─────
  fillBox(4, 0, 4, 15, S.pageBg);

  // ───── ROW 5: section labels under tabs ─────
  setStr(5, 0, '◆ FILTERS', S.footerText);
  setStr(5, 3, '◆ KEY PERFORMANCE INDICATORS', S.footerText);
  setStr(5, 14, '◆ FILTERS', S.footerText);
  setMerge(5, 0, 5, 2);
  setMerge(5, 3, 5, 13);
  setMerge(5, 14, 5, 15);
  fillBox(5, 0, 5, 15, S.pageBg);

  // ───── ROWS 6-7: KPI ROW + 1st left/right filter ─────
  const kpis = (spec.kpis || []).slice(0, 6);  // up to 6 KPIs
  const stats = spec.stats || {};
  const leftDims = (spec.leftFilters || []).slice(0, 3);
  const rightDims = (spec.rightFilters || []).slice(0, 3);

  // Helper to emit a filter panel: header at (hRow, c0..c1), then up to maxVals pills below.
  // 2 columns wide, 2 values per row → maxVals/2 rows total.
  function emitFilterPanel(hRow, c0, c1, dim, startRow, endRow) {
    if (!dim || !stats[dim]) return;
    setStr(hRow, c0, dim.toUpperCase(), S.filterHeader);
    setMerge(hRow, c0, hRow, c1);
    const capacity = (endRow - startRow + 1) * 2;
    const vals = Object.keys(stats[dim].value_counts).slice(0, capacity);
    for (let i = 0; i < vals.length; i++) {
      const rr = startRow + Math.floor(i / 2);
      const cc = c0 + (i % 2);
      if (rr > endRow) break;
      setStr(rr, cc, vals[i], i === 0 ? S.filterPillActive : S.filterPill);
    }
  }

  // Left filter block 1: header row 6, pills rows 7-8 (2 rows × 2 cols = 4 pills)
  emitFilterPanel(6, 0, 1, leftDims[0], 7, 8);
  // Right filter block 1: header row 6, pills rows 7-8 (2 rows × 2 cols = 4 pills)
  emitFilterPanel(6, 14, 15, rightDims[0], 7, 8);

  // KPI cards on rows 6-7 cols 3..12 — adapt to actual count (up to 6)
  // Width per card depends on KPI count: 5 cards = 2 cols each (10 cols total)
  // 6 cards = handled by squeezing; min 1 col per card
  const kpiWidthAvailable = 10; // cols 3..12 inclusive
  const cardWidth = Math.max(1, Math.floor(kpiWidthAvailable / Math.max(kpis.length, 1)));
  for (let i = 0; i < kpis.length; i++) {
    const c0 = 3 + i * cardWidth;
    const c1 = Math.min(12, c0 + cardWidth - 1);
    const kpi = kpis[i];
    setStr(6, c0, (kpi.label || '').toUpperCase(), S.kpiLabel);
    for (let c = c0 + 1; c <= c1; c++) setBg(6, c, S.kpiLabel);
    if (c1 > c0) setMerge(6, c0, 6, c1);

    const style = (kpi.format === 'currency') ? S.kpiCurrency
              : (kpi.format === 'percent') ? S.kpiPct
              : S.kpiCompact;
    setNum(7, c0, kpi.value, style);
    for (let c = c0 + 1; c <= c1; c++) setBg(7, c, style);
    if (c1 > c0) setMerge(7, c0, 7, c1);
  }

  // Fill the rest of the KPI rows with bg
  fillBox(6, 0, 9, 15, S.pageBg);

  // ───── ROWS 9-10: section header for charts row ─────
  setStr(9, 3, '◆ ANALYTICS', S.footerText);
  setMerge(9, 3, 9, 13);
  fillBox(9, 0, 9, 15, S.pageBg);

  // ───── ROWS 10-24: 3 small charts + filter 2 left/right ─────
  emitFilterPanel(10, 0, 1, leftDims[1], 11, 24);  // up to 28 pills
  emitFilterPanel(10, 14, 15, rightDims[1], 11, 24);

  // Chart title strips at row 10
  setStr(10, 3, `01 · ${spec.charts[0]?.title || 'Chart 1'}`, S.chartTitleRight);
  setMerge(10, 3, 10, 7);
  setStr(10, 8, `02 · ${spec.charts[1]?.title || 'Chart 2'}`, S.chartTitleRight);
  setMerge(10, 8, 10, 10);
  setStr(10, 11, `03 · ${spec.charts[2]?.title || 'Chart 3'}`, S.chartTitleRight);
  setMerge(10, 11, 10, 13);

  // chart anchor space
  fillBox(11, 3, 24, 13, S.pageBg);
  fillBox(10, 0, 24, 15, S.pageBg);

  // ───── ROW 25: timeline section header ─────
  setStr(25, 3, '◆ TIMELINE · TRENDS', S.footerText);
  setMerge(25, 3, 25, 13);
  fillBox(25, 0, 25, 15, S.pageBg);

  // ───── ROWS 26-44: stacked bar chart + 3rd left/right filters ─────
  emitFilterPanel(26, 0, 1, leftDims[2], 27, 44);   // up to 36 pills — plenty for Jan-Dec
  emitFilterPanel(26, 14, 15, rightDims[2], 27, 44);

  // chart 4 title
  setStr(26, 3, `04 · ${spec.charts[3]?.title || 'Trend'}`, S.chartTitleRight);
  setMerge(26, 3, 26, 13);

  fillBox(26, 0, 44, 15, S.pageBg);

  // ───── ROW 45: footer ─────
  setStr(45, 0, `${spec.rowCount || 0} records · ${domain} domain · YAI-Excel v3 · ${new Date().toISOString().slice(0, 10)}`, S.footerText);
  setMerge(45, 0, 45, 15);
  fillBox(45, 0, 45, 15, S.pageBg);

  // ───── HIDDEN CHART DATA RANGES (rows 50, 70, 90, 110) ─────
  function emitChartData(startRow, chart, isStacked) {
    if (!chart) return;
    // header row
    setStr(startRow, 1, chart.dim || chart.dimA || 'Category', S.tutorH);
    if (isStacked) {
      const names = (chart.series || []).map(s => s.name);
      for (let i = 0; i < names.length; i++) setStr(startRow, 2 + i, names[i], S.tutorH);
    } else {
      setStr(startRow, 2, chart.metric || 'Value', S.tutorH);
    }
    const labels = chart.labels || [];
    for (let i = 0; i < labels.length; i++) {
      setStr(startRow + 1 + i, 1, labels[i], S.default);
      if (isStacked) {
        const series = chart.series || [];
        for (let j = 0; j < series.length; j++) setNum(startRow + 1 + i, 2 + j, series[j].data?.[i] ?? 0, S.default);
      } else {
        setNum(startRow + 1 + i, 2, (chart.data || [])[i] ?? 0, S.default);
      }
    }
  }
  emitChartData(50, spec.charts[0], false);
  emitChartData(70, spec.charts[1], false);
  emitChartData(90, spec.charts[2], false);
  emitChartData(110, spec.charts[3], true);

  // ───── Convert cell map → row XML ─────
  // Group cells by row
  const rowMap = new Map();
  for (const [ref, c] of cellMap) {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    const r = parseInt(m[2], 10);
    if (!rowMap.has(r)) rowMap.set(r, []);
    rowMap.get(r).push({ ref, ...c });
  }
  // Sort rows
  const sortedRows = [...rowMap.keys()].sort((a, b) => a - b);
  const rowHeights = {
    1: 30, 2: 22, 3: 24, 4: 6, 5: 14,
    6: 18, 7: 38, 8: 6, 9: 14,
    10: 18, 11: 18, 12: 18, 13: 18, 14: 18, 15: 18, 16: 18, 17: 18, 18: 18, 19: 18, 20: 18, 21: 18, 22: 18, 23: 18, 24: 18,
    25: 14,
    26: 18, 27: 18, 28: 18, 29: 18, 30: 18, 31: 18, 32: 18, 33: 18, 34: 18, 35: 18, 36: 18, 37: 18, 38: 18, 39: 18, 40: 18, 41: 18, 42: 18, 43: 18, 44: 18,
    45: 18,
  };

  const xmlRows = [];
  for (const r of sortedRows) {
    const cells = rowMap.get(r).sort((a, b) => {
      const ca = a.ref.match(/^([A-Z]+)/)[1];
      const cb = b.ref.match(/^([A-Z]+)/)[1];
      if (ca.length !== cb.length) return ca.length - cb.length;
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });
    const ht = rowHeights[r] || 16;
    let rowXml = `<row r="${r}" ht="${ht}" customHeight="1">`;
    for (const c of cells) {
      if (c.type === 's') {
        rowXml += `<c r="${c.ref}" t="s" s="${c.style}"><v>${sst.add(c.val)}</v></c>`;
      } else if (c.type === 'n') {
        if (c.val == null || isNaN(c.val)) rowXml += `<c r="${c.ref}" s="${c.style}"/>`;
        else rowXml += `<c r="${c.ref}" s="${c.style}"><v>${c.val}</v></c>`;
      } else {
        rowXml += `<c r="${c.ref}" s="${c.style}"/>`;
      }
    }
    rowXml += `</row>`;
    xmlRows.push(rowXml);
  }

  const mergeXml = `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;

  return `${XML_HEAD}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><tabColor rgb="FF${tc.accent}"/></sheetPr>
<dimension ref="A1:P150"/>
<sheetViews><sheetView tabSelected="1" workbookViewId="0" showGridLines="0" zoomScale="90"/></sheetViews>
<sheetFormatPr defaultRowHeight="16"/>
${cols}
<sheetData>
${xmlRows.join('\n')}
</sheetData>
${mergeXml}
<drawing r:id="rId1"/>
</worksheet>`;
}

function buildDataSheet(rows, headers, sst) {
  const rowsXml = [];
  let headerRow = `<row r="1">`;
  for (let c = 0; c < headers.length; c++) {
    headerRow += `<c r="${cellRef(1, c)}" t="s" s="${S.tutorH}"><v>${sst.add(headers[c])}</v></c>`;
  }
  headerRow += `</row>`;
  rowsXml.push(headerRow);

  const max = Math.min(rows.length, 3000);
  for (let i = 0; i < max; i++) {
    const r = rows[i];
    let row = `<row r="${i + 2}">`;
    for (let c = 0; c < headers.length; c++) {
      const v = r[headers[c]];
      const cleaned = String(v || '').replace(/[$,€£₹%\s]/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num) && /^[-]?[\d.]+$/.test(cleaned)) {
        row += `<c r="${cellRef(i + 2, c)}"><v>${num}</v></c>`;
      } else {
        row += `<c r="${cellRef(i + 2, c)}" t="s"><v>${sst.add(v || '')}</v></c>`;
      }
    }
    row += `</row>`;
    rowsXml.push(row);
  }
  return `${XML_HEAD}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${cellRef(max + 1, Math.max(headers.length - 1, 0))}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<sheetData>${rowsXml.join('\n')}</sheetData>
</worksheet>`;
}

// Tutorial sheet — teaches Excel using *this* dataset
function buildTutorSheet(spec, headers, sst) {
  const m1 = spec.metrics[0] || headers[0];
  const m2 = spec.metrics[1] || m1;
  const d1 = spec.dimensions[0] || headers[0];
  const d2 = spec.dimensions[1] || d1;

  const ITEMS = [];
  const H = (text) => ITEMS.push(['header', text]);
  const Pair = (formula, explanation) => ITEMS.push(['pair', formula, explanation]);
  const Tip = (text) => ITEMS.push(['tip', text]);
  const Blank = () => ITEMS.push(['blank']);

  H('🎓 EXCEL TUTOR — LEARN FROM YOUR OWN DATA');
  Blank();
  H('LESSON 1 — TOTALS, AVERAGES, COUNTS');
  const m1Col = colLetter(headers.indexOf(m1));
  Pair(`=SUM(Data!${m1Col}:${m1Col})`,
    `Sums every value in the "${m1}" column on the Data sheet. SUM is your first reflex when you need a total.`);
  Pair(`=AVERAGE(Data!${m1Col}:${m1Col})`,
    `Average of "${m1}". Use AVERAGE for the mean, MEDIAN for the middle value when outliers exist.`);
  Pair(`=COUNTA(Data!A:A)-1`,
    `Counts how many records you have (subtract 1 for the header). COUNTA counts non-empty cells — even text. Use COUNT for numbers only.`);
  Tip('💡 Tip: Whole-column references (e.g. C:C) work fine in modern Excel and stay correct as your data grows.');
  Blank();

  H('LESSON 2 — CONDITIONAL TOTALS WITH SUMIFS');
  const d1Col = colLetter(headers.indexOf(d1));
  const sample = spec.stats[d1]?.sample?.[0] || 'CategoryA';
  Pair(`=SUMIFS(Data!${m1Col}:${m1Col},Data!${d1Col}:${d1Col},"${sample}")`,
    `Sums "${m1}" only when "${d1}" equals "${sample}". SUMIFS is the workhorse of every dashboard — it slices any metric by any dimension.`);
  Pair(`=COUNTIFS(Data!${d1Col}:${d1Col},"${sample}")`,
    `Counts how many rows match. Pair COUNTIFS with SUMIFS to get both volume and value in one breath.`);
  Tip('💡 Tip: SUMIFS takes the sum column FIRST, then pairs of (criteria_range, criteria). The reverse of SUMIF — easy mistake.');
  Blank();

  H('LESSON 3 — LOOKUPS WITH XLOOKUP & INDEX/MATCH');
  Pair(`=XLOOKUP("ValueToFind",Data!${d1Col}:${d1Col},Data!${m1Col}:${m1Col},"Not Found")`,
    `XLOOKUP (Excel 365 / 2021) finds a value in one column and returns the matching value from another. The 4th argument is what to show when nothing is found.`);
  Pair(`=INDEX(Data!${m1Col}:${m1Col},MATCH("ValueToFind",Data!${d1Col}:${d1Col},0))`,
    `Classic INDEX/MATCH — works in every Excel version. Powerful combo that beats VLOOKUP every time.`);
  Blank();

  H('LESSON 4 — KPIs WITH SMART FORMATTING');
  Pair(`=TEXT(SUM(Data!${m1Col}:${m1Col}),"$#,##0.0,,&quot;M&quot;")`,
    `Wraps a number in millions with the M suffix. The trailing ,, divides by 1,000,000. A single , formats thousands as K.`);
  Pair(`=ROUND(SUM(Data!${m1Col}:${m1Col})/SUM(Data!${colLetter(headers.indexOf(m2))}:${colLetter(headers.indexOf(m2))})*100,2)&"%"`,
    `Calculates a ratio between two metrics and appends "%". Use ROUND to keep KPIs clean.`);
  Blank();

  H('LESSON 5 — PIVOT TABLES WITHOUT PIVOT TABLES');
  Pair(`=UNIQUE(Data!${d1Col}:${d1Col})`,
    `UNIQUE pulls every distinct value from a column — the modern way to build a dimension list without a Pivot.`);
  Pair(`=SORT(UNIQUE(Data!${d1Col}:${d1Col}))`,
    `Same as above, sorted A→Z. SORT + UNIQUE + FILTER are the dynamic-array trio that replaces 80% of pivot work.`);
  Pair(`=FILTER(Data!A:Z,Data!${d1Col}:${d1Col}="${sample}")`,
    `FILTER returns only the rows where the condition is true — a live slicer in cell form.`);
  Tip('💡 Tip: Dynamic-array functions spill across cells. Put them in one cell and the rest auto-fill.');
  Blank();

  H('LESSON 6 — CHART RECIPES (NO MOUSE)');
  Pair(`Select your data range → Alt+F1`,
    `Inserts the default chart on the same sheet. F11 puts it on a new sheet. Faster than clicking through menus.`);
  Pair(`Insert → Sparkline → Line`,
    `Tiny inline charts inside a single cell — perfect beside a KPI to show its trend.`);
  Blank();

  H('LESSON 7 — DATE INTELLIGENCE');
  Pair(`=TEXT(TODAY(),"yyyy-mm-dd")`,
    `TODAY() returns today's date as a serial number. Wrap with TEXT to format it.`);
  Pair(`=EOMONTH(TODAY(),0)`,
    `Last day of the current month. -1 = last day of previous month. Essential for monthly reporting.`);
  Pair(`=YEAR(A2)&"-Q"&ROUNDUP(MONTH(A2)/3,0)`,
    `Convert a date to "YYYY-Q#" — instant quarter labels for any pivot.`);
  Blank();

  H('LESSON 8 — KEYBOARD SHORTCUTS THAT MAKE YOU FAST');
  Pair(`Ctrl + Shift + L`, `Toggle filters on/off. The fastest way to slice a sheet.`);
  Pair(`Ctrl + T`, `Convert a range to a Table. Tables auto-extend formulas and chart sources.`);
  Pair(`Ctrl + Shift + Arrow`, `Select to the end of a contiguous block.`);
  Pair(`F4`, `Toggle absolute/relative references ($A$1 ↔ A$1 ↔ $A1 ↔ A1).`);
  Pair(`Ctrl + ;`, `Insert today's date as a hard value.`);
  Blank();

  H(`🎯 RECREATE THIS DASHBOARD — KPI FORMULAS FOR YOUR ${(spec.domain || 'DATA').toUpperCase()}`);
  for (const k of spec.kpis.slice(0, 5)) {
    const col = colLetter(headers.indexOf(k.column));
    Pair(`=SUM(Data!${col}:${col})`, `Recomputes the "${k.label}" KPI shown on the Dashboard sheet.`);
  }
  Blank();
  H('🚀 NEXT STEPS');
  Tip('💬 Open the Dashboard sheet. Every chart there uses the Data sheet and the techniques above. Right-click any chart → "Select Data" to see exactly which columns drive it.');
  Tip('🎨 Try a different theme on your next upload — cell styles, chart colours, and KPI accents all move together.');

  const xmlRows = [];
  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const r = i + 1;
    let row = `<row r="${r}" ht="${item[0] === 'header' ? 26 : 22}" customHeight="1">`;
    if (item[0] === 'header') {
      row += `<c r="${cellRef(r, 0)}" s="${S.subTitle}" t="s"><v>${sst.add(item[1])}</v></c>`;
      for (let c = 1; c <= 6; c++) row += `<c r="${cellRef(r, c)}" s="${S.subTitle}"/>`;
    } else if (item[0] === 'pair') {
      row += `<c r="${cellRef(r, 0)}" s="${S.tutorCode}" t="s"><v>${sst.add(item[1])}</v></c>`;
      for (let c = 1; c <= 2; c++) row += `<c r="${cellRef(r, c)}" s="${S.tutorCode}"/>`;
      row += `<c r="${cellRef(r, 3)}" s="${S.tutorBody}" t="s"><v>${sst.add(item[2])}</v></c>`;
      for (let c = 4; c <= 6; c++) row += `<c r="${cellRef(r, c)}" s="${S.tutorBody}"/>`;
    } else if (item[0] === 'tip') {
      row += `<c r="${cellRef(r, 0)}" s="${S.tutorTip}" t="s"><v>${sst.add(item[1])}</v></c>`;
      for (let c = 1; c <= 6; c++) row += `<c r="${cellRef(r, c)}" s="${S.tutorTip}"/>`;
    } else {
      row += `<c r="${cellRef(r, 0)}" s="${S.default}"/>`;
    }
    row += `</row>`;
    xmlRows.push(row);
  }

  const colsXml = `<cols>
<col min="1" max="3" width="30" customWidth="1"/>
<col min="4" max="7" width="40" customWidth="1"/>
</cols>`;

  const merges = [];
  for (let i = 0; i < ITEMS.length; i++) {
    if (ITEMS[i][0] === 'header' || ITEMS[i][0] === 'tip') merges.push(`${cellRef(i + 1, 0)}:${cellRef(i + 1, 6)}`);
    else if (ITEMS[i][0] === 'pair') {
      merges.push(`${cellRef(i + 1, 0)}:${cellRef(i + 1, 2)}`);
      merges.push(`${cellRef(i + 1, 3)}:${cellRef(i + 1, 6)}`);
    }
  }
  const mergeXml = `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;

  return `${XML_HEAD}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><tabColor rgb="FF22C55E"/></sheetPr>
<dimension ref="A1:G${ITEMS.length}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
${colsXml}
<sheetData>${xmlRows.join('\n')}</sheetData>
${mergeXml}
</worksheet>`;
}

function buildSheet1Rels() {
  return `${XML_HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;
}

function buildDrawing() {
  function anchor(idx, fromCol, fromRow, toCol, toRow, rid) {
    return `<xdr:twoCellAnchor>
<xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro="">
<xdr:nvGraphicFramePr><xdr:cNvPr id="${idx + 1}" name="Chart ${idx + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rid}"/>
</a:graphicData></a:graphic>
</xdr:graphicFrame>
<xdr:clientData/>
</xdr:twoCellAnchor>`;
  }
  // Anchor map (col indexes are 0-based, rows are 0-based):
  //   chart1 (HBar):    D11:H24   → col 3..7,   row 10..23
  //   chart2 (Doughnut): I11:K24   → col 8..10,  row 10..23
  //   chart3 (Pie):      L11:N24   → col 11..13, row 10..23
  //   chart4 (Stacked):  D27:N44   → col 3..13,  row 26..43
  return `${XML_HEAD}
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
${anchor(0, 3, 10,  8, 24, 'rId1')}
${anchor(1, 8, 10, 11, 24, 'rId2')}
${anchor(2, 11, 10, 14, 24, 'rId3')}
${anchor(3, 3, 26, 14, 44, 'rId4')}
</xdr:wsDr>`;
}

function buildDrawingRels() {
  return `${XML_HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart3.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart4.xml"/>
</Relationships>`;
}

function chartTitleXml(title) {
  return `<c:title>
<c:tx><c:rich>
<a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" wrap="square" anchor="ctr" anchorCtr="1"/>
<a:lstStyle/>
<a:p>
<a:pPr><a:defRPr sz="1300" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Calibri"/></a:defRPr></a:pPr>
<a:r><a:rPr lang="en-US" sz="1300" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>${escapeXml(title)}</a:t></a:r>
</a:p>
</c:rich></c:tx>
<c:overlay val="0"/>
</c:title>`;
}

function chartBgXml(tc) {
  return `<c:spPr><a:solidFill><a:srgbClr val="${tc.card}"/></a:solidFill><a:ln w="0"><a:noFill/></a:ln></c:spPr>`;
}
function plotBgXml(tc) {
  return `<c:spPr><a:solidFill><a:srgbClr val="${tc.card}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>`;
}
function txPrXml(color) {
  return `<c:txPr><a:bodyPr/><a:lstStyle/>
<a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p>
</c:txPr>`;
}

function buildBarChartXml(chart, theme, horizontal, dataStartRow) {
  const tc = THEME_COLORS[theme] || THEME_COLORS.midnight;
  const labels = chart.labels || [];
  const data = chart.data || [];
  const color = tc.chart[0];
  const startRow = dataStartRow + 1;
  const endRow = dataStartRow + labels.length;
  const catPoints = labels.map((l, i) => `<c:pt idx="${i}"><c:v>${escapeXml(l)}</c:v></c:pt>`).join('');
  const numPoints = data.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
  return `${XML_HEAD}
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${chartBgXml(tc)}
<c:chart>
${chartTitleXml(chart.title || '')}
<c:autoTitleDeleted val="0"/>
<c:plotArea>
<c:layout/>
<c:barChart>
<c:barDir val="${horizontal ? 'bar' : 'col'}"/>
<c:grouping val="clustered"/>
<c:varyColors val="0"/>
<c:ser>
<c:idx val="0"/><c:order val="0"/>
<c:tx><c:v>${escapeXml(chart.metric || 'Value')}</c:v></c:tx>
<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
<c:cat><c:strRef><c:f>Dashboard!$B$${startRow}:$B$${endRow}</c:f><c:strCache><c:ptCount val="${labels.length}"/>${catPoints}</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>Dashboard!$C$${startRow}:$C$${endRow}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${labels.length}"/>${numPoints}</c:numCache></c:numRef></c:val>
</c:ser>
<c:gapWidth val="100"/>
<c:axId val="111"/>
<c:axId val="222"/>
</c:barChart>
<c:catAx>
<c:axId val="111"/>
<c:scaling><c:orientation val="minMax"/></c:scaling>
<c:delete val="0"/>
<c:axPos val="${horizontal ? 'l' : 'b'}"/>
${txPrXml(tc.text)}
<c:crossAx val="222"/>
</c:catAx>
<c:valAx>
<c:axId val="222"/>
<c:scaling><c:orientation val="minMax"/></c:scaling>
<c:delete val="0"/>
<c:axPos val="${horizontal ? 'b' : 'l'}"/>
<c:majorGridlines><c:spPr><a:ln w="3175"><a:solidFill><a:srgbClr val="${tc.text}"/><a:alpha val="20000"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>
${txPrXml(tc.text)}
<c:crossAx val="111"/>
</c:valAx>
${plotBgXml(tc)}
</c:plotArea>
<c:plotVisOnly val="1"/>
<c:dispBlanksAs val="gap"/>
</c:chart>
</c:chartSpace>`;
}

function buildPieChartXml(chart, theme, doughnut, dataStartRow) {
  const tc = THEME_COLORS[theme] || THEME_COLORS.midnight;
  const labels = chart.labels || [];
  const data = chart.data || [];
  const colors = tc.chart;
  const startRow = dataStartRow + 1;
  const endRow = dataStartRow + labels.length;
  const catPoints = labels.map((l, i) => `<c:pt idx="${i}"><c:v>${escapeXml(l)}</c:v></c:pt>`).join('');
  const numPoints = data.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
  const dPts = labels.map((l, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${colors[i % colors.length]}"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${tc.card}"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join('');
  const seriesTag = doughnut ? 'doughnutChart' : 'pieChart';
  const holeSize = doughnut ? `<c:holeSize val="60"/>` : '';
  return `${XML_HEAD}
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${chartBgXml(tc)}
<c:chart>
${chartTitleXml(chart.title || '')}
<c:autoTitleDeleted val="0"/>
<c:plotArea>
<c:layout/>
<c:${seriesTag}>
<c:varyColors val="1"/>
<c:ser>
<c:idx val="0"/><c:order val="0"/>
<c:tx><c:v>${escapeXml(chart.metric || 'Value')}</c:v></c:tx>
${dPts}
<c:cat><c:strRef><c:f>Dashboard!$B$${startRow}:$B$${endRow}</c:f><c:strCache><c:ptCount val="${labels.length}"/>${catPoints}</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>Dashboard!$C$${startRow}:$C$${endRow}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${labels.length}"/>${numPoints}</c:numCache></c:numRef></c:val>
</c:ser>
<c:firstSliceAng val="0"/>
${holeSize}
</c:${seriesTag}>
${plotBgXml(tc)}
</c:plotArea>
<c:legend>
<c:legendPos val="r"/>
<c:overlay val="0"/>
${txPrXml(tc.text)}
</c:legend>
<c:plotVisOnly val="1"/>
<c:dispBlanksAs val="gap"/>
</c:chart>
</c:chartSpace>`;
}

function buildLineChartXml(chart, theme, area = false, dataStartRow) {
  const tc = THEME_COLORS[theme] || THEME_COLORS.midnight;
  const labels = chart.labels || [];
  const series = chart.series && chart.series.length
    ? chart.series
    : [{ name: chart.metric || 'Value', data: chart.data || [] }];
  const colors = tc.chart;
  const startRow = dataStartRow + 1;
  const endRow = dataStartRow + labels.length;
  const catPoints = labels.map((l, i) => `<c:pt idx="${i}"><c:v>${escapeXml(l)}</c:v></c:pt>`).join('');

  const seriesXml = series.map((s, sIdx) => {
    const numPoints = (s.data || []).map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
    const valCol = colLetter(2 + sIdx);
    return `<c:ser>
<c:idx val="${sIdx}"/><c:order val="${sIdx}"/>
<c:tx><c:v>${escapeXml(s.name)}</c:v></c:tx>
<c:spPr><a:${area ? 'solidFill' : 'ln w="28575"'}><a:srgbClr val="${colors[sIdx % colors.length]}"/></a:${area ? 'solidFill' : 'ln'}></c:spPr>
<c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="${colors[sIdx % colors.length]}"/></a:solidFill></c:spPr></c:marker>
<c:cat><c:strRef><c:f>Dashboard!$B$${startRow}:$B$${endRow}</c:f><c:strCache><c:ptCount val="${labels.length}"/>${catPoints}</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>Dashboard!$${valCol}$${startRow}:$${valCol}$${endRow}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${labels.length}"/>${numPoints}</c:numCache></c:numRef></c:val>
<c:smooth val="0"/>
</c:ser>`;
  }).join('');

  const chartTag = area ? 'areaChart' : 'lineChart';
  return `${XML_HEAD}
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${chartBgXml(tc)}
<c:chart>
${chartTitleXml(chart.title || '')}
<c:autoTitleDeleted val="0"/>
<c:plotArea>
<c:layout/>
<c:${chartTag}>
<c:grouping val="${area ? 'standard' : 'standard'}"/>
<c:varyColors val="0"/>
${seriesXml}
<c:marker val="1"/>
<c:axId val="555"/>
<c:axId val="666"/>
</c:${chartTag}>
<c:catAx>
<c:axId val="555"/>
<c:scaling><c:orientation val="minMax"/></c:scaling>
<c:delete val="0"/>
<c:axPos val="b"/>
${txPrXml(tc.text)}
<c:crossAx val="666"/>
</c:catAx>
<c:valAx>
<c:axId val="666"/>
<c:scaling><c:orientation val="minMax"/></c:scaling>
<c:delete val="0"/>
<c:axPos val="l"/>
<c:majorGridlines><c:spPr><a:ln w="3175"><a:solidFill><a:srgbClr val="${tc.text}"/><a:alpha val="20000"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>
${txPrXml(tc.text)}
<c:crossAx val="555"/>
</c:valAx>
${plotBgXml(tc)}
</c:plotArea>
<c:legend>
<c:legendPos val="b"/>
<c:overlay val="0"/>
${txPrXml(tc.text)}
</c:legend>
<c:plotVisOnly val="1"/>
<c:dispBlanksAs val="gap"/>
</c:chart>
</c:chartSpace>`;
}

function buildStackedBarChartXml(chart, theme, dataStartRow) {
  const tc = THEME_COLORS[theme] || THEME_COLORS.midnight;
  const labels = chart.labels || [];
  const series = chart.series || [];
  const colors = tc.chart;
  const startRow = dataStartRow + 1;
  const endRow = dataStartRow + labels.length;
  const catPoints = labels.map((l, i) => `<c:pt idx="${i}"><c:v>${escapeXml(l)}</c:v></c:pt>`).join('');
  const seriesXml = series.map((s, sIdx) => {
    const numPoints = s.data.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
    const valCol = colLetter(2 + sIdx);
    return `<c:ser>
<c:idx val="${sIdx}"/><c:order val="${sIdx}"/>
<c:tx><c:v>${escapeXml(s.name)}</c:v></c:tx>
<c:spPr><a:solidFill><a:srgbClr val="${colors[sIdx % colors.length]}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
<c:cat><c:strRef><c:f>Dashboard!$B$${startRow}:$B$${endRow}</c:f><c:strCache><c:ptCount val="${labels.length}"/>${catPoints}</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>Dashboard!$${valCol}$${startRow}:$${valCol}$${endRow}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${labels.length}"/>${numPoints}</c:numCache></c:numRef></c:val>
</c:ser>`;
  }).join('');
  return `${XML_HEAD}
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${chartBgXml(tc)}
<c:chart>
${chartTitleXml(chart.title || '')}
<c:autoTitleDeleted val="0"/>
<c:plotArea>
<c:layout/>
<c:barChart>
<c:barDir val="col"/>
<c:grouping val="stacked"/>
<c:varyColors val="0"/>
${seriesXml}
<c:gapWidth val="50"/>
<c:overlap val="100"/>
<c:axId val="333"/>
<c:axId val="444"/>
</c:barChart>
<c:catAx>
<c:axId val="333"/>
<c:scaling><c:orientation val="minMax"/></c:scaling>
<c:delete val="0"/>
<c:axPos val="b"/>
${txPrXml(tc.text)}
<c:crossAx val="444"/>
</c:catAx>
<c:valAx>
<c:axId val="444"/>
<c:scaling><c:orientation val="minMax"/></c:scaling>
<c:delete val="0"/>
<c:axPos val="l"/>
<c:majorGridlines><c:spPr><a:ln w="3175"><a:solidFill><a:srgbClr val="${tc.text}"/><a:alpha val="20000"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>
${txPrXml(tc.text)}
<c:crossAx val="333"/>
</c:valAx>
${plotBgXml(tc)}
</c:plotArea>
<c:legend>
<c:legendPos val="b"/>
<c:overlay val="0"/>
${txPrXml(tc.text)}
</c:legend>
<c:plotVisOnly val="1"/>
<c:dispBlanksAs val="gap"/>
</c:chart>
</c:chartSpace>`;
}

// Dispatch a chart spec to the right XML builder by type.
// Supported: horizontalBar, verticalBar/clusteredBar, doughnut, pie, stackedBar, line, area.
// Falls back to barChart for unknown types.
function buildAnyChartXml(chart, theme, dataStartRow) {
  const type = (chart?.type || '').toLowerCase();
  if (type === 'horizontalbar' || type === 'hbar' || type === 'bar') {
    return buildBarChartXml(chart, theme, true, dataStartRow);
  }
  if (type === 'verticalbar' || type === 'clusteredbar' || type === 'column' || type === 'col') {
    return buildBarChartXml(chart, theme, false, dataStartRow);
  }
  if (type === 'doughnut' || type === 'donut') {
    return buildPieChartXml(chart, theme, true, dataStartRow);
  }
  if (type === 'pie') {
    return buildPieChartXml(chart, theme, false, dataStartRow);
  }
  if (type === 'stackedbar' || type === 'stackedcolumn' || type === 'stacked') {
    return buildStackedBarChartXml(chart, theme, dataStartRow);
  }
  if (type === 'line' || type === 'area') {
    return buildLineChartXml(chart, theme, type === 'area', dataStartRow);
  }
  // Default: vertical bar
  return buildBarChartXml(chart, theme, false, dataStartRow);
}

function buildXlsx(spec, theme, rows, headers) {
  const sst = new StringTable();
  const sheet1 = buildDashboardSheet(spec, theme, sst);
  const sheet2 = buildDataSheet(rows, headers, sst);
  const sheet3 = buildTutorSheet(spec, headers, sst);
  const sharedStrings = sst.toXml();
  // Each chart respects the type the AI picked (with deterministic fallback already applied in finaliseSpec)
  const chart1 = buildAnyChartXml(spec.charts[0], theme, 50);
  const chart2 = buildAnyChartXml(spec.charts[1], theme, 70);
  const chart3 = buildAnyChartXml(spec.charts[2], theme, 90);
  // Chart 4 ALWAYS uses stacked (or line for trend) since it's the timeline
  const chart4 = (spec.charts[3]?.type === 'line' || spec.charts[3]?.type === 'area')
    ? buildLineChartXml(spec.charts[3], theme, spec.charts[3].type === 'area', 110)
    : buildStackedBarChartXml(spec.charts[3], theme, 110);
  const files = {
    '[Content_Types].xml': buildContentTypes(),
    '_rels/.rels': buildRootRels(),
    'xl/workbook.xml': buildWorkbook(),
    'xl/_rels/workbook.xml.rels': buildWorkbookRels(),
    'xl/styles.xml': buildStyles(theme),
    'xl/sharedStrings.xml': sharedStrings,
    'xl/worksheets/sheet1.xml': sheet1,
    'xl/worksheets/_rels/sheet1.xml.rels': buildSheet1Rels(),
    'xl/worksheets/sheet2.xml': sheet2,
    'xl/worksheets/sheet3.xml': sheet3,
    'xl/drawings/drawing1.xml': buildDrawing(),
    'xl/drawings/_rels/drawing1.xml.rels': buildDrawingRels(),
    'xl/charts/chart1.xml': chart1,
    'xl/charts/chart2.xml': chart2,
    'xl/charts/chart3.xml': chart3,
    'xl/charts/chart4.xml': chart4,
  };
  return buildZip(files);
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

// Convert ArrayBuffer to base64 (Worker-safe — no node Buffer)
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function handleUpload(request, env) {
  const form = await request.formData();
  // Accept both legacy 'file' and new 'data' / 'image' fields
  const dataFile = form.get('data') || form.get('file');
  const imageFile = form.get('image');
  const text = (form.get('text') || '').toString();
  const groqKey = (form.get('groq_api_key') || '').toString();
  const geminiKey = (form.get('gemini_api_key') || '').toString();

  if (!dataFile && !text) return errorResponse('Provide a data file or text');

  let csvText = text;
  let fileName = '';
  if (dataFile) {
    fileName = dataFile.name || 'upload';
    const buf = await dataFile.arrayBuffer();
    csvText = new TextDecoder('utf-8').decode(buf);
  }

  // Image reference (optional) — used for layout extraction via Gemini Vision
  let imageBase64 = null;
  let imageMime = null;
  if (imageFile) {
    const ibuf = await imageFile.arrayBuffer();
    imageBase64 = arrayBufferToBase64(ibuf);
    imageMime = imageFile.type || 'image/png';
  }

  const parsed = parseCSV(csvText);
  if (parsed.headers.length === 0) return errorResponse('Could not parse data — please upload CSV');

  const token = generateUUID();
  const payload = {
    csv: csvText, headers: parsed.headers, rowCount: parsed.rows.length,
    fileName, userPrompt: text && dataFile ? text : '',
    keys: { groq: groqKey || '', gemini: geminiKey || '' },
    imageBase64, imageMime,
    ts: Date.now(),
  };
  await env.YAI_KV.put(`upload:${token}`, JSON.stringify(payload), { expirationTtl: 3600 });

  return jsonResponse({
    token, type: dataFile ? 'file' : 'text',
    has_image: !!imageBase64,
    summary: `Parsed ${parsed.rows.length} rows · ${parsed.headers.length} columns${fileName ? ' from ' + fileName : ''}${imageBase64 ? ' · with image reference' : ''}`,
    analysis: {
      domain: guessDomain(parsed.headers),
      kpi_count: 5, chart_count: 4,
    },
  });
}

async function handleGenerate(request, env) {
  const body = await request.json();
  const { token, theme = 'midnight', user_prompt = '' } = body;
  const groqKey = (body.groq_api_key || '').toString();
  const geminiKey = (body.gemini_api_key || '').toString();

  if (!token) return errorResponse('Missing token');
  const stored = await env.YAI_KV.get(`upload:${token}`);
  if (!stored) return errorResponse('Token expired or invalid');

  const data = JSON.parse(stored);
  const keys = { groq: groqKey || data.keys?.groq || '', gemini: geminiKey || data.keys?.gemini || '' };
  const parsed = parseCSV(data.csv);
  if (parsed.rows.length === 0) return errorResponse('No data rows');

  const spec = await finaliseSpec(parsed.rows, parsed.headers, keys, user_prompt, data.imageBase64, data.imageMime);
  const xlsxBytes = buildXlsx(spec, theme, parsed.rows, parsed.headers);

  const fileToken = generateUUID();
  // Store as latin-1 string in KV (Cloudflare KV supports arraybuffer too)
  await env.YAI_KV.put(`file:${fileToken}`, xlsxBytes,
    { expirationTtl: 7200, metadata: { type: 'xlsx', theme, name: spec.title } });

  const baseUrl = new URL(request.url).origin;
  const filename = `${(spec.title || 'dashboard').replace(/[^a-z0-9-]+/gi, '_').toLowerCase()}_${theme}.xlsx`;

  return jsonResponse({
    token, theme,
    download_url: `${baseUrl}/api/download/${fileToken}/${filename}`,
    filename,
    spec: {
      title: spec.title, domain: spec.domain,
      kpi_count: spec.kpis.length,
      chart_count: spec.charts.filter(c => (c.labels?.length || 0) > 0).length,
    },
    audit: {
      domain: spec.domain,
      confidence: keys.groq || keys.gemini ? 0.95 : 0.7,
      enhancement_suggestions: [
        { description: 'Open the Excel Tutor tab to learn how every KPI was computed.', priority: 'low' },
        { description: 'Right-click any chart → Select Data to retarget it to a different column.', priority: 'low' },
        { description: 'Apply your own brand colours by picking a different theme.', priority: 'low' },
      ],
    },
  });
}

async function handleFileDownload(request, env, parts) {
  const fileToken = parts[2];
  const requestedName = parts[3] || `dashboard.xlsx`;
  const data = await env.YAI_KV.get(`file:${fileToken}`, { type: 'arrayBuffer' });
  if (!data) return errorResponse('File not found or expired', 404);
  return new Response(data, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${requestedName}"`,
      'Cache-Control': 'private, max-age=600',
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    const url = new URL(request.url);
    const path = url.pathname;
    const parts = path.split('/').filter(Boolean);
    try {
      if (path === '/api/themes') return jsonResponse({ themes: THEMES });
      if (path === '/api/upload' && request.method === 'POST') return await handleUpload(request, env);
      if (path === '/api/generate' && request.method === 'POST') return await handleGenerate(request, env);
      if (parts[0] === 'api' && parts[1] === 'download') return await handleFileDownload(request, env, parts);
      if (path === '/' || path === '/health') return jsonResponse({ status: 'ok', version: '3.0', features: ['xlsx', 'charts', 'tutor', 'deterministic-70-30'] });
      return errorResponse('Not found', 404);
    } catch (e) {
      console.error(e);
      return errorResponse(e.message || 'Internal error', 500);
    }
  },
};
