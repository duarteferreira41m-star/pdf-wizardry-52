import { useState } from 'react';
import { FileUploadZone } from './FileUploadZone';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { FileText, Download, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

export const CreatePdfSection = () => {
  const [images, setImages] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleImagesSelected = (files: File[]) => {
    setImages(prev => [...prev, ...files]);
    toast({
      title: "Imagens adicionadas",
      description: `${files.length} imagem(ns) adicionada(s) com sucesso.`,
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const generatePdf = async () => {
    if (images.length === 0 && !text.trim()) {
      toast({
        title: "Erro",
        description: "Adicione imagens ou texto para gerar o PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const pdf = new jsPDF();
      let yPosition = 20;

      // Add text if provided
      if (text.trim()) {
        const lines = pdf.splitTextToSize(text, 170);
        pdf.text(lines, 20, yPosition);
        yPosition += lines.length * 7;
        
        if (images.length > 0 && yPosition < 270) {
          yPosition += 10;
        }
      }

      // Add images
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const reader = new FileReader();
        
        await new Promise<void>((resolve) => {
          reader.onload = (e) => {
            const imgData = e.target?.result as string;
            
            // Add new page if needed
            if (i > 0 || (text.trim() && yPosition > 100)) {
              pdf.addPage();
              yPosition = 20;
            }

            // Calculate dimensions to fit page
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth() - 40;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            pdf.addImage(imgData, 'JPEG', 20, yPosition, pdfWidth, pdfHeight);
            resolve();
          };
          reader.readAsDataURL(img);
        });
      }

      pdf.save('documento.pdf');
      
      toast({
        title: "PDF gerado!",
        description: "Seu documento foi criado com sucesso.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao gerar o PDF.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Adicionar Texto
        </h3>
        <Textarea
          placeholder="Digite o texto que deseja incluir no PDF..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[120px] resize-none"
        />
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Adicionar Imagens
        </h3>
        <FileUploadZone
          onFilesSelected={handleImagesSelected}
          accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }}
          title="Arraste imagens aqui"
          description="PNG, JPG, GIF até 10MB"
        />

        {images.length > 0 && (
          <div className="mt-4 space-y-2">
            {images.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-secondary rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeImage(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button
        onClick={generatePdf}
        disabled={isGenerating || (images.length === 0 && !text.trim())}
        className="w-full"
        size="lg"
      >
        <Download className="mr-2 h-5 w-5" />
        {isGenerating ? 'Gerando PDF...' : 'Gerar PDF'}
      </Button>
    </div>
  );
};
