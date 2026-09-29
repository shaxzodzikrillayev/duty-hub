import { Router } from 'express';
import { asyncHandler, badRequest, forbidden } from '../lib/errors.js';
import { addDays, formatRu, getDay, isSchoolDay, isValidISODate, todayISO, WEEKDAY_FULL } from '../lib/dates.js';
import { requireAuth } from '../middleware/auth.js';
import * as dutiesRepo from '../repositories/duties.repo.js';
import * as usersRepo from '../repositories/users.repo.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

function queryDate(value: unknown): string | undefined {
  return typeof value === 'string' && isValidISODate(value) ? value : undefined;
}

function dayInfo(date: string) {  return {
    date,
    formatted: formatRu(date),
    weekday: WEEKDAY_FULL[getDay(date)],
    isSchoolDay: isSchoolDay(date),
  };
}

/** Сводка дня: используется и в дашборде, и на странице «Сегодня». */
function buildDay(date: string) {
  const duties = dutiesRepo.listDuties({ from: date, to: date });
  const statuses = dutiesRepo.countByStatusForDate(date);
  const students = usersRepo.listByRoles('STUDENT').filter((u) => u.is_active === 1);
  const monitors = usersRepo.listByRoles('MONITOR').filter((u) => u.is_active === 1);
  const assignedIds = new Set(duties.map((d) => d.userId));

  return {
    day: dayInfo(date),
    duties,
    counts: {
      classSize: students.length + monitors.length,
      totalStudents: students.length,
      onDuty: duties.length,
      done: statuses.DONE ?? 0,
      missed: statuses.MISSED ?? 0,
      sick: statuses.SICK ?? 0,
      replaced: statuses.REPLACED ?? 0,
      planned: statuses.ASSIGNED ?? 0,
      unassigned: Math.max(0, students.length - assignedIds.size),
      reported: duties.filter((d) => d.status !== 'ASSIGNED').length,
    },
    notOnDuty: students
      .filter((u) => !assignedIds.has(u.id))
      .map((u) => ({ id: u.id, firstName: u.first_name, lastName: u.last_name, fullName: `${u.last_name} ${u.first_name}`, role: u.role })),
  };
}

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : todayISO();
    const me = usersRepo.findById(req.user!.id)!;
    const today = buildDay(date);

    if (me.role === 'STUDENT') {
      const myDuty = today.duties.find((d) => d.userId === me.id) ?? null;
      const myDuties = dutiesRepo.listDuties({ userId: me.id });
      const next = myDuties.find((d) => d.date >= date) ?? null;
      const prev = [...myDuties].reverse().find((d) => d.date < date) ?? null;

      res.json({
        role: 'STUDENT',
        user: usersRepo.toPublicUser(me),
        today: {
          ...today,
          myDuty,
          onDutyWithMe: today.duties.filter((d) => d.userId !== me.id),
        },
        nextDuty: next,
        previousDuty: prev,
        myStats: dutiesRepo.studentStats(me.id),
        history: myDuties.filter((d) => d.date < date).slice(-12).reverse(),
      });
      return;
    }

    const monitor = usersRepo.listByRoles('MONITOR').map(usersRepo.toPublicUser);
    res.json({
      role: me.role,
      user: usersRepo.toPublicUser(me),
      today,
      monitors: monitor,
      classStats: dutiesRepo.classStats(addDays(date, -7), addDays(date, 7)),
    });
  }),
);

dashboardRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const from = queryDate(req.query.from) ?? addDays(todayISO(), -60);
    const to = queryDate(req.query.to) ?? addDays(todayISO(), 60);
    if (from > to) throw badRequest('Некорректный диапазон дат');
    const overview = dutiesRepo.classStats(from, to);

    const base = {
      range: { from, to },
      overview,
      totalStudents: usersRepo.countByRole('STUDENT'),
    };

    if (req.user!.role === 'STUDENT') {
      res.json({ ...base, myStats: dutiesRepo.studentStats(req.user!.id), perStudent: null });
      return;
    }

    const perStudentMap = new Map(dutiesRepo.perStudentStats(from, to).map((s) => [s.userId, s]));
    const perStudent = usersRepo
      .listByRoles('STUDENT')
      .filter((u) => u.is_active === 1)
      .map((u) => {
        const s = perStudentMap.get(u.id);
        return {
          user: usersRepo.toPublicUser(u),
          assigned: s?.assigned ?? 0,
          done: s?.done ?? 0,
          missed: s?.missed ?? 0,
          sick: s?.sick ?? 0,
          replaced: s?.replaced ?? 0,
          planned: s?.planned ?? 0,
        };
      });

    res.json({ ...base, perStudent, myStats: null });
  }),
);

dashboardRouter.get(
  '/monitors',
  asyncHandler(async (_req, res) => {
    res.json({ monitors: usersRepo.listAdmins().map(usersRepo.toPublicUser) });
  }),
);

dashboardRouter.get(
  '/students/:id/summary',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (req.user!.role === 'STUDENT' && req.user!.id !== id) {
      throw forbidden('Можно смотреть только свою статистику');
    }
    const user = usersRepo.findById(id);
    if (!user) throw forbidden('Пользователь не найден');
    res.json({
      user: usersRepo.toPublicUser(user),
      stats: dutiesRepo.studentStats(id),
      duties: dutiesRepo.listDuties({ userId: id }),
    });
  }),
);
