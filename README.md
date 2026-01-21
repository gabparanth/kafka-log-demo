# Kafka Log Management Demo

End-to-end log monitoring demo with Kafka, MongoDB Atlas, and Next.js.

## Architecture

- **3 Microservices**: Order → Payment → Notification
- **Kafka**: Message broker (Docker)
- **MongoDB Atlas**: Log storage
- **Next.js Dashboard**: Log visualization (Vercel)

## Quick Start

```bash
# Start Kafka
docker-compose up -d

# Start services
cd services/order-service && npm start
cd services/payment-service && npm start
cd services/notification-service && npm start

# Trigger order
curl http://localhost:3001/order
```

## Demo Scenarios

- Happy path: `curl http://localhost:3001/order`
- Payment error: `curl http://localhost:3001/order?fail=payment`
- Notification error: `curl http://localhost:3001/order?fail=notification`
