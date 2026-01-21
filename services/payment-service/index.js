require('dotenv').config({ path: '../../.env' });

const { initLogger, log } = require('../shared/logger');
const { createProducer, createConsumer, TOPICS, getCorrelationId, setCorrelationId } = require('../shared/kafka');

let producer = null;

async function init() {
  await initLogger();
  producer = await createProducer();
  const consumer = await createConsumer('payment-service-group');

  await consumer.subscribe({ topic: TOPICS.ORDERS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const correlationId = getCorrelationId(message.headers);
      const order = JSON.parse(message.value.toString());

      await log('payment-service', 'INFO', 'Received order for payment', correlationId, {
        orderId: order.orderId,
        amount: order.amount
      });

      // Simulate payment processing
      await log('payment-service', 'INFO', 'Processing payment', correlationId);

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check for simulated failure
      if (order.failAt === 'payment') {
        await log('payment-service', 'ERROR', 'Payment failed: Insufficient funds', correlationId);
        return; // Stop processing
      }

      await log('payment-service', 'INFO', 'Payment successful', correlationId, {
        transactionId: `TXN-${Date.now()}`
      });

      // Publish payment result to Kafka
      const paymentResult = {
        orderId: order.orderId,
        transactionId: `TXN-${Date.now()}`,
        status: 'completed',
        failAt: order.failAt
      };

      await producer.send({
        topic: TOPICS.PAYMENTS,
        messages: [{
          value: JSON.stringify(paymentResult),
          headers: setCorrelationId(correlationId)
        }]
      });

      await log('payment-service', 'INFO', 'Payment result published', correlationId);
    }
  });

  console.log('Payment Service initialized and listening');
}

init().catch(console.error);
