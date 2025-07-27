import express from 'express';

const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Mikroservisi - B2B Portal</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f5f5f5;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #6E6F71; }
    .service {
      background: #f9f9f9;
      padding: 15px;
      margin: 10px 0;
      border-radius: 5px;
      border-left: 4px solid #FFB20F;
    }
    .service a {
      color: #FFB20F;
      text-decoration: none;
      font-weight: bold;
    }
    .service a:hover {
      text-decoration: underline;
    }
    .instructions {
      background: #e8f4f8;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    code {
      background: #f0f0f0;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Mikroservisi - B2B Software License Management</h1>
    
    <div class="instructions">
      <h3>📋 Instrukcije za pokretanje:</h3>
      <p>Monolitna arhitektura je obrisana. Sada koristimo mikroservise!</p>
      <p>Za pokretanje svih servisa:</p>
      <code>cd services && ./start-all-microservices.sh</code>
    </div>

    <h2>📍 Dostupni servisi:</h2>
    
    <div class="service">
      <h3>Admin Portal</h3>
      <p>URL: <a href="https://workspace-5001.dinoharbinja.repl.co" target="_blank">https://workspace-5001.dinoharbinja.repl.co</a></p>
      <p>Prijava: admin/Kalendar1</p>
      <p>Funkcionalnosti: Upravljanje proizvodima, korisnicima, licencnim ključevima</p>
    </div>

    <div class="service">
      <h3>B2B Portal</h3>
      <p>URL: <a href="https://workspace-5002.dinoharbinja.repl.co" target="_blank">https://workspace-5002.dinoharbinja.repl.co</a></p>
      <p>Prijava: b2buser/Kalendar1</p>
      <p>Funkcionalnosti: Pregled kataloga, kupovina licenci, upravljanje narudžbama</p>
    </div>

    <div class="service">
      <h3>Core API Service</h3>
      <p>URL: https://workspace-5003.dinoharbinja.repl.co (interni servis)</p>
      <p>Napomena: Dostupan samo drugim servisima</p>
    </div>
  </div>
</body>
</html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
=================================================================
🚀 MIKROSERVISI - B2B SOFTWARE LICENSE MANAGEMENT
=================================================================

Info stranica dostupna na: http://localhost:${PORT}

Za pokretanje mikroservisa:
   cd services
   ./start-all-microservices.sh

=================================================================
  `);
});