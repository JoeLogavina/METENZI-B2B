#!/bin/bash

# B2B License Management Platform - Docker Setup Script
set -e

echo "🐳 Setting up Docker environment for B2B License Management Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env.docker ]; then
    print_status "Creating .env.docker file..."
    cat > .env.docker << EOF
# Production Environment Variables
NODE_ENV=production
PORT=5000

# Database Configuration
POSTGRES_DB=b2b_licenses
POSTGRES_USER=b2b_user
POSTGRES_PASSWORD=secure_password_change_in_production
DATABASE_URL=postgresql://b2b_user:secure_password_change_in_production@postgres:5432/b2b_licenses

# Redis Configuration
REDIS_URL=redis://redis_password_change_in_production@redis:6379

# Session Secret (Change in production!)
SESSION_SECRET=change_this_to_a_secure_random_string_in_production

# Security
CORS_ORIGIN=http://localhost
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
EOF
    print_warning "Please update the passwords in .env.docker before deploying to production!"
fi

# Create SSL directory for nginx
mkdir -p ssl

# Create init-db directory for database initialization
mkdir -p init-db

# Build the application
print_status "Building the application..."
docker-compose build

# Start the services
print_status "Starting services..."
docker-compose up -d

# Wait for services to be healthy
print_status "Waiting for services to be ready..."
sleep 30

# Check service health
print_status "Checking service health..."

# Check PostgreSQL
if docker-compose exec postgres pg_isready -U b2b_user -d b2b_licenses > /dev/null 2>&1; then
    print_status "✅ PostgreSQL is ready"
else
    print_error "❌ PostgreSQL is not ready"
fi

# Check Redis
if docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
    print_status "✅ Redis is ready"
else
    print_error "❌ Redis is not ready"
fi

# Check Application
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    print_status "✅ Application is ready"
else
    print_error "❌ Application is not ready"
fi

# Show running containers
print_status "Running containers:"
docker-compose ps

echo ""
print_status "🎉 Docker setup complete!"
echo ""
echo "📋 Service URLs:"
echo "   Application: http://localhost:5000"
echo "   Nginx Proxy: http://localhost (port 80)"
echo "   PostgreSQL: localhost:5432"
echo "   Redis: localhost:6379"
echo ""
echo "🛠️  Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart services: docker-compose restart"
echo "   Update and rebuild: docker-compose up --build -d"
echo ""
print_warning "Remember to change the default passwords in .env.docker for production use!"