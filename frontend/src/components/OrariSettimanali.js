import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OrariSettimanali = () => {
  const [dipendenti, setDipendenti] = useState([]);
  const [settimane, setSettimane] = useState([]);
  const [dipendenteSelezionato, setDipendenteSelezionato] = useState('');
  const [settimanaSelezionata, setSettimanaSelezionata] = useState('');
  const [orariSettimana, setOrariSettimana] = useState([]);
  const [calcoli, setCalcoli] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (dipendenteSelezionato && settimanaSelezionata) {
      loadOrariECalcoli();
    }
  }, [dipendenteSelezionato, settimanaSelezionata]);

  const loadInitialData = async () => {
    try {
      const [dipRes, settRes] = await Promise.all([
        axios.get(`${API}/dipendenti`),
        axios.get(`${API}/settimane`)
      ]);
      
      setDipendenti(dipRes.data);
      setSettimane(settRes.data);
      
      // Seleziona automaticamente il primo dipendente e settimana se disponibili
      if (dipRes.data.length > 0) {
        setDipendenteSelezionato(dipRes.data[0].id);
      }
      if (settRes.data.length > 0) {
        setSettimanaSelezionata(settRes.data[0].id);
      }
    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
      toast.error('Errore nel caricamento dati');
    }
  };

  const loadOrariECalcoli = async () => {
    try {
      setLoading(true);
      
      // Carica la settimana completa per ottenere gli orari
      const settimanaResponse = await axios.get(`${API}/settimane`);
      const settimana = settimanaResponse.data.find(s => s.id === settimanaSelezionata);
      
      if (settimana && settimana.orari && settimana.orari[dipendenteSelezionato]) {
        const orariDipendente = settimana.orari[dipendenteSelezionato];
        // Converti la nuova struttura da giorni/turni a lista orari per visualizzazione
        const orariCompatibili = [];
        const giorni = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
        const giornoLabels = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
        
        giorni.forEach((giorno, index) => {
          const turni = orariDipendente[giorno];
          
          // Sempre mostra il giorno, anche se è riposo
          let orarioGiornaliero = {
            giorno: new Date(new Date(settimana.inizio).getTime() + index * 24 * 60 * 60 * 1000),
            giornoLabel: giornoLabels[index],
            turni: []
          };
          
          if (turni && typeof turni === 'object') {
            // Mattino
            const mattinoTipo = turni.mattino_tipo || 'ordinarie';
            if (mattinoTipo === 'riposo_mattino') {
              orarioGiornaliero.turni.push({
                turno: 'Mattino',
                tipo: 'riposo',
                orario: 'Riposo',
                ore: 0
              });
            } else {
              const mattinoInizio = turni.mattino_inizio || '06:00';
              const mattinoFine = turni.mattino_fine || '06:00';
              const oreMattinoCalcolate = calcolaOreDaOrari(mattinoInizio, mattinoFine);
              
              orarioGiornaliero.turni.push({
                turno: 'Mattino',
                tipo: mattinoTipo,
                orario: oreMattinoCalcolate > 0 ? `${mattinoInizio} - ${mattinoFine}` : 'Non programmato',
                ore: oreMattinoCalcolate
              });
            }
            
            // Pomeriggio
            const pomeriggioTipo = turni.pomeriggio_tipo || 'ordinarie';
            if (pomeriggioTipo === 'riposo_pomeriggio') {
              orarioGiornaliero.turni.push({
                turno: 'Pomeriggio',
                tipo: 'riposo',
                orario: 'Riposo',
                ore: 0
              });
            } else {
              const pomeriggioInizio = turni.pomeriggio_inizio || '14:00';
              const pomeriggioFine = turni.pomeriggio_fine || '14:00';
              const orePomeriggioCalcolate = calcolaOreDaOrari(pomeriggioInizio, pomeriggioFine);
              
              orarioGiornaliero.turni.push({
                turno: 'Pomeriggio',
                tipo: pomeriggioTipo,
                orario: orePomeriggioCalcolate > 0 ? `${pomeriggioInizio} - ${pomeriggioFine}` : 'Non programmato',
                ore: orePomeriggioCalcolate
              });
            }
          } else {
            // Se non ci sono turni definiti, mostra "Non programmato"
            orarioGiornaliero.turni.push({
              turno: 'Mattino',
              tipo: 'non_programmato',
              orario: 'Non programmato',
              ore: 0
            });
            orarioGiornaliero.turni.push({
              turno: 'Pomeriggio',
              tipo: 'non_programmato',
              orario: 'Non programmato',
              ore: 0
            });
          }
          
          orariCompatibili.push(orarioGiornaliero);
        });
        
        setOrariSettimana(orariCompatibili);
        
        // Carica i calcoli
        const calcoliResponse = await axios.get(`${API}/settimane/${settimanaSelezionata}/calcoli/${dipendenteSelezionato}`);
        setCalcoli(calcoliResponse.data);
      } else {
        // Se non ci sono orari programmati, crea comunque la struttura vuota per tutti i giorni
        const giorni = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
        const giornoLabels = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
        const orariVuoti = [];
        
        giorni.forEach((giorno, index) => {
          orariVuoti.push({
            giorno: settimana ? new Date(new Date(settimana.inizio).getTime() + index * 24 * 60 * 60 * 1000) : new Date(),
            giornoLabel: giornoLabels[index],
            turni: [
              {
                turno: 'Mattino',
                tipo: 'non_programmato',
                orario: 'Non programmato',
                ore: 0
              },
              {
                turno: 'Pomeriggio',
                tipo: 'non_programmato',
                orario: 'Non programmato',
                ore: 0
              }
            ]
          });
        });
        
        setOrariSettimana(orariVuoti);
        setCalcoli(null);
      }
    } catch (error) {
      console.error('Errore nel caricamento orari:', error);
      setOrariSettimana([]);
      setCalcoli(null);
    } finally {
      setLoading(false);
    }
  };

  const calcolaOreDaOrari = (inizio, fine) => {
    try {
      const [hInizio, mInizio] = inizio.split(':').map(Number);
      const [hFine, mFine] = fine.split(':').map(Number);
      
      let minutiInizio = hInizio * 60 + mInizio;
      let minutiFine = hFine * 60 + mFine;
      
      if (minutiFine <= minutiInizio) {
        minutiFine += 24 * 60;
      }
      
      return ((minutiFine - minutiInizio) / 60);
    } catch (error) {
      return 0;
    }
  };

  const getTipoColor = (tipo) => {
    switch (tipo) {
      case 'ordinarie':
        return 'bg-green-600 text-white';
      case 'mutua':
        return 'bg-yellow-600 text-white';
      case 'ferie':
        return 'bg-blue-600 text-white';
      case 'riposo':
        return 'bg-gray-600 text-white';
      case 'non_programmato':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getTipoText = (tipo) => {
    switch (tipo) {
      case 'ordinarie':
        return 'Ordinarie';
      case 'mutua':
        return 'Mutua';
      case 'ferie':
        return 'Ferie';
      case 'riposo':
        return 'Riposo';
      case 'non_programmato':
        return 'Non programmato';
      default:
        return tipo;
    }
  };

  const dipendenteCorrente = dipendenti.find(d => d.id === dipendenteSelezionato);
  const settimanaCorrente = settimane.find(s => s.id === settimanaSelezionata);

  return (
    <div className="space-y-6">
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Orari Settimanali</CardTitle>
          <CardDescription className="text-white/70">
            Visualizza i tuoi orari di lavoro settimanali
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selettori */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Dipendente</label>
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

            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Settimana Lavorativa</label>
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
          </div>

          {/* Informazioni dipendente */}
          {dipendenteCorrente && (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-white font-semibold">{dipendenteCorrente.nome}</h3>
                    <p className="text-white/70">Ore contratto: {dipendenteCorrente.ore_contratto}</p>
                  </div>
                  {settimanaCorrente && (
                    <div className="text-right">
                      <p className="text-white/70 text-sm">
                        {format(new Date(settimanaCorrente.inizio), 'dd/MM/yyyy', { locale: it })} - {format(new Date(settimanaCorrente.fine), 'dd/MM/yyyy', { locale: it })}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="text-white/70">Caricamento orari...</div>
            </div>
          ) : (
            <>
              {/* Tabella Orari */}
              {orariSettimana.length > 0 ? (
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Orari della Settimana</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {orariSettimana.map((giornoData, index) => {
                        const totaleGiorno = giornoData.turni.reduce((sum, turno) => sum + turno.ore, 0);
                        
                        return (
                          <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-white font-semibold text-lg">{giornoData.giornoLabel}</h4>
                              <div className="text-white/70">
                                <span className="text-sm">Totale giorno: </span>
                                <span className="font-bold text-lg">{totaleGiorno}h</span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {giornoData.turni.map((turno, turnoIndex) => (
                                <div key={turnoIndex} className="flex items-center justify-between p-3 bg-white/10 rounded">
                                  <div className="flex items-center gap-3">
                                    <div className="text-white font-medium min-w-[80px]">
                                      {turno.turno}
                                    </div>
                                    <div className="text-white/80 text-sm">
                                      {turno.orario}
                                    </div>
                                    {turno.tipo !== 'riposo' && turno.tipo !== 'non_programmato' && (
                                      <Badge className={getTipoColor(turno.tipo)}>
                                        {getTipoText(turno.tipo)}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-white font-semibold">
                                    {turno.ore > 0 ? `${turno.ore}h` : '-'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-8 text-center">
                    <p className="text-white/70">Seleziona un dipendente e una settimana per visualizzare gli orari</p>
                  </CardContent>
                </Card>
              )}

              {/* Resoconto Ore Settimanale */}
              {calcoli && (
                <Card className="bg-white/5 border-white/10 mt-6">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Resoconto Ore Settimanale</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-green-600/20 p-4 rounded-lg border border-green-600/30">
                        <div className="text-green-300 text-sm font-medium">Ore Ordinarie</div>
                        <div className="text-white text-2xl font-bold">{calcoli.ore_ordinarie}h</div>
                      </div>
                      
                      <div className="bg-yellow-600/20 p-4 rounded-lg border border-yellow-600/30">
                        <div className="text-yellow-300 text-sm font-medium">Ore Mutua</div>
                        <div className="text-white text-2xl font-bold">{calcoli.ore_mutua}h</div>
                      </div>
                      
                      <div className="bg-blue-600/20 p-4 rounded-lg border border-blue-600/30">
                        <div className="text-blue-300 text-sm font-medium">Ore Ferie</div>
                        <div className="text-white text-2xl font-bold">{calcoli.ore_ferie}h</div>
                      </div>
                      
                      <div className="bg-purple-600/20 p-4 rounded-lg border border-purple-600/30">
                        <div className="text-purple-300 text-sm font-medium">Ore Straordinario</div>
                        <div className="text-white text-2xl font-bold">{calcoli.ore_straordinario}h</div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-white/5 rounded-lg">
                      <div className="flex justify-between items-center text-white">
                        <span>Ore Totali Lavorate:</span>
                        <span className="font-bold text-xl">{calcoli.ore_totali_lavorate}h</span>
                      </div>
                      <div className="flex justify-between items-center text-white/70 mt-1">
                        <span>Ore Contratto:</span>
                        <span>{calcoli.ore_contratto}h</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Resoconto Ore */}
              {calcoli && (
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Resoconto Ore</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-green-600/20 p-4 rounded-lg border border-green-600/30">
                        <div className="text-green-300 text-sm font-medium">Ore Ordinarie</div>
                        <div className="text-white text-2xl font-bold">{calcoli.ore_ordinarie}h</div>
                      </div>
                      
                      <div className="bg-yellow-600/20 p-4 rounded-lg border border-yellow-600/30">
                        <div className="text-yellow-300 text-sm font-medium">Ore Mutua</div>
                        <div className="text-white text-2xl font-bold">{calcoli.ore_mutua}h</div>
                      </div>
                      
                      <div className="bg-blue-600/20 p-4 rounded-lg border border-blue-600/30">
                        <div className="text-blue-300 text-sm font-medium">Ore Ferie</div>
                        <div className="text-white text-2xl font-bold">{calcoli.ore_ferie}h</div>
                      </div>
                      
                      <div className="bg-purple-600/20 p-4 rounded-lg border border-purple-600/30">
                        <div className="text-purple-300 text-sm font-medium">Ore Straordinario</div>
                        <div className="text-white text-2xl font-bold">{calcoli.ore_straordinario}h</div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-white/5 rounded-lg">
                      <div className="flex justify-between items-center text-white">
                        <span>Ore Totali Lavorate:</span>
                        <span className="font-bold text-xl">{calcoli.ore_totali_lavorate}h</span>
                      </div>
                      <div className="flex justify-between items-center text-white/70 mt-1">
                        <span>Ore Contratto:</span>
                        <span>{calcoli.ore_contratto}h</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrariSettimanali;