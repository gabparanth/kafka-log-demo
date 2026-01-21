'use client';

import { useState, useEffect } from 'react';

interface Log {
  _id: string;
  correlationId: string;
  service: string;
  level: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface GroupedLogs {
  [correlationId: string]: Log[];
}

export default function LogViewer() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [groupedLogs, setGroupedLogs] = useState<GroupedLogs>({});
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');
  const [selectedCorrelationId, setSelectedCorrelationId] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs?limit=200');
      const data = await res.json();
      setLogs(data.logs || []);

      // Group logs by correlationId
      const grouped: GroupedLogs = {};
      (data.logs || []).forEach((log: Log) => {
        if (!grouped[log.correlationId]) {
          grouped[log.correlationId] = [];
        }
        grouped[log.correlationId].push(log);
      });

      // Sort each group by timestamp ascending
      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      setGroupedLogs(grouped);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusColor = (logs: Log[]) => {
    const hasError = logs.some(log => log.level === 'ERROR');
    const isComplete = logs.some(log => log.message.includes('completed successfully'));
    if (hasError) return 'border-red-500 bg-red-50';
    if (isComplete) return 'border-green-500 bg-green-50';
    return 'border-yellow-500 bg-yellow-50';
  };

  const getLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      INFO: 'bg-blue-100 text-blue-800',
      ERROR: 'bg-red-100 text-red-800',
      WARN: 'bg-yellow-100 text-yellow-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const getServiceBadge = (service: string) => {
    const colors: Record<string, string> = {
      'order-service': 'bg-purple-100 text-purple-800',
      'payment-service': 'bg-indigo-100 text-indigo-800',
      'notification-service': 'bg-teal-100 text-teal-800',
    };
    return colors[service] || 'bg-gray-100 text-gray-800';
  };

  const filteredGroupedLogs = Object.entries(groupedLogs).filter(([_, logs]) => {
    if (serviceFilter === 'all') return true;
    return logs.some(log => log.service === serviceFilter);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Log Management Dashboard</h1>
        <p className="text-gray-600">End-to-end monitoring with Kafka + MongoDB</p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">View:</label>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'list' | 'grouped')}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="grouped">Grouped by Correlation ID</option>
            <option value="list">List View</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Service:</label>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="all">All Services</option>
            <option value="order-service">Order Service</option>
            <option value="payment-service">Payment Service</option>
            <option value="notification-service">Notification Service</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Auto-refresh:</label>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              autoRefresh
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>

        <button
          onClick={fetchLogs}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          Refresh Now
        </button>

        <div className="ml-auto text-sm text-gray-500">
          {logs.length} logs | {Object.keys(groupedLogs).length} transactions
        </div>
      </div>

      {/* Grouped View */}
      {viewMode === 'grouped' && (
        <div className="space-y-4">
          {filteredGroupedLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No logs yet. Trigger an order to see logs appear.
            </div>
          ) : (
            filteredGroupedLogs.map(([correlationId, logs]) => (
              <div
                key={correlationId}
                className={`border-l-4 rounded-lg shadow-sm p-4 ${getStatusColor(logs)}`}
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setSelectedCorrelationId(
                    selectedCorrelationId === correlationId ? null : correlationId
                  )}
                >
                  <div>
                    <span className="font-mono text-sm text-gray-600">
                      {correlationId}
                    </span>
                    <div className="flex gap-2 mt-1">
                      {Array.from(new Set(logs.map(l => l.service))).map(service => (
                        <span key={service} className={`text-xs px-2 py-0.5 rounded ${getServiceBadge(service)}`}>
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      {new Date(logs[0].timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-sm font-medium">
                      {logs.length} events
                    </div>
                  </div>
                </div>

                {selectedCorrelationId === correlationId && (
                  <div className="mt-4 space-y-2 border-t pt-4">
                    {logs.map((log, idx) => (
                      <div key={log._id || idx} className="flex items-start gap-3 text-sm">
                        <div className="w-20 flex-shrink-0 text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getServiceBadge(log.service)}`}>
                          {log.service.replace('-service', '')}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelBadge(log.level)}`}>
                          {log.level}
                        </span>
                        <span className="text-gray-800">{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Correlation ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log, idx) => (
                <tr key={log._id || idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getServiceBadge(log.service)}`}>
                      {log.service}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelBadge(log.level)}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-800">{log.message}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{log.correlationId.slice(0, 8)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
