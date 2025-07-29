import { LockInfo, COMMAND_LOCKS, getLockAnalysis as getLockAnalysisFromData, LOCK_MODES } from './lockData';

export interface ParsedQuery {
  command: string;
  tables: string[];
  isValid: boolean;
  error?: string;
}


// Import @supabase/pg-parser for browser-compatible AST parsing
import { PgParser } from '@supabase/pg-parser';

// Initialize parser instance with proper async handling
let parser: PgParser | null = null;
let parserInitialized = false;

async function initParser(): Promise<PgParser> {
  if (!parser && !parserInitialized) {
    parserInitialized = true;
    try {
      parser = new PgParser(); // Defaults to PostgreSQL version 17

      // Test the parser with a simple query to ensure WASM is loaded
      const testResult = await parser.parse('SELECT 1;');

      // Check if the result indicates an error
      if (testResult && typeof testResult === 'object' && 'error' in testResult && testResult.error) {
        const errorMessage = typeof testResult.error === 'string' ? testResult.error : String(testResult.error);
        throw new Error(`Parser test failed: ${errorMessage}`);
      }

      // Check if we got a valid tree result
      if (!testResult || typeof testResult !== 'object' || !('tree' in testResult) || !testResult.tree) {
        throw new Error('Parser test failed: No valid AST tree returned');
      }
    } catch (error) {
      parser = null;
      parserInitialized = false;
      throw error;
    }
  }

  if (!parser) {
    throw new Error('Parser not initialized');
  }

  return parser;
}

export async function parseSQL(query: string): Promise<ParsedQuery> {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { command: '', tables: [], isValid: false, error: 'Query cannot be empty' };
    }

    // Get parser instance (now async)
    const parserInstance = await initParser();

    // Ensure query ends with semicolon (required by pg parsers)
    const queryWithSemicolon = cleanQuery.endsWith(';') ? cleanQuery : cleanQuery + ';';

    // Parse SQL to AST using @supabase/pg-parser
    const result = await parserInstance.parse(queryWithSemicolon);

    // Check if parsing failed
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      const errorMessage = typeof result.error === 'string' ? result.error : String(result.error);
      return { command: '', tables: [], isValid: false, error: errorMessage };
    }

    // Extract the AST tree
    let ast;
    if (result && typeof result === 'object' && 'tree' in result) {
      ast = result.tree;
    } else {
      // Maybe the result IS the tree directly?
      ast = result;
    }

    if (!ast || !ast.stmts || ast.stmts.length === 0) {
      return { command: '', tables: [], isValid: false, error: 'No statements found in query' };
    }

    // Process the first statement (support for single statements for now)
    const statement = ast.stmts[0].stmt;

    // Extract command and tables from AST
    const extractionResult = extractFromAST(statement);

    return {
      command: extractionResult.command,
      tables: extractionResult.tables,
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

interface ASTExtractionResult {
  command: string;
  tables: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromAST(statement: any): ASTExtractionResult {
  const tables: Set<string> = new Set();
  const cteNames: Set<string> = new Set();
  let command = '';

  // Handle WITH clauses (CTEs) first - collect CTE names and extract underlying tables
  if (statement.withClause) {
    extractTablesFromCTE(statement.withClause, tables, cteNames);
  }

  // Determine statement type and extract information
  if (statement.SelectStmt) {
    // Handle WITH clause for SELECT statements
    if (statement.SelectStmt.withClause) {
      extractTablesFromCTE(statement.SelectStmt.withClause, tables, cteNames);
    }
    command = analyzeSelectStatement(statement.SelectStmt, tables, cteNames);
  } else if (statement.InsertStmt) {
    command = analyzeInsertStatement(statement.InsertStmt, tables, cteNames);
  } else if (statement.UpdateStmt) {
    command = 'UPDATE';
    extractTableFromRelation(statement.UpdateStmt.relation, tables);
    // Extract tables from FROM clause (for JOINs in UPDATE)
    if (statement.UpdateStmt.fromClause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      statement.UpdateStmt.fromClause.forEach((fromItem: any) => {
        extractTablesFromFromClause(fromItem, tables, cteNames);
      });
    }
    // Extract tables from WHERE clause subqueries
    if (statement.UpdateStmt.whereClause) {
      extractTablesFromExpression(statement.UpdateStmt.whereClause, tables, cteNames);
    }
    // Extract tables from SET clause expressions
    if (statement.UpdateStmt.targetList) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      statement.UpdateStmt.targetList.forEach((target: any) => {
        if (target.ResTarget && target.ResTarget.val) {
          extractTablesFromExpression(target.ResTarget.val, tables, cteNames);
        }
      });
    }
  } else if (statement.DeleteStmt) {
    command = 'DELETE';
    extractTableFromRelation(statement.DeleteStmt.relation, tables);
    // Extract tables from USING clause
    if (statement.DeleteStmt.usingClause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      statement.DeleteStmt.usingClause.forEach((fromItem: any) => {
        extractTablesFromFromClause(fromItem, tables, cteNames);
      });
    }
    // Extract tables from WHERE clause subqueries
    if (statement.DeleteStmt.whereClause) {
      extractTablesFromExpression(statement.DeleteStmt.whereClause, tables, cteNames);
    }
  } else if (statement.IndexStmt) {
    command = statement.IndexStmt.concurrent ? 'CREATE INDEX CONCURRENTLY' : 'CREATE INDEX';
    extractTableFromRelation(statement.IndexStmt.relation, tables);
  } else if (statement.CreateTrigStmt) {
    command = 'CREATE TRIGGER';
    extractTableFromRelation(statement.CreateTrigStmt.relation, tables);
  } else if (statement.RefreshMatViewStmt) {
    command = statement.RefreshMatViewStmt.concurrent ?
      'REFRESH MATERIALIZED VIEW CONCURRENTLY' : 'REFRESH MATERIALIZED VIEW';
    extractTableFromRelation(statement.RefreshMatViewStmt.relation, tables);
  } else if (statement.DropStmt) {
    if (statement.DropStmt.removeType === 'OBJECT_TABLE') {
      command = 'DROP TABLE';
      extractTablesFromDropStmt(statement.DropStmt, tables);
    } else {
      command = 'DROP';
    }
  } else if (statement.TruncateStmt) {
    command = 'TRUNCATE';
    extractTablesFromTruncateStmt(statement.TruncateStmt, tables);
  } else if (statement.AlterTableStmt) {
    command = analyzeAlterTableStatement(statement.AlterTableStmt, tables);
  } else if (statement.VacuumStmt) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    command = statement.VacuumStmt.options?.some((opt: any) => opt.DefElem?.defname === 'full')
      ? 'VACUUM FULL' : 'VACUUM';
    if (statement.VacuumStmt.rels && statement.VacuumStmt.rels.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      statement.VacuumStmt.rels.forEach((rel: any) => {
        if (rel.RangeVar && rel.RangeVar.relname) {
          tables.add(rel.RangeVar.relname);
        } else if (rel.relname) {
          tables.add(rel.relname);
        } else {
          extractTableFromRelation(rel, tables);
        }
      });
    }
  } else if (statement.MergeStmt) {
    command = 'MERGE';
    extractTableFromRelation(statement.MergeStmt.relation, tables);
    // Extract source table from USING clause - could be table, subquery, or complex expression
    if (statement.MergeStmt.sourceRelation) {
      extractTablesFromFromClause(statement.MergeStmt.sourceRelation, tables, cteNames);
    }
    // Extract tables from MERGE conditions
    if (statement.MergeStmt.joinCondition) {
      extractTablesFromExpression(statement.MergeStmt.joinCondition, tables, cteNames);
    }
  } else {
    command = 'UNKNOWN';
  }

  // Filter out CTE names from the final table list
  const filteredTables = Array.from(tables).filter(table =>
    table.length > 0 && !cteNames.has(table)
  );

  return {
    command,
    tables: filteredTables
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeSelectStatement(selectStmt: any, tables: Set<string>, cteNames: Set<string> = new Set()): string {
  let command = 'SELECT';

  // Check for locking clauses (FOR UPDATE, FOR SHARE, etc.)
  if (selectStmt.lockingClause && selectStmt.lockingClause.length > 0) {
    const lockClause = selectStmt.lockingClause[0].LockingClause;
    if (lockClause) {
      switch (lockClause.strength) {
        case 'LCS_FORKEYSHARE':
          command = 'SELECT FOR KEY SHARE';
          break;
        case 'LCS_FORSHARE':
          command = 'SELECT FOR SHARE';
          break;
        case 'LCS_FORNOKEYUPDATE':
          command = 'SELECT FOR NO KEY UPDATE';
          break;
        case 'LCS_FORUPDATE':
          command = 'SELECT FOR UPDATE';
          break;
      }
    }
  }

  // Extract tables from FROM clause
  if (selectStmt.fromClause) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectStmt.fromClause.forEach((fromItem: any) => {
      extractTablesFromFromClause(fromItem, tables);
    });
  }

  // Extract tables from WHERE clause subqueries
  if (selectStmt.whereClause) {
    extractTablesFromExpression(selectStmt.whereClause, tables, cteNames);
  }

  // Extract tables from target list (SELECT clause) subqueries
  if (selectStmt.targetList) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectStmt.targetList.forEach((target: any) => {
      if (target.ResTarget && target.ResTarget.val) {
        extractTablesFromExpression(target.ResTarget.val, tables, cteNames);
      }
    });
  }

  return command;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTablesFromFromClause(fromItem: any, tables: Set<string>, cteNames: Set<string> = new Set()) {
  if (fromItem.RangeVar) {
    // Simple table reference
    if (fromItem.RangeVar.relname) {
      tables.add(fromItem.RangeVar.relname);
    }
  } else if (fromItem.JoinExpr) {
    // JOIN expression - extract from both sides
    if (fromItem.JoinExpr.larg) {
      extractTablesFromFromClause(fromItem.JoinExpr.larg, tables, cteNames);
    }
    if (fromItem.JoinExpr.rarg) {
      extractTablesFromFromClause(fromItem.JoinExpr.rarg, tables, cteNames);
    }
    // Extract tables from JOIN condition
    if (fromItem.JoinExpr.quals) {
      extractTablesFromExpression(fromItem.JoinExpr.quals, tables, cteNames);
    }
  } else if (fromItem.RangeSubselect) {
    // Subquery in FROM clause
    if (fromItem.RangeSubselect.subquery) {
      extractTablesFromSubquery(fromItem.RangeSubselect.subquery, tables, cteNames);
    }
  } else if (fromItem.RangeFunction) {
    // Function call in FROM clause - may contain subqueries in arguments
    if (fromItem.RangeFunction.functions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fromItem.RangeFunction.functions.forEach((func: any) => {
        if (func.List && func.List.items) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          func.List.items.forEach((item: any) => {
            extractTablesFromExpression(item, tables);
          });
        }
      });
    }
  } else if (fromItem.RangeTableFunc) {
    // Table function (including LATERAL expressions)
    if (fromItem.RangeTableFunc.docexpr) {
      extractTablesFromExpression(fromItem.RangeTableFunc.docexpr, tables);
    }
    if (fromItem.RangeTableFunc.rowexpr) {
      extractTablesFromExpression(fromItem.RangeTableFunc.rowexpr, tables);
    }
  } else if (fromItem.List) {
    // Multiple FROM items (comma-separated)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fromItem.List.items.forEach((item: any) => {
      extractTablesFromFromClause(item, tables);
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTableFromRelation(relation: any, tables: Set<string>) {
  if (relation && relation.relname) {
    tables.add(relation.relname);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTablesFromDropStmt(dropStmt: any, tables: Set<string>) {
  if (dropStmt.objects) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dropStmt.objects.forEach((obj: any) => {
      if (obj.List && obj.List.items) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obj.List.items.forEach((item: any) => {
          if (item.String && item.String.sval) {
            tables.add(item.String.sval);
          }
        });
      }
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTablesFromTruncateStmt(truncateStmt: any, tables: Set<string>) {
  if (truncateStmt.relations && truncateStmt.relations.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    truncateStmt.relations.forEach((relation: any) => {
      if (relation.RangeVar) {
        extractTableFromRelation(relation.RangeVar, tables);
      } else {
        extractTableFromRelation(relation, tables);
      }
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTablesFromCTE(withClause: any, tables: Set<string>, cteNames: Set<string>) {
  if (withClause.ctes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withClause.ctes.forEach((cte: any) => {
      if (cte.CommonTableExpr) {
        // Add CTE name to exclusion list
        if (cte.CommonTableExpr.ctename) {
          cteNames.add(cte.CommonTableExpr.ctename);
        }
        // Extract tables from CTE query
        if (cte.CommonTableExpr.ctequery) {
          extractTablesFromSubquery(cte.CommonTableExpr.ctequery, tables, cteNames);
        }
      }
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeInsertStatement(insertStmt: any, tables: Set<string>, cteNames: Set<string> = new Set()): string {
  let command = 'INSERT';

  extractTableFromRelation(insertStmt.relation, tables);

  // Extract tables from SELECT part (INSERT ... SELECT)
  if (insertStmt.selectStmt) {
    extractTablesFromSubquery(insertStmt.selectStmt, tables, cteNames);
  }

  // Check for ON CONFLICT clause
  if (insertStmt.onConflictClause) {
    command = 'INSERT ON CONFLICT';
  }

  return command;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeAlterTableStatement(alterStmt: any, tables: Set<string>): string {
  let command = 'ALTER TABLE';

  extractTableFromRelation(alterStmt.relation, tables);

  // Analyze specific ALTER TABLE commands
  if (alterStmt.cmds && alterStmt.cmds.length > 0) {
    const cmd = alterStmt.cmds[0].AlterTableCmd;
    if (cmd) {
      switch (cmd.subtype) {
        case 'AT_AddColumn':
          command = 'ALTER TABLE ADD COLUMN';
          break;
        case 'AT_AddConstraint':
          if (cmd.def?.Constraint?.contype === 'CONSTR_FOREIGN') {
            command = 'ALTER TABLE ADD FOREIGN KEY';
            // Extract referenced table
            if (cmd.def.Constraint.pktable) {
              extractTableFromRelation(cmd.def.Constraint.pktable, tables);
            }
          }
          break;
        case 'AT_ValidateConstraint':
          command = 'ALTER TABLE VALIDATE CONSTRAINT';
          break;
        case 'AT_AttachPartition':
          command = 'ALTER TABLE ATTACH PARTITION';
          if (cmd.def && cmd.def.RangeVar) {
            extractTableFromRelation(cmd.def.RangeVar, tables);
          } else if (cmd.def) {
            extractTableFromRelation(cmd.def, tables);
          }
          break;
        case 'AT_SetTableSpace':
          command = 'ALTER TABLE SET TABLESPACE';
          break;
        case 'AT_DisableTrig':
          command = 'ALTER TABLE DISABLE TRIGGER';
          break;
      }
    }
  }

  return command;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTablesFromExpression(expr: any, tables: Set<string>, cteNames: Set<string> = new Set()) {
  if (!expr) return;

  if (expr.SubLink) {
    // Subquery in expression
    if (expr.SubLink.subselect) {
      extractTablesFromSubquery(expr.SubLink.subselect, tables, cteNames);
    }
  } else if (expr.BoolExpr) {
    // Boolean expression (AND, OR, etc.)
    if (expr.BoolExpr.args) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expr.BoolExpr.args.forEach((arg: any) => {
        extractTablesFromExpression(arg, tables, cteNames);
      });
    }
  } else if (expr.A_Expr) {
    // Binary expression
    if (expr.A_Expr.lexpr) {
      extractTablesFromExpression(expr.A_Expr.lexpr, tables, cteNames);
    }
    if (expr.A_Expr.rexpr) {
      extractTablesFromExpression(expr.A_Expr.rexpr, tables, cteNames);
    }
  } else if (expr.RowExpr) {
    // Row expression (used in multi-column assignments)
    if (expr.RowExpr.args) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expr.RowExpr.args.forEach((arg: any) => {
        extractTablesFromExpression(arg, tables, cteNames);
      });
    }
  } else if (expr.MultiAssignRef) {
    // Multi-assignment reference (like in UPDATE ... SET (col1, col2) = ...)
    if (expr.MultiAssignRef.source) {
      extractTablesFromExpression(expr.MultiAssignRef.source, tables, cteNames);
    }
  } else if (expr.FuncCall) {
    // Function call - may contain subqueries in arguments
    if (expr.FuncCall.args) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expr.FuncCall.args.forEach((arg: any) => {
        extractTablesFromExpression(arg, tables, cteNames);
      });
    }
  } else if (expr.CaseExpr) {
    // CASE expression
    if (expr.CaseExpr.arg) {
      extractTablesFromExpression(expr.CaseExpr.arg, tables, cteNames);
    }
    if (expr.CaseExpr.args) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expr.CaseExpr.args.forEach((when: any) => {
        if (when.CaseWhen) {
          if (when.CaseWhen.expr) {
            extractTablesFromExpression(when.CaseWhen.expr, tables, cteNames);
          }
          if (when.CaseWhen.result) {
            extractTablesFromExpression(when.CaseWhen.result, tables, cteNames);
          }
        }
      });
    }
    if (expr.CaseExpr.defresult) {
      extractTablesFromExpression(expr.CaseExpr.defresult, tables, cteNames);
    }
  } else if (expr.List) {
    // List of expressions
    if (expr.List.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expr.List.items.forEach((item: any) => {
        extractTablesFromExpression(item, tables, cteNames);
      });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTablesFromSubquery(subquery: any, tables: Set<string>, cteNames: Set<string> = new Set()) {
  if (subquery.SelectStmt) {
    analyzeSelectStatement(subquery.SelectStmt, tables, cteNames);
  } else if (subquery.InsertStmt) {
    analyzeInsertStatement(subquery.InsertStmt, tables, cteNames);
  } else if (subquery.UpdateStmt) {
    extractTableFromRelation(subquery.UpdateStmt.relation, tables);
    if (subquery.UpdateStmt.fromClause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subquery.UpdateStmt.fromClause.forEach((fromItem: any) => {
        extractTablesFromFromClause(fromItem, tables, cteNames);
      });
    }
    if (subquery.UpdateStmt.whereClause) {
      extractTablesFromExpression(subquery.UpdateStmt.whereClause, tables, cteNames);
    }
  } else if (subquery.DeleteStmt) {
    extractTableFromRelation(subquery.DeleteStmt.relation, tables);
    if (subquery.DeleteStmt.usingClause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subquery.DeleteStmt.usingClause.forEach((fromItem: any) => {
        extractTablesFromFromClause(fromItem, tables, cteNames);
      });
    }
    if (subquery.DeleteStmt.whereClause) {
      extractTablesFromExpression(subquery.DeleteStmt.whereClause, tables, cteNames);
    }
  }
}

export function getLockAnalysis(command: string): LockInfo | null {
  return getLockAnalysisFromData(command);
}

export interface TableLockInfo {
  table: string;
  lockMode: string;
  description: string;
  conflicts: string[];
}

// Get lock analysis for each table based on its role in the query
export function getTableLockAnalysis(tables: string[], command: string, primaryTable?: string): TableLockInfo[] {
  const results: TableLockInfo[] = [];

  for (const table of tables) {
    let lockMode: string;

    // Special handling for specific commands where multiple tables get the same lock
    if (command === 'ALTER TABLE ADD FOREIGN KEY' && tables.length === 2) {
      // For FK creation: primary table gets SHARE ROW EXCLUSIVE, referenced table gets SHARE ROW EXCLUSIVE too
      if (isPrimaryTable(table, command, primaryTable, tables)) {
        lockMode = 'SHARE ROW EXCLUSIVE';
      } else {
        lockMode = 'SHARE ROW EXCLUSIVE'; // Both tables get the same lock for FK
      }
    } else if (command.startsWith('SELECT FOR')) {
      // For SELECT FOR UPDATE/SHARE, all referenced tables get the locking mode
      const commandLockMode = COMMAND_LOCKS[command];
      lockMode = commandLockMode || 'ACCESS SHARE';
    } else if (isPrimaryTable(table, command, primaryTable, tables)) {
      // Primary table gets the command's lock mode
      const commandLockMode = COMMAND_LOCKS[command];
      lockMode = commandLockMode || 'ACCESS SHARE';
    } else {
      // Referenced tables (in FROM, JOIN, subqueries) typically get ACCESS SHARE
      lockMode = 'ACCESS SHARE';
    }

    const lockModeInfo = LOCK_MODES[lockMode];
    if (lockModeInfo) {
      results.push({
        table,
        lockMode,
        description: lockModeInfo.description,
        conflicts: lockModeInfo.conflicts
      });
    }
  }

  return results;
}

function isPrimaryTable(table: string, command: string, primaryTable: string | undefined, allTables: string[]): boolean {
  // If primaryTable is explicitly provided, use it
  if (primaryTable) {
    return table === primaryTable;
  }

  // For multi-table operations, all tables may be primary
  if (['TRUNCATE'].includes(command)) {
    return true;
  }

  // For single table operations, the first table is usually primary
  // This is a heuristic and may need refinement based on AST analysis
  return table === allTables[0];
}

// Legacy sync version for backward compatibility (will be deprecated)
export function parseSQLSync(query: string): ParsedQuery {
  // This is a fallback that uses the old regex-based approach
  // It's kept for compatibility but should be replaced with parseSQL
  console.warn('parseSQLSync is deprecated. Use parseSQL instead.');

  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { command: '', tables: [], isValid: false, error: 'Query cannot be empty' };
    }

    // Simple fallback extraction
    const commandMatch = cleanQuery.match(/^(\w+)/i);
    const command = commandMatch ? commandMatch[1].toUpperCase() : 'UNKNOWN';

    return {
      command,
      tables: [],
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