export interface ParsedQuery {
  command: string;
  tables: string[];
  isValid: boolean;
  error?: string;
}

export interface LockInfo {
  lockMode: string;
  description: string;
  conflicts: string[];
}

const LOCK_MODES: Record<string, LockInfo> = {
  'ACCESS SHARE': {
    lockMode: 'ACCESS SHARE',
    description: 'Acquired by SELECT statements and other read-only operations. Only conflicts with ACCESS EXCLUSIVE lock.',
    conflicts: ['ACCESS EXCLUSIVE']
  },
  'ROW EXCLUSIVE': {
    lockMode: 'ROW EXCLUSIVE',
    description: 'Acquired by INSERT, UPDATE, DELETE statements. Conflicts with SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE locks.',
    conflicts: ['SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE']
  },
  'SHARE UPDATE EXCLUSIVE': {
    lockMode: 'SHARE UPDATE EXCLUSIVE',
    description: 'Acquired by VACUUM (without FULL), ANALYZE, CREATE INDEX CONCURRENTLY, and some ALTER TABLE variants.',
    conflicts: ['SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE']
  },
  'SHARE': {
    lockMode: 'SHARE',
    description: 'Acquired by CREATE INDEX (without CONCURRENTLY). Conflicts with ROW EXCLUSIVE and stronger locks.',
    conflicts: ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE']
  },
  'SHARE ROW EXCLUSIVE': {
    lockMode: 'SHARE ROW EXCLUSIVE',
    description: 'Acquired by CREATE TRIGGER and some forms of ALTER TABLE. Conflicts with ROW EXCLUSIVE and stronger locks.',
    conflicts: ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE']
  },
  'EXCLUSIVE': {
    lockMode: 'EXCLUSIVE',
    description: 'Acquired by REFRESH MATERIALIZED VIEW CONCURRENTLY. Conflicts with ROW EXCLUSIVE and stronger locks.',
    conflicts: ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE']
  },
  'ACCESS EXCLUSIVE': {
    lockMode: 'ACCESS EXCLUSIVE',
    description: 'Acquired by DROP TABLE, TRUNCATE, REINDEX, VACUUM FULL, most ALTER TABLE operations. Conflicts with all other lock modes.',
    conflicts: ['ACCESS SHARE', 'ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE']
  }
};

const COMMAND_LOCKS: Record<string, string> = {
  'SELECT': 'ACCESS SHARE',
  'INSERT': 'ROW EXCLUSIVE',
  'UPDATE': 'ROW EXCLUSIVE',
  'DELETE': 'ROW EXCLUSIVE',
  'TRUNCATE': 'ACCESS EXCLUSIVE',
  'DROP': 'ACCESS EXCLUSIVE',
  'CREATE INDEX': 'SHARE',
  'CREATE INDEX CONCURRENTLY': 'SHARE UPDATE EXCLUSIVE',
  'REINDEX': 'ACCESS EXCLUSIVE',
  'VACUUM': 'SHARE UPDATE EXCLUSIVE',
  'VACUUM FULL': 'ACCESS EXCLUSIVE',
  'ANALYZE': 'SHARE UPDATE EXCLUSIVE',
  'ALTER TABLE': 'ACCESS EXCLUSIVE',
  'CREATE TRIGGER': 'SHARE ROW EXCLUSIVE',
  'REFRESH MATERIALIZED VIEW': 'EXCLUSIVE'
};

export function parseSQL(query: string): ParsedQuery {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { command: '', tables: [], isValid: false, error: 'Query cannot be empty' };
    }

    // Remove comments and normalize whitespace
    const normalizedQuery = cleanQuery
      .replace(/--.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\s+/g, ' ')
      .trim();

    // Extract command
    const commandMatch = normalizedQuery.match(/^(SELECT|INSERT|UPDATE|DELETE|TRUNCATE|DROP|CREATE|ALTER|VACUUM|ANALYZE|REINDEX|REFRESH)\s+/i);
    if (!commandMatch) {
      return { command: '', tables: [], isValid: false, error: 'Unable to identify SQL command' };
    }

    let command = commandMatch[1].toUpperCase();
    
    // Handle compound commands
    if (command === 'CREATE') {
      if (/CREATE\s+INDEX\s+CONCURRENTLY/i.test(normalizedQuery)) {
        command = 'CREATE INDEX CONCURRENTLY';
      } else if (/CREATE\s+INDEX/i.test(normalizedQuery)) {
        command = 'CREATE INDEX';
      } else if (/CREATE\s+TRIGGER/i.test(normalizedQuery)) {
        command = 'CREATE TRIGGER';
      }
    } else if (command === 'VACUUM') {
      if (/VACUUM\s+FULL/i.test(normalizedQuery)) {
        command = 'VACUUM FULL';
      }
    } else if (command === 'REFRESH') {
      if (/REFRESH\s+MATERIALIZED\s+VIEW/i.test(normalizedQuery)) {
        command = 'REFRESH MATERIALIZED VIEW';
      }
    } else if (command === 'ALTER') {
      if (/ALTER\s+TABLE/i.test(normalizedQuery)) {
        command = 'ALTER TABLE';
      }
    }

    // Extract table names
    const tables = extractTableNames(normalizedQuery, command);

    return {
      command,
      tables,
      isValid: true
    };
  } catch (error) {
    return { 
      command: '', 
      tables: [], 
      isValid: false, 
      error: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

function extractTableNames(query: string, command: string): string[] {
  const tables: Set<string> = new Set();

  // Different patterns for different commands
  switch (command) {
    case 'SELECT':
      extractFromSelect(query, tables);
      break;
    case 'INSERT':
      extractFromInsert(query, tables);
      break;
    case 'UPDATE':
      extractFromUpdate(query, tables);
      break;
    case 'DELETE':
      extractFromDelete(query, tables);
      break;
    case 'TRUNCATE':
    case 'DROP':
      extractFromSingleTable(query, tables);
      break;
    case 'CREATE INDEX':
    case 'CREATE INDEX CONCURRENTLY':
      extractFromCreateIndex(query, tables);
      break;
    case 'ALTER TABLE':
      extractFromAlterTable(query, tables);
      break;
    default:
      // Generic extraction for other commands
      extractFromGeneric(query, tables);
  }

  return Array.from(tables).filter(table => table.length > 0);
}

function extractFromSelect(query: string, tables: Set<string>) {
  // Match FROM clause and JOINs
  const fromMatch = query.match(/FROM\s+([^WHERE\s]+(?:\s+(?:INNER|LEFT|RIGHT|FULL)\s+JOIN\s+[^WHERE\s]+)*)/i);
  if (fromMatch) {
    const fromClause = fromMatch[1];
    
    // Extract main table from FROM
    const mainTableMatch = fromClause.match(/^(\w+)/);
    if (mainTableMatch) {
      tables.add(mainTableMatch[1]);
    }
    
    // Extract tables from JOINs
    const joinMatches = fromClause.match(/JOIN\s+(\w+)/gi);
    if (joinMatches) {
      joinMatches.forEach(joinMatch => {
        const tableMatch = joinMatch.match(/JOIN\s+(\w+)/i);
        if (tableMatch) {
          tables.add(tableMatch[1]);
        }
      });
    }
  }
}

function extractFromInsert(query: string, tables: Set<string>) {
  const insertMatch = query.match(/INSERT\s+INTO\s+(\w+)/i);
  if (insertMatch) {
    tables.add(insertMatch[1]);
  }
}

function extractFromUpdate(query: string, tables: Set<string>) {
  const updateMatch = query.match(/UPDATE\s+(\w+)/i);
  if (updateMatch) {
    tables.add(updateMatch[1]);
  }
}

function extractFromDelete(query: string, tables: Set<string>) {
  const deleteMatch = query.match(/DELETE\s+FROM\s+(\w+)/i);
  if (deleteMatch) {
    tables.add(deleteMatch[1]);
  }
}

function extractFromSingleTable(query: string, tables: Set<string>) {
  const tableMatch = query.match(/(?:TRUNCATE|DROP)\s+(?:TABLE\s+)?(\w+)/i);
  if (tableMatch) {
    tables.add(tableMatch[1]);
  }
}

function extractFromCreateIndex(query: string, tables: Set<string>) {
  const indexMatch = query.match(/ON\s+(\w+)/i);
  if (indexMatch) {
    tables.add(indexMatch[1]);
  }
}

function extractFromAlterTable(query: string, tables: Set<string>) {
  const alterMatch = query.match(/ALTER\s+TABLE\s+(\w+)/i);
  if (alterMatch) {
    tables.add(alterMatch[1]);
  }
}

function extractFromGeneric(query: string, tables: Set<string>) {
  // Generic fallback - look for common table patterns
  const tablePatterns = [
    /FROM\s+(\w+)/gi,
    /JOIN\s+(\w+)/gi,
    /UPDATE\s+(\w+)/gi,
    /INTO\s+(\w+)/gi,
    /TABLE\s+(\w+)/gi
  ];

  tablePatterns.forEach(pattern => {
    const matches = query.matchAll(pattern);
    for (const match of matches) {
      tables.add(match[1]);
    }
  });
}

export function getLockAnalysis(command: string): LockInfo | null {
  const lockMode = COMMAND_LOCKS[command];
  if (!lockMode) {
    return null;
  }
  
  return LOCK_MODES[lockMode];
}