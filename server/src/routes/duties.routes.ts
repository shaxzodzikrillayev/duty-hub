import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { DUTY_STATUSES, STATUS_LABELS, type DutyStatus } from '../lib/types.js';
import { requireAuth, requireStaff } from '../middleware/auth.js';
import * as dutiesRepo from '../repositories/duties.repo.js';
import * as usersRepo from '../repositories/users.repo.js';
import { logAction } from '../repositories/audit.repo.js';
import { transaction } from '../db/index.js';
import { addDays, formatRu, isSchoolDay, isValidISODate, todayISO } from '../lib/dates.js';

export const dutiesRouter = Router();

dutiesRouter.use(requireAuth);

const isoDate = z
  .string()
  .refine(isValidISODate, 'Дата должна быть в формате ГГГГ-ММ-ДД')
  .refine((d) => isSchoolDay(d), 'Воскресенье — выходной. Выберите учебный день.');

const dutyRefSchema = z.object({
  date: z.string().refine(isValidISODate, 'Некорректная дата'),
  userId: z.number().int().positive(),
  status: z.enum(DUTY_STATUSES).default('ASSIGNED'),
  replacementUserId: z.number().int().positive().nullable().optional(),
  comment: z.string().max(300).nullable().optional(),
});

/** График дежурств. Ученитель видит его в режиме только чтение. */
dutiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' && isValidISODate(req.query.from) ? req.query.from : addDays(todayISO(), -30);
    const to = typeof req.query.to === 'string' && isValidISODate(req.query.to) ? req.query.to : addDays(todayISO(), 60);
    const userId = req.query.userId ? Number(req.query.userId) : undefined;

    const duties = dutiesRepo.listDuties({ from, to, userId });

    res.json({
      duties,
      range: { from, to },
      canEdit: req.user!.role !== 'STUDENT',
    });
  }),
);

dutiesRouter.post(
  '/',
  requireStaff,
  asyncHandler(async (req, res) => {
    const parsed = dutyRefSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '), 'VALIDATION');
    const data = parsed.data;

    if (!isSchoolDay(data.date)) throw badRequest('В этот день нет занятий (воскресенье)');

    const student = usersRepo.findById(data.userId);
    if (!student) throw notFound('Ученик не найден');
    if (student.is_active !== 1) throw badRequest('Ученик отключён');

    if (dutiesRepo.findDuty(data.date, data.userId)) {
      throw conflict('Этот ученик уже назначен на эту дату');
    }
    validateReplacement(data, data.userId);

    const duty = dutiesRepo.createDuty({ ...data, actorId: req.user!.id });

    logAction({
      actor: req.actor!,
      action: 'DUTY_CREATE',
      entityType: 'duty',
      entityId: duty.id,
      summary: `Назначен дежурный: ${student.last_name} ${student.first_name} на ${formatRu(data.date)}`,
      details: { date: data.date, student: `${student.last_name} ${student.first_name}`, status: data.status },
    });

    res.status(201).json({ duty });
  }),
);

const updateSchema = z.object({
  status: z.enum(DUTY_STATUSES).optional(),
  replacementUserId: z.number().int().positive().nullable().optional(),
  comment: z.string().max(300).nullable().optional(),
  userId: z.number().int().positive().optional(),
  date: z.string().refine(isValidISODate, 'Некорректная дата').optional(),
});

/** Смена статуса / замены / перенос назначения. */
dutiesRouter.patch(
  '/:id',
  requireStaff,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const current = dutiesRepo.findDutyById(id);
    if (!current) throw notFound('Назначение не найдено');

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '), 'VALIDATION');
    const patch = parsed.data;

    if (patch.date && !isSchoolDay(patch.date)) throw badRequest('В этот день нет занятий (воскресенье)');

    const targetUserId = patch.userId ?? current.userId;
    const targetDate = patch.date ?? current.date;

    if (patch.userId !== undefined || patch.date !== undefined) {
      const clash = dutiesRepo.listDuties({ from: targetDate, to: targetDate, userId: targetUserId }).find(
        (d) => d.id !== id,
      );
      if (clash) throw conflict('У ученика уже есть назначение на эту дату');
    }

    const nextStatus = patch.status ?? current.status;
    const nextReplacement =
      patch.replacementUserId === undefined ? current.replacementUserId : patch.replacementUserId;
    validateReplacement({ status: nextStatus, replacementUserId: nextReplacement }, targetUserId, targetDate, id);

    const updated = dutiesRepo.updateDuty(id, patch, req.user!.id)!;

    const parts: string[] = [];
    if (patch.status !== undefined && patch.status !== current.status) {
      parts.push(
        `изменил статус ${current.user.fullName}: «${STATUS_LABELS[current.status]}» → «${STATUS_LABELS[patch.status]}»`,
      );
    }
    if (patch.replacementUserId !== undefined && patch.replacementUserId !== current.replacementUserId) {
      parts.push(
        `замена для ${current.user.fullName}: ${
          updated.replacementName ?? 'отменена'
        }`,
      );
    }
    if (patch.userId !== undefined && patch.userId !== current.userId) {
      parts.push(`переназначил дежурство с ${current.user.fullName} на ${updated.user.fullName}`);
    }
    if (patch.date !== undefined && patch.date !== current.date) {
      parts.push(`перенёс дату с ${formatRu(current.date)} на ${formatRu(patch.date)}`);
    }
    if (patch.comment !== undefined && patch.comment !== current.comment) {
      parts.push(`комментарий: ${patch.comment ? `«${patch.comment}»` : 'удалён'}`);
    }

    if (parts.length > 0) {
      logAction({
        actor: req.actor!,
        action: 'DUTY_UPDATE',
        entityType: 'duty',
        entityId: id,
        summary: parts.join('; '),
        details: {
          date: updated.date,
          student: updated.user.fullName,
          from: { status: current.status, replacementUserId: current.replacementUserId },
          to: { status: updated.status, replacementUserId: updated.replacementUserId },
        },
      });
    }

    res.json({ duty: updated });
  }),
);

dutiesRouter.delete(
  '/:id',
  requireStaff,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const current = dutiesRepo.findDutyById(id);
    if (!current) throw notFound('Назначение не найдено');

    dutiesRepo.deleteDuty(id);
    logAction({
      actor: req.actor!,
      action: 'DUTY_DELETE',
      entityType: 'duty',
      entityId: id,
      summary: `Удалено назначение: ${current.user.fullName}, ${formatRu(current.date)}`,
      details: { date: current.date, student: current.user.fullName, status: current.status },
    });

    res.json({ ok: true });
  }),
);

/** Массовое назначение на день (удобно для старосты). */
dutiesRouter.post(
  '/bulk',
  requireStaff,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      date: z.string().refine(isValidISODate, 'Некорректная дата'),
      userIds: z.array(z.number().int().positive()).max(15),
      mode: z.enum(['add', 'remove']).default('add'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '), 'VALIDATION');
    const { date, userIds, mode } = parsed.data;

    if (userIds.length === 0) throw badRequest('Выберите хотя бы одного ученика');
    if (!isSchoolDay(date)) throw badRequest('В этот день нет занятий (воскресенье)');

    const result = dutiesRepo.listDuties({ from: date, to: date }).reduce<{
      created: string[];
      removed: string[];
      skipped: string[];
    }>(
      (acc, d) => {
        if (mode === 'remove' && userIds.includes(d.userId)) {
          dutiesRepo.deleteDuty(d.id);
          acc.removed.push(d.user.fullName);
        }
        return acc;
      },
      { created: [], removed: [], skipped: [] },
    );

    if (mode === 'add') {
      for (const userId of userIds) {
        const student = usersRepo.findById(userId);
        if (!student) continue;
        if (dutiesRepo.findDuty(date, userId)) {
          result.skipped.push(student.last_name + ' ' + student.first_name);
          continue;
        }
        dutiesRepo.createDuty({ date, userId, status: 'ASSIGNED', actorId: req.user!.id });
        result.created.push(student.last_name + ' ' + student.first_name);
      }
    }

    logAction({
      actor: req.actor!,
      action: mode === 'add' ? 'DUTY_BULK_ADD' : 'DUTY_BULK_REMOVE',
      entityType: 'duty',
      summary:
        mode === 'add'
          ? `Массовое назначение на ${formatRu(date)}: ${result.created.length} чел.`
          : `Снятие назначений на ${formatRu(date)}: ${result.removed.length} чел.`,
      details: { date, created: result.created, removed: result.removed, skipped: result.skipped },
    });

    res.json({ date, duties: dutiesRepo.listDuties({ from: date, to: date }), result });
  }),
);

/** Автозаполнение графика: равномерная ротация учеников по учебным дням. */
dutiesRouter.post(
  '/generate',
  requireStaff,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      from: z.string().refine(isValidISODate, 'Некорректная дата'),
      to: z.string().refine(isValidISODate, 'Некорректная дата'),
      perDay: z.number().int().min(1).max(10).default(4),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '), 'VALIDATION');
    const { from, to, perDay } = parsed.data;

    if (from > to) throw badRequest('Начальная дата позже конечной');
    if (addDays(from, 120) < to) throw badRequest('Слишком большой диапазон (максимум 120 дней)');

    const roster = usersRepo
      .listByRoles('STUDENT')
      .filter((u) => u.is_active === 1)
      .map((u) => u.id);
    if (roster.length === 0) throw badRequest('В классе нет учеников');

    let cursor = 0;
    let created = 0;
    let days = 0;

    const days_: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) if (isSchoolDay(d)) days_.push(d);

    transaction(() => {
      for (const date of days_) {
        days += 1;
        for (let i = 0; i < perDay; i += 1) {
          const userId = roster[cursor % roster.length]!;
          cursor += 1;
          if (dutiesRepo.findDuty(date, userId)) continue;
          dutiesRepo.createDuty({ date, userId, status: 'ASSIGNED', actorId: req.user!.id });
          created += 1;
        }
      }
    });

    logAction({
      actor: req.actor!,
      action: 'DUTY_GENERATE',
      entityType: 'duty',
      summary: `Сгенерирован график: ${formatRu(from)} — ${formatRu(to)}, добавлено ${created} назначений`,
      details: { from, to, perDay, created, days },
    });

    res.json({ created, days, duties: dutiesRepo.listDuties({ from, to }) });
  }),
);

/** История дежурств конкретного ученика (ученик — только свою). */
dutiesRouter.get(
  '/history/:userId',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) throw badRequest('Некорректный id');
    if (req.user!.role === 'STUDENT' && req.user!.id !== userId) {
      throw forbidden('Ученик может открыть только свою историю');
    }
    const from = typeof req.query.from === 'string' && isValidISODate(req.query.from) ? req.query.from : '2000-01-01';
    const to = typeof req.query.to === 'string' && isValidISODate(req.query.to) ? req.query.to : '2999-12-31';
    if (from > to) throw badRequest('Некорректный диапазон дат');

    res.json({ duties: dutiesRepo.listDuties({ from, to, userId }) });
  }),
);

function validateReplacement(
  data: { status: DutyStatus; replacementUserId?: number | null },
  userId: number,
  date?: string,
  excludeDutyId?: number,
): void {
  if (data.status !== 'REPLACED') return;
  const replacementId = data.replacementUserId;
  if (!replacementId) throw badRequest('Для статуса «Замена» нужно указать, кто дежурил вместо ученика');
  if (replacementId === userId) throw badRequest('Замена не может совпадать с самим учеником');

  const replacement = usersRepo.findById(replacementId);
  if (!replacement) throw notFound('Заменяющий ученик не найден');
  if (replacement.is_active !== 1) throw badRequest('Заменяющий ученик отключён');

  if (date && dutiesRepo.findReplacementConflict(date, replacementId, excludeDutyId)) {
    throw conflict(`${replacement.last_name} ${replacement.first_name} уже дежурит в этот день`);
  }
}
