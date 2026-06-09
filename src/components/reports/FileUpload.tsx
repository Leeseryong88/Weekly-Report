"use client";

import { useRef } from "react";
import { Upload, X, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface FileUploadProps {
  files: string[];
  onUpload: (file: File) => Promise<void>;
  onRemove: (url: string) => void;
  uploading?: boolean;
  disabled?: boolean;
}

export function FileUpload({ files, onUpload, onRemove, uploading, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {files.map((url) => (
          <div
            key={url}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
          >
            <Paperclip className="h-3 w-3 text-slate-400" />
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              첨부파일
            </a>
            {!disabled && (
              <button type="button" onClick={() => onRemove(url)} className="text-slate-400 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            await onUpload(file);
            e.target.value = "";
          }
        }}
      />
      {!disabled && (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {uploading ? "업로드 중..." : "파일 첨부"}
      </Button>
      )}
    </div>
  );
}
