#!/bin/bash

# B2B Platform - Start Monitoring Stack (Phase 2)
echo "🚀 Starting B2B Platform Monitoring Stack..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker to use the monitoring stack."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

# Create necessary directories
mkdir -p logs
mkdir -p monitoring/{prometheus,grafana/{provisioning/{dashboards,datasources},dashboards},alertmanager}

# Start the monitoring stack
echo "🔧 Starting Prometheus, Grafana, and Alertmanager..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Checking service status..."

# Check Prometheus
if curl -s http://localhost:9090/-/healthy > /dev/null; then
    echo "✅ Prometheus is running at http://localhost:9090"
else
    echo "⚠️  Prometheus may not be ready yet - check http://localhost:9090"
fi

# Check Grafana
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Grafana is running at http://localhost:3000"
    echo "   📝 Default login: admin / admin123"
else
    echo "⚠️  Grafana may not be ready yet - check http://localhost:3000"
fi

# Check Alertmanager
if curl -s http://localhost:9093/-/healthy > /dev/null; then
    echo "✅ Alertmanager is running at http://localhost:9093"
else
    echo "⚠️  Alertmanager may not be ready yet - check http://localhost:9093"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Your B2B platform should be running at http://localhost:5000"
echo "2. Check metrics endpoint: http://localhost:5000/metrics"
echo "3. View Grafana dashboards: http://localhost:3000 (admin/admin123)"
echo "4. Monitor Prometheus targets: http://localhost:9090/targets"
echo "5. Check alert rules: http://localhost:9090/rules"
echo "6. View alerts: http://localhost:9093/#/alerts"
echo ""
echo "🔍 To stop the monitoring stack:"
echo "docker-compose -f docker-compose.monitoring.yml down"