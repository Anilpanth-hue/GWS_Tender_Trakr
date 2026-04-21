import 'server-only';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_DATABASE || 'tender_trakr',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
});

export default pool;

/**
 * SELECT queries — uses pool.query() (non-prepared) to support LIMIT/OFFSET params
 * safely on MySQL 8. pool.execute() (prepared statements) rejects integer params
 * for LIMIT/OFFSET on MySQL 8.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T = unknown>(sql: string, values?: any[]): Promise<T[]> {
  const [rows] = await pool.query(sql, values);
  return rows as T[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryOne<T = unknown>(sql: string, values?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, values);
  return rows[0] ?? null;
}

/**
 * INSERT / UPDATE / DELETE — uses pool.execute() (prepared statements) for
 * proper escaping of user-supplied write data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function execute(sql: string, values?: any[]): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, values);
  return result as mysql.ResultSetHeader;
}
