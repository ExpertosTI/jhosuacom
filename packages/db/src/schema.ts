import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const priceModeEnum = pgEnum('price_mode', ['detal', 'mayor']);
export const orderStatusEnum = pgEnum('order_status', [
  'received',
  'quoted',
  'confirmed',
  'invoiced',
  'cancelled',
]);
export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'operator']);

/** Staff del negocio (single-merchant) */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull().default('admin'),
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** Empresas de Odoo (res.company) */
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  odooId: integer('odoo_id').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    odooId: integer('odoo_id').notNull(),
    sku: text('sku'),
    name: text('name').notNull(),
    description: text('description'),
    /** Descripción generada por IA (no pisa description humana) */
    aiDescription: text('ai_description'),
    aiTags: jsonb('ai_tags').$type<string[]>().notNull().default([]),
    /** human | odoo | ai */
    descriptionSource: text('description_source').notNull().default('odoo'),
    category: text('category'),
    imageUrl: text('image_url'),
    /** Galería: data URLs o URLs públicas (primera = imageUrl) */
    imageUrls: jsonb('image_urls').$type<string[]>().notNull().default([]),
    priceDetal: numeric('price_detal', { precision: 14, scale: 2 }).notNull().default('0'),
    priceMayor: numeric('price_mayor', { precision: 14, scale: 2 }).notNull().default('0'),
    minMayorQty: integer('min_mayor_qty').notNull().default(6),
    stock: numeric('stock', { precision: 14, scale: 2 }).notNull().default('0'),
    featured: boolean('featured').notNull().default(false),
    /** Si true, sync Odoo no pisa priceDetal/priceMayor */
    priceLocked: boolean('price_locked').notNull().default(false),
    active: boolean('active').notNull().default(true),
    syncedAt: timestamp('synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('products_company_odoo_uidx').on(t.companyId, t.odooId),
    index('products_company_idx').on(t.companyId),
    index('products_active_idx').on(t.active),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    odooPartnerId: integer('odoo_partner_id'),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    taxId: text('tax_id'),
    priceMode: priceModeEnum('price_mode').notNull().default('detal'),
    debtAmount: numeric('debt_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    debtSyncedAt: timestamp('debt_synced_at'),
    lastNotifiedDebtAt: timestamp('last_notified_debt_at'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('customers_phone_uidx').on(t.phone),
    index('customers_odoo_partner_idx').on(t.odooPartnerId),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    number: text('number').notNull().unique(),
    customerId: uuid('customer_id').references(() => customers.id),
    companyId: uuid('company_id').references(() => companies.id),
    status: orderStatusEnum('status').notNull().default('received'),
    priceMode: priceModeEnum('price_mode').notNull().default('detal'),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    customerEmail: text('customer_email'),
    notes: text('notes'),
    subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 14, scale: 2 }).notNull().default('0'),
    odooSaleOrderId: integer('odoo_sale_order_id'),
    odooSaleOrderName: text('odoo_sale_order_name'),
    whatsappNotifiedAt: timestamp('whatsapp_notified_at'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('orders_status_idx').on(t.status),
    index('orders_phone_idx').on(t.customerPhone),
    uniqueIndex('orders_idempotency_uidx').on(t.idempotencyKey),
  ],
);

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id),
  odooProductId: integer('odoo_product_id'),
  name: text('name').notNull(),
  sku: text('sku'),
  imageUrl: text('image_url'),
  quantity: numeric('quantity', { precision: 14, scale: 2 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull(),
  lineTotal: numeric('line_total', { precision: 14, scale: 2 }).notNull(),
});

export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const syncLogs = pgTable('sync_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
  message: text('message'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Auditoría de corridas Gemini */
export const aiRuns = pgTable(
  'ai_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    role: text('role').notNull(),
    channel: text('channel').notNull(),
    actor: text('actor'),
    promptSummary: text('prompt_summary'),
    replySummary: text('reply_summary'),
    toolsUsed: jsonb('tools_used').$type<string[]>().notNull().default([]),
    ok: boolean('ok').notNull().default(true),
    error: text('error'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('ai_runs_created_idx').on(t.createdAt), index('ai_runs_channel_idx').on(t.channel)],
);

export const waConversations = pgTable(
  'wa_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: text('phone').notNull(),
    customerName: text('customer_name'),
    status: text('status').notNull().default('ai'), // ai | human | closed
    lastOrderId: uuid('last_order_id').references(() => orders.id),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('wa_conversations_phone_uidx').on(t.phone),
    index('wa_conversations_status_idx').on(t.status),
  ],
);

export const waMessages = pgTable(
  'wa_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => waConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // user | assistant | system
    text: text('text').notNull(),
    orderId: uuid('order_id').references(() => orders.id),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('wa_messages_conversation_idx').on(t.conversationId)],
);

export const companiesRelations = relations(companies, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  company: one(companies, {
    fields: [products.companyId],
    references: [companies.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  company: one(companies, {
    fields: [orders.companyId],
    references: [companies.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const waConversationsRelations = relations(waConversations, ({ many, one }) => ({
  messages: many(waMessages),
  lastOrder: one(orders, {
    fields: [waConversations.lastOrderId],
    references: [orders.id],
  }),
}));

export const waMessagesRelations = relations(waMessages, ({ one }) => ({
  conversation: one(waConversations, {
    fields: [waMessages.conversationId],
    references: [waConversations.id],
  }),
}));
