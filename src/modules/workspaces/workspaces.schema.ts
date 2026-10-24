import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '../identity/identity.schema.js';

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: bigint('version', { mode: 'bigint' })
      .notNull()
      .default(sql`1`),
  },
  (table) => [
    index('workspaces_owner_user_id_idx').on(table.ownerUserId),
    check(
      'workspaces_status_check',
      sql`${table.status} IN ('active', 'suspended', 'archived')`,
    ),
    check('workspaces_version_check', sql`${table.version} > 0`),
    check('workspaces_name_check', sql`length(btrim(${table.name})) > 0`),
  ],
);
