"use client";

export default function FormulaList({
  suggestions,
}: {
  suggestions?: { description: string; priority: string }[];
}) {
  if (!suggestions?.length) return null;
  return (
    <div className="card p-5">
      <h4 className="font-display text-lg mb-3">Enhancement suggestions</h4>
      <ul className="space-y-2 text-sm">
        {suggestions.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span
              className={`inline-block w-2 h-2 mt-1.5 rounded-full ${
                s.priority === "high"
                  ? "bg-red-400"
                  : s.priority === "medium"
                  ? "bg-yellow-400"
                  : "bg-green-400"
              }`}
            />
            <span className="text-text">{s.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
