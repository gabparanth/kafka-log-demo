import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_MONGODB_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017';

let client: MongoClient | null = null;

async function getOutboxCollection() {
  if (!client) {
    client = new MongoClient(LOCAL_MONGODB_URI);
    await client.connect();
  }
  return client.db('outbox_db').collection('outbox');
}

// POST /api/outbox/simulate - Add test messages to outbox
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, count = 1 } = body;

    const collection = await getOutboxCollection();

    if (action === 'add-message' || action === 'add-messages') {
      const messages = [];
      const correlationId = uuidv4();

      for (let i = 0; i < count; i++) {
        const services = ['order-service', 'payment-service', 'notification-service'];
        const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR'];
        const messageTexts = [
          'Order created successfully',
          'Processing payment',
          'Payment completed',
          'Sending notification',
          'Notification sent',
          'Order flow completed'
        ];

        messages.push({
          messageId: uuidv4(),
          correlationId: count > 1 ? uuidv4() : correlationId,
          service: services[Math.floor(Math.random() * services.length)],
          level: levels[Math.floor(Math.random() * levels.length)],
          message: messageTexts[Math.floor(Math.random() * messageTexts.length)],
          metadata: { simulated: true, batchId: Date.now() },
          status: 'pending',
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: null,
          error: null
        });
      }

      await collection.insertMany(messages);

      return NextResponse.json({
        success: true,
        action: 'add-messages',
        count: messages.length,
        message: `Added ${messages.length} message(s) to outbox`
      });
    }

    if (action === 'clear-all') {
      const result = await collection.deleteMany({});
      return NextResponse.json({
        success: true,
        action: 'clear-all',
        deleted: result.deletedCount
      });
    }

    if (action === 'reset-failed') {
      const result = await collection.updateMany(
        { status: 'failed' },
        { $set: { status: 'pending', retryCount: 0, error: null, updatedAt: new Date() } }
      );
      return NextResponse.json({
        success: true,
        action: 'reset-failed',
        updated: result.modifiedCount
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: 'Simulation failed' },
      { status: 500 }
    );
  }
}
