"use client";

export default function AuditReport({
  domain,
  confidence,
  counts,
}: {
  domain?: string;
  confidence?: number;
  counts?: Record<string, number>;
}) {
  if (!domain && !counts) return null;

  return (
    <div className="card p-5">
      <h4 className="font-display text-lg mb-3">Audit report</h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Row label="Domain" value={domain || "—"} />
        <Row label="Confidence" value={confidence ? `${Math.round(confidence * 100)}%` : "—"} />
        {Object.entries(counts || {}).map(([k, v]) => (
          <Row key={k} label={k.replace(/_/g, " ")} value={String(v)} />
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-white/5 py-1.5">
      <span className="text-muted capitalize">{label}</span>
      <span className="font-mono text-text">{value}</span>
    </div>
  );
}
