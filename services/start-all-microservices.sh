#!/bin/bash

echo "🚀 Pokretanje B2B Mikroservisa..."
echo ""

# Zaustavi sve postojeće procese
echo "Zaustavljam postojeće servise..."
pkill -f "tsx server/index.ts" || true
sleep 2

# Postavi environment varijable
export NODE_ENV=development
export INTERNAL_SERVICE_KEY=dev-service-key
export DATABASE_URL=$DATABASE_URL
export SESSION_SECRET=$SESSION_SECRET

# Pokreni Core API Service
echo "1. Pokrećem Core API Service (port 5003)..."
cd core-api-service
NODE_PATH=../../node_modules PORT=5003 ../../node_modules/.bin/tsx server/index.ts &
CORE_PID=$!
cd ..
sleep 5

# Pokreni Admin Service
echo "2. Pokrećem Admin Service (port 5001)..."
cd admin-service
NODE_PATH=../../node_modules PORT=5001 CORE_API_URL=http://localhost:5003 ../../node_modules/.bin/tsx server/index.ts &
ADMIN_PID=$!
cd ..
sleep 5

# Pokreni B2B Service
echo "3. Pokrećem B2B Service (port 5002)..."
cd b2b-service
NODE_PATH=../../node_modules PORT=5002 CORE_API_URL=http://localhost:5003 ../../node_modules/.bin/tsx server/index.ts &
B2B_PID=$!
cd ..
sleep 5

echo ""
echo "✅ Svi servisi su pokrenuti!"
echo ""
echo "📍 Pristupne tačke:"
echo "   - Admin Portal: http://localhost:5001"
echo "   - B2B Portal: http://localhost:5002"
echo "   - Core API: http://localhost:5003"
echo ""
echo "👤 Test nalozi:"
echo "   - Admin: admin/Kalendar1"
echo "   - B2B: b2buser/Kalendar1"
echo ""
echo "⏹️  Pritisnite Ctrl+C za zaustavljanje"
echo ""

# Handle cleanup
trap "echo ''; echo 'Zaustavljam servise...'; kill $CORE_PID $ADMIN_PID $B2B_PID 2>/dev/null; exit 0" INT TERM

# Wait for all processes
wait $CORE_PID $ADMIN_PID $B2B_PID