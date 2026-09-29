import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { asyncHandler, badRequest, conflict, forbidden, unauthorized } from '../lib/errors.js';
import { hashPassword, safeEqual, verifyPassword } from '../lib/crypto.js';
import { clearSession, issueCsrfToken, issueSession } from '../lib/tokens.js';
import { ROLES, type Role } from '../lib/types.js';
import { requireAuth } from '../middleware/auth.js';
import * as usersRepo from '../repositories/users.repo.js';
import { actorFrom, logAction } from '../repositories/audit.repo.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Слишком много попыток. Попробуйте через несколько минут.' },
});

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Минимум 2 символа')
  .max(40, 'Максимум 40 символов')
  .regex(/^[\p{L}][\p{L}\s'-]*$/u, 'Только буквы, пробел, дефис или апостроф');

const registerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  username: z
    .string()
    .trim()
    .min(3, 'Логин: минимум 3 символа')
    .max(24, 'Логин: максимум 24 символа')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Логин: латиница, цифры, точка, дефис, подчёркивание'),
  password: z.string().min(6, 'Пароль: минимум 6 символов').max(72, 'Пароль: максимум 72 символа'),
  role: z.enum(ROLES),
  secret: z.string().max(200).optional(),
});

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль'),
});

const MAX_ADMINS: Record<'MONITOR' | 'CURATOR', number> = { MONITOR: 3, CURATOR: 3 };

/** Секретные коды существуют только на сервере (process.env) и проверяются здесь. */
function checkSecret(role: Role, provided: string | undefined): void {
  if (role === 'STUDENT') return;

  const expected = role === 'MONITOR' ? config.secrets.monitor : config.secrets.curator;
  if (!provided || !safeEqual(provided, expected)) {
    throw forbidden('Неверный секретный код для этой роли');
  }
}

/** GET, а не POST: иначе запрос сам попал бы под CSRF-защиту. */
authRouter.get(
  '/csrf',
  asyncHandler(async (_req, res) => {
    res.json({ csrfToken: issueCsrfToken(res) });
  }),
);

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join('; '), 'VALIDATION');
    }
    const { firstName, lastName, username, password, role, secret } = parsed.data;

    checkSecret(role, secret);

    if (usersRepo.findByUsername(username)) {
      throw conflict('Такой логин уже занят');
    }

    const adminCount = usersRepo.countByRole(role as 'MONITOR' | 'CURATOR');
    if (role !== 'STUDENT' && adminCount >= MAX_ADMINS[role]) {
      throw conflict(`Все аккаунты роли «${role === 'MONITOR' ? 'Староста' : 'Куратор'}» уже заняты`);
    }

    const passwordHash = await hashPassword(password);
    const user = usersRepo.insertUser({
      firstName,
      lastName,
      username,
      passwordHash,
      role,
    });

    logAction({
      actor: actorFrom(user),
      action: 'REGISTER',
      entityType: 'auth',
      entityId: user.id,
      summary: `Регистрация аккаунта (${role === 'STUDENT' ? 'ученик' : role === 'MONITOR' ? 'староста' : 'куратор'})`,
    });

    issueSession(res, { sub: user.id, role: user.role, username: user.username });
    const csrfToken = issueCsrfToken(res);
    res.status(201).json({ user: usersRepo.toPublicUser(user), csrfToken });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Введите логин и пароль', 'VALIDATION');

    const user = usersRepo.findByUsername(parsed.data.username);
    const hash = user?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const ok = await verifyPassword(parsed.data.password, hash);

    if (!user || !ok) throw unauthorized('Неверный логин или пароль');
    if (user.is_active !== 1) throw forbidden('Аккаунт отключён');

    issueSession(res, { sub: user.id, role: user.role, username: user.username });
    const csrfToken = issueCsrfToken(res);
    res.json({ user: usersRepo.toPublicUser(user), csrfToken });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    clearSession(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = usersRepo.findById(req.user!.id);
    if (!row) throw unauthorized('Пользователь не найден');
    if (row.role !== req.user!.role) {
      throw unauthorized('Роль в сессии устарела. Войдите заново.');
    }
    res.json({ user: usersRepo.toPublicUser(row) });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      currentPassword: z.string().min(1, 'Введите текущий пароль'),
      newPassword: z.string().min(6, 'Новый пароль: минимум 6 символов').max(72),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '), 'VALIDATION');

    const row = usersRepo.findById(req.user!.id)!;
    const ok = await verifyPassword(parsed.data.currentPassword, row.password_hash);
    if (!ok) throw unauthorized('Текущий пароль неверен');

    usersRepo.updatePassword(row.id, await hashPassword(parsed.data.newPassword));
    logAction({
      actor: actorFrom(row),
      action: 'PASSWORD_CHANGE',
      entityType: 'auth',
      entityId: row.id,
      summary: 'Смена собственного пароля',
    });
    res.json({ ok: true });
  }),
);
