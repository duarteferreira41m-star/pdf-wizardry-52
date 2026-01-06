import { useState } from 'react';
import { FileUploadZone } from './FileUploadZone';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { FileType, Download, Scissors } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument } from 'pdf-lib';
import { Checkbox } from './ui/checkbox';

interface PageInfo {
  pageNumber: number;
  selected: boolean;
}

export const SplitPdfSection = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileSelected = async (files: File[]) => {
    const file = files[0];
    setPdfFile(file);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pageCount = pdf.getPageCount();
      
      const pageInfo: PageInfo[] = Array.from({ length: pageCount }, (_, i) => ({
        pageNumber: i + 1,
        selected: true
      }));
      
      setPages(pageInfo);
      
      toast({
        title: "PDF carregado",
        description: `${pageCount} página(s) detectada(s).`,
      });
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o PDF.",
        variant: "destructive",
      });
    }
  };

  const togglePage = (pageNumber: number) => {
    setPages(prev => prev.map(p => 
      p.pageNumber === pageNumber ? { ...p, selected: !p.selected } : p
    ));
  };

  const selectAll = () => {
    setPages(prev => prev.map(p => ({ ...p, selected: true })));
  };

  const deselectAll = () => {
    setPages(prev => prev.map(p => ({ ...p, selected: false })));
  };

  const splitPdf = async () => {
    if (!pdfFile) return;

    const selectedPages = pages.filter(p => p.selected).map(p => p.pageNumber);

    if (selectedPages.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma página.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('selectedPages', JSON.stringify(selectedPages));

      const response = await fetch('http://localhost:5000/api/split-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao dividir PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'documento-separado.pdf';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "PDF criado!",
        description: `Documento com ${selectedPages.length} página(s) criado com sucesso.`,
      });
    } catch (error) {
      console.error('Error splitting PDF:', error);
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao processar o PDF.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedCount = pages.filter(p => p.selected).length;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileType className="h-5 w-5" />
          Selecionar PDF
        </h3>
        <FileUploadZone
          onFilesSelected={handleFileSelected}
          accept={{ 'application/pdf': ['.pdf'] }}
          multiple={false}
          title="Arraste um PDF aqui"
          description="ou clique para selecionar"
        />

        {pdfFile && pages.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {selectedCount} de {pages.length} página(s) selecionada(s)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                >
                  Selecionar Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAll}
                >
                  Limpar Seleção
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {pages.map((page) => (
                <div
                  key={page.pageNumber}
                  className={`
                    relative p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${page.selected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border bg-secondary/50'
                    }
                    hover:border-primary/50
                  `}
                  onClick={() => togglePage(page.pageNumber)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={page.selected}
                      onCheckedChange={() => togglePage(page.pageNumber)}
                      className="pointer-events-none"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Página {page.pageNumber}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Button
        onClick={splitPdf}
        disabled={isProcessing || !pdfFile || selectedCount === 0}
        className="w-full"
        size="lg"
      >
        <Scissors className="mr-2 h-5 w-5" />
        {isProcessing ? 'Processando...' : 'Criar PDF com Páginas Selecionadas'}
      </Button>
    </div>
  );
};
