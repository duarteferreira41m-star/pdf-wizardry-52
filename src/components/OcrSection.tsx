import { useState } from 'react';
import { FileUploadZone } from './FileUploadZone';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { FileSearch, Copy, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createWorker } from 'tesseract.js';
import { Progress } from './ui/progress';

export const OcrSection = () => {
  const [extractedText, setExtractedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    setIsProcessing(true);
    setProgress(0);
    setExtractedText('');

    try {
      const worker = await createWorker('por', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        }
      });

      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      setExtractedText(text);
      toast({
        title: "Texto extraído!",
        description: "O OCR foi concluído com sucesso.",
      });
    } catch (error) {
      console.error('Error processing OCR:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(extractedText);
    toast({
      title: "Copiado!",
      description: "Texto copiado para a área de transferência.",
    });
  };

  const downloadText = () => {
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'texto-extraido.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Selecionar Arquivo
        </h3>
        <FileUploadZone
          onFilesSelected={handleFileSelected}
          accept={{ 
            'image/*': ['.png', '.jpg', '.jpeg'],
            'application/pdf': ['.pdf']
          }}
          multiple={false}
          title="Arraste PDF ou imagem aqui"
          description="O texto será extraído automaticamente"
          disabled={isProcessing}
        />
        
        {isProcessing && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Processando OCR...</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}
      </Card>

      {extractedText && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Texto Extraído</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadText}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
            </div>
          </div>
          <Textarea
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
          />
        </Card>
      )}
    </div>
  );
};
