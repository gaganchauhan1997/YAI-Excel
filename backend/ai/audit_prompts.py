"""
Master audit prompts used by VisionReader.

These are the prompts that turn any input into a deep, structured audit JSON
which then drives the entire build pipeline.
"""

MASTER_AUDIT_PROMPT = """
You are the world's best Excel reverse-engineer.
Analyze every pixel of this input. Detect and count every single element.
Return ONLY valid JSON. No markdown. No commentary. No leading or trailing text.

Schema:
{
  "confidence": 0.0,
  "detected_domain": "sales|finance|hr|ops|marketing|inventory|logistics|healthcare|education|real_estate|custom",
  "meta": {
    "total_sheets": 0,
    "total_rows": 0,
    "total_columns": 0,
    "dashboard_width_cols": 0,
    "dashboard_height_rows": 0,
    "color_palette": [],
    "primary_color": "",
    "secondary_color": "",
    "accent_color": "",
    "has_frozen_panes": false,
    "has_merged_cells": false,
    "has_print_area": false,
    "complexity": "basic|standard|advanced|enterprise"
  },
  "interactive_controls": [
    {"type": "dropdown|button_group|option_button|checkbox|scrollbar",
     "location": "B2","linked_cell": "B2","options": [],
     "drives": ["all_kpis","all_charts"]}
  ],
  "kpi_strip": [
    {"id": "kpi_1","label": "","value": "","formula": "",
     "trend": "up|down|neutral","trend_formula": "",
     "icon": "","location": "","bg_color": "","text_color": ""}
  ],
  "charts": [
    {"id": "chart_1",
     "type": "bar|line|pie|donut|area|combo|scatter|radar|bubble|waterfall|funnel|gauge|bullet|cylinder|nested_donut|timeline|lollipop|progress_bar|smooth_line|stacked_bar|grouped_bar",
     "title": "","location": "","data_source": "",
     "series": [{"name": "","values_range": "","categories_range": "","color": "","chart_type": ""}],
     "has_legend": true,"has_data_labels": false,
     "axis_x_title": "","axis_y_title": "",
     "secondary_axis": false,"is_dynamic": true}
  ],
  "pivot_tables": [
    {"id": "pivot_1","location": "","row_fields": [],"column_fields": [],
     "value_fields": [{"field": "","aggregation": "SUM"}],
     "filter_fields": [],"has_grand_totals": true,"has_subtotals": true,
     "style": "PivotStyleMedium9"}
  ],
  "data_tables": [
    {"id": "table_1","location": "","headers": [],"row_count": 0,
     "has_totals_row": false,"table_style": "TableStyleMedium9",
     "has_conditional_format": true}
  ],
  "conditional_formatting": [
    {"range": "","rule_type": "color_scale|data_bar|icon_set|cell_value",
     "condition": "","value": 0,
     "format": {"bg_color": "","font_color": "","bold": false}}
  ],
  "formulas": [
    {"cell": "","formula": "",
     "type": "aggregate|lookup|conditional|percentage|array|dynamic|text|date|financial",
     "named_range": ""}
  ],
  "slicers": [
    {"id": "slicer_1","connected_to": "pivot_1","field": "",
     "location": "","style": "SlicerStyleLight2","items": []}
  ],
  "named_ranges": [{"name": "","refers_to": ""}],
  "data_validation": [
    {"range": "","type": "list|whole|decimal|date","formula": "","error_message": ""}
  ],
  "layout_bands": [
    {"band_id": "band_1","row_range": "","label": "",
     "type": "kpi_strip|chart_zone|table_zone|mixed|header","sections": []}
  ],
  "enhancement_suggestions": [
    {"type": "add_kpi|add_chart|add_pivot|add_conditional_format|add_formula|add_slicer",
     "description": "","formula": "","priority": "high|medium|low"}
  ],
  "missing_elements": [],
  "counts": {
    "charts": 0,"pivots": 0,"kpis": 0,"formulas": 0,
    "interactive_controls": 0,"conditional_formats": 0,
    "named_ranges": 0,"slicers": 0
  }
}

Rules:
- Use real numbers where possible; estimate counts when an exact figure is impossible.
- Use HEX color codes for any color fields.
- Use Excel-style ranges (e.g., "B5:D10") in any *_range field.
- If a section is not visible, return an empty array — never invent fake elements.
- If input is a natural-language prompt (no visual), design a realistic schema for that domain.
""".strip()


PROMPT_TO_AUDIT = """
You are the world's best Excel architect.
The user has described a dashboard in plain language.
Design a complete, enterprise-grade dashboard schema and return ONLY valid JSON
matching the master audit schema. Invent realistic seed data ranges where helpful.

User description:
{description}
""".strip()


DATA_TO_AUDIT = """
You are the world's best Excel analyst.
The user has provided raw tabular data. Detect the domain, propose the best
dashboard layout, KPIs, charts, formulas, and interactivity, and return ONLY
valid JSON matching the master audit schema.

Columns: {columns}
Sample rows:
{sample}

Detected types: {types}
""".strip()
