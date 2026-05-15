"use client";

import { Image as ImageIcon } from "lucide-react";
import UniversalDropzone from "./UniversalDropzone";

export default function ImageUploader({ onFile, busy }: { onFile: (f: File) => void; busy?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-muted text-sm">
        <ImageIcon size={16} /> Drop a screenshot, photo, scan — even blurry inputs work.
      </div>
      <UniversalDropzone onFile={onFile} busy={busy} />
    </div>
  );
}
