import { useState } from 'react';
import { FileUploadZone } from './FileUploadZone';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { FileType, Download, X, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument } from 'pdf-lib';

export const MergePdfSection = () => {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = (files: File[]) => {
    setPdfFiles(prev => [...prev, ...files]);
    toast({
      title: "PDFs adicionados",
      description: `${files.length} arquivo(s) adicionado(s) com sucesso.`,
    });
  };

  const removeFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const mergePdfs = async () => {
    if (pdfFiles.length < 2) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos 2 PDFs para juntar.",
        variant: "destructive",
      });
      return;
    }

    setIsMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'documento-mesclado.pdf';
      a.click();
      
      URL.revokeObjectURL(url);

      toast({
        title: "PDFs mesclados!",
        description: "Seus documentos foram unidos com sucesso.",
      });
    } catch (error) {
      console.error('Error merging PDFs:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao mesclar os PDFs.",
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileType className="h-5 w-5" />
          Selecionar PDFs
        </h3>
        <FileUploadZone
          onFilesSelected={handleFilesSelected}
          accept={{ 'application/pdf': ['.pdf'] }}
          title="Arraste PDFs aqui"
          description="Adicione múltiplos arquivos para juntar"
        />

        {pdfFiles.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              {pdfFiles.length} arquivo(s) selecionado(s)
            </p>
            {pdfFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                  <FileType className="h-5 w-5 text-destructive" />
                  <div>
                    <span className="text-sm font-medium">{file.name}</span>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button
        onClick={mergePdfs}
        disabled={isMerging || pdfFiles.length < 2}
        className="w-full"
        size="lg"
      >
        <Download className="mr-2 h-5 w-5" />
        {isMerging ? 'Mesclando PDFs...' : 'Mesclar PDFs'}
      </Button>
    </div>
  );
};
