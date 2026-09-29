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
console.log('[db:reset] Готово:', result);
console.log('[db:reset] Куратор: curator /', config.seedCurator.password);
console.log('[db:reset] Учеников, старосты и графика нет — добавьте их через интерфейс.');
closeDb();
