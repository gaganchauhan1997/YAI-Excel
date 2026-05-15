"use client";

const SWATCHES: Record<string, string[]> = {
  midnight: ["#1E3A5F", "#FFC000"],
  emerald: ["#1A3C2E", "#70AD47"],
  crimson: ["#7B0000", "#FFFFFF"],
  slate: ["#2D3748", "#63B3ED"],
  amber: ["#3D1F00", "#F59E0B"],
  ocean: ["#0F4C5C", "#22D3EE"],
  violet: ["#2D1B69", "#A78BFA"],
  rose: ["#7C3048", "#FBCFE8"],
  carbon: ["#0A0A0A", "#00FF41"],
  arctic: ["#FFFFFF", "#BFDBFE"],
};

export default function ThemeSelector({
  value,
  onChange,
  themes,
}: {
  value: string;
  onChange: (t: string) => void;
  themes: string[];
}) {
  return (
    <div className="card p-5">
      <h4 className="font-display text-lg mb-3">Theme</h4>
      <div className="grid grid-cols-2 gap-2">
        {themes.map((t) => {
          const swatch = SWATCHES[t] || ["#6366f1", "#22d3ee"];
          const active = value === t;
          return (
            <button
              key={t}
              onClick={() => onChange(t)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left ${
                active ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/20"
              }`}
            >
              <span className="flex gap-1">
                <span className="w-3 h-3 rounded-sm border border-white/10" style={{ background: swatch[0] }} />
                <span className="w-3 h-3 rounded-sm border border-white/10" style={{ background: swatch[1] }} />
              </span>
              <span className="text-sm capitalize">{t}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
