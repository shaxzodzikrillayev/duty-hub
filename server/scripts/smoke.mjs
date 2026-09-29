/**
 * Сквозная проверка API: регистрация → вход → права ролей → дежурства → журнал.
 * Запускает отдельный сервер на свободном порту с временной базой,
 * поэтому не затрагивает рабочие данные.
 *
 *   npm run test:api   (в папке server)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');
const PORT = 4999 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const DB_FILE = path.join(serverRoot, 'data', `smoke-${Date.now()}.db`);

const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(PORT),
  DATABASE_PATH: DB_FILE,
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  MONITOR_SECRET: 'Nulufar6789',
  CURATOR_SECRET: 'SmokeTest-Curator-42',
  ALLOWED_ORIGINS: '',
  SEED_PASSWORD: 'Duty12345',
};

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \u2717 ${name} ${extra}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

class Client {
  constructor() {
    this.cookies = new Map();
    this.csrf = null;
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  storeCookies(res) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const line of raw) {
      const [pair] = line.split(';');
      const idx = pair.indexOf('=');
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === '' || /expires=thu, 01 jan 1970/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async raw(method, url, body, { withCsrf = true } = {}) {
    const headers = { 'content-type': 'application/json', origin: BASE };
    const cookie = this.cookieHeader();
    if (cookie) headers.cookie = cookie;
    if (withCsrf && this.csrf && method !== 'GET') headers['x-csrf-token'] = this.csrf;
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.storeCookies(res);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (data && typeof data.csrfToken === 'string') this.csrf = data.csrfToken;
    return { status: res.status, data };
  }

  get(url, opts) {
    return this.raw('GET', url, undefined, opts);
  }
  post(url, body, opts) {
    return this.raw('POST', url, body, opts);
  }
  patch(url, body, opts) {
    return this.raw('PATCH', url, body, opts);
  }
  delete(url, opts) {
    return this.raw('DELETE', url, undefined, opts);
  }
}

async function bootstrapCsrf(client) {
  const res = await client.get('/api/auth/csrf');
  client.csrf = res.data.csrfToken;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  const child = spawn('npx tsx src/index.ts', {
    cwd: serverRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', (d) => process.env.SMOKE_DEBUG && process.stderr.write(d));

  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return child;
    } catch {
      /* сервер ещё поднимается */
    }
    await sleep(500);
  }
  killTree(child.pid);
  throw new Error('Сервер не поднялся за 30 секунд');
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawn(`taskkill /pid ${pid} /f /t`, { shell: true, stdio: 'ignore' });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  console.log(`\n▶ Сквозная проверка Duty Hub 5 «Г» (порт ${PORT})\n${'─'.repeat(60)}`);

  const server = await startServer();
  const anon = new Client();

  try {
    section('1. Регистрация и вход');
    await bootstrapCsrf(anon);
    check('CSRF-токен выдаётся', Boolean(anon.csrf));

    const badOrigin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://evil.example', cookie: anon.cookieHeader(), 'x-csrf-token': anon.csrf },
      body: JSON.stringify({ username: 'x', password: 'y' }),
    });
    check('запрос с чужим Origin отклоняется', badOrigin.status === 403, `(${badOrigin.status})`);

    const noCsrf = await anon.post('/api/auth/login', { username: 'x', password: 'y' }, { withCsrf: false });
    check('мутация без CSRF-токена отклоняется', noCsrf.status === 403, `(${noCsrf.status})`);

    const student = new Client();
    await bootstrapCsrf(student);
    const regStudent = await student.post('/api/auth/register', {
      firstName: 'Тест',
      lastName: 'Учеников',
      username: 'test.student',
      password: 'secret123',
      role: 'STUDENT',
    });
    check('ученик регистрируется без секрета', regStudent.status === 201, JSON.stringify(regStudent.data));
    const studentId = regStudent.data?.user?.id;
    check('роль ученика присвоена', regStudent.data?.user?.role === 'STUDENT');
    check('passwordHash не отдаётся клиенту', !JSON.stringify(regStudent.data).includes('passwordHash'));

    const noSecret = await (async () => {
      const c = new Client();
      await bootstrapCsrf(c);
      return c.post('/api/auth/register', { firstName: 'Тест', lastName: 'Староста', username: 'test.mon1', password: 'secret123', role: 'MONITOR' });
    })();
    check('староста без секрета не регистрируется', noSecret.status === 403, `(${noSecret.status})`);

    const wrongSecret = await (async () => {
      const c = new Client();
      await bootstrapCsrf(c);
      return c.post('/api/auth/register', { firstName: 'Тест', lastName: 'Староста', username: 'test.mon2', password: 'secret123', role: 'MONITOR', secret: 'неправильный' });
    })();
    check('староста с неверным секретом не регистрируется', wrongSecret.status === 403, `(${wrongSecret.status})`);

    section('2. Права ученика');
    check('гость не видит список класса', (await anon.get('/api/users')).status === 401);
    check('гость не видит график', (await anon.get('/api/duties')).status === 401);
    check('гость не видит дашборд', (await anon.get('/api/dashboard')).status === 401);

    check('ученик видит список класса', (await student.get('/api/users')).status === 200);
    const studentDash = await student.get('/api/dashboard');
    check('дашборд ученика отдаёт его данные', studentDash.status === 200 && studentDash.data?.user?.id === studentId);
    check('дашборд ученика не содержит прав админа', studentDash.data?.monitors === undefined);

    const createByStudent = await student.post('/api/duties', { date: '2026-09-30', userId: studentId });
    check('ученик НЕ может создавать дежурства', createByStudent.status === 403, `(${createByStudent.status})`);

    const auditByStudent = await student.get('/api/audit');
    check('ученик НЕ может читать журнал изменений', auditByStudent.status === 403, `(${auditByStudent.status})`);

    const usersByStudent = await student.post('/api/users', { firstName: 'Новый', lastName: 'Ученик', username: 'new.one', role: 'STUDENT' });
    check('ученик НЕ может добавлять учеников', usersByStudent.status === 403, `(${usersByStudent.status})`);

    const othersHistory = await student.get(`/api/duties/history/${studentId + 999}`);
    check('ученик не может открыть чужую историю', othersHistory.status === 403, `(${othersHistory.status})`);

    section('3. Староста (секретный код)');
    const monitor = new Client();
    await bootstrapCsrf(monitor);
    const regMonitor = await monitor.post('/api/auth/register', {
      firstName: 'Тест',
      lastName: 'Староста',
      username: 'test.monitor',
      password: 'secret123',
      role: 'MONITOR',
      secret: 'Nulufar6789',
    });
    check('староста регистрируется по секрету', regMonitor.status === 201, JSON.stringify(regMonitor.data));

    const roster = await monitor.get('/api/users');
    const monitorId = roster.data?.users?.find((u) => u.username === 'test.student')?.id ?? studentId;

    const monitorAddUser = await monitor.post('/api/users', { firstName: 'Тест', lastName: 'Новый', username: 'test.added', role: 'STUDENT' });
    check('староста добавляет ученика', monitorAddUser.status === 201, JSON.stringify(monitorAddUser.data));
    const addedUserId = monitorAddUser.data?.user?.id;

    const created = await monitor.post('/api/duties', { date: '2026-10-01', userId: monitorId });
    check('староста создаёт дежурство', created.status === 201, JSON.stringify(created.data));
    const dutyId = created.data?.duty?.id;

    const duplicate = await monitor.post('/api/duties', { date: '2026-10-01', userId: monitorId });
    check('повторное назначение отклоняется', duplicate.status === 409, `(${duplicate.status})`);

    const sunday = await monitor.post('/api/duties', { date: '2026-10-04', userId: monitorId });
    check('воскресенье не принимается', sunday.status === 400, `(${sunday.status})`);

    const patched = await monitor.patch(`/api/duties/${dutyId}`, { status: 'DONE' });
    check('староста меняет статус', patched.status === 200 && patched.data?.duty?.status === 'DONE');

    const corrected = await monitor.patch(`/api/duties/${dutyId}`, { status: 'MISSED' });
    check('староста исправляет ошибочную отметку', corrected.status === 200 && corrected.data?.duty?.status === 'MISSED');

    const replaceNoWho = await monitor.patch(`/api/duties/${dutyId}`, { status: 'REPLACED' });
    check('замена без указания заменяющего отклоняется', replaceNoWho.status === 400, `(${replaceNoWho.status})`);

    const replaceOk = await monitor.patch(`/api/duties/${dutyId}`, { status: 'REPLACED', replacementUserId: addedUserId, comment: 'Болел' });
    check('староста оформляет замену', replaceOk.status === 200 && replaceOk.data?.duty?.replacementUserId === addedUserId);

    const monitorAddAdmin = await monitor.post('/api/users', { firstName: 'Тест', lastName: 'Куратор', username: 'test.cur2', role: 'CURATOR' });
    check('староста НЕ может завести куратора', monitorAddAdmin.status === 403, `(${monitorAddAdmin.status})`);

    const monitorEditUser = await monitor.patch(`/api/users/${addedUserId}`, { firstName: 'Изменён' });
    check('староста НЕ может редактировать профили', monitorEditUser.status === 403, `(${monitorEditUser.status})`);

    const monitorDelete = await monitor.delete(`/api/duties/${dutyId}`);
    check('староста удаляет назначение', monitorDelete.status === 200);

    const monitorAudit = await monitor.get('/api/audit');
    check('староста читает журнал изменений', monitorAudit.status === 200 && Array.isArray(monitorAudit.data?.items));
    const hasStatusChange = monitorAudit.data?.items?.some((i) => i.action === 'DUTY_UPDATE' && i.summary.includes('«Дежурил» → «Не дежурил»'));
    check('в журнале есть запись о смене статуса', Boolean(hasStatusChange));

    section('4. Куратор (секретный код)');
    const curator = new Client();
    await bootstrapCsrf(curator);
    const regCurator = await curator.post('/api/auth/register', {
      firstName: 'Тест',
      lastName: 'Куратор',
      username: 'test.curator',
      password: 'secret123',
      role: 'CURATOR',
      secret: 'SmokeTest-Curator-42',
    });
    check('куратор регистрируется по секрету', regCurator.status === 201, JSON.stringify(regCurator.data));

    const curatorDash = await curator.get('/api/dashboard');
    check('дашборд куратора содержит данные класса', curatorDash.status === 200 && curatorDash.data?.today?.counts?.classSize > 0);
    check('куратор видит старосту', (curatorDash.data?.monitors ?? []).length >= 1);

    const gen = await curator.post('/api/duties/generate', { from: '2026-10-05', to: '2026-10-16', perDay: 3 });
    check('куратор генерирует график', gen.status === 200 && gen.data?.created > 0, JSON.stringify(gen.data?.created));

    const curatorEdit = await curator.patch(`/api/users/${addedUserId}`, { firstName: 'Изменён', lastName: 'Учеников' });
    check('куратор редактирует профиль', curatorEdit.status === 200 && curatorEdit.data?.user?.firstName === 'Изменён');

    const resetPwd = await curator.post(`/api/users/${addedUserId}/reset-password`);
    check('куратор сбрасывает пароль', resetPwd.status === 200 && typeof resetPwd.data?.initialPassword === 'string');

    const relogin = new Client();
    await bootstrapCsrf(relogin);
    const loginOk = await relogin.post('/api/auth/login', { username: 'test.added', password: resetPwd.data.initialPassword });
    check('новый пароль работает при входе', loginOk.status === 200);

    const selfDelete = await curator.delete(`/api/users/${regCurator.data?.user?.id}`);
    check('куратор не может удалить себя', selfDelete.status === 400, `(${selfDelete.status})`);

    const curDelete = await curator.delete(`/api/users/${addedUserId}`);
    check('куратор удаляет ученика', curDelete.status === 200);

    section('5. Права после подмены роли (защита от DevTools)');
    const forged = new Client();
    forged.cookies = new Map(student.cookies);
    forged.csrf = student.csrf;
    const forgedTry = await forged.patch('/api/duties/1', { status: 'DONE' });
    check('ученик с cookie ученика не может менять статусы', forgedTry.status === 403, `(${forgedTry.status})`);

    const roleSweep = await anon.get('/api/audit');
    check('журнал закрыт для неавторизованных', roleSweep.status === 401);

    section('6. Прочее');
    const stats = await curator.get('/api/dashboard/stats');
    check('статистика класса считается', stats.status === 200 && typeof stats.data?.overview?.totalAssignments === 'number');
    check('персональная статистика есть у каждого ученика', Array.isArray(stats.data?.perStudent) && stats.data.perStudent.length > 0);

    const logout = await curator.post('/api/auth/logout', {});
    check('выход из аккаунта работает', logout.status === 200);
    const afterLogout = await curator.get('/api/dashboard');
    check('после выхода сессия недействительна', afterLogout.status === 401, `(${afterLogout.status})`);
  } catch (err) {
    failed += 1;
    failures.push(`ИСКЛЮЧЕНИЕ: ${err.message}`);
    console.error('\n💥', err);
  } finally {
    killTree(server.pid);
    await sleep(500);
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const f = `${DB_FILE}${suffix}`;
      if (fs.existsSync(f)) fs.rmSync(f);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Пройдено: ${passed}   Провалено: ${failed}`);
  if (failed > 0) {
    console.log(`  Проблемы:\n${failures.map((f) => `   • ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log('  ✔ Все проверки пройдены\n');
  process.exit(0);
}

await main();
