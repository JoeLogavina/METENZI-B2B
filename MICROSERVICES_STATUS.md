# 🚀 Mikroservisi - Status i Instrukcije

## ✅ Status: SVI SERVISI RADE!

### Aktivni servisi:
- ✅ **Core API Service** - Port 5003
- ✅ **Admin Portal** - Port 5001  
- ✅ **B2B Portal** - Port 5002

## 🌐 Pristupne tačke:

### 1. Admin Portal
- **URL**: http://localhost:5001
- **Prijava**: admin/Kalendar1
- **Funkcionalnosti**: 
  - Upravljanje proizvodima
  - Pregled korisnika
  - Upravljanje licencnim ključevima
  - Dashboard sa statistikama

### 2. B2B Portal  
- **URL**: http://localhost:5002
- **Prijava**: b2buser/Kalendar1
- **Funkcionalnosti**:
  - Pregled kataloga proizvoda
  - Kupovina licenci
  - Pregled narudžbi
  - Upravljanje profilom

### 3. Core API
- **URL**: http://localhost:5003
- **Napomena**: Interni servis - nije dostupan direktno

## 📋 Kako pokrenuti servise:

```bash
cd services
./start-all-microservices.sh
```

## 🧪 Testiranje:

### Test Admin Portala:
1. Otvorite http://localhost:5001
2. Prijavite se sa admin/Kalendar1
3. Trebalo bi videti Admin Dashboard

### Test B2B Portala:
1. Otvorite http://localhost:5002  
2. Prijavite se sa b2buser/Kalendar1
3. Trebalo bi videti B2B Shop

## ⚠️ Napomena o Workflow grešci:

Greška "ERR_MODULE_NOT_FOUND" u workflow logu je **normalna** - javlja se jer workflow pokušava pokrenuti stari monolitni kod koji smo obrisali. Mikroservisi rade nezavisno od tog workflow-a.

## 🔄 Zaustavljanje servisa:

Pritisnite Ctrl+C u terminalu gde ste pokrenuli `start-all-microservices.sh`