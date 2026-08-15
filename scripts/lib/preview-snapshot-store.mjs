/**
 * preview-snapshot-store.mjs — Persistent preview snapshot store abstraction.
 *
 * Backends:
 *   upstash     — production / Vercel Preview / Vercel Production (REST, no SDK)
 *   memory      — unit tests / local default
 *   filesystem  — local dev ONLY (PREVIEW_STORE_ALLOW_FILESYSTEM=1, forbidden on Vercel)
 *
 * PRODUCTION USE of filesystem = FORBIDDEN (fail-closed on VERCEL=1).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SNAPSHOT_TTL_SECONDS,
  deserializeSnapshot,
  isExpiredSnapshot,
  isValidToken,
  serializeSnapshot,
} from './preview-snapshot-schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const FIXTURE_SNAPSHOT_DIR = path.join(ROOT, 'data/preview_snapshots');

export class PreviewStoreError extends Error {
  constructor(message, code = 'PREVIEW_STORE_ERROR') {
    super(message);
    this.name = 'PreviewStoreError';
    this.code = code;
  }
}

function tokenHash(token) {
  if (!token) return 'none';
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 8);
}

export function logPreviewStoreEvent(event, token, extra = {}) {
  if (process.env.PREVIEW_STORE_SILENT === '1') return;
  const payload = { event, token_hash: tokenHash(token), ...extra };
  console.error(JSON.stringify(payload));
}

export function resolvePreviewStoreBackend() {
  const explicit = (process.env.PREVIEW_STORE_BACKEND || '').trim().toLowerCase();
  const onVercel = process.env.VERCEL === '1';

  if (onVercel) {
    if (explicit === 'filesystem' || explicit === 'memory') {
      throw new PreviewStoreError(
        'filesystem/memory backend forbidden on Vercel',
        'PREVIEW_STORE_FORBIDDEN_BACKEND',
      );
    }
    return 'upstash';
  }

  if (explicit) {
    if (explicit === 'filesystem' && process.env.PREVIEW_STORE_ALLOW_FILESYSTEM !== '1') {
      throw new PreviewStoreError(
        'filesystem backend requires PREVIEW_STORE_ALLOW_FILESYSTEM=1',
        'PREVIEW_STORE_FORBIDDEN_BACKEND',
      );
    }
    return explicit;
  }

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'upstash';
  }
  if (process.env.PREVIEW_STORE_ALLOW_FILESYSTEM === '1') {
    return 'filesystem';
  }
  return 'memory';
}

function storageKey(token) {
  const prefix = (process.env.PREVIEW_STORE_KEY_PREFIX || 'preview:').replace(/\s/g, '');
  return `${prefix}${token}`;
}

function ttlSeconds() {
  const raw = Number(process.env.PREVIEW_STORE_TTL_SECONDS || SNAPSHOT_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : SNAPSHOT_TTL_SECONDS;
}

async function upstashPipeline(command) {
  const baseUrl = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!baseUrl || !token) {
    throw new PreviewStoreError('Upstash credentials missing', 'PREVIEW_STORE_UNCONFIGURED');
  }

  const res = await fetch(`${baseUrl}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command]),
  });

  if (!res.ok) {
    throw new PreviewStoreError(`Upstash HTTP ${res.status}`, 'PREVIEW_STORE_ERROR');
  }

  const data = await res.json().catch(() => ({}));
  if (Array.isArray(data)) {
    const item = data[0];
    if (item?.error) {
      throw new PreviewStoreError(String(item.error), 'PREVIEW_STORE_ERROR');
    }
    return item?.result;
  }
  if (data.error) {
    throw new PreviewStoreError(String(data.error), 'PREVIEW_STORE_ERROR');
  }
  const result = data.result;
  return Array.isArray(result) ? result[0] : result;
}

export class MemoryPreviewSnapshotStore {
  constructor() {
    this._data = new Map();
    this._expiresAt = new Map();
  }

  async save(snapshot) {
    const token = snapshot?.token;
    if (!isValidToken(token)) {
      throw new PreviewStoreError('invalid token', 'PREVIEW_STORE_INVALID_TOKEN');
    }
    this._data.set(token, structuredClone(snapshot));
    this._expiresAt.set(token, Date.now() + ttlSeconds() * 1000);
    logPreviewStoreEvent('snapshot_write_success', token, { backend: 'memory' });
    return { ok: true, token };
  }

  async get(token) {
    if (!isValidToken(token)) {
      logPreviewStoreEvent('snapshot_read_not_found', token, { reason: 'invalid_token' });
      return null;
    }
    const exp = this._expiresAt.get(token);
    if (exp && Date.now() > exp) {
      this._data.delete(token);
      this._expiresAt.delete(token);
      logPreviewStoreEvent('snapshot_read_expired', token, { backend: 'memory' });
      return null;
    }
    const snap = this._data.get(token);
    if (!snap) {
      logPreviewStoreEvent('snapshot_read_not_found', token, { backend: 'memory' });
      return null;
    }
    if (isExpiredSnapshot(snap)) {
      await this.delete(token);
      logPreviewStoreEvent('snapshot_read_expired', token, { backend: 'memory' });
      return null;
    }
    logPreviewStoreEvent('snapshot_read_success', token, { backend: 'memory' });
    return structuredClone(snap);
  }

  async delete(token) {
    if (!isValidToken(token)) return false;
    this._data.delete(token);
    this._expiresAt.delete(token);
    return true;
  }

  async healthcheck() {
    return { ok: true, backend: 'memory' };
  }
}

export class FilesystemPreviewSnapshotStore {
  constructor(dir = FIXTURE_SNAPSHOT_DIR) {
    if (process.env.VERCEL === '1') {
      throw new PreviewStoreError('filesystem forbidden on Vercel', 'PREVIEW_STORE_FORBIDDEN_BACKEND');
    }
    if (process.env.PREVIEW_STORE_ALLOW_FILESYSTEM !== '1') {
      throw new PreviewStoreError(
        'filesystem requires PREVIEW_STORE_ALLOW_FILESYSTEM=1',
        'PREVIEW_STORE_FORBIDDEN_BACKEND',
      );
    }
    this.dir = dir;
  }

  _path(token) {
    return path.join(this.dir, `${token}.json`);
  }

  async save(snapshot) {
    const token = snapshot?.token;
    if (!isValidToken(token)) {
      throw new PreviewStoreError('invalid token', 'PREVIEW_STORE_INVALID_TOKEN');
    }
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this._path(token), serializeSnapshot(snapshot), 'utf8');
    logPreviewStoreEvent('snapshot_write_success', token, { backend: 'filesystem' });
    return { ok: true, token };
  }

  async get(token) {
    if (!isValidToken(token)) {
      logPreviewStoreEvent('snapshot_read_not_found', token, { reason: 'invalid_token' });
      return null;
    }
    const filePath = this._path(token);
    if (!fs.existsSync(filePath)) {
      logPreviewStoreEvent('snapshot_read_not_found', token, { backend: 'filesystem' });
      return null;
    }
    const snap = deserializeSnapshot(fs.readFileSync(filePath, 'utf8'));
    if (!snap) {
      logPreviewStoreEvent('snapshot_read_not_found', token, { backend: 'filesystem', reason: 'parse_error' });
      return null;
    }
    if (isExpiredSnapshot(snap)) {
      logPreviewStoreEvent('snapshot_read_expired', token, { backend: 'filesystem' });
      return null;
    }
    logPreviewStoreEvent('snapshot_read_success', token, { backend: 'filesystem' });
    return snap;
  }

  async delete(token) {
    if (!isValidToken(token)) return false;
    const filePath = this._path(token);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  async healthcheck() {
    return { ok: fs.existsSync(this.dir), backend: 'filesystem' };
  }
}

export class UpstashPreviewSnapshotStore {
  async save(snapshot) {
    const token = snapshot?.token;
    if (!isValidToken(token)) {
      throw new PreviewStoreError('invalid token', 'PREVIEW_STORE_INVALID_TOKEN');
    }
    const key = storageKey(token);
    const payload = serializeSnapshot(snapshot);
    try {
      const result = await upstashPipeline(['SETEX', key, ttlSeconds(), payload]);
      if (result !== 'OK') {
        throw new PreviewStoreError(`SETEX unexpected: ${result}`, 'PREVIEW_STORE_ERROR');
      }
      logPreviewStoreEvent('snapshot_write_success', token, { backend: 'upstash' });
      return { ok: true, token };
    } catch (e) {
      logPreviewStoreEvent('snapshot_write_failure', token, {
        backend: 'upstash',
        error: e.code || e.message,
      });
      throw e;
    }
  }

  async get(token) {
    if (!isValidToken(token)) {
      logPreviewStoreEvent('snapshot_read_not_found', token, { reason: 'invalid_token' });
      return null;
    }
    const key = storageKey(token);
    try {
      const raw = await upstashPipeline(['GET', key]);
      if (raw == null) {
        logPreviewStoreEvent('snapshot_read_not_found', token, { backend: 'upstash' });
        return null;
      }
      const snap = deserializeSnapshot(raw);
      if (!snap) {
        logPreviewStoreEvent('snapshot_read_not_found', token, { backend: 'upstash', reason: 'parse_error' });
        return null;
      }
      if (isExpiredSnapshot(snap)) {
        await this.delete(token);
        logPreviewStoreEvent('snapshot_read_expired', token, { backend: 'upstash' });
        return null;
      }
      logPreviewStoreEvent('snapshot_read_success', token, { backend: 'upstash' });
      return snap;
    } catch (e) {
      logPreviewStoreEvent('snapshot_store_error', token, {
        backend: 'upstash',
        phase: 'read',
        error: e.code || e.message,
      });
      throw e;
    }
  }

  async delete(token) {
    if (!isValidToken(token)) return false;
    await upstashPipeline(['DEL', storageKey(token)]);
    return true;
  }

  async healthcheck() {
    const pong = await upstashPipeline(['PING']);
    return { ok: pong === 'PONG', backend: 'upstash' };
  }
}

let _singleton = null;

export function createPreviewSnapshotStore(backend = resolvePreviewStoreBackend()) {
  if (backend === 'upstash') return new UpstashPreviewSnapshotStore();
  if (backend === 'filesystem') return new FilesystemPreviewSnapshotStore();
  if (backend === 'memory') return new MemoryPreviewSnapshotStore();
  throw new PreviewStoreError(`unknown backend: ${backend}`, 'PREVIEW_STORE_UNKNOWN_BACKEND');
}

export function getPreviewSnapshotStore() {
  if (!_singleton) {
    _singleton = createPreviewSnapshotStore();
  }
  return _singleton;
}

export function resetPreviewSnapshotStore() {
  _singleton = null;
}

export async function loadSnapshot(token) {
  return getPreviewSnapshotStore().get(token);
}

export async function saveSnapshot(snapshot) {
  return getPreviewSnapshotStore().save(snapshot);
}
