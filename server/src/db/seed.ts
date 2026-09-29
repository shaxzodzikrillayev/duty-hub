import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { closeDb, getDb, migrate, transaction } from './index.js';
import { nowISO } from '../lib/dates.js';
import { makeUsername, readClassList, type ClassMember } from './class-list.js';

export interface SeedResult {
  curator: string;
  students: number;
  monitors: number;
  /** Таблица «Фамилия Имя — PIN» для раздачи ученикам. */
  pins: { person: string; role: string; pin: string; username: string }[];
}

/**
 * Заполняет базу аккаунтом куратора и классом из server/class-list.txt.
 * График дежурств не создаётся — староста назначает его сам.
 */
export function seedDatabase(): SeedResult {
  const db = getDb();
  const classList = readClassList();
  const pins: SeedResult['pins'] = [];

  return transaction(() => {
    const existing = db.scalar<number>('SELECT COUNT(*) FROM users') ?? 0;
    if (existing > 0) {
      throw new Error('В базе уже есть пользователи. Для очистки используйте npm run db:reset');
    }

    const ts = nowISO();
    const { firstName, lastName, password } = config.seedCurator;
    db.run(
      `INSERT INTO users (first_name, last_name, username, password_hash, role, position, is_active, pin_hash, created_at, updated_at)
       VALUES (?, ?, 'curator', ?, 'CURATOR', 0, 1, ?, ?, ?)`,
      firstName,
      lastName,
      bcrypt.hashSync(password, config.bcryptRounds),
      bcrypt.hashSync(password.slice(-4).padStart(4, '0'), config.bcryptRounds),
      ts,
      ts,
    );
    pins.push({ person: `${lastName} ${firstName}`, role: 'куратор', pin: password.slice(-4).padStart(4, '0'), username: 'curator' });

    const used = new Set<string>(['curator']);
    classList.forEach((member, index) => {
      let username = makeUsername(member.lastName, member.firstName);
      let suffix = 2;
      while (used.has(username)) username = `${makeUsername(member.lastName, member.firstName).slice(0, 21)}.${suffix++}`;
      used.add(username);

      const pinHash = bcrypt.hashSync(member.pin, config.bcryptRounds);
      db.run(
        `INSERT INTO users (first_name, last_name, username, password_hash, role, position, is_active, pin_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        member.firstName,
        member.lastName,
        username,
        pinHash,
        member.role,
        index + 1,
        pinHash,
        ts,
        ts,
      );
      pins.push({
        person: `${member.lastName} ${member.firstName}`,
        role: member.role === 'MONITOR' ? 'староста' : 'ученик',
        pin: member.pin,
        username,
      });
    });

    return {
      curator: 'curator',
      students: classList.filter((m: ClassMember) => m.role === 'STUDENT').length,
      monitors: classList.filter((m: ClassMember) => m.role === 'MONITOR').length,
      pins,
    };
  });
}

/**
 * Идемпотентный стартовый набор: нужен там, где файловая БД живёт недолго
 * (Vercel: /tmp очищается между запусками), иначе невозможно войти в систему.
 */
export function ensureSeed(): void {
  const db = getDb();
  const users = db.scalar<number>('SELECT COUNT(*) FROM users') ?? 0;
  if (users > 0) return;

  const result = seedDatabase();
  console.log(`[duty-hub] База создана: куратор + ${result.students} учеников, ${result.monitors} староста`);
}

const isDirectRun = process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1].replace(/\\/g, '/'));

if (isDirectRun) {
  migrate();
  const db = getDb();
  const existing = db.scalar<number>('SELECT COUNT(*) FROM users') ?? 0;

  if (existing > 0 && !process.argv.includes('--force')) {
    console.log(`[seed] В базе уже ${existing} пользователей. Используйте --force или npm run db:reset.`);
  } else {
    if (existing > 0) db.exec('DELETE FROM audit_log; DELETE FROM duties; DELETE FROM users;');
    const result = seedDatabase();
    console.log(`[seed] Готово: куратор + ${result.students} учеников, ${result.monitors} староста`);
    if (result.students === 0) {
      console.log('[seed] ⚠ Список класса пуст. Добавьте фамилии в server/class-list.txt и выполните npm run db:reset');
    }
    console.log('\n  Вход по фамилии и PIN:');
    for (const p of result.pins) {
      console.log(`   ${p.role.padEnd(9)} ${p.person.padEnd(34)} PIN ${p.pin}   (логин ${p.username})`);
    }
    console.log('');
  }
  closeDb();
}
