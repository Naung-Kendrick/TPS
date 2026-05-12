// retryQueue.js — persists failed Supabase writes and replays them when online
import { supabase } from './supabase';

const QUEUE_KEY = 'tps_retry_queue';

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (_) { return []; }
}

function saveQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (_) {}
}

// Add a failed operation to the queue
// op: { table, type: 'insert'|'update'|'delete', payload, id? }
export function enqueue(op) {
  const q = loadQueue();
  q.push({ ...op, queuedAt: new Date().toISOString(), id: op.id || crypto.randomUUID() });
  saveQueue(q);
}

export function queueLength() {
  return loadQueue().length;
}

// Attempt to drain the queue — call this on app start and on 'online' event
export async function drainQueue(onProgress) {
  const q = loadQueue();
  if (q.length === 0) return { synced: 0, failed: 0 };

  const remaining = [];
  let synced = 0;

  for (const op of q) {
    try {
      let error = null;
      if (op.type === 'insert') {
        ({ error } = await supabase.from(op.table).insert([op.payload]));
      } else if (op.type === 'update') {
        ({ error } = await supabase.from(op.table).update(op.payload).eq('id', op.recordId));
      } else if (op.type === 'delete') {
        ({ error } = await supabase.from(op.table).delete().eq('id', op.recordId));
      }

      if (error) {
        remaining.push(op);
      } else {
        synced++;
        if (onProgress) onProgress(synced, q.length);
      }
    } catch (_) {
      remaining.push(op);
    }
  }

  saveQueue(remaining);
  return { synced, failed: remaining.length };
}
