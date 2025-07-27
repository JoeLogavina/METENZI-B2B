#!/bin/bash

echo "=== TESTIRANJE MIKROSERVISA ==="
echo ""

# Test Core API
echo "1. Core API Service (Port 5003):"
curl -s http://localhost:5003/health || echo "GREŠKA: Core API ne radi"
echo ""

# Test Admin Portal
echo "2. Admin Portal (Port 5001):"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5001 || echo "GREŠKA: Admin Portal ne radi"
echo ""

# Test B2B Portal
echo "3. B2B Portal (Port 5002):"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5002 || echo "GREŠKA: B2B Portal ne radi"
echo ""

# Pokušaj direktno pokrenuti admin servis sa greškama
echo "=== POKRETANJE ADMIN SERVISA SA DETALJIMA ==="
cd admin-service
NODE_PATH=../../node_modules NODE_ENV=development PORT=5001 INTERNAL_SERVICE_KEY=dev-service-key CORE_API_URL=http://localhost:5003 ../../node_modules/.bin/tsx server/index.ts