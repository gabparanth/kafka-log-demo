'use client';

import { useState, useEffect } from 'react';

interface OutboxMessage {
  messageId: string;
  correlationId: string;
  service: string;
  level: string;
  message: string;
  status: 'pending' | 'processing' | 'published' | 'failed';
  retryCount: number;
  createdAt: string;
  publishedAt: string | null;
  error: string | null;
}

interface OutboxStats {
  pending: number;
  processing: number;
  published: number;
  failed: number;
  total: number;
}

interface OutboxData {
  stats: OutboxStats;
  recentMessages: OutboxMessage[];
  timestamp: string;
}

export default function OutboxViewer() {
  const [data, setData] = useState<OutboxData | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [animatingMessages, setAnimatingMessages] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      const res = await fetch('/api/outbox/stats');
      const newData = await res.json();

      // Track newly published messages for animation
      if (data && newData.recentMessages) {
        const newlyPublished = newData.recentMessages.filter((msg: OutboxMessage) => {
          const oldMsg = data.recentMessages.find(m => m.messageId === msg.messageId);
          return oldMsg && oldMsg.status !== 'published' && msg.status === 'published';
        });

        if (newlyPublished.length > 0) {
          setAnimatingMessages(new Set(newlyPublished.map((m: OutboxMessage) => m.messageId)));
          setTimeout(() => setAnimatingMessages(new Set()), 2000);
        }
      }

      setData(newData);
    } catch (error) {
      console.error('Failed to fetch outbox data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'published': return 'bg-green-100 text-green-800 border-green-300';
      case 'failed': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '⚙️';
      case 'published': return '✓';
      case 'failed': return '✗';
      default: return '•';
    }
  };

  if (!data) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Outbox Pattern Visualizer</h1>
        <p className="text-gray-600">Reliable message delivery with local persistence</p>
      </div>

      {/* Flow Diagram */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Message Flow</h2>
        <div className="flex items-center justify-between gap-4">
          {/* Services */}
          <div className="flex flex-col items-center p-4 bg-purple-50 rounded-lg border-2 border-purple-200 min-w-[120px]">
            <div className="text-2xl mb-2">🔧</div>
            <div className="font-medium text-purple-800">Services</div>
            <div className="text-sm text-purple-600">Order, Payment, etc.</div>
          </div>

          {/* Arrow */}
          <div className="flex-1 flex items-center justify-center">
            <div className="h-1 bg-gradient-to-r from-purple-300 to-yellow-300 flex-1 relative">
              {data.stats.pending > 0 && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 animate-pulse">
                  <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                </div>
              )}
            </div>
            <span className="mx-2 text-gray-400">→</span>
          </div>

          {/* Outbox */}
          <div className={`flex flex-col items-center p-4 rounded-lg border-2 min-w-[120px] ${
            data.stats.pending > 0 ? 'bg-yellow-50 border-yellow-400' : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="text-2xl mb-2">📤</div>
            <div className="font-medium text-yellow-800">Outbox</div>
            <div className="text-2xl font-bold text-yellow-600">{data.stats.pending}</div>
            <div className="text-xs text-yellow-600">pending</div>
          </div>

          {/* Arrow */}
          <div className="flex-1 flex items-center justify-center">
            <div className="h-1 bg-gradient-to-r from-yellow-300 to-blue-300 flex-1 relative">
              {data.stats.processing > 0 && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 animate-bounce">
                  <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
                </div>
              )}
            </div>
            <span className="mx-2 text-gray-400">→</span>
          </div>

          {/* Kafka */}
          <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200 min-w-[120px]">
            <div className="text-2xl mb-2">📨</div>
            <div className="font-medium text-blue-800">Kafka</div>
            <div className="text-sm text-blue-600">Message Broker</div>
          </div>

          {/* Arrow */}
          <div className="flex-1 flex items-center justify-center">
            <div className="h-1 bg-gradient-to-r from-blue-300 to-green-300 flex-1"></div>
            <span className="mx-2 text-gray-400">→</span>
          </div>

          {/* Atlas */}
          <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg border-2 border-green-200 min-w-[120px]">
            <div className="text-2xl mb-2">🗄️</div>
            <div className="font-medium text-green-800">MongoDB Atlas</div>
            <div className="text-2xl font-bold text-green-600">{data.stats.published}</div>
            <div className="text-xs text-green-600">delivered</div>
          </div>
        </div>

        {/* Failed indicator */}
        {data.stats.failed > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <span className="text-red-700">{data.stats.failed} messages failed (max retries reached)</span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">{data.stats.pending}</div>
          <div className="text-sm text-yellow-700">Pending</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{data.stats.processing}</div>
          <div className="text-sm text-blue-700">Processing</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{data.stats.published}</div>
          <div className="text-sm text-green-700">Published</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{data.stats.failed}</div>
          <div className="text-sm text-red-700">Failed</div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-4 py-2 rounded text-sm font-medium ${
            autoRefresh
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-gray-100 text-gray-800 border border-gray-300'
          }`}
        >
          Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          Refresh Now
        </button>

        <div className="border-l pl-4 flex gap-2">
          <button
            onClick={async () => {
              await fetch('/api/outbox/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add-message' })
              });
              fetchData();
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700"
          >
            + Add Message
          </button>
          <button
            onClick={async () => {
              await fetch('/api/outbox/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add-messages', count: 5 })
              });
              fetchData();
            }}
            className="px-4 py-2 bg-purple-500 text-white rounded text-sm font-medium hover:bg-purple-600"
          >
            + Add 5
          </button>
          <button
            onClick={async () => {
              if (confirm('Clear all messages?')) {
                await fetch('/api/outbox/simulate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'clear-all' })
                });
                fetchData();
              }
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded text-sm font-medium hover:bg-gray-600"
          >
            Clear All
          </button>
        </div>

        <span className="text-sm text-gray-500 ml-auto">
          Last updated: {new Date(data.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Messages Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold">Recent Messages</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retries</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.recentMessages.map((msg) => (
              <tr
                key={msg.messageId}
                className={`hover:bg-gray-50 transition-all duration-500 ${
                  animatingMessages.has(msg.messageId) ? 'bg-green-100' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${getStatusColor(msg.status)}`}>
                    {getStatusIcon(msg.status)} {msg.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{msg.service}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{msg.message}</td>
                <td className="px-4 py-3 text-sm text-center">{msg.retryCount}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {msg.publishedAt ? new Date(msg.publishedAt).toLocaleTimeString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.recentMessages.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No messages yet. Trigger an order to see the outbox pattern in action.
          </div>
        )}
      </div>
    </div>
  );
}
