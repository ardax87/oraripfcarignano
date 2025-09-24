from fastapi import FastAPI, APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date, time
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer(auto_error=False)

# Enums
class OrarioType(str, Enum):
    ORDINARIE = "ordinarie"
    MUTUA = "mutua"
    FERIE = "ferie"
    RIPOSO_MATTINO = "riposo_mattino"
    RIPOSO_POMERIGGIO = "riposo_pomeriggio"

class FasciaType(str, Enum):
    MATTINO = "mattino"
    POMERIGGIO = "pomeriggio"
    GIORNO = "giorno"

# Pydantic Models
class AppConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    admin_code: str = "555"
    user_code: str = "999"
    background_color: str = "#8B0000"  # rosso granata
    text_color: str = "#FFFFFF"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Dipendente(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    ore_contratto: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DipendenteCreate(BaseModel):
    nome: str
    ore_contratto: int

class OrarioGiornaliero(BaseModel):
    giorno: date
    ore: int
    tipo: OrarioType

class OrarioTurno(BaseModel):
    mattino_inizio: str = "06:00"  # formato HH:MM
    mattino_fine: str = "06:00"    # formato HH:MM  
    mattino_tipo: OrarioType = OrarioType.ORDINARIE
    pomeriggio_inizio: str = "14:00"  # formato HH:MM
    pomeriggio_fine: str = "14:00"    # formato HH:MM
    pomeriggio_tipo: OrarioType = OrarioType.ORDINARIE

class SettimanaLavorativa(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str  # es. "Settimana 1", "15-21 Gennaio 2024"
    inizio: date
    fine: date
    orari: Dict[str, Dict[str, OrarioTurno]] = {}  # dipendente_id -> { "lunedi": OrarioTurno, "martedi": OrarioTurno, ... }
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SettimanaLavorativaCreate(BaseModel):
    nome: str
    inizio: date
    fine: date

class RichiestaGiorno(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dipendente_nome: str
    giorno: date
    fascia: FasciaType
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RichiestaGiornoCreate(BaseModel):
    dipendente_nome: str
    giorno: date
    fascia: FasciaType

class CategoriaGuida(str, Enum):
    CONDOTTA_GENERALE = "condotta_generale"
    REPARTO_CASSA = "reparto_cassa"  
    REPARTO_FRESCHI = "reparto_freschi"
    REPARTO_GASTRONOMIA = "reparto_gastronomia"
    REPARTO_MACELLERIA = "reparto_macelleria"
    REPARTO_ORTOFRUTTA = "reparto_ortofrutta"
    REPARTO_SALA = "reparto_sala"
    REPARTO_SURGELATI = "reparto_surgelati"
    REPARTO_MAGAZZINO = "reparto_magazzino"

class Guida(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titolo: str
    contenuto: str
    categoria: CategoriaGuida
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GuidaCreate(BaseModel):
    titolo: str
    contenuto: str
    categoria: CategoriaGuida

class LoginRequest(BaseModel):
    code: str

class LoginResponse(BaseModel):
    success: bool
    user_type: str  # "admin" or "user"
    message: str

# Helper functions
def prepare_for_mongo(data):
    """Convert date/time objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if isinstance(value, date) and not isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, time):
                result[key] = value.strftime('%H:%M:%S')
            elif isinstance(value, list):
                result[key] = [prepare_for_mongo(item) for item in value]
            elif isinstance(value, dict):
                result[key] = prepare_for_mongo(value)
            else:
                result[key] = value
        return result
    elif isinstance(data, list):
        return [prepare_for_mongo(item) for item in data]
    elif isinstance(data, date) and not isinstance(data, datetime):
        return data.isoformat()
    elif isinstance(data, time):
        return data.strftime('%H:%M:%S')
    else:
        return data

def parse_from_mongo(data):
    """Parse date/time strings back from MongoDB and clean legacy data"""
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if isinstance(value, str):
                # Try to parse date
                if key in ['giorno', 'inizio', 'fine'] or key.endswith('_date'):
                    try:
                        result[key] = datetime.fromisoformat(value).date()
                        continue
                    except:
                        pass
                # Clean legacy riposo_giorno data
                if key.endswith('_tipo') and value == 'riposo_giorno':
                    result[key] = 'ordinarie'  # Convert to default
                    continue
            result[key] = parse_from_mongo(value) if isinstance(value, (dict, list)) else value
        return result
    elif isinstance(data, list):
        return [parse_from_mongo(item) for item in data]
    else:
        return data

# Initialize app configuration
async def init_app_config():
    """Initialize default app configuration if not exists"""
    config = await db.app_config.find_one()
    if not config:
        default_config = AppConfig()
        await db.app_config.insert_one(prepare_for_mongo(default_config.dict()))

# Routes
@api_router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    config = await db.app_config.find_one()
    if not config:
        await init_app_config()
        config = await db.app_config.find_one()
    
    if request.code == config.get("admin_code", "555"):
        return LoginResponse(success=True, user_type="admin", message="Login admin successful")
    elif request.code == config.get("user_code", "999"):
        return LoginResponse(success=True, user_type="user", message="Login utente successful")
    else:
        return LoginResponse(success=False, user_type="", message="Codice non valido")

@api_router.get("/config")
async def get_config():
    config = await db.app_config.find_one()
    if not config:
        await init_app_config()
        config = await db.app_config.find_one()
    return parse_from_mongo(config)

@api_router.put("/config")
async def update_config(updates: Dict[str, Any]):
    await db.app_config.update_one(
        {},
        {"$set": prepare_for_mongo(updates)},
        upsert=True
    )
    return {"message": "Configurazione aggiornata"}

# Dipendenti endpoints
@api_router.get("/dipendenti", response_model=List[Dipendente])
async def get_dipendenti():
    dipendenti = await db.dipendenti.find().to_list(length=None)
    return [Dipendente(**parse_from_mongo(dip)) for dip in dipendenti]

@api_router.post("/dipendenti", response_model=Dipendente)
async def create_dipendente(dipendente: DipendenteCreate):
    dip_obj = Dipendente(**dipendente.dict())
    await db.dipendenti.insert_one(prepare_for_mongo(dip_obj.dict()))
    return dip_obj

@api_router.put("/dipendenti/{dipendente_id}")
async def update_dipendente(dipendente_id: str, dipendente: DipendenteCreate):
    result = await db.dipendenti.update_one(
        {"id": dipendente_id},
        {"$set": prepare_for_mongo(dipendente.dict())}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    
    updated_dipendente = await db.dipendenti.find_one({"id": dipendente_id})
    return Dipendente(**parse_from_mongo(updated_dipendente))

@api_router.delete("/dipendenti/{dipendente_id}")
async def delete_dipendente(dipendente_id: str):
    result = await db.dipendenti.delete_one({"id": dipendente_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    return {"message": "Dipendente eliminato"}

# Settimane lavorative endpoints
@api_router.get("/settimane", response_model=List[SettimanaLavorativa])
async def get_settimane():
    settimane = await db.settimane_lavorative.find().to_list(length=None)
    return [SettimanaLavorativa(**parse_from_mongo(sett)) for sett in settimane]

@api_router.post("/settimane", response_model=SettimanaLavorativa)
async def create_settimana(settimana: SettimanaLavorativaCreate):
    sett_obj = SettimanaLavorativa(**settimana.dict())
    await db.settimane_lavorative.insert_one(prepare_for_mongo(sett_obj.dict()))
    return sett_obj

@api_router.put("/settimane/{settimana_id}/orari")
async def update_orari_settimana(settimana_id: str, orari: Dict[str, Dict[str, Dict]]):
    """Update orari per una settimana con struttura: dipendente_id -> giorno -> turni"""
    # Convert orari structure to proper format
    prepared_orari = {}
    for dipendente_id, giorni in orari.items():
        prepared_orari[dipendente_id] = {}
        for giorno, turni in giorni.items():
            prepared_orari[dipendente_id][giorno] = prepare_for_mongo(turni)
    
    result = await db.settimane_lavorative.update_one(
        {"id": settimana_id},
        {"$set": {"orari": prepared_orari}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Settimana non trovata")
    return {"message": "Orari aggiornati"}

@api_router.get("/settimane/{settimana_id}/calcoli-giornalieri/{dipendente_id}")
async def get_calcoli_orari_giornalieri(settimana_id: str, dipendente_id: str):
    """Calcola le ore per ogni giorno della settimana"""
    # Get settimana
    settimana = await db.settimane_lavorative.find_one({"id": settimana_id})
    if not settimana:
        raise HTTPException(status_code=404, detail="Settimana non trovata")
    
    orari_dipendente = settimana.get("orari", {}).get(dipendente_id, {})
    
    def calcola_ore_turno(inizio: str, fine: str) -> float:
        """Calcola le ore tra due orari in formato HH:MM come ore decimali dirette"""
        try:
            h_inizio, m_inizio = map(int, inizio.split(':'))
            h_fine, m_fine = map(int, fine.split(':'))
            
            # Converti tutto in minuti
            minuti_inizio = h_inizio * 60 + m_inizio
            minuti_fine = h_fine * 60 + m_fine
            
            if minuti_fine <= minuti_inizio:
                # Caso attraversamento mezzanotte
                minuti_fine += 24 * 60
                
            # Calcola la differenza in minuti e converti in ore decimali
            differenza_minuti = minuti_fine - minuti_inizio
            ore_decimali = differenza_minuti / 60.0
            
            return ore_decimali
        except:
            return 0.0
    
    calcoli_giornalieri = {}
    giorni = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica']
    
    for giorno in giorni:
        turni = orari_dipendente.get(giorno, {})
        ore_giorno = 0.0
        
        if isinstance(turni, dict):
            # Mattino
            mattino_tipo = turni.get("mattino_tipo", "ordinarie")
            if mattino_tipo not in ["riposo_mattino"]:
                ore_mattino = calcola_ore_turno(
                    turni.get("mattino_inizio", "06:00"),
                    turni.get("mattino_fine", "06:00")
                )
                ore_giorno += ore_mattino
                
            # Pomeriggio
            pomeriggio_tipo = turni.get("pomeriggio_tipo", "ordinarie")
            if pomeriggio_tipo not in ["riposo_pomeriggio"]:
                ore_pomeriggio = calcola_ore_turno(
                    turni.get("pomeriggio_inizio", "14:00"),
                    turni.get("pomeriggio_fine", "14:00")
                )
                ore_giorno += ore_pomeriggio
        
        calcoli_giornalieri[giorno] = round(ore_giorno, 2)
    
    return calcoli_giornalieri
async def get_calcoli_orari(settimana_id: str, dipendente_id: str):
    # Get settimana
    settimana = await db.settimane_lavorative.find_one({"id": settimana_id})
    if not settimana:
        raise HTTPException(status_code=404, detail="Settimana non trovata")
    
    # Get dipendente
    dipendente = await db.dipendenti.find_one({"id": dipendente_id})
    if not dipendente:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    
    orari_dipendente = settimana.get("orari", {}).get(dipendente_id, {})
    
    ore_ordinarie = 0.0
    ore_mutua = 0.0
    ore_ferie = 0.0
    
    def calcola_ore_turno(inizio: str, fine: str) -> float:
        """Calcola le ore tra due orari in formato HH:MM come ore decimali dirette"""
        try:
            h_inizio, m_inizio = map(int, inizio.split(':'))
            h_fine, m_fine = map(int, fine.split(':'))
            
            # Converti tutto in minuti
            minuti_inizio = h_inizio * 60 + m_inizio
            minuti_fine = h_fine * 60 + m_fine
            
            if minuti_fine <= minuti_inizio:
                # Caso attraversamento mezzanotte
                minuti_fine += 24 * 60
                
            # Calcola la differenza in minuti e converti in ore decimali
            differenza_minuti = minuti_fine - minuti_inizio
            ore_decimali = differenza_minuti / 60.0
            
            return ore_decimali
        except:
            return 0.0
    
    # Calcola ore per tutti i giorni della settimana
    for giorno, turni in orari_dipendente.items():
        if isinstance(turni, dict):
            # Mattino
            mattino_tipo = turni.get("mattino_tipo", "ordinarie")
            if mattino_tipo not in ["riposo_mattino"]:
                ore_mattino = calcola_ore_turno(
                    turni.get("mattino_inizio", "06:00"),
                    turni.get("mattino_fine", "06:00")
                )
                if mattino_tipo == "ordinarie":
                    ore_ordinarie += ore_mattino
                elif mattino_tipo == "mutua":
                    ore_mutua += ore_mattino
                elif mattino_tipo == "ferie":
                    ore_ferie += ore_mattino
                
            # Pomeriggio
            pomeriggio_tipo = turni.get("pomeriggio_tipo", "ordinarie")
            if pomeriggio_tipo not in ["riposo_pomeriggio"]:
                ore_pomeriggio = calcola_ore_turno(
                    turni.get("pomeriggio_inizio", "14:00"),
                    turni.get("pomeriggio_fine", "14:00")
                )
                if pomeriggio_tipo == "ordinarie":
                    ore_ordinarie += ore_pomeriggio
                elif pomeriggio_tipo == "mutua":
                    ore_mutua += ore_pomeriggio
                elif pomeriggio_tipo == "ferie":
                    ore_ferie += ore_pomeriggio
    
    ore_totali_lavorate = ore_ordinarie + ore_mutua + ore_ferie
    ore_contratto = dipendente.get("ore_contratto", 0)
    ore_straordinario = max(0, ore_totali_lavorate - ore_contratto)
    
    return {
        "ore_ordinarie": round(ore_ordinarie, 2),
        "ore_mutua": round(ore_mutua, 2),
        "ore_ferie": round(ore_ferie, 2),
        "ore_straordinario": round(ore_straordinario, 2),
        "ore_contratto": ore_contratto,
        "ore_totali_lavorate": round(ore_totali_lavorate, 2)
    }

@api_router.get("/guide/categorie")
async def get_categorie_guide():
    """Restituisce tutte le categorie guide disponibili"""
    categorie = {
        "condotta_generale": "Condotta Generale",
        "reparto_cassa": "Reparto Cassa",
        "reparto_freschi": "Reparto Freschi", 
        "reparto_gastronomia": "Reparto Gastronomia",
        "reparto_macelleria": "Reparto Macelleria",
        "reparto_ortofrutta": "Reparto Ortofrutta",
        "reparto_sala": "Reparto Sala",
        "reparto_surgelati": "Reparto Surgelati",
        "reparto_magazzino": "Reparto Magazzino"
    }
    return categorie

@api_router.get("/guide/per-categoria/{categoria}")
async def get_guide_per_categoria(categoria: str):
    """Ottiene le guide per una specifica categoria"""
    guide = await db.guide.find({"categoria": categoria}).to_list(length=None)
    return [Guida(**parse_from_mongo(g)) for g in guide]

# Richieste endpoints
@api_router.get("/richieste", response_model=List[RichiestaGiorno])
async def get_richieste():
    richieste = await db.richieste.find().to_list(length=None)
    return [RichiestaGiorno(**parse_from_mongo(req)) for req in richieste]

@api_router.post("/richieste", response_model=RichiestaGiorno)
async def create_richiesta(richiesta: RichiestaGiornoCreate):
    req_obj = RichiestaGiorno(**richiesta.dict())
    await db.richieste.insert_one(prepare_for_mongo(req_obj.dict()))
    return req_obj

@api_router.delete("/richieste/{richiesta_id}")
async def delete_richiesta(richiesta_id: str):
    result = await db.richieste.delete_one({"id": richiesta_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    return {"message": "Richiesta eliminata"}

# Guide endpoints
@api_router.get("/guide", response_model=List[Guida])
async def get_guide():
    guide = await db.guide.find().to_list(length=None)
    return [Guida(**parse_from_mongo(g)) for g in guide]

@api_router.post("/guide", response_model=Guida)
async def create_guida(guida: GuidaCreate):
    guida_obj = Guida(**guida.dict())
    await db.guide.insert_one(prepare_for_mongo(guida_obj.dict()))
    return guida_obj

@api_router.delete("/guide/{guida_id}")
async def delete_guida(guida_id: str):
    result = await db.guide.delete_one({"id": guida_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Guida non trovata")
    return {"message": "Guida eliminata"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await init_app_config()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()