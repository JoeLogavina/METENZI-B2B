# Quick Start Guide - Microservices

## Why Microservices?

Your B2B License Management platform is now split into 3 independent services for better security and scalability:
- **Admin Portal** (5001) - Completely isolated from customer access
- **B2B Portal** (5002) - Customer-facing application  
- **Core API** (5003) - Central database and business logic

## Running the Services

Since you're in the Replit environment, the setup is already done. To run the microservices:

```bash
# In the main terminal
cd services
./run-all.sh
```

This starts all three services. You can then access:
- Admin Portal: http://localhost:5001
- B2B Portal: http://localhost:5002

## That's It!

The microservices are now running with:
- ✓ Separate authentication systems
- ✓ Independent session management
- ✓ Inter-service security
- ✓ Complete isolation between admin and customers

No additional setup needed - the services use your existing database and environment variables.