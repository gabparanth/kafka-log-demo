import { NextResponse } from 'next/server';
import { getOutboxStats, getRecentMessages } from '@/lib/outbox-db';

export async function GET() {
  try {
    const stats = await getOutboxStats();
    const recentMessages = await getRecentMessages(20);

    return NextResponse.json({
      stats,
      recentMessages,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch outbox stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outbox stats' },
      { status: 500 }
    );
  }
}
