require('dotenv').config({ path: '../../.env' });

const {
  initOutboxLogger,
  getPendingMessages,
  markAsProcessing,
  markAsPublished,
  markAsFailed,
  markForRetry,
  getOutboxStats,
  closeOutboxLogger
} = require('../shared/outbox-logger');

const { Kafka } = require('kafkajs');

// Configuration
const POLL_INTERVAL_MS = parseInt(process.env.OUTBOX_POLL_INTERVAL) || 1000;
const BATCH_SIZE = parseInt(process.env.OUTBOX_BATCH_SIZE) || 10;
const MAX_RETRIES = parseInt(process.env.OUTBOX_MAX_RETRIES) || 3;
const LOGS_TOPIC = 'logs';

// Simulation flags (can be toggled via API)
let kafkaEnabled = true;

// Kafka setup
const kafka = new Kafka({
  clientId: 'outbox-processor',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

let producer = null;

async function initKafkaProducer() {
  producer = kafka.producer();
  await producer.connect();
  console.log('Outbox Processor: Kafka producer connected');
}

async function processOutbox() {
  if (!kafkaEnabled) {
    // Kafka is "down" for simulation
    return;
  }

  try {
    const pendingMessages = await getPendingMessages(BATCH_SIZE);

    for (const msg of pendingMessages) {
      try {
        // Mark as processing
        await markAsProcessing(msg.messageId);

        // Publish to Kafka
        await producer.send({
          topic: LOGS_TOPIC,
          messages: [{
            key: msg.correlationId,
            value: JSON.stringify({
              messageId: msg.messageId,
              correlationId: msg.correlationId,
              service: msg.service,
              level: msg.level,
              message: msg.message,
              metadata: msg.metadata,
              timestamp: msg.createdAt
            }),
            headers: {
              correlationId: Buffer.from(msg.correlationId),
              messageId: Buffer.from(msg.messageId)
            }
          }]
        });

        // Mark as published
        await markAsPublished(msg.messageId);
        console.log(`[Processor] Published: ${msg.messageId} (${msg.service})`);

      } catch (error) {
        console.error(`[Processor] Failed to publish ${msg.messageId}:`, error.message);

        if (msg.retryCount >= MAX_RETRIES) {
          await markAsFailed(msg.messageId, error);
          console.log(`[Processor] Max retries reached for ${msg.messageId}, marking as failed`);
        } else {
          await markForRetry(msg.messageId);
          console.log(`[Processor] Will retry ${msg.messageId} (attempt ${msg.retryCount + 1})`);
        }
      }
    }
  } catch (error) {
    console.error('[Processor] Error processing outbox:', error.message);
  }
}

async function startProcessor() {
  console.log('=== Outbox Processor Starting ===');
  console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Max retries: ${MAX_RETRIES}`);

  await initOutboxLogger();
  await initKafkaProducer();

  // Initial stats
  const stats = await getOutboxStats();
  console.log('Initial outbox stats:', stats);

  // Start polling loop
  setInterval(processOutbox, POLL_INTERVAL_MS);
  console.log('Outbox Processor running...\n');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (producer) await producer.disconnect();
  await closeOutboxLogger();
  process.exit(0);
});

// Export for simulation control
module.exports = {
  setKafkaEnabled: (enabled) => {
    kafkaEnabled = enabled;
    console.log(`[Processor] Kafka ${enabled ? 'ENABLED' : 'DISABLED'}`);
  },
  isKafkaEnabled: () => kafkaEnabled
};

// Start if run directly
if (require.main === module) {
  startProcessor().catch(console.error);
}
