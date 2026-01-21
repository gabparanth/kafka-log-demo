const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'log-demo',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const TOPICS = {
  ORDERS: 'orders',
  PAYMENTS: 'payments'
};

async function createProducer() {
  const producer = kafka.producer();
  await producer.connect();
  return producer;
}

async function createConsumer(groupId) {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  return consumer;
}

// Helper to extract correlation ID from Kafka headers
function getCorrelationId(headers) {
  if (headers && headers.correlationId) {
    return headers.correlationId.toString();
  }
  return null;
}

// Helper to set correlation ID in Kafka headers
function setCorrelationId(correlationId) {
  return { correlationId: Buffer.from(correlationId) };
}

module.exports = {
  kafka,
  TOPICS,
  createProducer,
  createConsumer,
  getCorrelationId,
  setCorrelationId
};
