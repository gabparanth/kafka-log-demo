require('dotenv').config({ path: '../../.env' });

const { Kafka } = require('kafkajs');
const { MongoClient } = require('mongodb');

// Configuration
const LOGS_TOPIC = 'logs';
const CONSUMER_GROUP = 'log-consumer-group';

// Simulation flag
let atlasEnabled = true;

// Kafka setup
const kafka = new Kafka({
  clientId: 'log-consumer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

// MongoDB Atlas setup
let atlasClient = null;
let logsCollection = null;

async function initAtlasConnection() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not set');
  }
  atlasClient = new MongoClient(process.env.MONGODB_URI);
  await atlasClient.connect();
  const db = atlasClient.db(process.env.MONGODB_DB || 'log_demo');
  logsCollection = db.collection(process.env.MONGODB_COLLECTION || 'logs');
  console.log('Log Consumer: Connected to MongoDB Atlas');
}

async function startConsumer() {
  console.log('=== Log Consumer Starting ===');

  await initAtlasConnection();

  const consumer = kafka.consumer({ groupId: CONSUMER_GROUP });
  await consumer.connect();
  console.log('Log Consumer: Kafka consumer connected');

  await consumer.subscribe({ topic: LOGS_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const logEntry = JSON.parse(message.value.toString());

        if (!atlasEnabled) {
          console.log(`[Consumer] Atlas disabled, skipping: ${logEntry.messageId}`);
          return;
        }

        // Add received timestamp
        logEntry.receivedAt = new Date();

        // Check for duplicates (idempotency)
        const existing = await logsCollection.findOne({ messageId: logEntry.messageId });
        if (existing) {
          console.log(`[Consumer] Duplicate skipped: ${logEntry.messageId}`);
          return;
        }

        // Write to Atlas
        await logsCollection.insertOne(logEntry);
        console.log(`[Consumer] Stored in Atlas: ${logEntry.messageId} (${logEntry.service})`);

      } catch (error) {
        console.error('[Consumer] Error processing message:', error.message);
      }
    }
  });

  console.log('Log Consumer running...\n');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (atlasClient) await atlasClient.close();
  process.exit(0);
});

// Export for simulation control
module.exports = {
  setAtlasEnabled: (enabled) => {
    atlasEnabled = enabled;
    console.log(`[Consumer] Atlas ${enabled ? 'ENABLED' : 'DISABLED'}`);
  },
  isAtlasEnabled: () => atlasEnabled
};

// Start if run directly
if (require.main === module) {
  startConsumer().catch(console.error);
}
