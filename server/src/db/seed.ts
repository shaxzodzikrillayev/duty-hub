import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { closeDb, getDb, migrate, transaction } from './index.js';
import { nowISO } from '../lib/dates.js';

/**
 * Заполняет базу только аккаунтом куратора.
 * Учеников, старосту и график добавляют через интерфейс:
 *   — куратор заводит учеников на странице «Класс»;
 *   — староста (регистрируется по секретному коду) строит график и ставит отметки.
 */
export interface SeedResult {
  curator: string;
}

export function seedDatabase(): SeedResult {
  const db = getDb();
  const { firstName, lastName, password } = config.seedCurator;
  const curatorHash = bcrypt.hashSync(password, config.bcryptRounds);

  return transaction(() => {
    const existing = db.scalar<number>('SELECT COUNT(*) FROM users') ?? 0;
    if (existing > 0) {
      throw new Error('В базе уже есть пользователи. Для очистки используйте npm run db:reset');
    }

    const ts = nowISO();
    db.run(
      `INSERT INTO users (first_name, last_name, username, password_hash, role, position, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'CURATOR', 0, 1, ?, ?)`,
      firstName,
      lastName,
      'curator',
      curatorHash,
      ts,
      ts,
    );

    return { curator: 'curator' };
  });
}

/**
 * Идемпотентный стартовый аккаунт: нужен там, где файловая БД живёт недолго
 * (Vercel: /tmp очищается между запусками), иначе невозможно войти в систему.
 */
export function ensureSeed(): void {
  const db = getDb();
  const users = db.scalar<number>('SELECT COUNT(*) FROM users') ?? 0;
  if (users > 0) return;

  seedDatabase();
  console.log('[duty-hub] Создан стартовый аккаунт куратора: curator');
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
    console.log('[seed] Готово:', result);
    console.log('[seed] Куратор: curator /', config.seedCurator.password);
    console.log('[seed] Учеников и дежурств нет — добавьте их через интерфейс после входа.');
  }
  closeDb();
}
