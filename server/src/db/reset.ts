import fs from 'node:fs';
import { config } from '../config.js';
import { closeDb, migrate } from './index.js';
import { seedDatabase } from './seed.js';

closeDb();
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  const file = `${config.databaseFile}${suffix}`;
  if (fs.existsSync(file)) fs.rmSync(file);
}
console.log('[db:reset] Файл базы удалён. Создаю заново...');

migrate();
const result = seedDatabase();
console.log('[db:reset] Готово: куратор + ' + result.students + ' учеников, ' + result.monitors + ' староста');
console.log('[db:reset] Куратор: curator /', config.seedCurator.password);
for (const p of result.pins) console.log('  ' + p.role.padEnd(9) + p.person.padEnd(34) + ' PIN ' + p.pin);
console.log('[db:reset] Графика дежурств нет — староста составит его сам.');
closeDb();
