"use client";

import Button from "@/components/ui/Button";

interface ProfileFileUploadProps {
  id: string;
  accept: string;
  label: string;
  hint: string;
  fileName?: string;
  uploading?: boolean;
  disabled?: boolean;
  onFile: (file: File) => void | Promise<void>;
}

export default function ProfileFileUpload({
  id,
  accept,
  label,
  hint,
  fileName,
  uploading = false,
  disabled = false,
  onFile,
}: ProfileFileUploadProps) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-center">
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled || uploading}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      {fileName && (
        <p className="mt-3 truncate text-xs text-emerald-300" title={fileName}>
          Selected: {fileName}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        disabled={disabled || uploading}
        onClick={() => document.getElementById(id)?.click()}
      >
        {uploading ? "Uploading…" : fileName ? "Replace file" : "Choose file"}
      </Button>
    </div>
  );
}
