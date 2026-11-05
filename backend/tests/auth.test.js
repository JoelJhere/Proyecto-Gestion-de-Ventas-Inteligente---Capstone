import { jest, describe, it, expect } from '@jest/globals';
import { verificarToken } from '../middleware/auth.middleware.js';

describe('Pruebas de Seguridad - Middleware Auth', () => {
  it('Debe denegar el acceso (403) si no se envía un token', () => {
    const req = { headers: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acceso denegado. No hay token de seguridad.' });
    expect(next).not.toHaveBeenCalled();
  });
});