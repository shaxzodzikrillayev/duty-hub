import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler, badRequest, conflict, forbidden, unauthorized } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { clearSession, issueCsrfToken, issueSession } from '../lib/tokens.js';
import { ROLES } from '../lib/types.js';
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
});

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль'),
});

/** Быстрый вход: выбрал себя по фамилии и имени, ввёл 4 цифры PIN. */
const pinLoginSchema = z.object({
  userId: z.number().int().positive(),
  pin: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'PIN состоит из 4 цифр'),
});

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
    const { firstName, lastName, username, password, role } = parsed.data;

    if (usersRepo.findByUsername(username)) {
      throw conflict('Такой логин уже занят');
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
  '/login-pin',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = pinLoginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Выберите себя и введите 4 цифры PIN', 'VALIDATION');

    const user = usersRepo.findById(parsed.data.userId);
    const hash = user?.pin_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const ok = await verifyPassword(parsed.data.pin, hash);

    if (!user || !ok) throw unauthorized('Неверный PIN');
    if (user.is_active !== 1) throw forbidden('Аккаунт отключён');

    issueSession(res, { sub: user.id, role: user.role, username: user.username });
    const csrfToken = issueCsrfToken(res);
    res.json({ user: usersRepo.toPublicUser(user), csrfToken });
  }),
);

/** Список класса для быстрого входа: только имена и роль, без логинов. */
authRouter.get(
  '/people',
  asyncHandler(async (_req, res) => {
    const people = usersRepo
      .listActive()
      .map((u) => ({ id: u.id, firstName: u.first_name, lastName: u.last_name, fullName: `${u.last_name} ${u.first_name}`, role: u.role }));
    res.json({ people });
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
