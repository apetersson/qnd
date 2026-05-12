# Rules for commits:

Commit as "conventional commit" style. Ideally body max 3-4 comment lines, not more. No co-author, no footer.
Any commit should clearly state the developer intent (ideally derive the intent from previous prompt interactions) / reason for the change - and be thoroughly defined that a very competent LLM could re-author the changes from the previous state. If that is not possible, the commit must be split up into more fine-granular.

# Prisma Migrations

**Never hand-write Prisma migration SQL.** Always autogenerate via `npx prisma migrate dev`.
- The development database must be running and mirror the production schema so Prisma can diff correctly.
- Hand-written migrations cause table-name mismatches (e.g., `tracks` vs `Track`) and break deploys.
- To create a migration:
  1. Edit `prisma/schema.prisma`
  2. Run `npx prisma migrate dev --name <name>` (auto-generates SQL)
  3. Commit both the migration directory AND the regenerated `@prisma/client`
