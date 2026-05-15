"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";

export default function UniversalDropzone({
  onFile,
  busy,
}: {
  onFile: (file: File) => void;
  busy?: boolean;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: busy,
  });

  return (
    <div
      {...getRootProps()}
      className={`card border-2 border-dashed transition cursor-pointer p-10 text-center ${
        isDragActive ? "border-primary bg-primary/5" : "border-white/10 hover:border-primary/40"
      } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <input {...getInputProps()} />
      <UploadCloud className="mx-auto text-primary" size={42} />
      <p className="mt-4 font-medium text-text">
        {isDragActive ? "Drop the file to start" : "Drop a file — image, video, PDF, Excel, CSV, JSON, XML"}
      </p>
      <p className="mt-1 text-sm text-muted">or click to browse · up to 500 MB</p>
    </div>
  );
}
