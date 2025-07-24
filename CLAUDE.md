# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based PostgreSQL Lock Analyzer web application that allows users to input SQL queries and analyze the table-level locks that PostgreSQL will acquire. The app parses SQL queries, identifies affected tables, and provides detailed information about lock modes and conflicts.

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **State Management**: React Query (@tanstack/react-query)
- **Package Manager**: pnpm

## Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Build for development (with development mode settings)
pnpm build:dev

# Run linting
pnpm lint

# Preview production build
pnpm preview

# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests once (CI mode)
pnpm test:run
```

**Important**: The development server (`pnpm dev`) is always running in a separate terminal. Do not start, stop, or restart the development server - the user manages this themselves.

## Core Architecture

### Main Application Structure

- **`src/App.tsx`**: Root component with routing setup using React Router, includes providers for React Query and Tooltip components
- **`src/pages/Index.tsx`**: Main application page containing the SQL input interface and lock analysis results
- **`src/pages/NotFound.tsx`**: 404 error page

### Key Components

- **`SQLQueryInput`**: Handles SQL query input from users
- **`LockAnalysisResults`**: Displays the lock analysis results with detailed information about lock modes and conflicts
- **`ErrorMessage`**: Displays error messages when query parsing fails

### Core Logic

- **`src/lib/sqlParser.ts`**: Contains the main SQL parsing and lock analysis logic
  - `parseSQL()`: **Async function** that uses pgsql-parser to parse SQL queries via AST analysis
  - `getLockAnalysis()`: Maps SQL commands to PostgreSQL lock modes
  - Uses **pgsql-parser** library for accurate PostgreSQL AST parsing (not regex-based)
  - **WASM Initialization**: Automatically loads the WebAssembly module on first use via `loadModule()`
  - Supports various SQL commands: SELECT, INSERT, UPDATE, DELETE, CREATE INDEX, ALTER TABLE, VACUUM, etc.
  - Handles complex cases like `SELECT FOR UPDATE`, `CREATE INDEX CONCURRENTLY`, JOINs, etc.
  - **Note**: `parseSQL()` is async and returns a Promise - make sure to use `await` when calling it

### UI Components

The app uses shadcn/ui components located in `src/components/ui/`. Key components include:
- Cards, Buttons, Badges for UI elements
- Tooltips for additional lock information
- Toast notifications via Sonner

## Configuration Files

- **`vite.config.ts`**: Vite configuration with React plugin and path aliases (`@` -> `./src`)
- **`eslint.config.js`**: ESLint configuration with TypeScript and React plugins
- **`tailwind.config.ts`**: Tailwind CSS configuration
- **`tsconfig.json`**: TypeScript configuration with strict settings

## Testing

The project uses **Vitest** for testing with comprehensive coverage of SQL parsing scenarios.

### Test Structure

- **`src/lib/__tests__/sqlParser.test.ts`**: Comprehensive test suite covering 31+ advanced SQL scenarios including:
  - DML with Complex JOINs and Subqueries
  - Common Table Expressions (CTEs)
  - Pessimistic Locking (FOR UPDATE/SHARE)
  - Data Definition Language (DDL)
  - Transaction and System Commands
  - Edge Cases and Miscellaneous scenarios

### Running Tests

```bash
# Watch mode for development
pnpm test

# Run tests with interactive UI
pnpm test:ui

# Run tests once (for CI)
pnpm test:run
```

### Test Coverage

The test suite validates:
- Correct command identification (SELECT, INSERT, UPDATE, DELETE, etc.)
- Accurate table extraction from complex queries  
- **Individual table lock mode assignment** - validates each table gets the correct lock
- Error handling for invalid queries
- **31/38 tests pass** (82% success rate) including lock mode validation
- 7 edge cases are skipped (advanced CTE filtering and specific DDL scenarios)

**Test Results:**
- All DML with Complex JOINs (6/6 tests) - 100% success
- All Pessimistic Locking scenarios (3/3 tests) - 100% success  
- Most DDL commands (7/8 tests) - 87.5% success
- Most Transaction commands (3/4 tests) - 75% success
- All Edge Cases (5/5 tests) - 100% success
- All Basic Commands (4/4 tests) - 100% success

## Key Features

1. **SQL Query Parsing**: Parses various PostgreSQL SQL statements to identify tables and lock requirements
2. **Lock Analysis**: Maps SQL commands to PostgreSQL table-level lock modes (ACCESS SHARE, ROW EXCLUSIVE, etc.)
3. **Conflict Detection**: Shows which lock modes conflict with each other
4. **Interactive UI**: Provides example queries and real-time analysis
5. **Error Handling**: Comprehensive error messages for invalid queries

## Development Notes

- The application runs on port 8080 in development mode
- Uses TypeScript with strict type checking
- ESLint is configured with React hooks and TypeScript rules
- The app is designed to work with PostgreSQL lock semantics specifically