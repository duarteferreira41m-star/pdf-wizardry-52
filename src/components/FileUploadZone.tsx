import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  maxSize?: number;
  disabled?: boolean;
  title?: string;
  description?: string;
}

export const FileUploadZone = ({
  onFilesSelected,
  accept,
  multiple = true,
  maxSize = 10485760, // 10MB default
  disabled = false,
  title = "Arraste arquivos aqui",
  description = "ou clique para selecionar"
}: FileUploadZoneProps) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
    maxSize,
    disabled
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300",
        "hover:border-primary hover:bg-primary/5",
        isDragActive ? "border-primary bg-primary/10" : "border-border",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <div className={cn(
          "p-4 rounded-full transition-colors duration-300",
          isDragActive ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
        )}>
          {isDragActive ? (
            <FileIcon className="h-8 w-8" />
          ) : (
            <Upload className="h-8 w-8" />
          )}
        </div>
        <div>
          <p className="text-lg font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
};
