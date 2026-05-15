"use client";

import { Video } from "lucide-react";
import UniversalDropzone from "./UniversalDropzone";

export default function VideoUploader({ onFile, busy }: { onFile: (f: File) => void; busy?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-muted text-sm">
        <Video size={16} /> Drop a screen recording — we'll extract keyframes every 2 seconds.
      </div>
      <UniversalDropzone onFile={onFile} busy={busy} />
    </div>
  );
}
