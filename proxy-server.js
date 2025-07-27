import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import path from 'path';

const app = express();
const PORT = 5000;

// Pokreni sve mikroservise interno
function startMicroservices() {
  const services = [
    {
      name: 'Core API',
      port: 5003,
      dir: 'services/core-api-service',
      env: { PORT: 5003, INTERNAL_SERVICE_KEY: 'dev-service-key' }
    },
    {
      name: 'Admin Service', 
      port: 5001,
      dir: 'services/admin-service',
      env: { PORT: 5001, CORE_API_URL: 'http://localhost:5003', INTERNAL_SERVICE_KEY: 'dev-service-key' }
    },
    {
      name: 'B2B Service',
      port: 5002, 
      dir: 'services/b2b-service',
      env: { PORT: 5002, CORE_API_URL: 'http://localhost:5003', INTERNAL_SERVICE_KEY: 'dev-service-key' }
    }
  ];

  services.forEach((service, index) => {
    setTimeout(() => {
      console.log(`🚀 Pokrećem ${service.name} na portu ${service.port}...`);
      
      const env = { 
        ...process.env, 
        ...service.env,
        NODE_ENV: 'development',
        NODE_PATH: '../../node_modules'
      };
      
      const child = spawn('npx', ['tsx', 'server/index.ts'], {
        cwd: service.dir,
        env,
        stdio: 'pipe'
      });

      child.stdout.on('data', (data) => {
        console.log(`${service.name}: ${data}`);
      });

      child.stderr.on('data', (data) => {
        console.error(`${service.name} stderr: ${data}`);
      });

      child.on('error', (error) => {
        console.error(`${service.name} greška:`, error.message);
      });
    }, index * 3000); // Pokreni servise sa zakašnjenjem
  });
}

// Pokreni mikroservise
startMicroservices();

// Čekaj da se servisi pokrenu
setTimeout(() => {
  // Proxy konfiguracija
  const adminProxy = createProxyMiddleware({
    target: 'http://localhost:5001',
    changeOrigin: true,
    pathRewrite: {
      '^/admin': ''
    },
    onError: (err, req, res) => {
      console.error('Admin proxy greška:', err.message);
      res.status(503).send('Admin servis nije dostupan');
    }
  });

  const shopProxy = createProxyMiddleware({
    target: 'http://localhost:5002', 
    changeOrigin: true,
    pathRewrite: {
      '^/shop': ''
    },
    onError: (err, req, res) => {
      console.error('B2B proxy greška:', err.message);
      res.status(503).send('B2B servis nije dostupan');
    }
  });

  const apiProxy = createProxyMiddleware({
    target: 'http://localhost:5003',
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api'
    },
    onError: (err, req, res) => {
      console.error('API proxy greška:', err.message);
      res.status(503).send('API servis nije dostupan');
    }
  });

  // Proxy rute
  app.use('/admin', adminProxy);
  app.use('/shop', shopProxy);
  app.use('/api', apiProxy);

  // Glavna stranica
  app.get('/', (req, res) => {
    res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>B2B License Management - Mikroservisi</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background: linear-gradient(135deg, #6E6F71 0%, #4a4b4d 100%);
        color: white;
        margin: 0;
        padding: 40px;
        min-height: 100vh;
      }
      .container {
        max-width: 800px;
        margin: 0 auto;
        background: rgba(255, 255, 255, 0.1);
        padding: 40px;
        border-radius: 15px;
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }
      h1 {
        text-align: center;
        margin-bottom: 40px;
        color: #FFB20F;
        font-size: 2.5em;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      }
      .service-card {
        background: rgba(255, 255, 255, 0.15);
        margin: 20px 0;
        padding: 25px;
        border-radius: 10px;
        border-left: 5px solid #FFB20F;
        transition: transform 0.3s ease;
      }
      .service-card:hover {
        transform: translateY(-5px);
        background: rgba(255, 255, 255, 0.2);
      }
      .service-title {
        font-size: 1.5em;
        margin-bottom: 10px;
        color: #FFB20F;
      }
      .service-link {
        display: inline-block;
        background: #FFB20F;
        color: #6E6F71;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 25px;
        font-weight: bold;
        margin: 10px 10px 0 0;
        transition: all 0.3s ease;
      }
      .service-link:hover {
        background: #ff9900;
        transform: scale(1.05);
        box-shadow: 0 4px 15px rgba(255, 178, 15, 0.4);
      }
      .credentials {
        background: rgba(0, 0, 0, 0.3);
        padding: 20px;
        border-radius: 10px;
        margin-top: 30px;
        text-align: center;
      }
      .status {
        display: inline-block;
        background: #28a745;
        color: white;
        padding: 5px 15px;
        border-radius: 20px;
        font-size: 0.9em;
        margin-left: 10px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>🚀 B2B License Management</h1>
      
      <div class="service-card">
        <div class="service-title">Admin Portal <span class="status">✅ Aktivan</span></div>
        <p>Upravljanje proizvodima, korisnicima i licencnim ključevima</p>
        <a href="/admin" class="service-link">Otvori Admin Portal</a>
      </div>

      <div class="service-card">
        <div class="service-title">B2B Shop <span class="status">✅ Aktivan</span></div>
        <p>Pregled kataloga proizvoda i kupovina licenci</p>
        <a href="/shop" class="service-link">Otvori B2B Shop</a>
      </div>

      <div class="service-card">
        <div class="service-title">Core API <span class="status">✅ Aktivan</span></div>
        <p>Interni API za komunikaciju između servisa</p>
        <a href="/api/core/health" class="service-link">Proveri Status</a>
      </div>

      <div class="credentials">
        <h3>🔐 Pristupni podaci:</h3>
        <p><strong>Admin:</strong> admin / Kalendar1</p>
        <p><strong>B2B:</strong> b2buser / Kalendar1</p>
      </div>
    </div>
  </body>
  </html>
    `);
  });

  console.log(`
  =================================================================
  🚀 B2B MIKROSERVISI - PROXY SERVER
  =================================================================
  
  Glavna stranica: https://workspace.dinoharbinja.repl.co
  
  📍 Servisi dostupni preko:
     🔧 Admin Portal: /admin
     🛒 B2B Shop: /shop  
     ⚙️  Core API: /api
  
  👤 Pristupni podaci:
     - Admin: admin/Kalendar1
     - B2B: b2buser/Kalendar1
  
  =================================================================
  `);

}, 10000); // Čekaj 10 sekundi da se servisi pokrenu

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Proxy server pokrenut na portu ${PORT}`);
});