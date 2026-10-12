import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', {
 id:text('id').primaryKey(), owner:text('owner').notNull(), name:text('name').notNull(), code:text('code').notNull(), location:text('location').notNull(), created:text('created').notNull(), updated:text('updated').notNull()
}, t=>[index('project_owner').on(t.owner)]);
export const records=sqliteTable('records',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),projectId:text('project_id').notNull().references(()=>projects.id),title:text('title').notNull(),kind:text('kind').notNull(),date:text('date').notNull(),data:text('data').notNull(),version:integer('version').notNull(),created:text('created').notNull(),updated:text('updated').notNull()
}, t=>[index('record_project').on(t.owner,t.projectId)]);
export const revisions=sqliteTable('revisions',{
 recordId:text('record_id').notNull().references(()=>records.id),version:integer('version').notNull(),snapshot:text('snapshot').notNull(),created:text('created').notNull()
},t=>[primaryKey({columns:[t.recordId,t.version]})]);
export const files=sqliteTable('files',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),projectId:text('project_id').notNull().references(()=>projects.id),recordId:text('record_id').references(()=>records.id),name:text('name').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),kind:text('kind').notNull(),objectKey:text('object_key').notNull(),created:text('created').notNull()
},t=>[index('file_project').on(t.owner,t.projectId)]);
export const operations=sqliteTable('operations',{
 owner:text('owner').notNull(),requestId:text('request_id').notNull(),hash:text('hash').notNull(),result:text('result').notNull(),created:text('created').notNull()
},t=>[primaryKey({columns:[t.owner,t.requestId]})]);
export const settings=sqliteTable('settings',{
 owner:text('owner').primaryKey(),company:text('company').notNull(),handwriting:integer('handwriting').notNull().default(0),lastMcp:text('last_mcp')
});
