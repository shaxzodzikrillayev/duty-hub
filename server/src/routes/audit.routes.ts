import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireStaff } from '../middleware/auth.js';
import * as auditRepo from '../repositories/audit.repo.js';

export const auditRouter = Router();

auditRouter.use(requireAuth, requireStaff);

/** Журнал изменений — доступен старосте (чтение) и куратору (полный доступ). */
auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const action = typeof req.query.action === 'string' ? req.query.action : undefined;

    const { total, items } = auditRepo.listAudit(limit, offset);
    const filtered = action ? items.filter((i) => i.action === action) : items;

    res.json({ items: filtered, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);
