require('dotenv').config({ path: '../../.env' });

const express = require('express');
const { initLogger, generateCorrelationId, log } = require('../shared/logger');
const { createProducer, TOPICS, setCorrelationId } = require('../shared/kafka');

const app = express();
const PORT = process.env.ORDER_SERVICE_PORT || 3001;

let producer = null;

async function init() {
  await initLogger();
  producer = await createProducer();
  console.log('Order Service initialized');
}

app.get('/order', async (req, res) => {
  const correlationId = generateCorrelationId();
  const failAt = req.query.fail; // For error simulation

  try {
    // Log order received
    await log('order-service', 'INFO', 'Order received', correlationId, {
      orderId: `ORD-${Date.now()}`
    });

    // Simulate order processing
    await log('order-service', 'INFO', 'Processing order', correlationId);

    // Publish to Kafka
    const orderData = {
      orderId: `ORD-${Date.now()}`,
      amount: Math.floor(Math.random() * 1000) + 100,
      failAt // Pass failure flag downstream
    };

    await producer.send({
      topic: TOPICS.ORDERS,
      messages: [{
        value: JSON.stringify(orderData),
        headers: setCorrelationId(correlationId)
      }]
    });

    await log('order-service', 'INFO', 'Order published to Kafka', correlationId);

    res.json({
      success: true,
      correlationId,
      message: 'Order created and sent for processing'
    });

  } catch (error) {
    await log('order-service', 'ERROR', `Order failed: ${error.message}`, correlationId);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

init().then(() => {
  app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
  });
}).catch(console.error);
