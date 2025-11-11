import { useState } from 'react';
import { FileUploadZone } from './FileUploadZone';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { FileText, Download, X, Image as ImageIcon, File } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export const CreatePdfSection = () => {
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [extractedText, setExtractedText] = useState('');
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

  const handleDocumentsSelected = async (files: File[]) => {
    setDocuments(prev => [...prev, ...files]);
    
    // Extract text from documents
    let allText = extractedText;
    for (const file of files) {
      const text = await extractTextFromDocument(file);
      if (text) {
        allText += (allText ? '\n\n' : '') + text;
      }
    }
    setExtractedText(allText);
    
    toast({
      title: "Documentos adicionados",
      description: `${files.length} documento(s) adicionado(s) com sucesso.`,
    });
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const extractTextFromDocument = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      if (extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
      } else if (extension === 'xlsx' || extension === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        let text = '';
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          text += XLSX.utils.sheet_to_txt(worksheet) + '\n';
        });
        return text;
      } else if (extension === 'txt' || extension === 'csv') {
        return await file.text();
      } else {
        toast({
          title: "Formato não suportado",
          description: `O formato .${extension} não é suportado para extração de texto.`,
          variant: "destructive",
        });
        return '';
      }
    } catch (error) {
      console.error('Error extracting text:', error);
      toast({
        title: "Erro",
        description: "Erro ao extrair texto do documento.",
        variant: "destructive",
      });
      return '';
    }
  };

  const generatePdf = async () => {
    if (images.length === 0 && !extractedText.trim()) {
      toast({
        title: "Erro",
        description: "Adicione imagens ou documentos para gerar o PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const pdf = new jsPDF();
      let yPosition = 20;

      // Add extracted text if provided
      if (extractedText.trim()) {
        const lines = pdf.splitTextToSize(extractedText, 170);
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
            if (i > 0 || (extractedText.trim() && yPosition > 100)) {
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
        disabled={isGenerating || (images.length === 0 && !extractedText.trim())}
        className="w-full"
        size="lg"
      >
        <Download className="mr-2 h-5 w-5" />
        {isGenerating ? 'Gerando PDF...' : 'Gerar PDF'}
      </Button>
    </div>
  );
};
