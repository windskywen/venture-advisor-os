import type { PersistenceDatabase, SqlExecutor } from './database.js';

export interface GuardedPersistenceMutation<StorageResult, DatabaseResult> {
  writeStorage(): Promise<StorageResult>;
  writeDatabase(
    executor: SqlExecutor,
    storageResult: StorageResult,
  ): Promise<DatabaseResult>;
  rollbackStorage?(storageResult: StorageResult): Promise<void>;
}

export interface GuardedPersistenceCoordinator {
  execute<StorageResult, DatabaseResult>(
    mutation: GuardedPersistenceMutation<StorageResult, DatabaseResult>,
  ): Promise<DatabaseResult>;
}

export function createGuardedPersistenceCoordinator(
  database: PersistenceDatabase,
): GuardedPersistenceCoordinator {
  return {
    async execute<StorageResult, DatabaseResult>(
      mutation: GuardedPersistenceMutation<StorageResult, DatabaseResult>,
    ): Promise<DatabaseResult> {
      let storageResult: StorageResult | undefined;

      try {
        const committedStorageResult = await mutation.writeStorage();
        storageResult = committedStorageResult;
        return await database.withTransaction((executor) =>
          mutation.writeDatabase(executor, committedStorageResult),
        );
      } catch (error) {
        if (storageResult !== undefined && mutation.rollbackStorage) {
          await mutation.rollbackStorage(storageResult);
        }

        throw error;
      }
    },
  };
}
