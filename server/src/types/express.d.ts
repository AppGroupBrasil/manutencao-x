import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    condominioIds?: string[];
    requestId?: string;
  }
}
