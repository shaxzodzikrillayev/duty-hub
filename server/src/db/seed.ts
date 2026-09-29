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

export async function seedDatabase(): Promise<SeedResult> {
  const db = getDb();
  const curatorPassword = process.env.SEED_CURATOR_PASSWORD?.trim() || 'Curator12345';
  const curatorHash = bcrypt.hashSync(curatorPassword, config.bcryptRounds);

  return transaction(() => {
    const existing = db.scalar<number>('SELECT COUNT(*) FROM users') ?? 0;
    if (existing > 0) {
      throw new Error('В базе уже есть пользователи. Для очистки используйте npm run db:reset');
    }

    const ts = nowISO();
    db.run(
      `INSERT INTO users (first_name, last_name, username, password_hash, role, position, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'CURATOR', 0, 1, ?, ?)`,
      process.env.SEED_CURATOR_FIRST_NAME?.trim() || 'Нилюфар',
      process.env.SEED_CURATOR_LAST_NAME?.trim() || 'Абдусаматова',
      'curator',
      curatorHash,
      ts,
      ts,
    );

    return { curator: 'curator' };
  });
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
    const result = await seedDatabase();
    console.log('[seed] Готово:', result);
    console.log('[seed] Куратор: curator /', process.env.SEED_CURATOR_PASSWORD?.trim() || 'Curator12345');
    console.log('[seed] Учеников и дежурств нет — добавьте их через интерфейс после входа.');
  }
  closeDb();
}
