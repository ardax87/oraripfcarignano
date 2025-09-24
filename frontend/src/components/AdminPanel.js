import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon, Trash2, Plus, Edit, Save, X, Clock } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { it } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dipendenti');
  const [dipendenti, setDipendenti] = useState([]);
  const [settimane, setSettimane] = useState([]);
  const [guide, setGuide] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(false);

  // Stati per form
  const [nuovoDipendente, setNuovoDipendente] = useState({ nome: '', ore_contratto: '' });
  const [dipendenteInModifica, setDipendenteInModifica] = useState(null);
  const [nuovaSettimana, setNuovaSettimana] = useState({ nome: '', inizio: null, fine: null });
  const [nuovaGuida, setNuovaGuida] = useState({ titolo: '', contenuto: '', categoria: '' });
  const [nuoviCodici, setNuoviCodici] = useState({ admin_code: '', user_code: '' });
  const [nuoviColori, setNuoviColori] = useState({ background_color: '', text_color: '' });

  // Stati per orari settimanali
  const [settimanaSelezionata, setSettimanaSelezionata] = useState('');
  const [dipendenteSelezionato, setDipendenteSelezionato] = useState('');
  const [orariSettimana, setOrariSettimana] = useState({});
  const [calcoliOrari, setCalcoliOrari] = useState(null);
  const [calcoliGiornalieri, setCalcoliGiornalieri] = useState({});
  const [dataSelezionata, setDataSelezionata] = useState(null);

  // Categorie guide
  const categorieGuide = {
    'condotta_generale': 'Condotta Generale',
    'reparto_cassa': 'Reparto Cassa',
    'reparto_freschi': 'Reparto Freschi',
    'reparto_gastronomia': 'Reparto Gastronomia',
    'reparto_macelleria': 'Reparto Macelleria',
    'reparto_ortofrutta': 'Reparto Ortofrutta',
    'reparto_sala': 'Reparto Sala',
    'reparto_surgelati': 'Reparto Surgelati',
    'reparto_magazzino': 'Reparto Magazzino'
  };

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState({
    dipendente: false,
    modificaDipendente: false,
    settimana: false,
    guida: false,
    codici: false,
    colori: false,
    orari: false,
    calendario: false
  });

  // Opzioni per orari
  const oreOptions = Array.from({ length: 16 }, (_, i) => {
    const ora = i + 6;
    return { value: ora.toString().padStart(2, '0'), label: `${ora.toString().padStart(2, '0')}` };
  });

  const minutiOptions = [
    { value: '00', label: '00' },
    { value: '15', label: '15' },
    { value: '30', label: '30' },
    { value: '45', label: '45' }
  ];

  const tipoOrarioOptions = [
    { value: 'ordinarie', label: 'Ordinarie' },
    { value: 'mutua', label: 'Mutua' },
    { value: 'ferie', label: 'Ferie' },
    { value: 'riposo_mattino', label: 'Riposo Mattino' },
    { value: 'riposo_pomeriggio', label: 'Riposo Pomeriggio' }
  ];

  // Caricamento dati iniziale
  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (settimanaSelezionata && dipendenteSelezionato) {
      loadOrariSettimana();
    }
  }, [settimanaSelezionata, dipendenteSelezionato]);

  useEffect(() => {
    if (settimanaSelezionata && dipendenteSelezionato && Object.keys(orariSettimana).length > 0) {
      calcolaOrariAutomatici();
      calcolaOrariGiornalieri();
    }
  }, [orariSettimana, settimanaSelezionata, dipendenteSelezionato]);

  const loadAllData = async () => {
    try {
      const [dipRes, settRes, guideRes, configRes] = await Promise.all([
        axios.get(`${API}/dipendenti`),
        axios.get(`${API}/settimane`),
        axios.get(`${API}/guide`),
        axios.get(`${API}/config`)
      ]);
      
      setDipendenti(dipRes.data);
      setSettimane(settRes.data);
      setGuide(guideRes.data);
      setConfig(configRes.data);
      
      // Inizializza form con valori attuali
      setNuoviCodici({
        admin_code: configRes.data.admin_code,
        user_code: configRes.data.user_code
      });
      setNuoviColori({
        background_color: configRes.data.background_color,
        text_color: configRes.data.text_color
      });
    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
      toast.error('Errore nel caricamento dati');
    }
  };

  const loadOrariSettimana = async () => {
    try {
      const settimana = settimane.find(s => s.id === settimanaSelezionata);
      if (settimana && settimana.orari && settimana.orari[dipendenteSelezionato]) {
        setOrariSettimana(settimana.orari[dipendenteSelezionato]);
      } else {
        // Inizializza orari vuoti per la settimana
        const orariVuoti = {
          lunedi: { mattino_inizio: '06:00', mattino_fine: '06:00', mattino_tipo: 'ordinarie', pomeriggio_inizio: '14:00', pomeriggio_fine: '14:00', pomeriggio_tipo: 'ordinarie' },
          martedi: { mattino_inizio: '06:00', mattino_fine: '06:00', mattino_tipo: 'ordinarie', pomeriggio_inizio: '14:00', pomeriggio_fine: '14:00', pomeriggio_tipo: 'ordinarie' },
          mercoledi: { mattino_inizio: '06:00', mattino_fine: '06:00', mattino_tipo: 'ordinarie', pomeriggio_inizio: '14:00', pomeriggio_fine: '14:00', pomeriggio_tipo: 'ordinarie' },
          giovedi: { mattino_inizio: '06:00', mattino_fine: '06:00', mattino_tipo: 'ordinarie', pomeriggio_inizio: '14:00', pomeriggio_fine: '14:00', pomeriggio_tipo: 'ordinarie' },
          venerdi: { mattino_inizio: '06:00', mattino_fine: '06:00', mattino_tipo: 'ordinarie', pomeriggio_inizio: '14:00', pomeriggio_fine: '14:00', pomeriggio_tipo: 'ordinarie' },
          sabato: { mattino_inizio: '06:00', mattino_fine: '06:00', mattino_tipo: 'ordinarie', pomeriggio_inizio: '14:00', pomeriggio_fine: '14:00', pomeriggio_tipo: 'ordinarie' },
          domenica: { mattino_inizio: '06:00', mattino_fine: '06:00', mattino_tipo: 'ordinarie', pomeriggio_inizio: '14:00', pomeriggio_fine: '14:00', pomeriggio_tipo: 'ordinarie' }
        };
        setOrariSettimana(orariVuoti);
      }
    } catch (error) {
      console.error('Errore nel caricamento orari:', error);
    }
  };

  const calcolaOrariAutomatici = async () => {
    if (!settimanaSelezionata || !dipendenteSelezionato) return;
    
    try {
      const response = await axios.get(`${API}/settimane/${settimanaSelezionata}/calcoli/${dipendenteSelezionato}`);
      setCalcoliOrari(response.data);
    } catch (error) {
      console.error('Errore nel calcolo orari:', error);
      setCalcoliOrari(null);
    }
  };

  const calcolaOrariGiornalieri = async () => {
    if (!settimanaSelezionata || !dipendenteSelezionato) return;
    
    try {
      const response = await axios.get(`${API}/settimane/${settimanaSelezionata}/calcoli-giornalieri/${dipendenteSelezionato}`);
      setCalcoliGiornalieri(response.data);
    } catch (error) {
      console.error('Errore nel calcolo orari giornalieri:', error);
      setCalcoliGiornalieri({});
    }
  };

  const creaSettimanaAutomatica = (data) => {
    // Trova il lunedì della settimana selezionata
    const lunedi = startOfWeek(data, { weekStartsOn: 1 });
    const domenica = addDays(lunedi, 6);
    
    const nomeSettimana = `Settimana ${format(lunedi, 'dd/MM')} - ${format(domenica, 'dd/MM yyyy', { locale: it })}`;
    
    return {
      nome: nomeSettimana,
      inizio: lunedi,
      fine: domenica
    };
  };

  const selezionaDataECreaSettimana = (data) => {
    const nuovaSettimanaData = creaSettimanaAutomatica(data);
    setNuovaSettimana(nuovaSettimanaData);
    setDataSelezionata(data);
    setDialogOpen({ ...dialogOpen, calendario: false });
  };

  const salvaOrariSettimana = async () => {
    if (!settimanaSelezionata || !dipendenteSelezionato) {
      toast.error('Seleziona settimana e dipendente');
      return;
    }

    try {
      setLoading(true);
      const orariCompleti = {
        [dipendenteSelezionato]: orariSettimana
      };
      
      await axios.put(`${API}/settimane/${settimanaSelezionata}/orari`, orariCompleti);
      toast.success('Orari salvati con successo');
      
      // Ricarica le settimane per aggiornare i dati
      const settRes = await axios.get(`${API}/settimane`);
      setSettimane(settRes.data);
      
      // Ricalcola gli orari
      await calcolaOrariAutomatici();
      await calcolaOrariGiornalieri();
    } catch (error) {
      console.error('Errore nel salvataggio orari:', error);
      toast.error('Errore nel salvataggio orari');
    } finally {
      setLoading(false);
    }
  };

  const updateOrarioTurno = (giorno, campo, valore) => {
    setOrariSettimana(prev => ({
      ...prev,
      [giorno]: {
        ...prev[giorno],
        [campo]: valore
      }
    }));
  };

  const formatOrario = (ora, minuti) => {
    return `${ora}:${minuti}`;
  };

  const parseOrario = (orario) => {
    const [ora, minuti] = orario.split(':');
    return { ora: ora || '06', minuti: minuti || '00' };
  };

  const renderTurnoRiposo = (tipo, turno) => {
    if (tipo === 'riposo_mattino' && turno === 'mattino') return 'Riposo';
    if (tipo === 'riposo_pomeriggio' && turno === 'pomeriggio') return 'Riposo';
    return null;
  };

  // Gestione Dipendenti
  const aggiungiDipendente = async () => {
    if (!nuovoDipendente.nome || !nuovoDipendente.ore_contratto) {
      toast.error('Compila tutti i campi');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API}/dipendenti`, {
        nome: nuovoDipendente.nome,
        ore_contratto: parseInt(nuovoDipendente.ore_contratto)
      });
      
      setDipendenti([...dipendenti, response.data]);
      setNuovoDipendente({ nome: '', ore_contratto: '' });
      setDialogOpen({ ...dialogOpen, dipendente: false });
      toast.success('Dipendente aggiunto');
    } catch (error) {
      toast.error('Errore nell\'aggiunta del dipendente');
    } finally {
      setLoading(false);
    }
  };

  const apriModificaDipendente = (dipendente) => {
    setDipendenteInModifica({ ...dipendente });
    setDialogOpen({ ...dialogOpen, modificaDipendente: true });
  };

  const modificaDipendente = async () => {
    if (!dipendenteInModifica.nome || !dipendenteInModifica.ore_contratto) {
      toast.error('Compila tutti i campi');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.put(`${API}/dipendenti/${dipendenteInModifica.id}`, {
        nome: dipendenteInModifica.nome,
        ore_contratto: parseInt(dipendenteInModifica.ore_contratto)
      });
      
      setDipendenti(dipendenti.map(d => d.id === dipendenteInModifica.id ? response.data : d));
      setDipendenteInModifica(null);
      setDialogOpen({ ...dialogOpen, modificaDipendente: false });
      toast.success('Dipendente modificato');
    } catch (error) {
      toast.error('Errore nella modifica del dipendente');
    } finally {
      setLoading(false);
    }
  };

  const eliminaDipendente = async (id) => {
    try {
      await axios.delete(`${API}/dipendenti/${id}`);
      setDipendenti(dipendenti.filter(d => d.id !== id));
      toast.success('Dipendente eliminato');
    } catch (error) {
      toast.error('Errore nell\'eliminazione del dipendente');
    }
  };

  // Gestione Settimane
  const aggiungiSettimana = async () => {
    if (!nuovaSettimana.nome || !nuovaSettimana.inizio || !nuovaSettimana.fine) {
      toast.error('Compila tutti i campi');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API}/settimane`, {
        nome: nuovaSettimana.nome,
        inizio: format(nuovaSettimana.inizio, 'yyyy-MM-dd'),
        fine: format(nuovaSettimana.fine, 'yyyy-MM-dd')
      });
      
      setSettimane([...settimane, response.data]);
      setNuovaSettimana({ nome: '', inizio: null, fine: null });
      setDataSelezionata(null);
      setDialogOpen({ ...dialogOpen, settimana: false });
      toast.success('Settimana lavorativa creata');
    } catch (error) {
      toast.error('Errore nella creazione della settimana');
    } finally {
      setLoading(false);
    }
  };

  // Gestione Richieste - rimosso dal pannello admin

  // Gestione Guide
  const aggiungiGuida = async () => {
    if (!nuovaGuida.titolo || !nuovaGuida.contenuto || !nuovaGuida.categoria) {
      toast.error('Compila tutti i campi');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API}/guide`, nuovaGuida);
      setGuide([...guide, response.data]);
      setNuovaGuida({ titolo: '', contenuto: '', categoria: '' });
      setDialogOpen({ ...dialogOpen, guida: false });
      toast.success('Guida aggiunta');
    } catch (error) {
      toast.error('Errore nell\'aggiunta della guida');
    } finally {
      setLoading(false);
    }
  };

  const eliminaGuida = async (id) => {
    try {
      await axios.delete(`${API}/guide/${id}`);
      setGuide(guide.filter(g => g.id !== id));
      toast.success('Guida eliminata');
    } catch (error) {
      toast.error('Errore nell\'eliminazione della guida');
    }
  };

  // Gestione Configurazione
  const aggiornaCodici = async () => {
    if (!nuoviCodici.admin_code || !nuoviCodici.user_code) {
      toast.error('Inserisci entrambi i codici');
      return;
    }

    try {
      setLoading(true);
      await axios.put(`${API}/config`, nuoviCodici);
      setConfig({ ...config, ...nuoviCodici });
      setDialogOpen({ ...dialogOpen, codici: false });
      toast.success('Codici aggiornati');
    } catch (error) {
      toast.error('Errore nell\'aggiornamento dei codici');
    } finally {
      setLoading(false);
    }
  };

  const aggiornaColori = async () => {
    if (!nuoviColori.background_color || !nuoviColori.text_color) {
      toast.error('Seleziona entrambi i colori');
      return;
    }

    try {
      setLoading(true);
      await axios.put(`${API}/config`, nuoviColori);
      setConfig({ ...config, ...nuoviColori });
      setDialogOpen({ ...dialogOpen, colori: false });
      toast.success('Colori aggiornati - ricarica la pagina per vedere le modifiche');
    } catch (error) {
      toast.error('Errore nell\'aggiornamento dei colori');
    } finally {
      setLoading(false);
    }
  };

  const giorni = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
  const giorniLabels = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Pannello Amministratore</h2>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 bg-white/10">
          <TabsTrigger value="dipendenti" className="text-white data-[state=active]:bg-white/20">
            Dipendenti
          </TabsTrigger>
          <TabsTrigger value="settimane" className="text-white data-[state=active]:bg-white/20">
            Settimane
          </TabsTrigger>
          <TabsTrigger value="orari" className="text-white data-[state=active]:bg-white/20">
            Orari
          </TabsTrigger>
          <TabsTrigger value="guide" className="text-white data-[state=active]:bg-white/20">
            Guide
          </TabsTrigger>
          <TabsTrigger value="config" className="text-white data-[state=active]:bg-white/20">
            Config
          </TabsTrigger>
        </TabsList>

        {/* Tab Dipendenti */}
        <TabsContent value="dipendenti" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-white">Gestione Dipendenti</h3>
            <Dialog open={dialogOpen.dipendente} onOpenChange={(open) => 
              setDialogOpen({ ...dialogOpen, dipendente: open })}>
              <DialogTrigger asChild>
                <Button className="bg-white text-red-800 hover:bg-white/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Dipendente
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-red-900 text-white border-white/20">
                <DialogHeader>
                  <DialogTitle>Nuovo Dipendente</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input
                      id="nome"
                      value={nuovoDipendente.nome}
                      onChange={(e) => setNuovoDipendente({ ...nuovoDipendente, nome: e.target.value })}
                      placeholder="Es. Mario Rossi"
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ore">Ore Contratto</Label>
                    <Input
                      id="ore"
                      type="number"
                      value={nuovoDipendente.ore_contratto}
                      onChange={(e) => setNuovoDipendente({ ...nuovoDipendente, ore_contratto: e.target.value })}
                      placeholder="Es. 40"
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={aggiungiDipendente} disabled={loading} className="bg-white text-red-800 hover:bg-white/90">
                      <Save className="w-4 h-4 mr-2" />
                      Salva
                    </Button>
                    <Button variant="outline" onClick={() => setDialogOpen({ ...dialogOpen, dipendente: false })}
                            className="border-white/20 text-white hover:bg-white/10">
                      <X className="w-4 h-4 mr-2" />
                      Annulla
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Dialog Modifica Dipendente */}
          <Dialog open={dialogOpen.modificaDipendente} onOpenChange={(open) => 
            setDialogOpen({ ...dialogOpen, modificaDipendente: open })}>
            <DialogContent className="bg-red-900 text-white border-white/20">
              <DialogHeader>
                <DialogTitle>Modifica Dipendente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="nomeModifica">Nome Completo</Label>
                  <Input
                    id="nomeModifica"
                    value={dipendenteInModifica?.nome || ''}
                    onChange={(e) => setDipendenteInModifica({ ...dipendenteInModifica, nome: e.target.value })}
                    placeholder="Es. Mario Rossi"
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="oreModifica">Ore Contratto</Label>
                  <Input
                    id="oreModifica"
                    type="number"
                    value={dipendenteInModifica?.ore_contratto || ''}
                    onChange={(e) => setDipendenteInModifica({ ...dipendenteInModifica, ore_contratto: e.target.value })}
                    placeholder="Es. 40"
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={modificaDipendente} disabled={loading} className="bg-white text-red-800 hover:bg-white/90">
                    <Save className="w-4 h-4 mr-2" />
                    Salva Modifiche
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setDialogOpen({ ...dialogOpen, modificaDipendente: false });
                    setDipendenteInModifica(null);
                  }}
                          className="border-white/20 text-white hover:bg-white/10">
                    <X className="w-4 h-4 mr-2" />
                    Annulla
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid gap-4">
            {dipendenti.map(dipendente => (
              <Card key={dipendente.id} className="bg-white/10 border-white/20">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-white">{dipendente.nome}</h4>
                    <p className="text-white/70">Ore contratto: {dipendente.ore_contratto}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => apriModificaDipendente(dipendente)}
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => eliminaDipendente(dipendente.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab Settimane */}
        <TabsContent value="settimane" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-white">Settimane Lavorative</h3>
            <Dialog open={dialogOpen.settimana} onOpenChange={(open) => 
              setDialogOpen({ ...dialogOpen, settimana: open })}>
              <DialogTrigger asChild>
                <Button className="bg-white text-red-800 hover:bg-white/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Crea Settimana
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-red-900 text-white border-white/20">
                <DialogHeader>
                  <DialogTitle>Nuova Settimana Lavorativa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Seleziona Data</Label>
                    <Dialog open={dialogOpen.calendario} onOpenChange={(open) => 
                      setDialogOpen({ ...dialogOpen, calendario: open })}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start bg-white/10 border-white/20 text-white hover:bg-white/20">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataSelezionata ? format(dataSelezionata, 'dd/MM/yyyy', { locale: it }) : 'Seleziona una data'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-red-900 text-white border-white/20">
                        <DialogHeader>
                          <DialogTitle>Seleziona Data per Settimana</DialogTitle>
                        </DialogHeader>
                        <Calendar
                          mode="single"
                          selected={dataSelezionata}
                          onSelect={selezionaDataECreaSettimana}
                          fromDate={new Date('2024-01-01')}
                          toYear={new Date().getFullYear() + 2}
                          locale={it}
                          initialFocus
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  {nuovaSettimana.nome && (
                    <>
                      <div>
                        <Label>Nome Settimana</Label>
                        <Input
                          value={nuovaSettimana.nome}
                          onChange={(e) => setNuovaSettimana({ ...nuovaSettimana, nome: e.target.value })}
                          className="bg-white/10 border-white/20 text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Data Inizio (Lunedì)</Label>
                          <Input
                            value={nuovaSettimana.inizio ? format(nuovaSettimana.inizio, 'dd/MM/yyyy', { locale: it }) : ''}
                            disabled
                            className="bg-white/5 border-white/10 text-white/70"
                          />
                        </div>
                        <div>
                          <Label>Data Fine (Domenica)</Label>
                          <Input
                            value={nuovaSettimana.fine ? format(nuovaSettimana.fine, 'dd/MM/yyyy', { locale: it }) : ''}
                            disabled
                            className="bg-white/5 border-white/10 text-white/70"
                          />
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="flex gap-2">
                    <Button onClick={aggiungiSettimana} disabled={loading || !nuovaSettimana.nome} className="bg-white text-red-800 hover:bg-white/90">
                      <Save className="w-4 h-4 mr-2" />
                      Crea
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setDialogOpen({ ...dialogOpen, settimana: false });
                      setNuovaSettimana({ nome: '', inizio: null, fine: null });
                      setDataSelezionata(null);
                    }}
                            className="border-white/20 text-white hover:bg-white/10">
                      <X className="w-4 h-4 mr-2" />
                      Annulla
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {settimane.map(settimana => (
              <Card key={settimana.id} className="bg-white/10 border-white/20">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-white">{settimana.nome}</h4>
                  <p className="text-white/70">
                    Dal {format(new Date(settimana.inizio), 'dd/MM/yyyy', { locale: it })} al {format(new Date(settimana.fine), 'dd/MM/yyyy', { locale: it })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab Orari Settimanali */}
        <TabsContent value="orari" className="space-y-4">
          <h3 className="text-xl font-semibold text-white">Gestione Orari Settimanali</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white">Settimana</Label>
              <Select value={settimanaSelezionata} onValueChange={setSettimanaSelezionata}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Seleziona settimana" />
                </SelectTrigger>
                <SelectContent>
                  {settimane.map(settimana => (
                    <SelectItem key={settimana.id} value={settimana.id}>
                      {settimana.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white">Dipendente</Label>
              <Select value={dipendenteSelezionato} onValueChange={setDipendenteSelezionato}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Seleziona dipendente" />
                </SelectTrigger>
                <SelectContent>
                  {dipendenti.map(dipendente => (
                    <SelectItem key={dipendente.id} value={dipendente.id}>
                      {dipendente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {settimanaSelezionata && dipendenteSelezionato && (
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Orari Settimanali</CardTitle>
                <CardDescription className="text-white/70">
                  Configura gli orari da lunedì a domenica (formato HH:MM)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {giorni.map((giorno, index) => (
                  <div key={giorno} className="p-4 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-white font-medium flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        {giorniLabels[index]}
                      </h4>
                      <div className="text-white/70 text-sm">
                        Totale: <span className="font-semibold">{calcoliGiornalieri[giorno] || 0}h</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Turno Mattino */}
                      <div className="space-y-2">
                        <Label className="text-white text-sm">Mattino</Label>
                        {renderTurnoRiposo(orariSettimana[giorno]?.mattino_tipo, 'mattino') ? (
                          <div className="p-3 bg-gray-600/30 rounded text-white text-center font-semibold">
                            {renderTurnoRiposo(orariSettimana[giorno]?.mattino_tipo, 'mattino')}
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2">
                            {/* Ora Inizio */}
                            <Select 
                              value={parseOrario(orariSettimana[giorno]?.mattino_inizio || '06:00').ora}
                              onValueChange={(value) => {
                                const { minuti } = parseOrario(orariSettimana[giorno]?.mattino_inizio || '06:00');
                                updateOrarioTurno(giorno, 'mattino_inizio', formatOrario(value, minuti));
                              }}
                            >
                              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {oreOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Minuti Inizio */}
                            <Select 
                              value={parseOrario(orariSettimana[giorno]?.mattino_inizio || '06:00').minuti}
                              onValueChange={(value) => {
                                const { ora } = parseOrario(orariSettimana[giorno]?.mattino_inizio || '06:00');
                                updateOrarioTurno(giorno, 'mattino_inizio', formatOrario(ora, value));
                              }}
                            >
                              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {minutiOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Ora Fine */}
                            <Select 
                              value={parseOrario(orariSettimana[giorno]?.mattino_fine || '06:00').ora}
                              onValueChange={(value) => {
                                const { minuti } = parseOrario(orariSettimana[giorno]?.mattino_fine || '06:00');
                                updateOrarioTurno(giorno, 'mattino_fine', formatOrario(value, minuti));
                              }}
                            >
                              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {oreOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Minuti Fine */}
                            <Select 
                              value={parseOrario(orariSettimana[giorno]?.mattino_fine || '06:00').minuti}
                              onValueChange={(value) => {
                                const { ora } = parseOrario(orariSettimana[giorno]?.mattino_fine || '06:00');
                                updateOrarioTurno(giorno, 'mattino_fine', formatOrario(ora, value));
                              }}
                            >
                              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {minutiOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        <Select 
                          value={orariSettimana[giorno]?.mattino_tipo || 'ordinarie'}
                          onValueChange={(value) => updateOrarioTurno(giorno, 'mattino_tipo', value)}
                        >
                          <SelectTrigger className="bg-white/10 border-white/20 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {tipoOrarioOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Turno Pomeriggio */}
                      <div className="space-y-2">
                        <Label className="text-white text-sm">Pomeriggio</Label>
                        {renderTurnoRiposo(orariSettimana[giorno]?.pomeriggio_tipo, 'pomeriggio') ? (
                          <div className="p-3 bg-gray-600/30 rounded text-white text-center font-semibold">
                            {renderTurnoRiposo(orariSettimana[giorno]?.pomeriggio_tipo, 'pomeriggio')}
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2">
                            {/* Ora Inizio */}
                            <Select 
                              value={parseOrario(orariSettimana[giorno]?.pomeriggio_inizio || '14:00').ora}
                              onValueChange={(value) => {
                                const { minuti } = parseOrario(orariSettimana[giorno]?.pomeriggio_inizio || '14:00');
                                updateOrarioTurno(giorno, 'pomeriggio_inizio', formatOrario(value, minuti));
                              }}
                            >
                              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {oreOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Minuti Inizio */}
                            <Select 
                              value={parseOrario(orariSettimana[giorno]?.pomeriggio_inizio || '14:00').minuti}
                              onValueChange={(value) => {
                                const { ora } = parseOrario(orariSettimana[giorno]?.pomeriggio_inizio || '14:00');
                                updateOrarioTurno(giorno, 'pomeriggio_inizio', formatOrario(ora, value));
                              }}
                            >
                              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {minutiOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Ora Fine */}
                            <Select 
                              value={parseOrario(orariSettimana[giorno]?.pomeriggio_fine || '14:00').ora}
                              onValueChange={(value) => {
                                const { minuti } = parseOrario(orariSettimana[giorno]?.pomeriggio_fine || '14:00');
                                updateOrarioTurno(giorno, 'pomeriggio_fine', formatOrario(value, minuti));
                              }}
                            >
                              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {oreOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Minuti Fine */}
                            <Select 
                              value={parseOrario(orariSettimana[giorno]?.pomeriggio_fine || '14:00').minuti}
                              onValueChange={(value) => {
                                const { ora } = parseOrario(orariSettimana[giorno]?.pomeriggio_fine || '14:00');
                                updateOrarioTurno(giorno, 'pomeriggio_fine', formatOrario(ora, value));
                              }}
                            >
                              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {minutiOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        <Select 
                          value={orariSettimana[giorno]?.pomeriggio_tipo || 'ordinarie'}
                          onValueChange={(value) => updateOrarioTurno(giorno, 'pomeriggio_tipo', value)}
                        >
                          <SelectTrigger className="bg-white/10 border-white/20 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {tipoOrarioOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Tabella Riassuntiva */}
                {calcoliOrari && (
                  <Card className="bg-white/5 border-white/10 mt-6">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">Resoconto Ore</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-green-600/20 p-4 rounded-lg border border-green-600/30">
                          <div className="text-green-300 text-sm font-medium">Ore Ordinarie</div>
                          <div className="text-white text-2xl font-bold">{calcoliOrari.ore_ordinarie}h</div>
                        </div>
                        
                        <div className="bg-yellow-600/20 p-4 rounded-lg border border-yellow-600/30">
                          <div className="text-yellow-300 text-sm font-medium">Ore Mutua</div>
                          <div className="text-white text-2xl font-bold">{calcoliOrari.ore_mutua}h</div>
                        </div>
                        
                        <div className="bg-blue-600/20 p-4 rounded-lg border border-blue-600/30">
                          <div className="text-blue-300 text-sm font-medium">Ore Ferie</div>
                          <div className="text-white text-2xl font-bold">{calcoliOrari.ore_ferie}h</div>
                        </div>
                        
                        <div className="bg-purple-600/20 p-4 rounded-lg border border-purple-600/30">
                          <div className="text-purple-300 text-sm font-medium">Ore Straordinario</div>
                          <div className="text-white text-2xl font-bold">{calcoliOrari.ore_straordinario}h</div>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-white/5 rounded-lg">
                        <div className="flex justify-between items-center text-white">
                          <span>Ore Totali Lavorate:</span>
                          <span className="font-bold text-xl">{calcoliOrari.ore_totali_lavorate}h</span>
                        </div>
                        <div className="flex justify-between items-center text-white/70 mt-1">
                          <span>Ore Contratto:</span>
                          <span>{calcoliOrari.ore_contratto}h</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <div className="flex justify-end">
                  <Button 
                    onClick={salvaOrariSettimana} 
                    disabled={loading}
                    className="bg-white text-red-800 hover:bg-white/90"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? 'Salvataggio...' : 'Salva Orari'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Guide */}
        <TabsContent value="guide" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-white">Gestione Guide per Reparto</h3>
            <Dialog open={dialogOpen.guida} onOpenChange={(open) => 
              setDialogOpen({ ...dialogOpen, guida: open })}>
              <DialogTrigger asChild>
                <Button className="bg-white text-red-800 hover:bg-white/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Guida
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-red-900 text-white border-white/20 max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nuova Guida</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Reparto</Label>
                    <Select value={nuovaGuida.categoria} onValueChange={(value) => setNuovaGuida({ ...nuovaGuida, categoria: value })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Seleziona reparto" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categorieGuide).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Titolo</Label>
                    <Input
                      value={nuovaGuida.titolo}
                      onChange={(e) => setNuovaGuida({ ...nuovaGuida, titolo: e.target.value })}
                      placeholder="Es. Procedure di apertura cassa"
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div>
                    <Label>Contenuto</Label>
                    <Textarea
                      value={nuovaGuida.contenuto}
                      onChange={(e) => setNuovaGuida({ ...nuovaGuida, contenuto: e.target.value })}
                      placeholder="Inserisci il contenuto della guida..."
                      rows={6}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={aggiungiGuida} disabled={loading} className="bg-white text-red-800 hover:bg-white/90">
                      <Save className="w-4 h-4 mr-2" />
                      Salva
                    </Button>
                    <Button variant="outline" onClick={() => setDialogOpen({ ...dialogOpen, guida: false })}
                            className="border-white/20 text-white hover:bg-white/10">
                      <X className="w-4 h-4 mr-2" />
                      Annulla
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Guide organizzate per categoria */}
          <div className="space-y-6">
            {Object.entries(categorieGuide).map(([categoria, labelCategoria]) => {
              const guideCategoria = guide.filter(g => g.categoria === categoria);
              return (
                <Card key={categoria} className="bg-white/10 border-white/20">
                  <CardHeader>
                    <CardTitle className="text-white">{labelCategoria}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {guideCategoria.length > 0 ? (
                      <div className="space-y-3">
                        {guideCategoria.map(guida => (
                          <div key={guida.id} className="p-3 bg-white/5 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-white">{guida.titolo}</h4>
                              <Button
                                onClick={() => eliminaGuida(guida.id)}
                                variant="destructive"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-white/70 text-sm whitespace-pre-wrap">{guida.contenuto}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-white/50 text-center py-4">Nessuna guida disponibile per questo reparto</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab Configurazione */}
        <TabsContent value="config" className="space-y-4">
          <h3 className="text-xl font-semibold text-white">Configurazione Sistema</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Codici di Accesso */}
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Codici di Accesso</CardTitle>
                <CardDescription className="text-white/70">
                  Modifica i codici PIN per admin e utenti
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-white/80 text-sm">
                    Admin: {config.admin_code} | Utente: {config.user_code}
                  </p>
                  <Dialog open={dialogOpen.codici} onOpenChange={(open) => 
                    setDialogOpen({ ...dialogOpen, codici: open })}>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-white text-red-800 hover:bg-white/90">
                        <Edit className="w-4 h-4 mr-2" />
                        Modifica Codici
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-red-900 text-white border-white/20">
                      <DialogHeader>
                        <DialogTitle>Modifica Codici di Accesso</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Codice Admin</Label>
                          <Input
                            type="password"
                            value={nuoviCodici.admin_code}
                            onChange={(e) => setNuoviCodici({ ...nuoviCodici, admin_code: e.target.value })}
                            className="bg-white/10 border-white/20 text-white"
                          />
                        </div>
                        <div>
                          <Label>Codice Utente</Label>
                          <Input
                            type="password"
                            value={nuoviCodici.user_code}
                            onChange={(e) => setNuoviCodici({ ...nuoviCodici, user_code: e.target.value })}
                            className="bg-white/10 border-white/20 text-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={aggiornaCodici} disabled={loading} className="bg-white text-red-800 hover:bg-white/90">
                            <Save className="w-4 h-4 mr-2" />
                            Salva
                          </Button>
                          <Button variant="outline" onClick={() => setDialogOpen({ ...dialogOpen, codici: false })}
                                  className="border-white/20 text-white hover:bg-white/10">
                            <X className="w-4 h-4 mr-2" />
                            Annulla
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Personalizzazione Colori */}
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Colori Tema</CardTitle>
                <CardDescription className="text-white/70">
                  Personalizza i colori dell'interfaccia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <div 
                      className="w-6 h-6 rounded border border-white/20" 
                      style={{ backgroundColor: config.background_color }}
                    ></div>
                    <span className="text-white/80 text-sm">Sfondo attuale</span>
                  </div>
                  <Dialog open={dialogOpen.colori} onOpenChange={(open) => 
                    setDialogOpen({ ...dialogOpen, colori: open })}>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-white text-red-800 hover:bg-white/90">
                        <Edit className="w-4 h-4 mr-2" />
                        Modifica Colori
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-red-900 text-white border-white/20">
                      <DialogHeader>
                        <DialogTitle>Modifica Colori</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Colore Sfondo</Label>
                          <Input
                            type="color"
                            value={nuoviColori.background_color}
                            onChange={(e) => setNuoviColori({ ...nuoviColori, background_color: e.target.value })}
                            className="h-12 bg-white/10 border-white/20"
                          />
                        </div>
                        <div>
                          <Label>Colore Testo</Label>
                          <Input
                            type="color"
                            value={nuoviColori.text_color}
                            onChange={(e) => setNuoviColori({ ...nuoviColori, text_color: e.target.value })}
                            className="h-12 bg-white/10 border-white/20"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={aggiornaColori} disabled={loading} className="bg-white text-red-800 hover:bg-white/90">
                            <Save className="w-4 h-4 mr-2" />
                            Salva
                          </Button>
                          <Button variant="outline" onClick={() => setDialogOpen({ ...dialogOpen, colori: false })}
                                  className="border-white/20 text-white hover:bg-white/10">
                            <X className="w-4 h-4 mr-2" />
                            Annulla
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;