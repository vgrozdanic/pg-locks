import { TableLockInfo } from './sqlParser';
import { LOCK_MODES } from './lockData';

export interface QueryComparisonResult {
  isCompatible: boolean;
  conflictingTables: TableConflict[];
  compatibleTables: CompatibleTable[];
  uniqueTables: {
    query1Only: string[];
    query2Only: string[];
  };
}

export interface TableConflict {
  table: string;
  query1Lock: string;
  query2Lock: string;
  conflictReason: string;
}

export interface CompatibleTable {
  table: string;
  query1Lock: string;
  query2Lock: string;
}

export interface QueryAnalysisInput {
  query: string;
  tables: TableLockInfo[];
  error?: string;
  isValid: boolean;
}

export function compareQueries(
  query1Analysis: QueryAnalysisInput,
  query2Analysis: QueryAnalysisInput
): QueryComparisonResult {
  // If either query has errors, they can't be compared
  if (!query1Analysis.isValid || !query2Analysis.isValid) {
    return {
      isCompatible: false,
      conflictingTables: [],
      compatibleTables: [],
      uniqueTables: { query1Only: [], query2Only: [] }
    };
  }

  const conflictingTables: TableConflict[] = [];
  const compatibleTables: CompatibleTable[] = [];
  
  // Create maps for easier lookup
  const query1TableMap = new Map<string, TableLockInfo>();
  const query2TableMap = new Map<string, TableLockInfo>();
  
  query1Analysis.tables.forEach(table => {
    query1TableMap.set(table.table, table);
  });
  
  query2Analysis.tables.forEach(table => {
    query2TableMap.set(table.table, table);
  });

  // Get all unique table names
  const allTables = new Set([
    ...query1TableMap.keys(),
    ...query2TableMap.keys()
  ]);

  const query1OnlyTables: string[] = [];
  const query2OnlyTables: string[] = [];

  // Check each table for conflicts
  for (const tableName of allTables) {
    const table1Info = query1TableMap.get(tableName);
    const table2Info = query2TableMap.get(tableName);

    if (table1Info && table2Info) {
      // Table exists in both queries - check for conflicts
      const conflict = checkLockConflict(table1Info.lockMode, table2Info.lockMode);
      
      if (conflict) {
        conflictingTables.push({
          table: tableName,
          query1Lock: table1Info.lockMode,
          query2Lock: table2Info.lockMode,
          conflictReason: `${table1Info.lockMode} conflicts with ${table2Info.lockMode}`
        });
      } else {
        compatibleTables.push({
          table: tableName,
          query1Lock: table1Info.lockMode,
          query2Lock: table2Info.lockMode
        });
      }
    } else if (table1Info && !table2Info) {
      query1OnlyTables.push(tableName);
    } else if (!table1Info && table2Info) {
      query2OnlyTables.push(tableName);
    }
  }

  const isCompatible = conflictingTables.length === 0;

  return {
    isCompatible,
    conflictingTables,
    compatibleTables,
    uniqueTables: {
      query1Only: query1OnlyTables,
      query2Only: query2OnlyTables
    }
  };
}

export function checkLockConflict(lockMode1: string, lockMode2: string): boolean {
  // Get lock mode information
  const lock1Info = LOCK_MODES[lockMode1];
  const lock2Info = LOCK_MODES[lockMode2];

  if (!lock1Info || !lock2Info) {
    return false; // Unknown lock modes are assumed compatible
  }

  // Check if lock1 conflicts with lock2
  const lock1ConflictsWithLock2 = lock1Info.conflicts.includes(lockMode2);
  
  // Check if lock2 conflicts with lock1  
  const lock2ConflictsWithLock1 = lock2Info.conflicts.includes(lockMode1);

  // If either lock conflicts with the other, they cannot coexist
  return lock1ConflictsWithLock2 || lock2ConflictsWithLock1;
}

export function getLockCompatibilityMatrix(): Record<string, Record<string, boolean>> {
  const matrix: Record<string, Record<string, boolean>> = {};
  
  const lockModeNames = Object.keys(LOCK_MODES);
  
  for (const lock1 of lockModeNames) {
    matrix[lock1] = {};
    for (const lock2 of lockModeNames) {
      matrix[lock1][lock2] = !checkLockConflict(lock1, lock2);
    }
  }
  
  return matrix;
}

// Helper function to get a human-readable summary
export function getComparisonSummary(result: QueryComparisonResult): string {
  if (result.isCompatible) {
    const sharedTables = result.compatibleTables.length;
    const uniqueTables = result.uniqueTables.query1Only.length + result.uniqueTables.query2Only.length;
    
    if (sharedTables === 0) {
      return `✅ Queries are compatible - they access different tables`;
    } else {
      return `✅ Queries are compatible - ${sharedTables} shared table${sharedTables > 1 ? 's' : ''} with compatible locks`;
    }
  } else {
    const conflictCount = result.conflictingTables.length;
    return `❌ Queries will conflict - ${conflictCount} table${conflictCount > 1 ? 's have' : ' has'} incompatible locks`;
  }
}