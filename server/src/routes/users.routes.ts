import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { hashPassword, randomToken } from '../lib/crypto.js';
import { ROLES, type Role, type UserRow } from '../lib/types.js';
import { requireAuth, requireRole, requireStaff } from '../middleware/auth.js';
import * as usersRepo from '../repositories/users.repo.js';
import { logAction } from '../repositories/audit.repo.js';
import * as dutiesRepo from '../repositories/duties.repo.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Минимум 2 символа')
  .max(40, 'Максимум 40 символов')
  .regex(/^[\p{L}][\p{L}\s'-]*$/u, 'Только буквы, пробел, дефис или апостроф');

/** Список класса. Ученик видит базовую информацию, но не может её менять. */
usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const roleFilter = typeof req.query.role === 'string' ? req.query.role : undefined;
    const rows =
      roleFilter && ROLES.includes(roleFilter as Role)
        ? usersRepo.listByRoles(roleFilter as Role)
        : usersRepo.listAll();

    const staff = req.user!.role !== 'STUDENT';
    res.json({
      users: rows.map((r) => usersRepo.toPublicUser(r)),
      meta: {
        total: rows.length,
        canManage: staff,
        canEdit: req.user!.role === 'CURATOR',
      },
    });
  }),
);

const createSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  username: z
    .string()
    .trim()
    .min(3, 'Логин: минимум 3 символа')
    .max(24, 'Логин: максимум 24 символа')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Логин: латиница, цифры, точка, дефис, подчёркивание'),
  password: z.string().min(6, 'Пароль: минимум 6 символов').max(72).optional(),
  role: z.enum(ROLES).default('STUDENT'),
});

/**
 * Староста может заводить только учеников.
 * Назначать/снимать роли «староста» и «куратор» может только куратор.
 */
usersRouter.post(
  '/',
  requireStaff,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '), 'VALIDATION');

    const { firstName, lastName, username, role } = parsed.data;
    if (role !== 'STUDENT' && req.user!.role !== 'CURATOR') {
      throw forbidden('Добавлять аккаунты старосты или куратора может только куратор');
    }
    if (usersRepo.findByUsername(username)) throw conflict('Такой логин уже занят');

    const password = parsed.data.password ?? `Duty-${randomToken(4)}`;
    const user = usersRepo.insertUser({
      firstName,
      lastName,
      username,
      passwordHash: await hashPassword(password),
      role,
    });

    logAction({
      actor: req.actor!,
      action: 'USER_CREATE',
      entityType: 'user',
      entityId: user.id,
      summary: `Добавлен ученик: ${user.last_name} ${user.first_name}`,
      details: { username, role, passwordWasGenerated: parsed.data.password === undefined },
    });

    res.status(201).json({
      user: usersRepo.toPublicUser(user),
      initialPassword: parsed.data.password ? undefined : password,
    });
  }),
);

const updateSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).max(999).optional(),
});

/** Полное редактирование карточки ученика — привилегия куратора. */
usersRouter.patch(
  '/:id',
  requireRole('CURATOR'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = usersRepo.findById(id);
    if (!target) throw notFound('Пользователь не найден');

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '), 'VALIDATION');

    const patch = parsed.data;
    if (patch.username && usersRepo.findByUsername(patch.username)?.id !== id) {
      throw conflict('Такой логин уже занят');
    }
    if (target.id === req.user!.id && patch.isActive === false) {
      throw badRequest('Нельзя отключить собственный аккаунт');
    }
    if (
      target.role === 'CURATOR' &&
      (patch.role === undefined ? false : patch.role !== 'CURATOR') &&
      usersRepo.countByRole('CURATOR') <= 1
    ) {
      throw conflict('В системе должен остаться хотя бы один куратор');
    }

    const updated = usersRepo.updateUser(id, patch)!;
    const columns = {
      firstName: 'first_name',
      lastName: 'last_name',
      username: 'username',
      role: 'role',
      isActive: 'is_active',
      position: 'position',
    } as const;
    const readValue = (row: UserRow, key: keyof typeof columns): unknown => {
      const raw = (row as unknown as Record<string, unknown>)[columns[key]];
      return key === 'isActive' ? raw === 1 : raw;
    };
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(columns) as (keyof typeof columns)[]) {
      if (patch[key] === undefined) continue;
      const from = readValue(target, key);
      const to = readValue(updated, key);
      if (String(from) !== String(to)) changes[key] = { from, to };
    }

    if (Object.keys(changes).length > 0) {
      logAction({
        actor: req.actor!,
        action: 'USER_UPDATE',
        entityType: 'user',
        entityId: id,
        summary: `Изменён профиль: ${target.last_name} ${target.first_name}`,
        details: { changes },
      });
    }

    res.json({ user: usersRepo.toPublicUser(updated) });
  }),
);

usersRouter.delete(
  '/:id',
  requireRole('CURATOR'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = usersRepo.findById(id);
    if (!target) throw notFound('Пользователь не найден');
    if (target.id === req.user!.id) throw badRequest('Нельзя удалить собственный аккаунт');
    if (target.role === 'CURATOR' && usersRepo.countByRole('CURATOR') <= 1) {
      throw conflict('В системе должен остаться хотя бы один куратор');
    }

    const upcoming = dutiesRepo.listDuties({ userId: id }).filter((d) => d.date >= new Date().toISOString().slice(0, 10));
    usersRepo.deleteUser(id);

    logAction({
      actor: req.actor!,
      action: 'USER_DELETE',
      entityType: 'user',
      entityId: id,
      summary: `Удалён из класса: ${target.last_name} ${target.first_name}`,
      details: { role: target.role, username: target.username, removedDuties: upcoming.length },
    });

    res.json({ ok: true });
  }),
);

usersRouter.post(
  '/:id/reset-password',
  requireRole('CURATOR'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = usersRepo.findById(id);
    if (!target) throw notFound('Пользователь не найден');

    const password = `Duty-${randomToken(4)}`;
    usersRepo.updatePassword(id, await hashPassword(password));

    logAction({
      actor: req.actor!,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: id,
      summary: `Сброшен пароль: ${target.last_name} ${target.first_name}`,
    });

    res.json({ initialPassword: password });
  }),
);
