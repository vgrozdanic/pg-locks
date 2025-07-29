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
      'SELECT with no locking clauses'
    ],
    details: 'This is the most permissive lock mode. It allows concurrent reads and most other operations. Only blocked by ACCESS EXCLUSIVE locks. This lock is automatically acquired by SELECT statements that only read data without any FOR UPDATE/SHARE clauses.'
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
      'MERGE'
    ],
    details: 'This lock mode is acquired by commands that modify data. It allows concurrent reads and other row-exclusive operations, but prevents operations that require stronger locks like index creation.'
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
    details: 'This lock mode protects against concurrent schema changes and allows only one VACUUM-type operation at a time. It permits ordinary reads and writes but prevents other maintenance operations.'
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
      'ALTER TABLE (some forms)'
    ],
    details: 'This lock mode is more restrictive than SHARE, preventing concurrent SHARE ROW EXCLUSIVE locks. It allows reads but blocks most other operations.'
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
      'CREATE INDEX (some cases)'
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