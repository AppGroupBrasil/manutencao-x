import { Request, Response, NextFunction } from 'express';

function snakeToCamel(key: string) {
  return key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

function convert(value: any): any {
  if (Array.isArray(value)) return value.map(convert);
  if (value === null || typeof value !== 'object') return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  const out: Record<string, any> = {};
  for (const key of Object.keys(value)) {
    out[snakeToCamel(key)] = convert(value[key]);
  }
  return out;
}

/**
 * O frontend converte todas as chaves do body para snake_case (toSnake em api.ts),
 * mas schemas Zod e handlers usam camelCase. Normaliza aqui, no caminho de entrada.
 * Não aplicar em /api/portal, /api/provisioning e /api/sso (contratos snake_case).
 */
export function camelizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') req.body = convert(req.body);
  next();
}
