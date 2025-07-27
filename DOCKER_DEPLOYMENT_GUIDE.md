# 🐳 Docker Deployment Guide - B2B License Management Platform

## 📋 Prerequisites

- **Docker** (v20.10+)
- **Docker Compose** (v2.0+)
- **Git** (for cloning the repository)
- **4GB RAM minimum** (8GB recommended)
- **20GB disk space** (for containers and data)

## 🚀 Quick Start

### 1. **Development Environment**
```bash
# Clone and start development environment
git clone <repository-url>
cd b2b-license-platform

# Start development containers
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### 2. **Production Environment**
```bash
# Use the automated setup script
chmod +x scripts/docker-setup.sh
./scripts/docker-setup.sh

# Or manual setup
docker-compose up -d
```

## 📦 Container Architecture

### **Services Overview**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │    │   B2B App       │    │   PostgreSQL    │
│   Port: 80/443  │────│   Port: 5000    │────│   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │     Redis       │
                       │   Port: 6379    │
                       └─────────────────┘
```

### **Container Details**

#### **1. B2B Application (`app`)**
- **Base Image**: Node.js 20 Alpine
- **Build**: Multi-stage for optimized size
- **Security**: Non-root user execution
- **Health Checks**: `/health` endpoint monitoring
- **Features**: Production-optimized build, security headers

#### **2. PostgreSQL Database (`postgres`)**
- **Image**: PostgreSQL 15 Alpine
- **Data Persistence**: Named volume (`postgres_data`)
- **Health Checks**: `pg_isready` monitoring
- **Backup Ready**: Volume mounted for easy backups

#### **3. Redis Cache (`redis`)**
- **Image**: Redis 7 Alpine
- **Purpose**: Session storage and application caching
- **Persistence**: AOF (Append Only File) enabled
- **Security**: Password protected

#### **4. Nginx Reverse Proxy (`nginx`)**
- **Features**: Load balancing, SSL termination, compression
- **Security**: Rate limiting, security headers
- **Performance**: Gzip compression, static file caching
- **SSL Ready**: Certificate mounting configured

## 🔧 Configuration

### **Environment Variables**

#### **Production (.env.docker)**
```bash
# Application
NODE_ENV=production
PORT=5000

# Database
POSTGRES_DB=b2b_licenses
POSTGRES_USER=b2b_user
POSTGRES_PASSWORD=CHANGE_IN_PRODUCTION
DATABASE_URL=postgresql://b2b_user:PASSWORD@postgres:5432/b2b_licenses

# Redis
REDIS_URL=redis://PASSWORD@redis:6379

# Security
SESSION_SECRET=CHANGE_TO_SECURE_RANDOM_STRING
CORS_ORIGIN=https://yourdomain.com
```

#### **Development (.env.dev)**
```bash
NODE_ENV=development
DATABASE_URL=postgresql://dev_user:dev_password@postgres-dev:5432/b2b_licenses_dev
REDIS_URL=redis://redis-dev:6379
SESSION_SECRET=development_session_secret
```

### **Port Mapping**

| Service | Container Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| Nginx | 80, 443 | 80, 443 | Web traffic |
| App | 5000 | 5000 | Direct app access |
| PostgreSQL | 5432 | 5432 | Database connection |
| Redis | 6379 | 6379 | Cache connection |

## 🛠️ Management Commands

### **Basic Operations**
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart app

# View logs
docker-compose logs -f app

# Scale application (multiple instances)
docker-compose up -d --scale app=3
```

### **Development Commands**
```bash
# Development environment
docker-compose -f docker-compose.dev.yml up -d

# Hot reload development
docker-compose -f docker-compose.dev.yml exec app-dev npm run dev

# Run tests in container
docker-compose -f docker-compose.dev.yml exec app-dev npm test
```

### **Database Management**
```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U b2b_user -d b2b_licenses

# Create database backup
docker-compose exec postgres pg_dump -U b2b_user b2b_licenses > backup.sql

# Restore database
docker-compose exec -T postgres psql -U b2b_user -d b2b_licenses < backup.sql

# Run database migrations
docker-compose exec app npm run db:push
```

### **Monitoring & Debugging**
```bash
# Check container health
docker-compose ps

# View container resource usage
docker stats

# Execute commands in container
docker-compose exec app sh

# View application logs
docker-compose logs app | grep ERROR
```

## 📊 Health Monitoring

### **Health Check Endpoints**
- **`/health`**: Basic health status
- **`/ready`**: Readiness for traffic
- **`/metrics`**: Performance metrics

### **Health Check Examples**
```bash
# Check application health
curl http://localhost:5000/health

# Check via nginx proxy
curl http://localhost/health

# Get performance metrics
curl http://localhost:5000/metrics
```

### **Expected Responses**
```json
// /health
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production"
}

// /metrics
{
  "timestamp": "2024-01-20T10:30:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": "150 MB",
    "heapTotal": "75 MB",
    "heapUsed": "45 MB"
  }
}
```

## 🔒 Security Configuration

### **Production Security Checklist**
- ✅ **Change Default Passwords**: Update all passwords in `.env.docker`
- ✅ **SSL Certificates**: Configure SSL for HTTPS
- ✅ **Firewall Rules**: Restrict unnecessary port access
- ✅ **Regular Updates**: Keep base images updated
- ✅ **Non-root Execution**: All containers run as non-root users
- ✅ **Security Headers**: Configured in Nginx
- ✅ **Rate Limiting**: API protection enabled

### **SSL Setup (Production)**
```bash
# Create SSL directory
mkdir -p ssl

# Copy your certificates
cp your-domain.crt ssl/cert.pem
cp your-domain.key ssl/key.pem

# Update nginx.conf to enable HTTPS server block
# Restart nginx
docker-compose restart nginx
```

## 📈 Performance Tuning

### **Production Optimizations**
```yaml
# docker-compose.yml additions
services:
  app:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

### **Database Tuning**
```bash
# PostgreSQL configuration
# Add to docker-compose.yml postgres service:
command: |
  postgres
  -c shared_preload_libraries=pg_stat_statements
  -c max_connections=100
  -c shared_buffers=256MB
  -c effective_cache_size=1GB
```

## 🔄 Backup & Recovery

### **Automated Backup Script**
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec postgres pg_dump -U b2b_user b2b_licenses > "backup_${DATE}.sql"
echo "Backup created: backup_${DATE}.sql"
```

### **Data Persistence**
- **PostgreSQL**: `postgres_data` volume
- **Redis**: `redis_data` volume
- **Application Logs**: Container logs via Docker logging drivers

## 🚨 Troubleshooting

### **Common Issues**

#### **Container Won't Start**
```bash
# Check logs
docker-compose logs app

# Check resource usage
docker system df

# Clean up unused resources
docker system prune
```

#### **Database Connection Failed**
```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready -U b2b_user

# Verify network connectivity
docker-compose exec app ping postgres
```

#### **Performance Issues**
```bash
# Monitor resource usage
docker stats

# Check application metrics
curl http://localhost:5000/metrics

# Analyze logs for errors
docker-compose logs app | grep -i error
```

### **Log Analysis**
```bash
# Real-time log monitoring
docker-compose logs -f --tail=100

# Filter logs by service
docker-compose logs nginx | grep "error"

# Export logs for analysis
docker-compose logs app > app_logs.txt
```

## 📝 Deployment Checklist

### **Pre-deployment**
- [ ] Update all passwords in `.env.docker`
- [ ] Configure SSL certificates
- [ ] Set up monitoring alerts
- [ ] Test backup/restore procedures
- [ ] Run security scans
- [ ] Performance test with expected load

### **Post-deployment**
- [ ] Verify all health checks pass
- [ ] Test application functionality
- [ ] Monitor resource usage
- [ ] Set up log aggregation
- [ ] Configure automated backups
- [ ] Document deployment specifics

## 🔗 Additional Resources

- **Docker Documentation**: https://docs.docker.com/
- **Docker Compose Reference**: https://docs.docker.com/compose/
- **PostgreSQL Docker**: https://hub.docker.com/_/postgres
- **Redis Docker**: https://hub.docker.com/_/redis
- **Nginx Docker**: https://hub.docker.com/_/nginx

---

This Docker setup provides a production-ready, scalable, and secure deployment for your B2B License Management Platform.