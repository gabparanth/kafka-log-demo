const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

let client = null;
let db = null;
let collection = null;

async function initLogger() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db(process.env.MONGODB_DB || 'log_demo');
    collection = db.collection(process.env.MONGODB_COLLECTION || 'logs');
    console.log('Logger connected to MongoDB');
  }
}

function generateCorrelationId() {
  return uuidv4();
}

async function log(serviceName, level, message, correlationId, metadata = {}) {
  const logEntry = {
    correlationId,
    service: serviceName,
    level,
    message,
    timestamp: new Date(),
    metadata
  };

  // Console output for local debugging
  console.log(`[${serviceName}] [${level}] [${correlationId}] ${message}`);

  // Persist to MongoDB
  if (collection) {
    try {
      await collection.insertOne(logEntry);
    } catch (err) {
      console.error('Failed to write log to MongoDB:', err.message);
    }
  }

  return logEntry;
}

async function closeLogger() {
  if (client) {
    await client.close();
    client = null;
  }
}

module.exports = {
  initLogger,
  generateCorrelationId,
  log,
  closeLogger
};
