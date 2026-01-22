import { MongoClient, Db, Collection } from 'mongodb';

const LOCAL_MONGODB_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017';

let client: MongoClient | null = null;
let db: Db | null = null;

declare global {
  var _outboxClientPromise: Promise<MongoClient> | undefined;
}

async function getOutboxClient(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    if (!global._outboxClientPromise) {
      client = new MongoClient(LOCAL_MONGODB_URI);
      global._outboxClientPromise = client.connect();
    }
    return global._outboxClientPromise;
  } else {
    if (!client) {
      client = new MongoClient(LOCAL_MONGODB_URI);
      await client.connect();
    }
    return client;
  }
}

export async function getOutboxCollection(): Promise<Collection> {
  const client = await getOutboxClient();
  const db = client.db('outbox_db');
  return db.collection('outbox');
}

export interface OutboxStats {
  pending: number;
  processing: number;
  published: number;
  failed: number;
  total: number;
}

export async function getOutboxStats(): Promise<OutboxStats> {
  const collection = await getOutboxCollection();

  const stats = await collection.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  const result: OutboxStats = {
    pending: 0,
    processing: 0,
    published: 0,
    failed: 0,
    total: 0
  };

  stats.forEach((s: any) => {
    result[s._id as keyof OutboxStats] = s.count;
    result.total += s.count;
  });

  return result;
}

export interface OutboxMessage {
  messageId: string;
  correlationId: string;
  service: string;
  level: string;
  message: string;
  metadata: Record<string, any>;
  status: 'pending' | 'processing' | 'published' | 'failed';
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  error: string | null;
}

export async function getRecentMessages(limit: number = 50): Promise<OutboxMessage[]> {
  const collection = await getOutboxCollection();

  return collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as unknown as OutboxMessage[];
}
