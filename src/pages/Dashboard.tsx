import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Newspaper, Plus, Trash2, Search, Bell, LogOut, RefreshCw, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchTerm {
  id: string;
  term: string;
  is_active: boolean;
  created_at: string;
}

interface SearchResult {
  id: string;
  title: string | null;
  content: string;
  publication_date: string;
  source_url: string | null;
  was_notified: boolean;
  search_term_id: string;
}

interface Profile {
  notification_enabled: boolean;
  email: string;
  full_name: string | null;
}

const Dashboard = () => {
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTerm, setIsAddingTerm] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedTermResults, setSelectedTermResults] = useState<SearchResult[]>([]);
  const [selectedTermName, setSelectedTermName] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      await loadData();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      }
    });

    checkAuth();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [termsRes, profileRes, resultsRes] = await Promise.all([
        supabase.from('search_terms').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').single(),
        supabase.from('search_results').select('*').order('publication_date', { ascending: false }).limit(50),
      ]);

      if (termsRes.data) setSearchTerms(termsRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      if (resultsRes.data) setSearchResults(resultsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  const handleAddTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;

    setIsAddingTerm(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('search_terms').insert({
      term: newTerm.trim(),
      user_id: user?.id,
    });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o termo.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Termo adicionado!",
        description: `"${newTerm}" será monitorado no Diário Oficial.`,
      });
      setNewTerm('');
      await loadData();
    }
    setIsAddingTerm(false);
  };

  const handleDeleteTerm = async (id: string, term: string) => {
    const { error } = await supabase.from('search_terms').delete().eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover o termo.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Termo removido",
        description: `"${term}" não será mais monitorado.`,
      });
      await loadData();
    }
  };

  const handleToggleTerm = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from('search_terms').update({ is_active: !isActive }).eq('id', id);

    if (!error) {
      await loadData();
    }
  };

  const handleToggleNotifications = async () => {
    if (!profile) return;

    const { error } = await supabase
      .from('profiles')
      .update({ notification_enabled: !profile.notification_enabled })
      .eq('email', profile.email);

    if (!error) {
      setProfile({ ...profile, notification_enabled: !profile.notification_enabled });
      toast({
        title: profile.notification_enabled ? "Notificações desativadas" : "Notificações ativadas",
        description: profile.notification_enabled 
          ? "Você não receberá mais e-mails de alerta." 
          : "Você receberá e-mails quando termos forem encontrados.",
      });
    }
  };

  const handleManualScan = async () => {
    setIsScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-diario-oficial`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: "Verificação concluída!",
          description: `${result.resultsCount || 0} publicações encontradas.`,
        });
        await loadData();
      } else {
        throw new Error(result.error || 'Erro ao verificar');
      }
    } catch (error: any) {
      toast({
        title: "Erro na verificação",
        description: error.message,
        variant: "destructive",
      });
    }
    setIsScanning(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const viewTermResults = (termId: string, termName: string) => {
    const results = searchResults.filter(r => r.search_term_id === termId);
    setSelectedTermResults(results);
    setSelectedTermName(termName);
  };

  const getResultsCountForTerm = (termId: string) => {
    return searchResults.filter(r => r.search_term_id === termId).length;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Newspaper className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Monitor Diário Oficial</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Bell className={`h-4 w-4 ${profile?.notification_enabled ? 'text-primary' : 'text-muted-foreground'}`} />
              <Switch
                checked={profile?.notification_enabled || false}
                onCheckedChange={handleToggleNotifications}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Add Term Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Adicionar Termo de Busca
            </CardTitle>
            <CardDescription>
              Adicione palavras-chave para monitorar no Diário Oficial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTerm} className="flex gap-2">
              <Input
                placeholder="Ex: licitação, concurso público, seu nome..."
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={isAddingTerm || !newTerm.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleManualScan} disabled={isScanning || searchTerms.length === 0}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Verificando...' : 'Verificar Agora'}
          </Button>
        </div>

        {/* Search Terms List */}
        <Card>
          <CardHeader>
            <CardTitle>Termos Monitorados ({searchTerms.length})</CardTitle>
            <CardDescription>
              Gerencie os termos que serão buscados automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchTerms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum termo adicionado ainda.</p>
                <p className="text-sm">Adicione termos acima para começar o monitoramento.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchTerms.map((term) => (
                  <div
                    key={term.id}
                    className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={term.is_active}
                        onCheckedChange={() => handleToggleTerm(term.id, term.is_active)}
                      />
                      <span className={term.is_active ? '' : 'text-muted-foreground line-through'}>
                        {term.term}
                      </span>
                      {getResultsCountForTerm(term.id) > 0 && (
                        <Badge variant="secondary">
                          {getResultsCountForTerm(term.id)} resultado(s)
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => viewTermResults(term.id, term.term)}
                            disabled={getResultsCountForTerm(term.id) === 0}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>Resultados para "{selectedTermName}"</DialogTitle>
                            <DialogDescription>
                              Publicações encontradas no Diário Oficial
                            </DialogDescription>
                          </DialogHeader>
                          <ScrollArea className="h-[60vh] pr-4">
                            {selectedTermResults.length === 0 ? (
                              <p className="text-center text-muted-foreground py-8">
                                Nenhum resultado encontrado para este termo.
                              </p>
                            ) : (
                              <div className="space-y-4">
                                {selectedTermResults.map((result) => (
                                  <div key={result.id} className="p-4 border rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm text-muted-foreground">
                                        {new Date(result.publication_date).toLocaleDateString('pt-BR')}
                                      </span>
                                      {result.was_notified && (
                                        <Badge variant="outline">Notificado</Badge>
                                      )}
                                    </div>
                                    {result.title && (
                                      <h4 className="font-medium mb-2">{result.title}</h4>
                                    )}
                                    <p className="text-sm text-muted-foreground line-clamp-4">
                                      {result.content}
                                    </p>
                                    {result.source_url && (
                                      <a
                                        href={result.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline mt-2 inline-block"
                                      >
                                        Ver publicação original
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTerm(term.id, term.term)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Results */}
        {searchResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Últimos Resultados</CardTitle>
              <CardDescription>
                Publicações recentes encontradas com seus termos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {searchResults.slice(0, 5).map((result) => {
                  const term = searchTerms.find(t => t.id === result.search_term_id);
                  return (
                    <div key={result.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge>{term?.term || 'Termo removido'}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(result.publication_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      {result.title && (
                        <h4 className="font-medium mb-1">{result.title}</h4>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {result.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
