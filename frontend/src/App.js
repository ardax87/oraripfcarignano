import React, { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

// Import components
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';

// Import section components
import AdminPanelComponent from './components/AdminPanel';
import OrariSettimanaliComponent from './components/OrariSettimanali';
import RichiestaGiorniComponent from './components/RichiestaGiorni';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Context per gestire l'autenticazione
const AuthContext = React.createContext();

// Hook per usare il contesto
const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Provider per l'autenticazione
const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState('');
  const [config, setConfig] = useState({
    background_color: '#8B0000',
    text_color: '#FFFFFF'
  });

  const login = (type) => {
    setIsAuthenticated(true);
    setUserType(type);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', type);
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserType('');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userType');
  };

  const loadConfig = async () => {
    try {
      const response = await axios.get(`${API}/config`);
      setConfig(response.data);
    } catch (error) {
      console.error('Errore nel caricamento configurazione:', error);
    }
  };

  useEffect(() => {
    const storedAuth = localStorage.getItem('isAuthenticated');
    const storedUserType = localStorage.getItem('userType');
    if (storedAuth === 'true' && storedUserType) {
      setIsAuthenticated(true);
      setUserType(storedUserType);
    }
    loadConfig();
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      userType,
      config,
      login,
      logout,
      loadConfig
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Componente Home/Login
const HomePage = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, config } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error('Inserisci il codice');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/login`, { code });
      
      if (response.data.success) {
        login(response.data.user_type);
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error('Errore durante il login');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4"
      style={{ 
        backgroundColor: config.background_color,
        color: config.text_color
      }}
    >
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img 
            src="https://prestofresco.it/wp-content/uploads/2022/08/logo-presto-fresco.png"
            alt="Logo Presto Fresco"
            className="mx-auto h-24 w-auto mb-6"
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Punto vendita: CARIGNANO</h1>
            <h2 className="text-xl">Benvenuti nel pannello orari</h2>
            <p className="text-lg opacity-90">Inserite il pin che vi è stato fornito</p>
          </div>
        </div>

        <Card className="bg-white/10 border-white/20">
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                placeholder="Inserisci codice PIN"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-xl py-3 bg-white/20 border-white/30 text-white placeholder:text-white/70"
                maxLength={10}
              />
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 text-lg font-semibold bg-white text-red-800 hover:bg-white/90"
              >
                {loading ? 'Accesso...' : 'ENTRA'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Navbar per navigazione
const Navbar = () => {
  const { userType, logout, config } = useAuth();

  return (
    <div 
      className="bg-white/10 backdrop-blur-sm p-4 mb-6"
      style={{ backgroundColor: `${config.background_color}CC` }}
    >
      <div className="flex justify-between items-center max-w-4xl mx-auto">
        <h1 className="text-xl font-bold text-white">
          {userType === 'admin' ? 'Pannello Amministratore' : 'Pannello Dipendente'}
        </h1>
        <Button 
          onClick={logout}
          variant="outline"
          className="text-white border-white/50 hover:bg-white/20"
        >
          Esci
        </Button>
      </div>
    </div>
  );
};

// Menu principale
const MainMenu = () => {
  const { userType, config } = useAuth();
  const [currentSection, setCurrentSection] = useState('menu');

  const menuItems = [
    { id: 'orari', title: 'Orari Settimanali', icon: '📅', available: true },
    { id: 'richieste', title: 'Richiesta Giorni', icon: '📝', available: true },
    { id: 'guide', title: 'Guide', icon: '📚', available: true },
    { id: 'prossimamente', title: 'Prossimamente', icon: '🔜', available: true }
  ];

  if (userType === 'admin') {
    menuItems.unshift({ id: 'admin', title: 'Pannello Admin', icon: '⚙️', available: true });
  }

  if (currentSection !== 'menu') {
    return (
      <div>
        <div className="flex items-center mb-6">
          <Button 
            onClick={() => setCurrentSection('menu')}
            variant="outline"
            className="text-white border-white/50 hover:bg-white/20 mr-4"
          >
            ← Torna al Menu
          </Button>
        </div>
        <SectionContent section={currentSection} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {menuItems.map(item => (
        <Card 
          key={item.id}
          className="bg-white/10 border-white/20 hover:bg-white/20 transition-all cursor-pointer"
          onClick={() => setCurrentSection(item.id)}
        >
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-4">{item.icon}</div>
            <h3 className="text-xl font-semibold text-white">{item.title}</h3>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Contenuto delle sezioni
const SectionContent = ({ section }) => {
  const { config } = useAuth();

  const sections = {
    admin: <AdminPanelComponent />,
    orari: <OrariSettimanaliComponent />,
    richieste: <RichiestaGiorniComponent />,
    guide: <GuideSection />,
    prossimamente: <ProssimamenteSection />
  };

  return (
    <div style={{ color: config.text_color }}>
      {sections[section] || <div>Sezione non trovata</div>}
    </div>
  );
};

// Pannello Admin (implementazione completa)
const AdminPanel = () => {
  return <AdminPanelComponent />;
};

// Sezioni con implementazione completa
const OrariSettimanali = () => <OrariSettimanaliComponent />;

const RichiestaGiorni = () => {
  const { userType } = useAuth();
  return <RichiestaGiorniComponent userType={userType} />;
};

// Sezioni placeholder
const GuideSection = () => {
  const [guide, setGuide] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadGuide();
  }, []);

  const loadGuide = async () => {
    try {
      const response = await axios.get(`${API}/guide`);
      setGuide(response.data);
    } catch (error) {
      console.error('Errore nel caricamento guide:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Guide per Reparto</CardTitle>
          <CardDescription className="text-white/70">
            Consulta le guide e istruzioni per ogni reparto
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-white/70">Caricamento guide...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(categorieGuide).map(([categoria, labelCategoria]) => {
                const guideCategoria = guide.filter(g => g.categoria === categoria);
                return (
                  <Card key={categoria} className="bg-white/5 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">{labelCategoria}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {guideCategoria.length > 0 ? (
                        <div className="space-y-3">
                          {guideCategoria.map(guida => (
                            <Card key={guida.id} className="bg-white/5 border-white/10">
                              <CardHeader>
                                <CardTitle className="text-white text-base">{guida.titolo}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-white/80 whitespace-pre-wrap text-sm">{guida.contenuto}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-white/50 text-center py-4 text-sm">
                          Nessuna guida disponibile per questo reparto
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ProssimamenteSection = () => (
  <Card className="bg-white/10 border-white/20">
    <CardHeader>
      <CardTitle className="text-white">Prossimamente</CardTitle>
      <CardDescription className="text-white/70">
        Nuove funzionalità in arrivo
      </CardDescription>
    </CardHeader>
    <CardContent className="text-center py-12">
      <div className="text-6xl mb-4">🚀</div>
      <h3 className="text-white text-xl font-semibold mb-2">Sezione in Sviluppo</h3>
      <p className="text-white/70">
        Questa sezione sarà presto disponibile con nuove funzionalità!
      </p>
    </CardContent>
  </Card>
);

// Componente principale Dashboard
const Dashboard = () => {
  const { config } = useAuth();

  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: config.background_color }}
    >
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <MainMenu />
      </div>
    </div>
  );
};

// Router principale
function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route path="/login" element={<HomePage />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

// Componente per proteggere le rotte
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <HomePage />;
  }
  
  return children;
};

export default App;