import { app } from './app.js';
import { getDb, closeDb } from './db/index.js';
import { config, SERVER_ROOT } from './config.js';

const server = app.listen(config.port, () => {
  const db = getDb();
  const users = db.scalar<number>('SELECT COUNT(*) FROM users');
  console.log(`\n  Duty Hub 5 «Г» — API запущен`);
  console.log(`  → http://localhost:${config.port}/api/health`);
  console.log(`  → режим: ${config.env} | пользователей в базе: ${users}`);
  console.log(`  → база: ${config.databaseFile}\n`);
  if (users === 0) {
    console.log('  ! База пуста. Выполните: npm run db:reset\n');
  }
});

function shutdown(signal: string): void {
  console.log(`\n[duty-hub] Получен ${signal}, завершаю работу...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, SERVER_ROOT };
