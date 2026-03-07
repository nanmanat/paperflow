import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const columnIdEnum = pgEnum('column_id', [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
]);

export const projects = pgTable('projects', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          text('name').notNull(),
  description:   text('description').notNull().default(''),
  githubOwner:   text('github_owner').notNull(),
  githubRepo:    text('github_repo').notNull(),
  defaultBranch: text('default_branch').notNull(),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kanbanCards = pgTable('kanban_cards', {
  id:          uuid('id').primaryKey().defaultRandom(),
  projectId:   uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title:       text('title').notNull(),
  description: text('description').notNull().default(''),
  columnId:    columnIdEnum('column_id').notNull(),
  position:    integer('position').notNull().default(0),
  branchName:  text('branch_name'),
  prNumber:    integer('pr_number'),
  prMerged:    boolean('pr_merged').notNull().default(false),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectRow    = typeof projects.$inferSelect;
export type KanbanCardRow = typeof kanbanCards.$inferSelect;
