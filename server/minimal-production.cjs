// Ultra-minimal production server for DigitalOcean
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
console.log('Environment PORT:', process.env.PORT);
console.log('Using PORT:', PORT);

console.log(`Starting minimal server on port ${PORT}`);

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist', 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// Favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

// API placeholder
app.use('/api/*', (req, res) => {
  res.status(200).json({ message: 'API endpoint ready for connection' });
});

// Catch all
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'dist', 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>B2B Platform</title></head>
      <body>
        <h1>B2B License Platform</h1>
        <p>Server running on port ${PORT}</p>
        <p><a href="/health">Health Check</a></p>
      </body>
      </html>
    `);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});