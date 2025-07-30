# PostgreSQL Lock Analyzer

Analyze PostgreSQL table-level locks for any SQL query. Paste your SQL and instantly see which tables get locked and with what lock modes.

**🔗 Try it live**: [db-locks.vgrozdanic.com](https://db-locks.vgrozdanic.com)

## What it does

- Parse any PostgreSQL query (SELECT, INSERT, UPDATE, DELETE, DDL commands)
- Show which tables will be locked and with what lock modes
- Identify lock conflicts between concurrent queries
- Works entirely in your browser - no data sent to servers

## Tech Stack

- React 18 + TypeScript + Vite
- shadcn/ui + Tailwind CSS
- @supabase/pg-parser (WebAssembly PostgreSQL parser)

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Example Queries

```sql
-- UPDATE with JOINs
UPDATE employees SET salary = salary * 1.05
FROM departments
WHERE employees.department_id = departments.id;

-- SELECT with locking
SELECT * FROM job_queue 
WHERE status = 'pending' 
FOR UPDATE SKIP LOCKED;

-- DDL operations
CREATE INDEX CONCURRENTLY idx_email ON users(email);
```

## Contributing

1. Fork and clone the repository
2. `pnpm install`
3. `pnpm dev` to start development
4. `pnpm test` to run tests
5. Submit a pull request

## License

MIT