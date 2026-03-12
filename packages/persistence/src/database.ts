import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

export interface SqlExecutor {
  query<TResult extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<TResult>>;
}

export interface PersistenceDatabaseOptions {
  connectionString: string;
  maxConnections?: number;
}

export interface PersistenceDatabase extends SqlExecutor {
  readonly pool: Pool;
  withTransaction<TResult>(
    callback: (executor: SqlExecutor) => Promise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

export function createPersistenceDatabase(
  options: PersistenceDatabaseOptions,
): PersistenceDatabase {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.maxConnections,
  });

  return {
    pool,
    query(sql, params) {
      return executeQuery(pool, sql, params);
    },
    async withTransaction(callback) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        const result = await callback(createClientExecutor(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close() {
      return pool.end();
    },
  };
}

function createClientExecutor(client: PoolClient): SqlExecutor {
  return {
    query(sql, params) {
      return executeQuery(client, sql, params);
    },
  };
}

function executeQuery<TResult extends QueryResultRow>(
  executor: Pick<Pool, 'query'> | Pick<PoolClient, 'query'>,
  sql: string,
  params?: readonly unknown[],
): Promise<QueryResult<TResult>> {
  if (params === undefined) {
    return executor.query<TResult>(sql);
  }

  return executor.query<TResult>(sql, [...params]);
}
