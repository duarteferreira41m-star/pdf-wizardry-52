import { useState } from 'react';
import { FileUploadZone } from './FileUploadZone';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { FileText, Download, X, Image as ImageIcon, File } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const CreatePdfSection = () => {
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
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

  const handleDocumentsSelected = (files: File[]) => {
    setDocuments(prev => [...prev, ...files]);
    toast({
      title: "Documentos adicionados",
      description: `${files.length} documento(s) adicionado(s) com sucesso.`,
    });
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const generatePdf = async () => {
    if (documents.length === 0 && images.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione imagens ou documentos para gerar o PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      documents.forEach((doc) => formData.append('documents', doc));
      images.forEach((img) => formData.append('images', img));

      const response = await fetch('http://localhost:5000/api/create-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'documento.pdf';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "PDF gerado!",
        description: "Seu documento foi criado com sucesso.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao gerar o PDF.",
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
          <File className="h-5 w-5" />
          Adicionar Documentos
        </h3>
        <FileUploadZone
          onFilesSelected={handleDocumentsSelected}
          accept={{
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/plain': ['.txt'],
            'text/csv': ['.csv']
          }}
          title="Arraste documentos aqui"
          description="Word, Excel, TXT, CSV até 10MB"
        />

        {documents.length > 0 && (
          <div className="mt-4 space-y-2">
            {documents.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-secondary rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <File className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDocument(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
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
        disabled={isGenerating || (images.length === 0 && documents.length === 0)}
        className="w-full"
        size="lg"
      >
        <Download className="mr-2 h-5 w-5" />
        {isGenerating ? 'Gerando PDF...' : 'Gerar PDF'}
      </Button>
    </div>
  );
};
