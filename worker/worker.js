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

// ── EXCEL TEACHER ─────────────────────────────────────────────────────────────
// Conversational Excel tutor — multi-turn chat with a patient, encouraging
// teacher persona. Speaks the user's language (English / Hindi / Hinglish),
// uses Excel formulas with real examples, suggests keyboard shortcuts, and
// adapts difficulty to the learner's level.

const TEACHER_SYSTEM_PROMPT = `You are "Yahavi" (याहवी) — a warm, patient Excel teacher built by Hackknow. Your name means "river of knowledge" in Sanskrit. You combine the warmth of a college mentor with the precision of a Microsoft MVP, and your goal is to make every Indian professional fluent in Excel.

CORE TEACHING PRINCIPLES:

1. MEET THE LEARNER WHERE THEY ARE
   Detect the language of the user's message and respond in the SAME register:
   - English question → reply in English
   - Hindi question (Devanagari script) → reply in Hindi
   - Hinglish ("Excel mein VLOOKUP kaise use karein?") → reply in Hinglish (Hindi+English mix, Latin script)
   Never lecture in a language they didn't ask in.

2. SHOW, DON'T JUST TELL
   For every formula or concept, give:
   - A 1-line plain-language description
   - The exact formula syntax in a code block
   - A worked example with sample inputs and the expected output
   - A keyboard shortcut if relevant
   - ONE common mistake learners make

3. PROGRESS BY THE LADDER OF DEPTH
   - First answer the question in the SIMPLEST possible way (the "minimum viable answer")
   - Then offer "deeper dive" follow-ups if the learner wants more
   - Never overwhelm with 10 concepts when 1 will do

4. CONNECT TO REAL WORK
   When the learner mentions their data (CSV columns, business domain, role), tailor examples to that domain. A manufacturing learner gets SUMIFS over Plant + Month; a sales learner gets it over Region + Quarter.

5. CELEBRATE PROGRESS
   Acknowledge when they ask a good question. Reinforce when they make a clever choice. Excel can be intimidating — your tone is "you've got this".

6. PRACTICAL EXCEL RANGE
   You cover: formulas (XLOOKUP, INDEX/MATCH, SUMIFS, COUNTIFS, IF, IFS, IFERROR, dynamic arrays UNIQUE/SORT/FILTER, LET, LAMBDA), PivotTables, charts (when to use which type), conditional formatting, data validation, Power Query basics, Power Pivot basics, VBA macros (simple ones), keyboard shortcuts, dashboard design, financial modelling fundamentals.

7. STAY IN SCOPE
   If the learner asks something non-Excel ("write me a Python script", "tell me a joke about my boss"), politely redirect: "I'm trained on Excel specifically — back to your spreadsheet, that's where I shine." Don't refuse rudely; redirect.

OUTPUT FORMAT (always return ONE valid JSON object, no markdown fences around the outer JSON):
{
  "reply": "<markdown body — multi-paragraph, with code blocks for formulas>",
  "lang": "en|hi|hinglish",
  "level": "beginner|intermediate|advanced — your read of the learner",
  "concepts_covered": ["SUMIFS", "absolute references"],
  "follow_up_questions": [
    "Short question the learner might ask next",
    "Another natural next question",
    "A deeper question for when they're ready"
  ],
  "suggested_shortcut": "Ctrl+Shift+Enter — array formula entry (or null)",
  "homework": "ONE tiny exercise the learner could try in their own sheet right now, or null"
}

EXAMPLES OF GREAT TEACHING MOMENTS:
- "How do I sum only Plant A rows?" → SUMIFS with $-anchored ranges, example output, mention "drag this down" caveat
- "VLOOKUP nahi mil raha" → Hinglish reply with XLOOKUP recommendation + INDEX/MATCH for older Excel
- "What's a pivot table?" → minimum viable answer (3 sentences) + offer to walk through building one`;

async function aiTeacherReply(keys, history, userMessage, dataContext = null) {
  const messages = [];
  // Build conversation history — last 8 turns is plenty for a teaching loop
  for (const turn of (history || []).slice(-8)) {
    if (turn.role === 'user' || turn.role === 'assistant') {
      messages.push({ role: turn.role, content: turn.content });
    }
  }
  // Append data context if provided
  let userBlock = userMessage;
  if (dataContext) {
    userBlock = `[Context: the learner is currently working with a dataset that has these columns: ${JSON.stringify(dataContext.headers || [])}, ${dataContext.row_count || 0} rows. Their inferred domain is "${dataContext.domain || 'unknown'}". When suggesting formulas, prefer column names from this list so they can paste them directly.]\n\n${userMessage}`;
  }
  messages.push({ role: 'user', content: userBlock });

  // Prefer Groq (faster + JSON mode), fall back to Gemini
  if (keys.groq) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keys.groq}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: TEACHER_SYSTEM_PROMPT }, ...messages],
          max_tokens: 2048,
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });
      if (!resp.ok) throw new Error(`Groq ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      const data = await resp.json();
      return parseJSONLoose(data.choices?.[0]?.message?.content || '') || null;
    } catch (e) {
      console.error('Groq teacher failed:', e.message);
    }
  }
  if (keys.gemini) {
    try {
      const flatHistory = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      const prompt = `${TEACHER_SYSTEM_PROMPT}\n\nConversation so far:\n${flatHistory}\n\nReturn only the JSON.`;
      const raw = await callGemini(keys.gemini, prompt);
      return parseJSONLoose(raw) || null;
    } catch (e) {
      console.error('Gemini teacher failed:', e.message);
    }
  }
  return null;
}

// Deterministic fallback teacher — keyword routing → canned helpful answer.
// Triggered when no AI keys are available so users still get value.
const FALLBACK_LESSONS = [
  {
    match: /(vlookup|xlookup|lookup|खोज)/i,
    reply: `## Looking up values across sheets

The modern way is **XLOOKUP** (Excel 365 / 2021+):

\`\`\`
=XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])
\`\`\`

Example — find an employee's salary by name:

\`\`\`
=XLOOKUP("Alice", A:A, C:C, "Not found")
\`\`\`

For older Excel, use INDEX/MATCH instead — it's more flexible than VLOOKUP:

\`\`\`
=INDEX(C:C, MATCH("Alice", A:A, 0))
\`\`\`

**Common mistake**: VLOOKUP only works left-to-right (lookup column must be left of return column). XLOOKUP and INDEX/MATCH have no such limit.`,
    concepts: ['XLOOKUP', 'INDEX/MATCH', 'VLOOKUP'],
    follow_ups: ['How is XLOOKUP different from VLOOKUP?', 'What does the if_not_found argument do?', 'Show me a 2-criteria lookup'],
    shortcut: 'F4 — toggle absolute references inside a formula',
    homework: 'In your own data, replace one VLOOKUP with XLOOKUP and add an "if_not_found" message.',
  },
  {
    match: /(sumif|sum.{0,3}if|conditional.{0,3}sum|sum krna)/i,
    reply: `## Conditional sums — the SUMIFS workhorse

\`\`\`
=SUMIFS(sum_range, criteria_range1, criteria1, [criteria_range2, criteria2], ...)
\`\`\`

Example — total revenue for Plant A in January:

\`\`\`
=SUMIFS(Revenue, Plant, "A", Month, "Jan")
\`\`\`

**The order is reversed from SUMIF.** SUMIFS asks for the sum column FIRST, then pairs of (criteria_range, criteria). Easy to get wrong — F1 SUMIFS to remind yourself anytime.

For counting rows that match, use **COUNTIFS** (same syntax pattern, no sum_range argument).`,
    concepts: ['SUMIFS', 'COUNTIFS'],
    follow_ups: ['How do I sum with two conditions?', 'What\'s the difference between SUMIF and SUMIFS?', 'Can SUMIFS use date ranges?'],
    shortcut: 'Alt + = — auto-sum the column above',
    homework: 'Pick a category in your sheet and write a SUMIFS that totals one metric just for that category.',
  },
  {
    match: /(pivot|pivot table)/i,
    reply: `## PivotTables in 3 sentences

A PivotTable is a drag-and-drop summary of your raw data — you pick which column becomes rows, which becomes columns, and which gets summed/counted. Excel keeps the source intact and shows you the aggregated view.

To create one: select your data → **Insert → PivotTable** → drag column names into the Rows, Columns, Values boxes.

**Pro tip**: Convert your data to a Table first (**Ctrl + T**) so the PivotTable auto-extends when you add rows.`,
    concepts: ['PivotTable', 'Table'],
    follow_ups: ['How do I refresh a PivotTable?', 'Show me how to add a slicer', 'Can I use a formula inside a PivotTable?'],
    shortcut: 'Ctrl + T — convert range to Table',
    homework: 'Insert a PivotTable from your data; drag your biggest categorical column to Rows and your top metric to Values.',
  },
  {
    match: /(chart|graph|visuali[sz]e)/i,
    reply: `## Which chart should I use?

Quick decision tree:

- **Compare totals across categories** → vertical bar
- **Rank entities** (long labels) → horizontal bar
- **Show a share of total** (3-8 slices) → doughnut or pie
- **Trend over time** → line; if stacked, stacked column
- **Correlate two metrics** → scatter
- **One value vs target** → bullet or gauge

**Insert a default chart in 1 click**: select your range → **Alt + F1**.`,
    concepts: ['Chart selection', 'Chart insertion'],
    follow_ups: ['How do I add a secondary axis?', 'How do I change chart colors?', 'Can I combine a bar and line chart?'],
    shortcut: 'Alt + F1 — instant chart',
    homework: 'Select your top 5 categories and one metric, hit Alt + F1, then change it to a horizontal bar with a right-click.',
  },
  {
    match: /(shortcut|keyboard|fastest)/i,
    reply: `## Top 10 Excel shortcuts that pay off forever

1. **Ctrl + T** — convert range to Table (auto-extends formulas + chart sources)
2. **Ctrl + Shift + L** — toggle filters
3. **Ctrl + Shift + Arrow** — select to end of contiguous block
4. **Ctrl + ;** — insert today's date as a value
5. **F4** — toggle absolute / relative references ($A$1 ↔ A$1 ↔ $A1 ↔ A1)
6. **Alt + =** — auto-sum
7. **Alt + F1** — insert default chart
8. **Ctrl + Shift + Enter** — array formula (legacy Excel)
9. **Ctrl + Page Up/Down** — switch sheets
10. **F2** — edit cell in place`,
    concepts: ['Keyboard shortcuts'],
    follow_ups: ['Shortcut to lock a cell reference?', 'How do I open the Name Manager via keyboard?', 'Show me Mac equivalents'],
    shortcut: 'F4 — universal reference toggler',
    homework: 'Try Ctrl+T on your data range right now. Watch your formulas auto-update.',
  },
  {
    match: /(dashboard|kpi|design)/i,
    reply: `## How great dashboards are built

A working Excel dashboard has 4 layers, top to bottom:

1. **Title bar** — name + period + (optional) brand
2. **3-5 KPI cards** — biggest numbers, smallest text labels above them. Currency / compact / percent format
3. **3-4 detail charts** — answer the "why" behind each KPI
4. **1 wide timeline chart** at the bottom — the story over time

**Design rule of thumb**: use ONE accent color, generous white space, never more than 3 fonts. The reader should "get it" in 5 seconds.

Want to try? Open **https://yexcel.hackknow.com** — upload any CSV, get a working dashboard back instantly, with a free Excel Tutor sheet that teaches every formula it used.`,
    concepts: ['Dashboard design', 'KPI cards'],
    follow_ups: ['How big should the KPI font be?', 'What\'s the best chart for monthly trend?', 'How do I add slicers to my dashboard?'],
    shortcut: 'Ctrl + 1 — open Format Cells dialog (KPI formatting)',
    homework: 'Pick 3 numbers from your sheet that matter and turn them into 3 large cells with bold accents — your first KPI cards.',
  },
];

function deterministicTeacherReply(message) {
  const m = String(message || '').trim();
  for (const lesson of FALLBACK_LESSONS) {
    if (lesson.match.test(m)) {
      return {
        reply: lesson.reply,
        lang: /[ऀ-ॿ]/.test(m) ? 'hi' : /(kar|hai|kaise|nahi|kr|sab|kuch)/i.test(m) ? 'hinglish' : 'en',
        level: 'beginner',
        concepts_covered: lesson.concepts,
        follow_up_questions: lesson.follow_ups,
        suggested_shortcut: lesson.shortcut,
        homework: lesson.homework,
      };
    }
  }
  return {
    reply: `Hi! I'm Yahavi — your free Excel teacher.

Without an AI key I work in **offline mode** with a small library of canned lessons. Add a free **Groq** or **Gemini** key (settings panel) and I can answer any Excel question with full personalised teaching.

Some things you can ask me right now in offline mode:
- "How do I use VLOOKUP / XLOOKUP?"
- "Show me SUMIFS"
- "What is a PivotTable?"
- "Which chart should I use?"
- "Best Excel keyboard shortcuts"
- "How do I design a dashboard?"

Or just open **https://yexcel.hackknow.com** and drop a CSV — you'll get a working dashboard *plus* an Excel Tutor sheet inside the workbook that teaches you every formula it used, with examples from your own data.`,
    lang: /[ऀ-ॿ]/.test(m) ? 'hi' : 'en',
    level: 'beginner',
    concepts_covered: [],
    follow_up_questions: [
      'How do I use XLOOKUP?',
      'Show me a SUMIFS example',
      'What is a PivotTable?',
    ],
    suggested_shortcut: 'Ctrl + T — convert range to Table',
    homework: null,
  };
}

async function handleTeach(request, env) {
  const body = await request.json();
  const {
    message = '',
    history = [],
    session_id = null,
    data_token = null,  // optional — links to an existing upload for richer context
  } = body;
  const groqKey = (body.groq_api_key || '').toString();
  const geminiKey = (body.gemini_api_key || '').toString();
  const keys = { groq: groqKey, gemini: geminiKey };

  if (!message || !message.trim()) return errorResponse('Empty message');

  // Optionally enrich with the user's uploaded dataset context
  let dataContext = null;
  if (data_token) {
    const stored = await env.YAI_KV.get(`upload:${data_token}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      dataContext = {
        headers: parsed.headers,
        row_count: parsed.rowCount,
        domain: guessDomain(parsed.headers),
      };
    }
  }

  // Try AI teacher; fall back to deterministic lessons.
  let result = await aiTeacherReply(keys, history, message, dataContext);
  if (!result) result = deterministicTeacherReply(message);

  // Generate a session id if not supplied so the frontend can resume
  const sid = session_id || generateUUID();

  // Persist the latest turn in KV (best-effort, 24h TTL) so the user
  // can pick up where they left off across reloads.
  try {
    const newHistory = [...(history || []), { role: 'user', content: message }, { role: 'assistant', content: result.reply }];
    await env.YAI_KV.put(`teach:${sid}`, JSON.stringify({ history: newHistory.slice(-20), ts: Date.now() }), { expirationTtl: 86400 });
  } catch (e) {
    console.error('teach persistence failed:', e.message);
  }

  return jsonResponse({
    session_id: sid,
    ai_used: !!(keys.groq || keys.gemini),
    ...result,
  });
}

async function handleTeachHistory(request, env, parts) {
  const sid = parts[2];
  if (!sid) return errorResponse('Missing session id');
  const stored = await env.YAI_KV.get(`teach:${sid}`);
  if (!stored) return jsonResponse({ session_id: sid, history: [] });
  return jsonResponse({ session_id: sid, ...JSON.parse(stored) });
}

// ── PROGRESS TRACKING ────────────────────────────────────────────────────────
// Per-session learner profile. Tracks concepts seen, concepts mastered (via quiz),
// quizzes taken, current level, streak. Keyed by session_id in KV.

const FUNDAMENTAL_CONCEPTS = [
  // Tier 1 — beginner foundations
  { id: 'cell-references', name: 'Cell References', tier: 1, name_hi: 'सेल रेफरेन्स' },
  { id: 'sum-avg-count', name: 'SUM / AVERAGE / COUNT', tier: 1, name_hi: 'योग, औसत, गिनती' },
  { id: 'absolute-refs', name: 'Absolute vs Relative References ($)', tier: 1, name_hi: 'पूर्ण बनाम सापेक्ष रेफरेन्स' },
  { id: 'formatting', name: 'Number / Currency / Percent Formatting', tier: 1, name_hi: 'संख्या स्वरूपण' },
  { id: 'shortcuts-basic', name: 'Basic Keyboard Shortcuts', tier: 1, name_hi: 'बुनियादी शॉर्टकट्स' },
  // Tier 2 — intermediate
  { id: 'sumifs', name: 'SUMIFS / COUNTIFS / AVERAGEIFS', tier: 2, name_hi: 'शर्ती योग' },
  { id: 'xlookup', name: 'XLOOKUP / INDEX-MATCH', tier: 2, name_hi: 'XLOOKUP / INDEX-MATCH' },
  { id: 'if-iferror', name: 'IF / IFS / IFERROR', tier: 2, name_hi: 'IF / IFS / IFERROR' },
  { id: 'tables', name: 'Tables (Ctrl+T) & Structured References', tier: 2, name_hi: 'टेबल्स और संरचित संदर्भ' },
  { id: 'charts-basic', name: 'Chart Types (Bar, Pie, Line)', tier: 2, name_hi: 'चार्ट के प्रकार' },
  // Tier 3 — advanced
  { id: 'pivots', name: 'PivotTables & Slicers', tier: 3, name_hi: 'पिवट टेबल और स्लाइसर' },
  { id: 'dynamic-arrays', name: 'UNIQUE / SORT / FILTER / SEQUENCE', tier: 3, name_hi: 'डायनामिक एरे फ़ंक्शन' },
  { id: 'conditional-format', name: 'Conditional Formatting', tier: 3, name_hi: 'शर्तीय स्वरूपण' },
  { id: 'date-functions', name: 'Date Intelligence (EOMONTH, NETWORKDAYS)', tier: 3, name_hi: 'दिनांक फ़ंक्शन' },
  { id: 'dashboard-design', name: 'Dashboard Design Principles', tier: 3, name_hi: 'डैशबोर्ड डिज़ाइन' },
  // Tier 4 — pro
  { id: 'power-query', name: 'Power Query Basics', tier: 4, name_hi: 'पावर क्वेरी' },
  { id: 'power-pivot', name: 'Power Pivot & DAX Basics', tier: 4, name_hi: 'पावर पिवट और DAX' },
  { id: 'lambda-let', name: 'LAMBDA / LET (Custom Functions)', tier: 4, name_hi: 'कस्टम फ़ंक्शन' },
  { id: 'vba-basic', name: 'VBA Macros (Beginner)', tier: 4, name_hi: 'VBA मैक्रो' },
];

function emptyProgress(sid) {
  return {
    session_id: sid,
    name: null,
    language: 'en',
    level: 'beginner',
    xp: 0,
    streak_days: 0,
    last_active: Date.now(),
    seen: [],           // concept_ids that the learner has been exposed to
    mastered: [],       // concept_ids the learner answered correctly in a quiz
    quizzes_taken: 0,
    quizzes_passed: 0,
    badges: [],         // ["first-quiz", "tier-1-cleared", "streak-7", ...]
  };
}

async function loadProgress(env, sid) {
  if (!sid) return null;
  const v = await env.YAI_KV.get(`progress:${sid}`);
  if (!v) return emptyProgress(sid);
  try { return JSON.parse(v); } catch { return emptyProgress(sid); }
}

async function saveProgress(env, sid, progress) {
  await env.YAI_KV.put(`progress:${sid}`, JSON.stringify(progress), { expirationTtl: 90 * 24 * 3600 });
}

function progressLevel(progress) {
  const masteredTiers = new Set();
  for (const id of progress.mastered || []) {
    const concept = FUNDAMENTAL_CONCEPTS.find(c => c.id === id);
    if (concept) masteredTiers.add(concept.tier);
  }
  if (masteredTiers.has(4)) return 'pro';
  if (masteredTiers.has(3)) return 'advanced';
  if (masteredTiers.has(2)) return 'intermediate';
  return 'beginner';
}

function awardBadges(progress) {
  const has = (b) => progress.badges.includes(b);
  if (progress.quizzes_taken >= 1 && !has('first-quiz')) progress.badges.push('first-quiz');
  if (progress.quizzes_passed >= 5 && !has('quiz-streak-5')) progress.badges.push('quiz-streak-5');
  if (progress.mastered.length >= 5 && !has('5-concepts')) progress.badges.push('5-concepts');
  if (progress.mastered.length >= 10 && !has('10-concepts')) progress.badges.push('10-concepts');
  // tier-cleared badges
  for (const tier of [1, 2, 3, 4]) {
    const tierConcepts = FUNDAMENTAL_CONCEPTS.filter(c => c.tier === tier).map(c => c.id);
    const cleared = tierConcepts.every(id => progress.mastered.includes(id));
    if (cleared && !has(`tier-${tier}-cleared`)) progress.badges.push(`tier-${tier}-cleared`);
  }
  return progress;
}

async function handleProgress(request, env, parts) {
  const sid = parts[3] || new URL(request.url).searchParams.get('session_id');
  if (!sid) return errorResponse('Missing session id');
  const progress = await loadProgress(env, sid);
  progress.level = progressLevel(progress);
  // Compute concept coverage
  const tiers = [1, 2, 3, 4].map(tier => {
    const tierConcepts = FUNDAMENTAL_CONCEPTS.filter(c => c.tier === tier);
    const masteredInTier = tierConcepts.filter(c => progress.mastered.includes(c.id)).length;
    const seenInTier = tierConcepts.filter(c => progress.seen.includes(c.id)).length;
    return {
      tier,
      total: tierConcepts.length,
      mastered: masteredInTier,
      seen: seenInTier,
      percent: Math.round((masteredInTier / tierConcepts.length) * 100),
      concepts: tierConcepts.map(c => ({
        ...c,
        status: progress.mastered.includes(c.id) ? 'mastered'
              : progress.seen.includes(c.id) ? 'seen' : 'locked',
      })),
    };
  });
  return jsonResponse({ ...progress, tiers, all_concepts: FUNDAMENTAL_CONCEPTS });
}

// ── QUIZ ──────────────────────────────────────────────────────────────────────
// Generate a 5-question multi-choice quiz that probes fundamentals. AI-backed
// when keys are present; otherwise served from a static bank.

const QUIZ_BANK = {
  'cell-references': [
    {
      q: 'In Excel, what does the formula =A1+B1 calculate?',
      q_hi: 'Excel में =A1+B1 क्या गणना करता है?',
      options: ['Sum of cells A1 and B1', 'Difference A1 minus B1', 'Concatenation of A1 and B1', 'Multiplication of A1 and B1'],
      correct: 0,
      explain: 'The + operator adds the numeric values in cells A1 and B1.',
    },
  ],
  'sum-avg-count': [
    {
      q: 'Which function returns the arithmetic mean of a range?',
      q_hi: 'कौन सा फ़ंक्शन एक रेंज का औसत निकालता है?',
      options: ['SUM', 'AVERAGE', 'MEDIAN', 'COUNT'],
      correct: 1,
      explain: 'AVERAGE returns the mean. MEDIAN returns the middle value, COUNT counts numeric cells.',
    },
    {
      q: '=COUNTA(A1:A10) does what?',
      q_hi: '=COUNTA(A1:A10) क्या करता है?',
      options: ['Counts numeric cells only', 'Counts non-empty cells (including text)', 'Counts empty cells', 'Sums all values'],
      correct: 1,
      explain: 'COUNTA counts every non-empty cell; COUNT counts only numeric ones; COUNTBLANK counts empties.',
    },
  ],
  'absolute-refs': [
    {
      q: 'You copy =A1*$B$1 from row 1 to row 5. Which reference changes?',
      q_hi: 'आप =A1*$B$1 को पंक्ति 1 से 5 में कॉपी करें। कौन सा संदर्भ बदलेगा?',
      options: ['Both', 'Only A1 → A5', 'Only $B$1 → $B$5', 'Neither'],
      correct: 1,
      explain: 'The $ signs lock B1 (absolute). A1 is relative — it shifts to A5 when copied down.',
    },
    {
      q: 'Which key toggles between A1, $A$1, A$1, $A1 inside a formula?',
      q_hi: 'फ़ॉर्मूला में A1, $A$1, A$1, $A1 के बीच कौन सी key स्विच करती है?',
      options: ['F2', 'F4', 'F9', 'Ctrl+F'],
      correct: 1,
      explain: 'Place the cursor on a reference in the formula bar and press F4 to cycle through.',
    },
  ],
  'shortcuts-basic': [
    {
      q: 'Which shortcut inserts today\'s date as a static value?',
      q_hi: 'कौन सा शॉर्टकट आज की तारीख डालता है (फ़ंक्शन नहीं, स्थिर मान)?',
      options: ['Ctrl + ;', 'Ctrl + T', '=TODAY()', 'Ctrl + Shift + ;'],
      correct: 0,
      explain: 'Ctrl + ; inserts the date. Ctrl + Shift + ; inserts the current time. =TODAY() updates every day.',
    },
    {
      q: 'Ctrl + Shift + L does what?',
      q_hi: 'Ctrl + Shift + L क्या करता है?',
      options: ['Locks cells', 'Toggles filter buttons on/off', 'Inserts a chart', 'Opens VBA editor'],
      correct: 1,
      explain: 'It toggles the filter dropdowns on your header row — the fastest way to slice data.',
    },
  ],
  'sumifs': [
    {
      q: 'What\'s the correct order of arguments for SUMIFS?',
      q_hi: 'SUMIFS का सही क्रम क्या है?',
      options: [
        'SUMIFS(criteria_range, criteria, sum_range)',
        'SUMIFS(sum_range, criteria_range1, criteria1, …)',
        'SUMIFS(range, criteria)',
        'SUMIFS(criteria, sum_range)',
      ],
      correct: 1,
      explain: 'SUMIFS asks for the SUM column FIRST, then pairs of (range, criterion). This is the reverse of SUMIF.',
    },
    {
      q: '=SUMIFS(Revenue, Plant, "A", Month, "Jan") gives:',
      q_hi: '=SUMIFS(Revenue, Plant, "A", Month, "Jan") क्या देगा?',
      options: [
        'Revenue total for Plant A across all months',
        'Revenue total for January across all plants',
        'Revenue total only when Plant=A AND Month=Jan',
        'An error — too many arguments',
      ],
      correct: 2,
      explain: 'SUMIFS only sums rows where ALL criteria match (logical AND).',
    },
  ],
  'xlookup': [
    {
      q: 'XLOOKUP vs VLOOKUP — which is true?',
      q_hi: 'XLOOKUP बनाम VLOOKUP — कौन सा सत्य है?',
      options: [
        'XLOOKUP only works in Excel 2003+',
        'XLOOKUP can search left of the key column; VLOOKUP cannot',
        'VLOOKUP is faster than XLOOKUP',
        'XLOOKUP requires the data to be sorted',
      ],
      correct: 1,
      explain: 'XLOOKUP works in any direction. VLOOKUP can only return values to the right of the lookup column.',
    },
  ],
  'if-iferror': [
    {
      q: 'What does =IFERROR(A1/B1, 0) do?',
      q_hi: '=IFERROR(A1/B1, 0) क्या करता है?',
      options: [
        'Always returns 0',
        'Divides A1 by B1; returns 0 if the division errors (e.g. B1=0)',
        'Returns A1/B1 rounded to 0 decimals',
        'Returns an error if A1=0',
      ],
      correct: 1,
      explain: 'IFERROR wraps any formula. If the formula returns an error, IFERROR returns your fallback (0 here).',
    },
  ],
  'pivots': [
    {
      q: 'Where do you drag a column to summarise its values (sum, average, count)?',
      q_hi: 'मान सारांश के लिए कॉलम कहाँ खींचें (योग, औसत, गिनती)?',
      options: ['Filters', 'Rows', 'Columns', 'Values'],
      correct: 3,
      explain: 'The Values area is where aggregations happen. Rows/Columns are dimensions, Filters slice the whole pivot.',
    },
  ],
  'dynamic-arrays': [
    {
      q: '=UNIQUE(A1:A100) does what?',
      q_hi: '=UNIQUE(A1:A100) क्या करता है?',
      options: [
        'Returns the count of unique values',
        'Spills a list of distinct values from the range',
        'Removes duplicates from the source data',
        'Returns TRUE if all values are unique',
      ],
      correct: 1,
      explain: 'UNIQUE is a dynamic array — it spills the distinct list. Source data is untouched.',
    },
  ],
  'tables': [
    {
      q: 'Ctrl + T does what?',
      q_hi: 'Ctrl + T क्या करता है?',
      options: [
        'Inserts a Table from the selected range',
        'Inserts a Pivot Table',
        'Inserts a Text box',
        'Switches to the next worksheet',
      ],
      correct: 0,
      explain: 'Converts a range to a Table. Tables auto-extend formulas and chart sources as rows are added.',
    },
  ],
  'date-functions': [
    {
      q: 'What does =EOMONTH(A1, 0) return?',
      q_hi: '=EOMONTH(A1, 0) क्या देता है?',
      options: [
        'The first day of the month of A1',
        'The last day of the month of A1',
        'The last day of the previous month',
        'The last day of next year',
      ],
      correct: 1,
      explain: '=EOMONTH(date, 0) → last day of current month. -1 = previous month, +1 = next month.',
    },
  ],
};

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function aiQuizGenerate(keys, conceptIds, language = 'en') {
  if (!keys.groq && !keys.gemini) return null;
  const conceptList = conceptIds.map(id => {
    const c = FUNDAMENTAL_CONCEPTS.find(x => x.id === id);
    return c ? `${c.id} (${c.name})` : id;
  }).join(', ');
  const prompt = `Generate a 5-question Excel multiple-choice quiz covering these concepts: ${conceptList}.

For each question:
- Be specific and testable (not "Excel is useful?")
- Include 4 plausible options with ONE clearly correct
- Provide a 1-2 sentence explanation of why the correct answer is right

Language: ${language === 'hi' ? 'Hindi (Devanagari)' : language === 'hinglish' ? 'Hinglish (Hindi+English, Latin script)' : 'English'}

Return ONLY this JSON shape (no markdown fences):
{
  "questions": [
    {
      "concept_id": "<one of the concept ids you were given>",
      "q": "the question text in the requested language",
      "options": ["opt A", "opt B", "opt C", "opt D"],
      "correct": 0,
      "explain": "why option 'correct' is right"
    }
  ]
}`;
  try {
    const raw = keys.groq
      ? await callGroq(keys.groq, prompt, 'Return valid JSON only.')
      : await callGemini(keys.gemini, prompt);
    return parseJSONLoose(raw);
  } catch (e) {
    console.error('AI quiz failed:', e.message);
    return null;
  }
}

async function handleQuizStart(request, env) {
  const body = await request.json();
  const { session_id, language = 'en', focus_tier = null } = body;
  const keys = { groq: (body.groq_api_key || '').toString(), gemini: (body.gemini_api_key || '').toString() };

  let sid = session_id;
  if (!sid) sid = generateUUID();
  const progress = await loadProgress(env, sid);

  // Pick 5 concepts: prefer seen-but-not-mastered, otherwise next tier
  let pool = FUNDAMENTAL_CONCEPTS;
  if (focus_tier) pool = pool.filter(c => c.tier === Number(focus_tier));
  const candidates = pool.filter(c => !progress.mastered.includes(c.id));
  const picks = pickRandom(candidates.length ? candidates : pool, 5);
  const pickedIds = picks.map(p => p.id);

  // Try AI for fresh questions; fall back to QUIZ_BANK
  let questions = null;
  const aiQuiz = await aiQuizGenerate(keys, pickedIds, language);
  if (aiQuiz && Array.isArray(aiQuiz.questions) && aiQuiz.questions.length) {
    questions = aiQuiz.questions.slice(0, 5);
  } else {
    questions = [];
    for (const id of pickedIds) {
      const bank = QUIZ_BANK[id] || [];
      const q = pickRandom(bank, 1)[0];
      if (q) {
        questions.push({
          concept_id: id,
          q: language === 'hi' ? (q.q_hi || q.q) : q.q,
          options: q.options,
          correct: q.correct,
          explain: q.explain,
        });
      }
    }
    // If bank had fewer than 5 (some concepts have no canned q), pad with generic
    while (questions.length < 5 && pickedIds.length > questions.length) {
      const id = pickedIds[questions.length];
      questions.push({
        concept_id: id,
        q: `Pick the best description of "${FUNDAMENTAL_CONCEPTS.find(c => c.id === id)?.name || id}":`,
        options: [
          'A specific Excel feature with a unique formula',
          'A keyboard-only shortcut',
          'Only available in Office 365',
          'A built-in Excel concept worth learning',
        ],
        correct: 3,
        explain: 'Best to study this concept in Yahavi chat — ask "teach me about ' + id + '".',
      });
    }
  }

  // Store the quiz attempt — needed so /submit can verify correctness
  const quizId = generateUUID();
  await env.YAI_KV.put(`quiz:${quizId}`, JSON.stringify({
    session_id: sid, questions, language, created: Date.now(),
  }), { expirationTtl: 3600 });

  // Strip the correct answers before sending to client
  const safeQuestions = questions.map((q, i) => ({
    index: i,
    concept_id: q.concept_id,
    q: q.q,
    options: q.options,
  }));

  return jsonResponse({
    quiz_id: quizId,
    session_id: sid,
    language,
    questions: safeQuestions,
    total: safeQuestions.length,
  });
}

async function handleQuizSubmit(request, env) {
  const body = await request.json();
  const { quiz_id, answers } = body;
  if (!quiz_id || !Array.isArray(answers)) return errorResponse('quiz_id and answers required');

  const stored = await env.YAI_KV.get(`quiz:${quiz_id}`);
  if (!stored) return errorResponse('Quiz expired or invalid', 404);
  const { session_id, questions } = JSON.parse(stored);

  let progress = await loadProgress(env, session_id);
  const results = questions.map((q, i) => {
    const ans = answers[i];
    const correct = ans === q.correct;
    // Mark this concept as seen on any attempt
    if (!progress.seen.includes(q.concept_id)) progress.seen.push(q.concept_id);
    return {
      concept_id: q.concept_id,
      your_answer: ans,
      correct_answer: q.correct,
      is_correct: correct,
      explain: q.explain,
      options: q.options,
      q: q.q,
    };
  });
  const score = results.filter(r => r.is_correct).length;
  const pct = Math.round((score / results.length) * 100);
  const passed = pct >= 60;

  // Promote concepts to "mastered" if the learner got that concept right
  for (const r of results) {
    if (r.is_correct && !progress.mastered.includes(r.concept_id)) {
      progress.mastered.push(r.concept_id);
    }
  }
  progress.quizzes_taken = (progress.quizzes_taken || 0) + 1;
  if (passed) progress.quizzes_passed = (progress.quizzes_passed || 0) + 1;
  progress.xp = (progress.xp || 0) + score * 10;
  progress.last_active = Date.now();
  progress.level = progressLevel(progress);
  progress = awardBadges(progress);

  await saveProgress(env, session_id, progress);

  return jsonResponse({
    score, total: results.length, percent: pct, passed,
    results,
    new_level: progress.level,
    new_xp: progress.xp,
    new_badges: progress.badges,
    next_action: passed ? 'Take another quiz to climb the next tier' : 'Chat with Yahavi about the questions you missed',
  });
}

// ── CHEAT SHEET XLSX ─────────────────────────────────────────────────────────
// Generates a downloadable .xlsx cheat sheet covering formulas, shortcuts,
// chart recipes — bilingual labels (English + Hindi). Uses the same XLSX
// infrastructure as the dashboard pipeline.

const CHEAT_FORMULAS = [
  // [Formula, Description (en), Description (hi)]
  ['SUM', '=SUM(range)', 'Adds numbers', 'संख्याओं को जोड़ता है'],
  ['AVERAGE', '=AVERAGE(range)', 'Arithmetic mean', 'अंकगणितीय औसत'],
  ['COUNT', '=COUNT(range)', 'Counts numeric cells', 'संख्यात्मक सेल गिनता है'],
  ['COUNTA', '=COUNTA(range)', 'Counts non-empty cells', 'भरे हुए सेल गिनता है'],
  ['MAX / MIN', '=MAX(range) · =MIN(range)', 'Largest / smallest', 'सबसे बड़ा / सबसे छोटा'],
  ['ROUND', '=ROUND(num, 2)', 'Round to N decimals', 'दशमलव तक गोल'],
  ['SUMIFS', '=SUMIFS(sum_range, c_range1, c1, c_range2, c2)', 'Conditional sum (AND)', 'शर्ती योग (AND)'],
  ['COUNTIFS', '=COUNTIFS(c_range1, c1, c_range2, c2)', 'Conditional count', 'शर्ती गिनती'],
  ['AVERAGEIFS', '=AVERAGEIFS(avg_range, c_range, c)', 'Conditional average', 'शर्ती औसत'],
  ['IF', '=IF(condition, true_val, false_val)', 'Branch on a condition', 'शर्त पर शाखा'],
  ['IFS', '=IFS(test1, val1, test2, val2, …)', 'Multiple conditions without nesting', 'कई शर्तें बिना नेस्टिंग'],
  ['IFERROR', '=IFERROR(formula, fallback)', 'Replace errors with a fallback', 'त्रुटि की जगह fallback'],
  ['SWITCH', '=SWITCH(expr, v1, r1, v2, r2, default)', 'Pick a result by matching values', 'मानों के अनुसार उत्तर चुनें'],
  ['XLOOKUP', '=XLOOKUP(lookup, lookup_range, return_range, [if_not_found])', 'Modern lookup', 'आधुनिक lookup'],
  ['INDEX/MATCH', '=INDEX(return_range, MATCH(lookup, lookup_range, 0))', 'Classic universal lookup', 'क्लासिक lookup'],
  ['VLOOKUP', '=VLOOKUP(lookup, table, col_index, FALSE)', 'Vertical lookup (legacy)', 'लंबवत lookup (पुराना)'],
  ['UNIQUE', '=UNIQUE(range)', 'Distinct values (spill)', 'अद्वितीय मान'],
  ['SORT', '=SORT(range, [sort_index], [order])', 'Sorted version of a range', 'क्रम में लगाए गए मान'],
  ['FILTER', '=FILTER(range, condition_array)', 'Rows matching a condition', 'शर्त के अनुसार पंक्तियाँ'],
  ['SEQUENCE', '=SEQUENCE(rows, cols, start, step)', 'Auto-numbered grid', 'संख्या क्रम'],
  ['LEN', '=LEN(text)', 'Character count of text', 'टेक्स्ट के अक्षर'],
  ['LEFT / RIGHT / MID', '=LEFT(text, n) · =RIGHT(text, n) · =MID(text, start, n)', 'Sub-string extract', 'उप-स्ट्रिंग निकालें'],
  ['CONCAT / TEXTJOIN', '=CONCAT(a, b) · =TEXTJOIN(", ", TRUE, range)', 'Combine text values', 'टेक्स्ट जोड़ें'],
  ['TEXT', '=TEXT(value, "#,##0.0,\\"K\\"")', 'Format numbers as styled text', 'संख्या को स्वरूपित टेक्स्ट'],
  ['TODAY / NOW', '=TODAY() · =NOW()', 'Today\'s date / current timestamp', 'आज की तारीख / समय'],
  ['EOMONTH', '=EOMONTH(date, 0)', 'Last day of the current month', 'महीने का अंतिम दिन'],
  ['NETWORKDAYS', '=NETWORKDAYS(start, end, [holidays])', 'Business days between dates', 'कार्य दिवस गिनती'],
  ['LET', '=LET(name, value, formula)', 'Reuse intermediate values', 'मध्यवर्ती मान को फिर से उपयोग'],
  ['LAMBDA', '=LAMBDA(x, y, x*y)(3, 4)', 'Define a reusable function', 'पुनःप्रयोज्य फ़ंक्शन परिभाषित करें'],
];

const CHEAT_SHORTCUTS = [
  ['Ctrl + T', 'Convert range to Table', 'रेंज को टेबल में बदलें'],
  ['Ctrl + Shift + L', 'Toggle filters', 'फ़िल्टर ON/OFF'],
  ['Ctrl + Shift + Arrow', 'Select to end of block', 'ब्लॉक के अंत तक चुनें'],
  ['Ctrl + Shift + Enter', 'Array formula entry (legacy)', 'एरे फ़ॉर्मूला दर्ज (पुराना)'],
  ['Ctrl + ;', 'Insert today\'s date (static)', 'आज की तारीख डालें (स्थिर)'],
  ['Ctrl + Shift + ;', 'Insert current time (static)', 'अभी का समय डालें'],
  ['Ctrl + 1', 'Open Format Cells dialog', 'सेल फ़ॉर्मेट डायलॉग'],
  ['Ctrl + Page Up / Down', 'Switch sheets', 'शीट बदलें'],
  ['Alt + =', 'AutoSum the column above', 'ऊपर का योग'],
  ['Alt + F1', 'Insert default chart inline', 'चार्ट डालें'],
  ['F11', 'Insert chart on a new sheet', 'नई शीट में चार्ट'],
  ['F2', 'Edit active cell in place', 'सेल संपादित करें'],
  ['F4', 'Toggle $ on a reference', '$ टॉगल करें'],
  ['F5 → Special', 'Go-To Special (blanks, formulas, etc.)', 'विशेष पर जाएँ'],
  ['F9', 'Recalculate now', 'पुनः गणना करें'],
  ['Ctrl + K', 'Insert hyperlink', 'हाइपरलिंक डालें'],
  ['Ctrl + N / O / S / W', 'New / Open / Save / Close', 'नया / खोलें / सहेजें / बंद'],
  ['Ctrl + Z / Y', 'Undo / Redo', 'पूर्ववत् / फिर से करें'],
  ['Ctrl + Home / End', 'Go to A1 / last used cell', 'A1 / अंतिम सेल पर जाएँ'],
  ['Ctrl + Space / Shift + Space', 'Select entire column / row', 'पूरा कॉलम / पंक्ति'],
  ['Ctrl + Shift + + / -', 'Insert / delete row or column', 'पंक्ति/कॉलम जोड़ें/हटाएँ'],
];

const CHEAT_CHARTS = [
  ['Vertical Bar', 'Compare totals across categories', 'श्रेणियों के बीच कुल तुलना'],
  ['Horizontal Bar', 'Rank entities (long labels)', 'सूची क्रम (बड़े लेबल)'],
  ['Doughnut', 'Share of total (3-8 slices)', 'कुल का अनुपात'],
  ['Pie', 'Single-series share (3-6 slices)', 'एक श्रृंखला का अनुपात'],
  ['Stacked Column', 'Time-on-X with category stack', 'समय और श्रेणी एक साथ'],
  ['Line', 'Continuous trend over time', 'समय के साथ रुझान'],
  ['Area', 'Trend with magnitude emphasis', 'मात्रा पर ज़ोर'],
  ['Scatter', 'Correlation between two metrics', 'दो मानों का संबंध'],
  ['Combo (Bar + Line)', 'Two metrics with different scales', 'दो भिन्न मान'],
  ['Sparkline', 'Mini chart inside a cell', 'सेल में छोटा चार्ट'],
];

function buildCheatSheetSheet(title, columns, rows, sst) {
  // 3-column table: [Formula/Shortcut/Chart][English Description][Hindi Description]
  const xmlRows = [];
  // Title row
  let row = `<row r="1" ht="32" customHeight="1">`;
  row += `<c r="A1" t="s" s="${S.title}"><v>${sst.add(title)}</v></c>`;
  for (let c = 1; c < 4; c++) row += `<c r="${cellRef(1, c)}" s="${S.title}"/>`;
  row += `</row>`;
  xmlRows.push(row);

  // Header row
  row = `<row r="2" ht="22" customHeight="1">`;
  for (let c = 0; c < columns.length; c++) {
    row += `<c r="${cellRef(2, c)}" t="s" s="${S.subTitle}"><v>${sst.add(columns[c])}</v></c>`;
  }
  for (let c = columns.length; c < 4; c++) row += `<c r="${cellRef(2, c)}" s="${S.subTitle}"/>`;
  row += `</row>`;
  xmlRows.push(row);

  // Data rows alternating styles
  for (let i = 0; i < rows.length; i++) {
    const r = 3 + i;
    const altStyle = i % 2 === 0 ? S.tutorBody : S.tutorAlt;
    row = `<row r="${r}" ht="22" customHeight="1">`;
    for (let c = 0; c < rows[i].length; c++) {
      const cell = rows[i][c];
      row += `<c r="${cellRef(r, c)}" t="s" s="${altStyle}"><v>${sst.add(cell)}</v></c>`;
    }
    for (let c = rows[i].length; c < 4; c++) row += `<c r="${cellRef(r, c)}" s="${altStyle}"/>`;
    row += `</row>`;
    xmlRows.push(row);
  }

  const cols = `<cols>
<col min="1" max="1" width="22" customWidth="1"/>
<col min="2" max="2" width="50" customWidth="1"/>
<col min="3" max="3" width="42" customWidth="1"/>
<col min="4" max="4" width="42" customWidth="1"/>
</cols>`;

  const merges = [`A1:${cellRef(1, columns.length - 1)}`];
  const mergeXml = `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;

  return `${XML_HEAD}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><tabColor rgb="FF22C55E"/></sheetPr>
<dimension ref="A1:${cellRef(rows.length + 2, columns.length - 1)}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="22"/>
${cols}
<sheetData>${xmlRows.join('\n')}</sheetData>
${mergeXml}
</worksheet>`;
}

function buildCheatSheetXlsx(theme = 'emerald') {
  const sst = new StringTable();
  const sheet1 = buildCheatSheetSheet(
    'YAHAVI · EXCEL FORMULA CHEAT SHEET',
    ['Function', 'Syntax · Example', 'Description (EN)', 'विवरण (हिंदी)'],
    CHEAT_FORMULAS.map(([fn, syntax, en, hi]) => [fn, syntax, en, hi]),
    sst,
  );
  const sheet2 = buildCheatSheetSheet(
    'YAHAVI · KEYBOARD SHORTCUTS',
    ['Shortcut', 'Action (EN)', 'क्रिया (हिंदी)', ''],
    CHEAT_SHORTCUTS,
    sst,
  );
  const sheet3 = buildCheatSheetSheet(
    'YAHAVI · WHICH CHART TO USE',
    ['Chart Type', 'When to use (EN)', 'कब उपयोग करें (हिंदी)', ''],
    CHEAT_CHARTS,
    sst,
  );

  // Use existing infrastructure but with 3 cheat sheets instead of dashboard
  const files = {
    '[Content_Types].xml': `${XML_HEAD}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`,
    '_rels/.rels': buildRootRels(),
    'xl/workbook.xml': `${XML_HEAD}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Formulas" sheetId="1" r:id="rId1"/>
<sheet name="Shortcuts" sheetId="2" r:id="rId2"/>
<sheet name="Charts" sheetId="3" r:id="rId3"/>
</sheets>
</workbook>`,
    'xl/_rels/workbook.xml.rels': `${XML_HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`,
    'xl/styles.xml': buildStyles(theme),
    'xl/sharedStrings.xml': sst.toXml(),
    'xl/worksheets/sheet1.xml': sheet1,
    'xl/worksheets/sheet2.xml': sheet2,
    'xl/worksheets/sheet3.xml': sheet3,
  };
  return buildZip(files);
}

async function handleCheatSheet(request, env) {
  const url = new URL(request.url);
  const theme = url.searchParams.get('theme') || 'emerald';
  const xlsxBytes = buildCheatSheetXlsx(theme);
  return new Response(xlsxBytes, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="yahavi_excel_cheatsheet.xlsx"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// ── PRACTICE EXERCISE XLSX ───────────────────────────────────────────────────
// Generates a practice workbook with realistic raw data and 8 tasks.
// User fills in formulas, then opens the bundled "Solutions" sheet to compare.

function buildPracticeXlsx(level = 'beginner', theme = 'emerald') {
  const sst = new StringTable();

  // Sample dataset — Sales by Rep / Region / Month
  const reps = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank'];
  const regions = ['North', 'South', 'East', 'West'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const products = ['Widget', 'Gadget', 'Gizmo'];
  const rows = [];
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
  for (let i = 0; i < 60; i++) {
    const rep = reps[rand() % reps.length];
    const region = regions[rand() % regions.length];
    const month = months[rand() % months.length];
    const product = products[rand() % products.length];
    const qty = 10 + rand() % 50;
    const price = 100 + rand() % 400;
    const revenue = qty * price;
    const cost = Math.floor(revenue * (0.4 + (rand() % 30) / 100));
    rows.push({ rep, region, month, product, qty, price, revenue, cost });
  }

  const headers = ['Rep', 'Region', 'Month', 'Product', 'Qty', 'Price', 'Revenue', 'Cost'];

  // ─── DATA SHEET ─────
  const dataRows = [];
  let r = `<row r="1">`;
  for (let c = 0; c < headers.length; c++) r += `<c r="${cellRef(1, c)}" t="s" s="${S.tutorH}"><v>${sst.add(headers[c])}</v></c>`;
  r += `</row>`;
  dataRows.push(r);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    r = `<row r="${i + 2}">`;
    r += `<c r="${cellRef(i + 2, 0)}" t="s"><v>${sst.add(row.rep)}</v></c>`;
    r += `<c r="${cellRef(i + 2, 1)}" t="s"><v>${sst.add(row.region)}</v></c>`;
    r += `<c r="${cellRef(i + 2, 2)}" t="s"><v>${sst.add(row.month)}</v></c>`;
    r += `<c r="${cellRef(i + 2, 3)}" t="s"><v>${sst.add(row.product)}</v></c>`;
    r += `<c r="${cellRef(i + 2, 4)}"><v>${row.qty}</v></c>`;
    r += `<c r="${cellRef(i + 2, 5)}"><v>${row.price}</v></c>`;
    r += `<c r="${cellRef(i + 2, 6)}"><v>${row.revenue}</v></c>`;
    r += `<c r="${cellRef(i + 2, 7)}"><v>${row.cost}</v></c>`;
    r += `</row>`;
    dataRows.push(r);
  }
  const dataSheet = `${XML_HEAD}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:H${rows.length + 1}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols><col min="1" max="8" width="14"/></cols>
<sheetData>${dataRows.join('\n')}</sheetData>
</worksheet>`;

  // ─── TASKS SHEET ─────
  // Format: [Task #][Question (EN)][Question (HI)][Your formula here →][(empty)][Correct formula (in Solutions sheet)]
  const TASKS = level === 'advanced' ? [
    ['1', 'Total revenue across all rows', 'सभी पंक्तियों का कुल राजस्व', '=SUM(Data!G2:G61)'],
    ['2', 'Total revenue for the North region only', 'केवल North क्षेत्र का राजस्व', '=SUMIFS(Data!G:G, Data!B:B, "North")'],
    ['3', 'Count of unique products', 'अद्वितीय उत्पादों की संख्या', '=ROWS(UNIQUE(Data!D2:D61))'],
    ['4', 'Highest single-row revenue', 'सबसे ज़्यादा एक पंक्ति का राजस्व', '=MAX(Data!G:G)'],
    ['5', 'Average revenue per Rep (use UNIQUE+AVERAGEIFS)', 'प्रति Rep औसत राजस्व', '=AVERAGEIFS(Data!G:G, Data!A:A, "Alice")'],
    ['6', 'Total profit (Revenue − Cost) for Widget product', 'Widget का कुल लाभ', '=SUMIFS(Data!G:G,Data!D:D,"Widget")-SUMIFS(Data!H:H,Data!D:D,"Widget")'],
    ['7', 'Sorted list of distinct Regions', 'अद्वितीय Regions की सूची', '=SORT(UNIQUE(Data!B2:B61))'],
    ['8', 'Filter all rows where Region=East AND Qty>30', 'East और Qty>30 वाली पंक्तियाँ', '=FILTER(Data!A2:H61, (Data!B2:B61="East")*(Data!E2:E61>30))'],
    ['9', 'Use LET to compute profit margin %', 'LET से लाभ मार्जिन %', '=LET(rev,SUM(Data!G:G),cst,SUM(Data!H:H),(rev-cst)/rev)'],
    ['10', 'Use XLOOKUP to find revenue for "Alice"+"Jan"+"Widget"', '"Alice"+"Jan"+"Widget" का राजस्व', '=SUMIFS(Data!G:G,Data!A:A,"Alice",Data!C:C,"Jan",Data!D:D,"Widget")'],
  ] : [
    ['1', 'Total revenue across all rows', 'सभी पंक्तियों का कुल राजस्व', '=SUM(Data!G2:G61)'],
    ['2', 'Average price across all rows', 'सभी पंक्तियों का औसत मूल्य', '=AVERAGE(Data!F2:F61)'],
    ['3', 'Count of records', 'कुल रिकॉर्ड', '=COUNTA(Data!A2:A61)'],
    ['4', 'Highest Qty in any row', 'सबसे ज़्यादा Qty', '=MAX(Data!E:E)'],
    ['5', 'Total revenue for Rep = "Alice"', 'Alice का कुल राजस्व', '=SUMIFS(Data!G:G,Data!A:A,"Alice")'],
    ['6', 'Count of rows where Region = "South"', 'South Region की पंक्तियाँ', '=COUNTIFS(Data!B:B,"South")'],
    ['7', 'XLOOKUP: revenue for the first row of Frank', 'Frank की पहली पंक्ति का राजस्व', '=XLOOKUP("Frank",Data!A:A,Data!G:G)'],
    ['8', 'List of distinct Months in the data', 'अद्वितीय Months की सूची', '=UNIQUE(Data!C2:C61)'],
  ];

  const taskRows = [];
  // Title
  let row = `<row r="1" ht="34" customHeight="1">`;
  row += `<c r="A1" t="s" s="${S.title}"><v>${sst.add(`YAHAVI · PRACTICE EXERCISE · ${level.toUpperCase()}`)}</v></c>`;
  for (let c = 1; c < 8; c++) row += `<c r="${cellRef(1, c)}" s="${S.title}"/>`;
  row += `</row>`;
  taskRows.push(row);

  // Instructions
  row = `<row r="2" ht="24" customHeight="1">`;
  row += `<c r="A2" t="s" s="${S.tutorTip}"><v>${sst.add('Type your formula in column "Your formula here" — then compare with the Solutions tab.  ·  Hindi: अपना फ़ॉर्मूला "Your formula here" कॉलम में टाइप करें — फिर Solutions टैब से मिलाएँ।')}</v></c>`;
  for (let c = 1; c < 8; c++) row += `<c r="${cellRef(2, c)}" s="${S.tutorTip}"/>`;
  row += `</row>`;
  taskRows.push(row);

  // Header row
  row = `<row r="3" ht="22" customHeight="1">`;
  ['#', 'Question (EN)', 'Question (हिंदी)', 'Your formula here'].forEach((h, c) => {
    row += `<c r="${cellRef(3, c)}" t="s" s="${S.subTitle}"><v>${sst.add(h)}</v></c>`;
  });
  for (let c = 4; c < 8; c++) row += `<c r="${cellRef(3, c)}" s="${S.subTitle}"/>`;
  row += `</row>`;
  taskRows.push(row);

  // Task rows
  for (let i = 0; i < TASKS.length; i++) {
    const r0 = 4 + i;
    const altStyle = i % 2 === 0 ? S.tutorBody : S.tutorAlt;
    row = `<row r="${r0}" ht="34" customHeight="1">`;
    row += `<c r="${cellRef(r0, 0)}" t="s" s="${altStyle}"><v>${sst.add(TASKS[i][0])}</v></c>`;
    row += `<c r="${cellRef(r0, 1)}" t="s" s="${altStyle}"><v>${sst.add(TASKS[i][1])}</v></c>`;
    row += `<c r="${cellRef(r0, 2)}" t="s" s="${altStyle}"><v>${sst.add(TASKS[i][2])}</v></c>`;
    row += `<c r="${cellRef(r0, 3)}" s="${S.tutorCode}"/>`;  // empty cell for user
    for (let c = 4; c < 8; c++) row += `<c r="${cellRef(r0, c)}" s="${altStyle}"/>`;
    row += `</row>`;
    taskRows.push(row);
  }

  const taskCols = `<cols>
<col min="1" max="1" width="6" customWidth="1"/>
<col min="2" max="2" width="45" customWidth="1"/>
<col min="3" max="3" width="40" customWidth="1"/>
<col min="4" max="4" width="38" customWidth="1"/>
</cols>`;

  const taskMerges = ['A1:H1', 'A2:H2'];
  const taskSheet = `${XML_HEAD}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><tabColor rgb="FFFFD60A"/></sheetPr>
<dimension ref="A1:H${TASKS.length + 3}"/>
<sheetViews><sheetView tabSelected="1" workbookViewId="0" showGridLines="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="22"/>
${taskCols}
<sheetData>${taskRows.join('\n')}</sheetData>
<mergeCells count="${taskMerges.length}">${taskMerges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>
</worksheet>`;

  // ─── SOLUTIONS SHEET ─────
  const solRows = [];
  let r2 = `<row r="1" ht="32" customHeight="1">`;
  r2 += `<c r="A1" t="s" s="${S.title}"><v>${sst.add('YAHAVI · SOLUTIONS')}</v></c>`;
  for (let c = 1; c < 8; c++) r2 += `<c r="${cellRef(1, c)}" s="${S.title}"/>`;
  r2 += `</row>`;
  solRows.push(r2);

  r2 = `<row r="2" ht="22" customHeight="1">`;
  ['#', 'Correct formula', 'Result (live)', ''].forEach((h, c) => {
    r2 += `<c r="${cellRef(2, c)}" t="s" s="${S.subTitle}"><v>${sst.add(h)}</v></c>`;
  });
  for (let c = 4; c < 8; c++) r2 += `<c r="${cellRef(2, c)}" s="${S.subTitle}"/>`;
  r2 += `</row>`;
  solRows.push(r2);

  for (let i = 0; i < TASKS.length; i++) {
    const r0 = 3 + i;
    const altStyle = i % 2 === 0 ? S.tutorBody : S.tutorAlt;
    r2 = `<row r="${r0}" ht="32" customHeight="1">`;
    r2 += `<c r="${cellRef(r0, 0)}" t="s" s="${altStyle}"><v>${sst.add(TASKS[i][0])}</v></c>`;
    r2 += `<c r="${cellRef(r0, 1)}" t="s" s="${altStyle}"><v>${sst.add(TASKS[i][3])}</v></c>`;
    // Column C: live formula that computes the answer
    // Strip the leading "=" — Excel needs it but we write the raw formula text-as-formula
    const formula = TASKS[i][3].startsWith('=') ? TASKS[i][3].slice(1) : TASKS[i][3];
    r2 += `<c r="${cellRef(r0, 2)}" s="${altStyle}"><f>${escapeXml(formula)}</f></c>`;
    for (let c = 3; c < 8; c++) r2 += `<c r="${cellRef(r0, c)}" s="${altStyle}"/>`;
    r2 += `</row>`;
    solRows.push(r2);
  }

  const solSheet = `${XML_HEAD}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><tabColor rgb="FF22C55E"/></sheetPr>
<dimension ref="A1:H${TASKS.length + 2}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="22"/>
<cols>
<col min="1" max="1" width="6"/>
<col min="2" max="2" width="65"/>
<col min="3" max="3" width="22"/>
</cols>
<sheetData>${solRows.join('\n')}</sheetData>
<mergeCells count="1"><mergeCell ref="A1:H1"/></mergeCells>
</worksheet>`;

  const files = {
    '[Content_Types].xml': `${XML_HEAD}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`,
    '_rels/.rels': buildRootRels(),
    'xl/workbook.xml': `${XML_HEAD}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Tasks" sheetId="1" r:id="rId1"/>
<sheet name="Data" sheetId="2" r:id="rId2"/>
<sheet name="Solutions" sheetId="3" r:id="rId3"/>
</sheets>
</workbook>`,
    'xl/_rels/workbook.xml.rels': `${XML_HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`,
    'xl/styles.xml': buildStyles(theme),
    'xl/sharedStrings.xml': sst.toXml(),
    'xl/worksheets/sheet1.xml': taskSheet,
    'xl/worksheets/sheet2.xml': dataSheet,
    'xl/worksheets/sheet3.xml': solSheet,
  };
  return buildZip(files);
}

async function handlePracticeExercise(request, env) {
  const url = new URL(request.url);
  const level = url.searchParams.get('level') || 'beginner';
  const theme = url.searchParams.get('theme') || 'emerald';
  const xlsxBytes = buildPracticeXlsx(level, theme);
  return new Response(xlsxBytes, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="yahavi_practice_${level}.xlsx"`,
      'Cache-Control': 'public, max-age=600',
    },
  });
}

// ── DAILY TIP ─────────────────────────────────────────────────────────────────
const DAILY_TIPS = [
  { en: 'Press Ctrl + T to convert any range to a Table — your charts will auto-extend forever.', hi: 'किसी भी रेंज को टेबल बनाने के लिए Ctrl + T दबाएँ — आपके चार्ट हमेशा अपडेट रहेंगे।' },
  { en: 'F4 inside a formula toggles $ on a reference — fastest way to lock cells.', hi: 'फ़ॉर्मूला में F4 दबाने से $ टॉगल होता है — सेल लॉक करने का सबसे तेज़ तरीका।' },
  { en: 'Use XLOOKUP\'s 4th argument to set a friendly "Not Found" message.', hi: 'XLOOKUP के 4थे आर्ग्युमेंट से "Not Found" मेसेज सेट करें।' },
  { en: 'SUMIFS uses logical AND — every criteria must match. For OR logic, sum two SUMIFS.', hi: 'SUMIFS में सभी शर्तें मिलनी चाहिए। OR के लिए दो SUMIFS जोड़ें।' },
  { en: 'Ctrl + Shift + Arrow selects to the end of a contiguous block — pair with Ctrl+C for a fast copy.', hi: 'Ctrl + Shift + Arrow ब्लॉक के अंत तक चुनता है — Ctrl+C के साथ इस्तेमाल करें।' },
  { en: 'UNIQUE + SORT + FILTER are the modern trio that replaces 80% of pivot work.', hi: 'UNIQUE + SORT + FILTER — पिवट का 80% काम इनसे हो जाता है।' },
  { en: 'IFERROR makes dashboards production-grade — never show #DIV/0! or #N/A to your boss.', hi: 'IFERROR से डैशबोर्ड साफ़ रहता है — #DIV/0! या #N/A कभी न दिखाएँ।' },
  { en: 'Use =TEXT(value, "$#,##0.0,,\"M\"") to format big numbers as $1.3M.', hi: 'बड़ी संख्याओं को $1.3M जैसे फ़ॉर्मेट के लिए =TEXT() का प्रयोग करें।' },
  { en: 'Ctrl + ; inserts today as a hard value. =TODAY() updates every day — use the right one.', hi: 'Ctrl + ; आज की तारीख स्थिर डालता है। =TODAY() रोज़ बदलता है।' },
  { en: 'Tables (Ctrl + T) give you @-references like [@Revenue] — much cleaner than $G$2:$G$1000.', hi: 'टेबल्स [@Revenue] जैसे रेफरेन्स देती हैं — $G$2:$G$1000 से बेहतर।' },
];

async function handleDailyTip(request, env) {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') || 'en';
  const date = new Date().toISOString().slice(0, 10);
  // Deterministic daily pick — same tip per UTC day
  const hash = [...date].reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
  const tip = DAILY_TIPS[Math.abs(hash) % DAILY_TIPS.length];
  return jsonResponse({ date, lang, en: tip.en, hi: tip.hi, text: lang === 'hi' ? tip.hi : tip.en });
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
      if (path === '/api/teach' && request.method === 'POST') return await handleTeach(request, env);
      if (parts[0] === 'api' && parts[1] === 'teach' && parts[2] === 'history' && parts.length === 4 && request.method === 'GET') return await handleTeachHistory(request, env, ['api','teach', parts[3]]);
      if (parts[0] === 'api' && parts[1] === 'teach' && parts[2] === 'progress' && request.method === 'GET') return await handleProgress(request, env, parts);
      if (path === '/api/teach/quiz' && request.method === 'POST') return await handleQuizStart(request, env);
      if (path === '/api/teach/quiz/submit' && request.method === 'POST') return await handleQuizSubmit(request, env);
      if (path === '/api/teach/cheatsheet' && request.method === 'GET') return await handleCheatSheet(request, env);
      if (path === '/api/teach/practice' && request.method === 'GET') return await handlePracticeExercise(request, env);
      if (path === '/api/teach/tip' && request.method === 'GET') return await handleDailyTip(request, env);
      // legacy GET /api/teach/:sid — keep for backwards compat
      if (parts[0] === 'api' && parts[1] === 'teach' && parts.length === 3 && request.method === 'GET' && !['quiz', 'cheatsheet', 'practice', 'tip', 'progress', 'history'].includes(parts[2])) {
        return await handleTeachHistory(request, env, parts);
      }
      if (parts[0] === 'api' && parts[1] === 'download') return await handleFileDownload(request, env, parts);
      if (path === '/' || path === '/health') return jsonResponse({ status: 'ok', version: '3.2', features: ['xlsx', 'charts', 'tutor', 'deterministic-70-30', 'teacher-chat', 'progress', 'quiz', 'cheatsheet', 'practice-xlsx', 'bilingual-hi-en'] });
      return errorResponse('Not found', 404);
    } catch (e) {
      console.error(e);
      return errorResponse(e.message || 'Internal error', 500);
    }
  },
};
