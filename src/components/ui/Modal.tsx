"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl" | "full";
  bodyClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  bodyClassName,
}: ModalProps) {
  if (!open) return null;
  const sizes = {
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "h-[calc(100vh-2rem)] max-w-[min(1600px,calc(100vw-2rem))]",
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-xl bg-white shadow-xl",
          sizes[size]
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto p-5", bodyClassName)}>{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function AiPreviewModal({
  open,
  onClose,
  content,
  onContentChange,
  onApply,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  content: string;
  onContentChange: (v: string) => void;
  onApply: () => void;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI 생성 결과 미리보기"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={onApply} disabled={loading || !content}>
            적용하여 저장
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        AI 생성 결과입니다. 수정 후 &apos;적용하여 저장&apos;을 눌러주세요.
      </p>
      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className="min-h-[300px] w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"
      />
    </Modal>
  );
}
