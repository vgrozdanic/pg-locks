export interface LockMode {
  name: string;
  description: string;
  conflicts: string[];
  statements: string[];
  details: string;
}

export const LOCK_MODES: Record<string, LockMode> = {
  'ACCESS SHARE': {
    name: 'ACCESS SHARE',
    description: 'Only conflicts with ACCESS EXCLUSIVE lock. The lightest lock mode.',
    conflicts: ['ACCESS EXCLUSIVE'],
    statements: [
      'SELECT (read-only queries)',
      'SELECT with no locking clauses',
      'COPY TO',
      'EXPLAIN'
    ],
    details: 'This is the most permissive lock mode. It allows all concurrent operations except ACCESS EXCLUSIVE. Only blocked by ACCESS EXCLUSIVE locks. This lock is acquired by read-only operations that do not modify data or require row-level locks.'
  },
  'ROW SHARE': {
    name: 'ROW SHARE',
    description: 'Conflicts with EXCLUSIVE and ACCESS EXCLUSIVE locks.',
    conflicts: ['EXCLUSIVE', 'ACCESS EXCLUSIVE'],
    statements: [
      'SELECT FOR UPDATE',
      'SELECT FOR SHARE',
      'SELECT FOR NO KEY UPDATE',
      'SELECT FOR KEY SHARE'
    ],
    details: 'Acquired by SELECT commands that include row-level locking clauses. This lock mode allows concurrent reads and most writes, but prevents EXCLUSIVE and ACCESS EXCLUSIVE operations.'
  },
  'ROW EXCLUSIVE': {
    name: 'ROW EXCLUSIVE',
    description: 'Conflicts with SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE locks.',
    conflicts: ['SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
    statements: [
      'UPDATE',
      'DELETE', 
      'INSERT',
      'INSERT ON CONFLICT',
      'MERGE',
      'COPY FROM'
    ],
    details: 'This lock mode is acquired by commands that modify data. It allows concurrent reads and other row-exclusive operations, but conflicts with SHARE locks (preventing operations like index creation).'
  },
  'SHARE UPDATE EXCLUSIVE': {
    name: 'SHARE UPDATE EXCLUSIVE',
    description: 'Conflicts with SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE locks.',
    conflicts: ['SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
    statements: [
      'VACUUM (without FULL)',
      'ANALYZE',
      'CREATE INDEX CONCURRENTLY',
      'CREATE STATISTICS',
      'COMMENT ON',
      'REINDEX CONCURRENTLY'
    ],
    details: 'This lock mode protects against concurrent schema changes and allows only one such operation at a time. It permits ordinary reads and writes but prevents concurrent VACUUM-type operations and schema modifications.'
  },
  'SHARE': {
    name: 'SHARE',
    description: 'Conflicts with ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE locks.',
    conflicts: ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
    statements: [
      'CREATE INDEX (without CONCURRENTLY)'
    ],
    details: 'This lock mode allows concurrent reads but prevents any data modification. Multiple SHARE locks can be held simultaneously, but they block all write operations.'
  },
  'SHARE ROW EXCLUSIVE': {
    name: 'SHARE ROW EXCLUSIVE',
    description: 'Conflicts with ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE locks.',
    conflicts: ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
    statements: [
      'CREATE TRIGGER',
      'ALTER TABLE ADD FOREIGN KEY',
      'ALTER TABLE DISABLE TRIGGER'
    ],
    details: 'This lock mode is more restrictive than SHARE because it conflicts with SHARE locks and itself. It allows reads but prevents data modifications and any concurrent schema-changing operations.'
  },
  'EXCLUSIVE': {
    name: 'EXCLUSIVE',
    description: 'Conflicts with ROW SHARE, ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE locks.',
    conflicts: ['ROW SHARE', 'ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
    statements: [
      'REFRESH MATERIALIZED VIEW CONCURRENTLY'
    ],
    details: 'This lock mode allows only ACCESS SHARE locks (plain SELECT) to proceed concurrently. It blocks all other lock modes, including row-level locking SELECT statements.'
  },
  'ACCESS EXCLUSIVE': {
    name: 'ACCESS EXCLUSIVE',
    description: 'Conflicts with ALL lock modes. The most restrictive lock.',
    conflicts: ['ACCESS SHARE', 'ROW SHARE', 'ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
    statements: [
      'DROP TABLE',
      'TRUNCATE',
      'REINDEX (without CONCURRENTLY)',
      'CLUSTER',
      'VACUUM FULL',
      'LOCK TABLE (default mode)',
      'ALTER TABLE (most forms)',
      'ALTER TABLE SET TABLESPACE',
      'REFRESH MATERIALIZED VIEW'
    ],
    details: 'This is the most restrictive lock mode. It conflicts with all other lock modes, effectively making the table inaccessible to any other transaction until the lock is released. This ensures exclusive access to the table.'
  }
};

export function getLockModeInfo(lockName: string): LockMode | undefined {
  return LOCK_MODES[lockName];
}

export function getAllLockModes(): LockMode[] {
  return Object.values(LOCK_MODES);
}

// Mapping of SQL commands to their lock modes
export const COMMAND_LOCKS: Record<string, string> = {
  'SELECT': 'ACCESS SHARE',
  'SELECT FOR UPDATE': 'ROW SHARE',
  'SELECT FOR NO KEY UPDATE': 'ROW SHARE',
  'SELECT FOR SHARE': 'ROW SHARE',
  'SELECT FOR KEY SHARE': 'ROW SHARE',
  'INSERT': 'ROW EXCLUSIVE',
  'INSERT ON CONFLICT': 'ROW EXCLUSIVE',
  'UPDATE': 'ROW EXCLUSIVE',
  'DELETE': 'ROW EXCLUSIVE',
  'MERGE': 'ROW EXCLUSIVE',
  'COPY TO': 'ACCESS SHARE',
  'COPY FROM': 'ROW EXCLUSIVE',
  'EXPLAIN': 'ACCESS SHARE',
  'TRUNCATE': 'ACCESS EXCLUSIVE',
  'DROP TABLE': 'ACCESS EXCLUSIVE',
  'CREATE INDEX': 'SHARE',
  'CREATE INDEX CONCURRENTLY': 'SHARE UPDATE EXCLUSIVE',
  'REINDEX': 'ACCESS EXCLUSIVE',
  'VACUUM': 'SHARE UPDATE EXCLUSIVE',
  'VACUUM FULL': 'ACCESS EXCLUSIVE',
  'ANALYZE': 'SHARE UPDATE EXCLUSIVE',
  'ALTER TABLE': 'ACCESS EXCLUSIVE',
  'ALTER TABLE ADD COLUMN': 'SHARE UPDATE EXCLUSIVE',
  'ALTER TABLE ADD FOREIGN KEY': 'SHARE ROW EXCLUSIVE',
  'ALTER TABLE VALIDATE CONSTRAINT': 'SHARE UPDATE EXCLUSIVE',
  'ALTER TABLE ATTACH PARTITION': 'SHARE UPDATE EXCLUSIVE',
  'ALTER TABLE SET TABLESPACE': 'ACCESS EXCLUSIVE',
  'ALTER TABLE DISABLE TRIGGER': 'SHARE ROW EXCLUSIVE',
  'CREATE TRIGGER': 'SHARE ROW EXCLUSIVE',
  'REFRESH MATERIALIZED VIEW': 'ACCESS EXCLUSIVE',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY': 'EXCLUSIVE'
};

export function getCommandLockMode(command: string): string | null {
  return COMMAND_LOCKS[command] || null;
}

// Interface for backward compatibility with sqlParser.ts
export interface LockInfo {
  lockMode: string;
  description: string;
  conflicts: string[];
}

export function getLockAnalysis(command: string): LockInfo | null {
  const lockMode = COMMAND_LOCKS[command];
  if (!lockMode) {
    return null;
  }

  const lockModeInfo = LOCK_MODES[lockMode];
  if (!lockModeInfo) {
    return null;
  }

  return {
    lockMode: lockModeInfo.name,
    description: lockModeInfo.description,
    conflicts: lockModeInfo.conflicts
  };
}