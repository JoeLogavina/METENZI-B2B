import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy routes za pristup servisima unutar Replit-a
app.use('/admin', createProxyMiddleware({
  target: 'http://localhost:5001',
  changeOrigin: true,
  pathRewrite: {
    '^/admin': '/'
  }
}));

app.use('/shop', createProxyMiddleware({
  target: 'http://localhost:5002',
  changeOrigin: true,
  pathRewrite: {
    '^/shop': '/'
  }
}));

app.use('/api', createProxyMiddleware({
  target: 'http://localhost:5003',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/'
  }
}));

// Info stranica sa linkovima na mikroservise
app.get('/', (req, res) => {
  const replName = process.env.REPL_SLUG || 'workspace';
  const replOwner = process.env.REPL_OWNER || 'dinoharbinja';

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
        .service {
          background: rgba(255, 255, 255, 0.15);
          padding: 25px;
          margin: 20px 0;
          border-radius: 10px;
          border-left: 5px solid #FFB20F;
          transition: transform 0.3s ease;
        }
        .service:hover {
          transform: translateY(-5px);
          background: rgba(255, 255, 255, 0.2);
        }
        .service h3 {
          color: #FFB20F;
          margin-top: 0;
        }
        .button {
          background: #FFB20F;
          color: #6E6F71;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 25px;
          font-weight: bold;
          margin: 10px 10px 0 0;
          display: inline-block;
          transition: all 0.3s ease;
        }
        .button:hover {
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
          color: #28a745;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 B2B License Management Platform</h1>
        <p>Aplikacija je podeljena u mikroservise za bolju bezbednost i skalabilnost:</p>

        <div class="service">
          <h3>🔧 Admin Portal</h3>
          <p>Upravljanje proizvodima, korisnicima i licencnim ključevima</p>
          <a href="/admin" class="button">Unutar Replit-a</a>
          <a href="https://${replName}-5001.${replOwner}.repl.co" class="button">Eksterni Link</a>
          <p><strong>Status:</strong> <span class="status">✅ Aktivan</span></p>
        </div>

        <div class="service">
          <h3>🛒 B2B Portal</h3>
          <p>Katalog proizvoda i kupovina licenci za B2B klijente</p>
          <a href="/shop" class="button">Unutar Replit-a</a>
          <a href="https://${replName}-5002.${replOwner}.repl.co" class="button">Eksterni Link</a>
          <p><strong>Status:</strong> <span class="status">✅ Aktivan</span></p>
        </div>

        <div class="service">
          <h3>⚙️ Core API</h3>
          <p>Centralna API za komunikaciju između servisa</p>
          <a href="/api/health" class="button">Health Check</a>
          <a href="https://${replName}-5003.${replOwner}.repl.co/health" class="button">Eksterni Link</a>
          <p><strong>Status:</strong> <span id="core-status">Proverava se...</span></p>
        </div>

        <div class="credentials">
          <h3>🔐 Test nalozi:</h3>
          <p><strong>Admin:</strong> admin / Kalendar1</p>
          <p><strong>B2B:</strong> b2buser / Kalendar1</p>
        </div>
      </div>

      <script>
        // Proveri status Core API servisa
        fetch('/api/health')
          .then(response => response.json())
          .then(data => {
            document.getElementById('core-status').innerHTML = '<span class="status">✅ Aktivan</span>';
          })
          .catch(error => {
            document.getElementById('core-status').innerHTML = '<span style="color: #dc3545;">❌ Nedostupan</span>';
          });
      </script>
    </body>
    </html>
  `);
});

// Pokreni mikroservise interno
function startMicroservices() {
  console.log('🚀 Pokretanje mikroservisa...');

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
        console.log(`${service.name}: ${data.toString().trim()}`);
      });

      child.stderr.on('data', (data) => {
        const errorMsg = data.toString().trim();
        if (errorMsg.includes('EADDRINUSE')) {
          console.log(`${service.name}: Servis već pokrenut na portu ${service.port}`);
        } else {
          console.error(`${service.name} stderr: ${errorMsg}`);
        }
      });

      child.on('error', (error) => {
        console.error(`${service.name} greška:`, error.message);
      });
    }, index * 2000);
  });
}

// Pokreni mikroservise
startMicroservices();

console.log(`
=================================================================
🚀 B2B MIKROSERVISI - INFO SERVER
=================================================================

Glavna stranica: https://workspace.dinoharbinja.repl.co

📍 Direktan pristup servisima:
   - Admin Portal: https://workspace-5001.dinoharbinja.repl.co
   - B2B Portal: https://workspace-5002.dinoharbinja.repl.co
   - Core API: https://workspace-5003.dinoharbinja.repl.co

👤 Test nalozi:
   - Admin: admin/Kalendar1
   - B2B: b2buser/Kalendar1

=================================================================
`);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📋 Info stranica pokrenuta na portu ${PORT}`);
});