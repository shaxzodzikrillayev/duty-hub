/**
 * Проверка боевого стенда: система стартует пустой (только куратор),
 * скрипт сам создаёт ученика и старосту, проверяет права и убирает за собой.
 *
 *   node scripts/check-live.mjs [http://localhost:5173]
 */

const BASE = process.argv[2] ?? 'http://localhost:5173';
const ORIGIN = BASE;
const stamp = Date.now().toString().slice(-6);

let passed = 0;
let failed = 0;

function check(name, ok, extra = '') {
  if (ok) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    console.log(`  \u2717 ${name} ${extra}`);
  }
}

class Session {
  constructor() {
    this.cookies = new Map();
    this.csrf = null;
  }

  async call(method, url, body) {
    const headers = { 'content-type': 'application/json', origin: ORIGIN };
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.cookie = cookie;
    if (this.csrf && method !== 'GET') headers['x-csrf-token'] = this.csrf;

    const res = await fetch(`${BASE}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (data?.csrfToken) this.csrf = data.csrfToken;
    return { status: res.status, data };
  }

  get(u) {
    return this.call('GET', u);
  }
  post(u, b) {
    return this.call('POST', u, b ?? {});
  }
  patch(u, b) {
    return this.call('PATCH', u, b);
  }
  del(u) {
    return this.call('DELETE', u);
  }
}

async function session() {
  const s = new Session();
  await s.get('/api/auth/csrf');
  return s;
}

async function login(username, password) {
  const s = await session();
  const res = await s.post('/api/auth/login', { username, password });
  if (res.status !== 200) {
    throw new Error(`Не удалось войти как ${username}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return { session: s, user: res.data.user };
}

console.log(`\n▶ Проверка стенда ${BASE}\n${'─'.repeat(60)}`);
check('API доступен', (await fetch(`${BASE}/api/health`).then((r) => r.json())).ok === true);

console.log('\n1. Пустая система');
const curator = await login('curator', 'Curator12345');
check('вход куратора: Абдусаматова Нилюфар', curator.user.fullName === 'Абдусаматова Нилюфар', curator.user.fullName);
check('роль куратора', curator.user.role === 'CURATOR');
const emptyRoster = await curator.session.get('/api/users');
const studentsBefore = emptyRoster.data?.users?.filter((u) => u.role === 'STUDENT').length ?? 0;
check('в базе нет учеников', studentsBefore === 0, String(studentsBefore));
const emptyDash = await curator.session.get('/api/dashboard');
check('пустой дашборд отдаёт нули', emptyDash.data?.today?.counts?.onDuty === 0);
check('журнал изменений пуст', (await curator.session.get('/api/audit')).data?.items?.length === 0);

console.log('\n2. Куратор заводит класс');
const student = await curator.session.post('/api/users', {
  firstName: 'Проверка',
  lastName: 'Проверкин',
  username: `check.stud.${stamp}`,
  role: 'STUDENT',
});
check('куратор добавляет ученика', student.status === 201, `(${student.status})`);
check('временный пароль выдан один раз', typeof student.data?.initialPassword === 'string');
check('хеш пароля не отдаётся', !JSON.stringify(student.data).includes('passwordHash'));
const studentId = student.data?.user?.id;

const monitorRes = await session();
const monitor = await monitorRes.post('/api/auth/register', {
  firstName: 'Проверка',
  lastName: 'Старостин',
  username: `check.mon.${stamp}`,
  password: 'secret123',
  role: 'MONITOR',
  secret: 'Nulufar6789',
});
check('староста регистрируется по секрету', monitor.status === 201, `(${monitor.status})`);

console.log('\n3. Староста строит график');
const mon = await login(`check.mon.${stamp}`, 'secret123');
const today = mon.user ? (await mon.session.get('/api/dashboard')).data?.today?.day?.date : null;

const created = await mon.session.post('/api/duties', { date: today, userId: studentId });
check('староста назначает дежурного', created.status === 201, `(${created.status})`);
const dutyId = created.data?.duty?.id;

const done = await mon.session.patch(`/api/duties/${dutyId}`, { status: 'DONE' });
check('староста отмечает 🟢 дежурил', done.status === 200 && done.data?.duty?.status === 'DONE');
const sick = await mon.session.patch(`/api/duties/${dutyId}`, { status: 'SICK' });
check('староста исправляет отметку на 🟡', sick.status === 200 && sick.data?.duty?.status === 'SICK');

const gen = await mon.session.post('/api/duties/generate', { from: today, to: today, perDay: 2 });
check('генерация графика не ломает пустые дни', gen.status === 200, `(${gen.status})`);

const journal = await mon.session.get('/api/audit?limit=10');
check('староста читает журнал изменений', journal.status === 200);
check(
  'в журнале есть запись о смене статуса',
  journal.data.items.some((i) => i.action === 'DUTY_UPDATE' && i.summary.includes('«')),
);

const stats = await mon.session.get('/api/dashboard/stats');
check('статистика считает назначения', stats.data?.overview?.totalAssignments >= 1, String(stats.data?.overview?.totalAssignments));
check('статистика по ученикам не пустая', (stats.data?.perStudent ?? []).length === 1);

console.log('\n4. Ученик');
const stud = await login(`check.stud.${stamp}`, student.data.initialPassword);
check('вход ученика по выданному паролю', stud.user.role === 'STUDENT');
const studDash = await stud.session.get('/api/dashboard');
check('ученик видит своё дежурство', studDash.data?.today?.myDuty !== null);
check('ученик не получает список старост', studDash.data?.monitors === undefined);
check('ученик не может менять статусы', (await stud.session.patch(`/api/duties/${dutyId}`, { status: 'MISSED' })).status === 403);
check('ученик не может добавлять учеников', (await stud.session.post('/api/users', { firstName: 'Х', lastName: 'Х', username: `x.${stamp}` })).status === 403);
check('ученик не читает журнал', (await stud.session.get('/api/audit')).status === 403);
check('ученик не читает чужую историю', (await stud.session.get(`/api/duties/history/${(await curator.session.get('/api/users')).data.users.find((u) => u.role === 'CURATOR').id}`)).status === 403);
check('староста не может удалить ученика', (await mon.session.del(`/api/users/${studentId}`)).status === 403);

console.log('\n5. Куратор завершает');
const renamed = await curator.session.patch(`/api/users/${studentId}`, { firstName: 'Переименован' });
check('куратор редактирует профиль', renamed.status === 200 && renamed.data?.user?.firstName === 'Переименован');
const cleared = await curator.session.del(`/api/duties/${dutyId}`);
check('куратор удаляет назначение', cleared.status === 200);

console.log('\n6. Уборка');
const monitorUser = (await curator.session.get('/api/users')).data.users.find((u) => u.username === `check.mon.${stamp}`);
check('удаление старосты', (await curator.session.del(`/api/users/${monitorUser.id}`)).status === 200);
check('удаление ученика', (await curator.session.del(`/api/users/${studentId}`)).status === 200);
const after = await curator.session.get('/api/users');
check('в базе остался только куратор', after.data?.users?.length === 1, String(after.data?.users?.length));

console.log(`\n${'─'.repeat(60)}`);
console.log(`  Пройдено: ${passed}   Провалено: ${failed}`);
console.log(failed === 0 ? '  ✔ Стенд работает корректно\n' : '  ✖ Есть проблемы\n');
process.exit(failed === 0 ? 0 : 1);
