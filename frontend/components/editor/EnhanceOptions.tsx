"use client";

export type Options = {
  addMissingKPIs: boolean;
  addMissingCharts: boolean;
  addInteractivity: boolean;
  addConditionalFormat: boolean;
};

export default function EnhanceOptions({
  value,
  onChange,
}: {
  value: Options;
  onChange: (v: Options) => void;
}) {
  const items: { key: keyof Options; label: string }[] = [
    { key: "addMissingKPIs", label: "Add missing KPIs (auto-fill to 4)" },
    { key: "addMissingCharts", label: "Add missing charts (min 2)" },
    { key: "addInteractivity", label: "Add period dropdown + filters" },
    { key: "addConditionalFormat", label: "Add conditional formatting" },
  ];
  return (
    <div className="card p-5">
      <h4 className="font-display text-lg mb-3">Auto-enhance</h4>
      <div className="space-y-2">
        {items.map((it) => (
          <label key={it.key} className="flex items-center gap-3 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={value[it.key]}
              onChange={(e) => onChange({ ...value, [it.key]: e.target.checked })}
              className="accent-primary w-4 h-4"
            />
            <span>{it.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
