#!/bin/bash

# Test Docker deployment
set -e

echo "🧪 Testing Docker deployment..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Test health endpoint
print_test "Testing health endpoint..."
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    print_pass "Health endpoint responding"
else
    print_fail "Health endpoint not responding"
    exit 1
fi

# Test readiness endpoint
print_test "Testing readiness endpoint..."
if curl -f http://localhost:5000/ready > /dev/null 2>&1; then
    print_pass "Readiness endpoint responding"
else
    print_fail "Readiness endpoint not responding"
    exit 1
fi

# Test metrics endpoint
print_test "Testing metrics endpoint..."
if curl -f http://localhost:5000/metrics > /dev/null 2>&1; then
    print_pass "Metrics endpoint responding"
else
    print_fail "Metrics endpoint not responding"
    exit 1
fi

# Test main application
print_test "Testing main application..."
if curl -f http://localhost:5000/ > /dev/null 2>&1; then
    print_pass "Main application responding"
else
    print_fail "Main application not responding"
    exit 1
fi

# Test database connectivity
print_test "Testing database connectivity..."
if docker-compose exec -T postgres pg_isready -U b2b_user -d b2b_licenses > /dev/null 2>&1; then
    print_pass "Database connection successful"
else
    print_fail "Database connection failed"
    exit 1
fi

# Test Redis connectivity
print_test "Testing Redis connectivity..."
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_pass "Redis connection successful"
else
    print_fail "Redis connection failed"
    exit 1
fi

# Test nginx proxy (if running)
print_test "Testing nginx proxy..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    print_pass "Nginx proxy responding"
else
    print_fail "Nginx proxy not responding (this may be expected if nginx is not running)"
fi

echo ""
echo -e "${GREEN}✅ All Docker tests passed!${NC}"
echo ""
echo "🔗 Available endpoints:"
echo "   Application: http://localhost:5000"
echo "   Health Check: http://localhost:5000/health"
echo "   Metrics: http://localhost:5000/metrics"
echo "   Nginx Proxy: http://localhost (if configured)"