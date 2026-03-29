import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth.js';

const cacheStore = new Map<string, { value: unknown; expiry: number }>();

function buildCacheKey(req: AuthRequest) {
  const scopeIds = Array.isArray((req as any).condominioIds)
    ? [...(req as any).condominioIds].sort((left, right) => left.localeCompare(right)).join(',')
    : 'all';

  return `__express__${req.originalUrl || req.url}__${scopeIds}`;
}

export const apiCache = (durationSeconds: number) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const key = buildCacheKey(req);
    const cachedItem = cacheStore.get(key);
    if (cachedItem && cachedItem.expiry > Date.now()) {
      res.json(cachedItem.value);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      cacheStore.set(key, {
        value: body,
        expiry: Date.now() + durationSeconds * 1000,
      });
      return originalJson(body);
    };

    next();
  };
};
