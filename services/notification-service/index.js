require('dotenv').config({ path: '../../.env' });

const { initLogger, log } = require('../shared/logger');
const { createConsumer, TOPICS, getCorrelationId } = require('../shared/kafka');

async function init() {
  await initLogger();
  const consumer = await createConsumer('notification-service-group');

  await consumer.subscribe({ topic: TOPICS.PAYMENTS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const correlationId = getCorrelationId(message.headers);
      const payment = JSON.parse(message.value.toString());

      await log('notification-service', 'INFO', 'Received payment confirmation', correlationId, {
        orderId: payment.orderId,
        transactionId: payment.transactionId
      });

      // Simulate notification processing
      await log('notification-service', 'INFO', 'Preparing notification', correlationId);

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check for simulated failure
      if (payment.failAt === 'notification') {
        await log('notification-service', 'ERROR', 'Notification failed: Email service unavailable', correlationId);
        return;
      }

      await log('notification-service', 'INFO', 'Email notification sent to customer', correlationId, {
        notificationType: 'email',
        recipient: 'customer@example.com'
      });

      await log('notification-service', 'INFO', 'Order flow completed successfully', correlationId);
    }
  });

  console.log('Notification Service initialized and listening');
}

init().catch(console.error);
