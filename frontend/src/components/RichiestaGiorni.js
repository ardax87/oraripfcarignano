import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RichiestaGiorni = ({ userType = 'user' }) => {
  const [dipendenti, setDipendenti] = useState([]);
  const [richieste, setRichieste] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [nuovaRichiesta, setNuovaRichiesta] = useState({
    dipendente_nome: '',
    giorno: null,
    fascia: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dipRes, richRes] = await Promise.all([
        axios.get(`${API}/dipendenti`),
        axios.get(`${API}/richieste`)
      ]);
      
      setDipendenti(dipRes.data);
      setRichieste(richRes.data);
    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
      toast.error('Errore nel caricamento dati');
    }
  };

  const inviaRichiesta = async () => {
    if (!nuovaRichiesta.dipendente_nome || !nuovaRichiesta.giorno || !nuovaRichiesta.fascia) {
      toast.error('Compila tutti i campi');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API}/richieste`, {
        dipendente_nome: nuovaRichiesta.dipendente_nome,
        giorno: format(nuovaRichiesta.giorno, 'yyyy-MM-dd'),
        fascia: nuovaRichiesta.fascia
      });
      
      setRichieste([...richieste, response.data]);
      setNuovaRichiesta({
        dipendente_nome: '',
        giorno: null,
        fascia: ''
      });
      
      toast.success('Richiesta inviata con successo');
    } catch (error) {
      console.error('Errore nell\'invio della richiesta:', error);
      toast.error('Errore nell\'invio della richiesta');
    } finally {
      setLoading(false);
    }
  };

  const eliminaRichiesta = async (id) => {
    try {
      await axios.delete(`${API}/richieste/${id}`);
      setRichieste(richieste.filter(r => r.id !== id));
      toast.success('Richiesta eliminata');
    } catch (error) {
      console.error('Errore nell\'eliminazione:', error);
      toast.error('Errore nell\'eliminazione della richiesta');
    }
  };

  const getFasciaText = (fascia) => {
    switch (fascia) {
      case 'mattino':
        return 'Mattino';
      case 'pomeriggio':
        return 'Pomeriggio';
      case 'giorno':
        return 'Giorno Intero';
      default:
        return fascia;
    }
  };

  const getFasciaColor = (fascia) => {
    switch (fascia) {
      case 'mattino':
        return 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30';
      case 'pomeriggio':
        return 'bg-orange-600/20 text-orange-300 border-orange-600/30';
      case 'giorno':
        return 'bg-red-600/20 text-red-300 border-red-600/30';
      default:
        return 'bg-gray-600/20 text-gray-300 border-gray-600/30';
    }
  };

  // Ordina le richieste per data (più recenti prima)
  const richiesteOrdinate = [...richieste].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="space-y-6">
      {/* Form per Nuova Richiesta */}
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Richiesta Giorni</CardTitle>
          <CardDescription className="text-white/70">
            Richiedi giorni di ferie, malattia o permesso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Selezione Dipendente */}
            <div className="space-y-2">
              <Label className="text-white">Nome Dipendente</Label>
              <Select 
                value={nuovaRichiesta.dipendente_nome} 
                onValueChange={(value) => setNuovaRichiesta({ ...nuovaRichiesta, dipendente_nome: value })}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Seleziona dipendente" />
                </SelectTrigger>
                <SelectContent>
                  {dipendenti.map(dipendente => (
                    <SelectItem key={dipendente.id} value={dipendente.nome}>
                      {dipendente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selezione Giorno */}
            <div className="space-y-2">
              <Label className="text-white">Giorno</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {nuovaRichiesta.giorno 
                      ? format(nuovaRichiesta.giorno, 'dd/MM/yyyy', { locale: it }) 
                      : 'Seleziona giorno'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={nuovaRichiesta.giorno}
                    onSelect={(date) => setNuovaRichiesta({ ...nuovaRichiesta, giorno: date })}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                    fromDate={new Date()}
                    toYear={new Date().getFullYear() + 2}
                    locale={it}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Selezione Fascia */}
            <div className="space-y-2">
              <Label className="text-white">Fascia</Label>
              <Select 
                value={nuovaRichiesta.fascia} 
                onValueChange={(value) => setNuovaRichiesta({ ...nuovaRichiesta, fascia: value })}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Seleziona fascia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mattino">Mattino</SelectItem>
                  <SelectItem value="pomeriggio">Pomeriggio</SelectItem>
                  <SelectItem value="giorno">Giorno Intero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={inviaRichiesta} 
            disabled={loading}
            className="w-full bg-white text-red-800 hover:bg-white/90"
            data-testid="submit-request-btn"
          >
            {loading ? 'Invio in corso...' : 'Invia Richiesta'}
          </Button>
        </CardContent>
      </Card>

      {/* Elenco Richieste */}
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Richieste Inviate</CardTitle>
          <CardDescription className="text-white/70">
            Elenco di tutte le richieste effettuate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {richiesteOrdinate.length > 0 ? (
            <div className="space-y-3">
              {richiesteOrdinate.map(richiesta => (
                <div 
                  key={richiesta.id} 
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                  data-testid={`request-item-${richiesta.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <h4 className="font-semibold text-white">{richiesta.dipendente_nome}</h4>
                      <p className="text-white/70 text-sm">
                        {format(new Date(richiesta.giorno), 'EEEE dd MMMM yyyy', { locale: it })}
                      </p>
                    </div>
                    
                    <div className={`px-3 py-1 rounded-full border ${getFasciaColor(richiesta.fascia)}`}>
                      <span className="text-sm font-medium">
                        {getFasciaText(richiesta.fascia)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-white/50 text-xs">
                        Richiesto il {format(new Date(richiesta.created_at), 'dd/MM/yyyy', { locale: it })}
                      </p>
                      <p className="text-white/50 text-xs">
                        alle {format(new Date(richiesta.created_at), 'HH:mm', { locale: it })}
                      </p>
                    </div>
                    
                    {userType === 'admin' && (
                      <Button
                        onClick={() => eliminaRichiesta(richiesta.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-300 hover:text-red-100 hover:bg-red-600/20"
                        data-testid={`delete-request-${richiesta.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-white/70">Nessuna richiesta effettuata</p>
              <p className="text-white/50 text-sm mt-2">
                Le tue richieste appariranno qui dopo l'invio
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RichiestaGiorni;