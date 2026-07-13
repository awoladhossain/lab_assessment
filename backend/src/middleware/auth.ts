import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Read token from authorization header or cookie
  let token = req.cookies?.auth_token;

  if (!token && req.headers.cookie) {
    const rawCookies = req.headers.cookie.split(';');
    for (const cookie of rawCookies) {
      const [key, val] = cookie.trim().split('=');
      if (key === 'auth_token') {
        token = val;
        break;
      }
    }
  }

  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};
