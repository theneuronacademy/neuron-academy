const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5433, user: 'postgres', database: 'postgres', connectionTimeoutMillis: 4000 });
pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('BiometricDevice','BiometricDeviceEvent','BiometricUserMap') ORDER BY tablename")
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); process.exit(0); })
  .catch(e => { console.error('ERR:', e.message.substring(0, 120)); process.exit(1); })
  .finally(() => pool.end());
