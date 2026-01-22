const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

let client = null;
let db = null;
let outboxCollection = null;

const OUTBOX_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PUBLISHED: 'published',
  FAILED: 'failed'
};

async function initOutboxLogger() {
  if (!client) {
    const localMongoUri = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017';
    client = new MongoClient(localMongoUri);
    await client.connect();
    db = client.db('outbox_db');
    outboxCollection = db.collection('outbox');

    // Create indexes for efficient querying
    await outboxCollection.createIndex({ status: 1, createdAt: 1 });
    await outboxCollection.createIndex({ correlationId: 1 });

    console.log('Outbox Logger connected to local MongoDB');
  }
}

function generateCorrelationId() {
  return uuidv4();
}

function generateMessageId() {
  return uuidv4();
}

async function logToOutbox(serviceName, level, message, correlationId, metadata = {}) {
  const outboxEntry = {
    messageId: generateMessageId(),
    correlationId,
    service: serviceName,
    level,
    message,
    metadata,
    status: OUTBOX_STATUS.PENDING,
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    error: null
  };

  // Console output for local debugging
  console.log(`[${serviceName}] [${level}] [${correlationId}] ${message} (outbox: pending)`);

  // Write to local outbox
  if (outboxCollection) {
    try {
      await outboxCollection.insertOne(outboxEntry);
    } catch (err) {
      console.error('Failed to write to outbox:', err.message);
    }
  }

  return outboxEntry;
}

async function getOutboxStats() {
  if (!outboxCollection) return null;

  const stats = await outboxCollection.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  const result = {
    pending: 0,
    processing: 0,
    published: 0,
    failed: 0,
    total: 0
  };

  stats.forEach(s => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  return result;
}

async function getPendingMessages(limit = 10) {
  if (!outboxCollection) return [];

  return outboxCollection
    .find({ status: OUTBOX_STATUS.PENDING })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
}

async function markAsProcessing(messageId) {
  if (!outboxCollection) return;

  await outboxCollection.updateOne(
    { messageId },
    {
      $set: {
        status: OUTBOX_STATUS.PROCESSING,
        updatedAt: new Date()
      }
    }
  );
}

async function markAsPublished(messageId) {
  if (!outboxCollection) return;

  await outboxCollection.updateOne(
    { messageId },
    {
      $set: {
        status: OUTBOX_STATUS.PUBLISHED,
        publishedAt: new Date(),
        updatedAt: new Date()
      }
    }
  );
}

async function markAsFailed(messageId, error) {
  if (!outboxCollection) return;

  await outboxCollection.updateOne(
    { messageId },
    {
      $set: {
        status: OUTBOX_STATUS.FAILED,
        error: error.message || error,
        updatedAt: new Date()
      },
      $inc: { retryCount: 1 }
    }
  );
}

async function markForRetry(messageId) {
  if (!outboxCollection) return;

  await outboxCollection.updateOne(
    { messageId },
    {
      $set: {
        status: OUTBOX_STATUS.PENDING,
        updatedAt: new Date()
      },
      $inc: { retryCount: 1 }
    }
  );
}

async function getRecentMessages(limit = 20) {
  if (!outboxCollection) return [];

  return outboxCollection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

async function closeOutboxLogger() {
  if (client) {
    await client.close();
    client = null;
  }
}

module.exports = {
  initOutboxLogger,
  generateCorrelationId,
  logToOutbox,
  getOutboxStats,
  getPendingMessages,
  markAsProcessing,
  markAsPublished,
  markAsFailed,
  markForRetry,
  getRecentMessages,
  closeOutboxLogger,
  OUTBOX_STATUS
};
