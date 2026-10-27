import React, { useState } from "react";
import { Upload, FileSpreadsheet, Images, CheckCircle2 } from "lucide-react";

interface DropzoneUploadProps {
  type: "spreadsheet" | "photos";
  onFilesSelected: (files: File[] | FileList) => Promise<void>;
  accept: string;
  multiple?: boolean;
  title: string;
  subtitle: string;
  isProcessing?: boolean;
  summaryText?: string | null;
}

export const DropzoneUpload: React.FC<DropzoneUploadProps> = ({
  type,
  onFilesSelected,
  accept,
  multiple = false,
  title,
  subtitle,
  isProcessing = false,
  summaryText = null,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onFilesSelected(e.target.files);
      e.target.value = "";
    }
  };

  const Icon = type === "spreadsheet" ? FileSpreadsheet : Images;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-all min-h-[140px] flex flex-col items-center justify-center ${
        isDragOver
          ? "border-red-600 bg-red-50/70 scale-[1.01]"
          : "border-neutral-300 hover:border-neutral-400 bg-neutral-50/60"
      }`}
    >
      <Icon
        className={`h-9 w-9 mb-2 transition-colors ${
          isDragOver ? "text-red-600 animate-bounce" : "text-neutral-400"
        }`}
      />

      <div className="text-sm font-bold text-neutral-800">{title}</div>
      <p className="text-xs text-neutral-500 mt-0.5 max-w-md">{subtitle}</p>

      {/* Botão de Seleção Acessível (min-h 44px) */}
      <div className="mt-3">
        <label className="cursor-pointer inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 rounded-lg bg-white border border-neutral-300 hover:border-red-500 hover:text-red-700 shadow-xs text-xs font-semibold text-neutral-800 transition-colors focus-within:ring-2 focus-within:ring-red-600">
          <Upload className="h-4 w-4 text-red-600" />
          <span>
            {isProcessing ? "Processando arquivos..." : "Procurar no computador"}
          </span>
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            className="sr-only"
            disabled={isProcessing}
            onChange={handleChange}
          />
        </label>
      </div>

      {/* Resumo do envio */}
      {summaryText && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-bold text-green-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>{summaryText}</span>
        </div>
      )}
    </div>
  );
};
