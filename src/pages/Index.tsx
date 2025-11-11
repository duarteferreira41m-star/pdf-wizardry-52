import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreatePdfSection } from '@/components/CreatePdfSection';
import { OcrSection } from '@/components/OcrSection';
import { MergePdfSection } from '@/components/MergePdfSection';
import { FileText, FileSearch, FilePlus } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            PDF Tools Pro
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Crie, extraia e mescle documentos PDF com facilidade
          </p>
        </header>

        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="create" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Criar PDF</span>
              </TabsTrigger>
              <TabsTrigger value="ocr" className="flex items-center gap-2">
                <FileSearch className="h-4 w-4" />
                <span className="hidden sm:inline">Extrair Texto</span>
              </TabsTrigger>
              <TabsTrigger value="merge" className="flex items-center gap-2">
                <FilePlus className="h-4 w-4" />
                <span className="hidden sm:inline">Mesclar PDFs</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-0">
              <CreatePdfSection />
            </TabsContent>

            <TabsContent value="ocr" className="mt-0">
              <OcrSection />
            </TabsContent>

            <TabsContent value="merge" className="mt-0">
              <MergePdfSection />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
