import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import bcrypt from 'bcryptjs';
import * as schema from '@jhosua/db';

/** Crea schema si falta y siembra demo si la DB está vacía. Usa solo deps del API (sin drizzle-kit). */
export async function bootstrapDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const client = postgres(url, { max: 1 });

  try {
    const exists = await client`
      SELECT to_regclass('public.companies') AS reg
    `;
    if (!exists[0]?.reg) {
      console.log('📦 Creando schema JH Hogar...');
      await client.unsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).catch(() => {});
      await client.unsafe(`
        DO $$ BEGIN
          CREATE TYPE price_mode AS ENUM ('detal', 'mayor');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN
          CREATE TYPE order_status AS ENUM ('received', 'quoted', 'confirmed', 'invoiced', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN
          CREATE TYPE user_role AS ENUM ('owner', 'admin', 'operator');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        CREATE TABLE IF NOT EXISTS users (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email text NOT NULL UNIQUE,
          password_hash text NOT NULL,
          name text NOT NULL,
          role user_role NOT NULL DEFAULT 'admin',
          phone text,
          active boolean NOT NULL DEFAULT true,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS companies (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          odoo_id integer NOT NULL UNIQUE,
          name text NOT NULL,
          slug text NOT NULL UNIQUE,
          logo_url text,
          sort_order integer NOT NULL DEFAULT 0,
          active boolean NOT NULL DEFAULT true,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS products (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid NOT NULL REFERENCES companies(id),
          odoo_id integer NOT NULL,
          sku text,
          name text NOT NULL,
          description text,
          category text,
          image_url text,
          image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
          price_detal numeric(14,2) NOT NULL DEFAULT 0,
          price_mayor numeric(14,2) NOT NULL DEFAULT 0,
          min_mayor_qty integer NOT NULL DEFAULT 6,
          stock numeric(14,2) NOT NULL DEFAULT 0,
          featured boolean NOT NULL DEFAULT false,
          active boolean NOT NULL DEFAULT true,
          synced_at timestamp,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS products_company_odoo_uidx ON products(company_id, odoo_id);
        CREATE INDEX IF NOT EXISTS products_company_idx ON products(company_id);
        CREATE INDEX IF NOT EXISTS products_active_idx ON products(active);

        CREATE TABLE IF NOT EXISTS customers (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          odoo_partner_id integer,
          name text NOT NULL,
          phone text NOT NULL,
          email text,
          tax_id text,
          price_mode price_mode NOT NULL DEFAULT 'detal',
          debt_amount numeric(14,2) NOT NULL DEFAULT 0,
          debt_synced_at timestamp,
          last_notified_debt_at timestamp,
          notes text,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_uidx ON customers(phone);
        CREATE INDEX IF NOT EXISTS customers_odoo_partner_idx ON customers(odoo_partner_id);

        CREATE TABLE IF NOT EXISTS orders (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          number text NOT NULL UNIQUE,
          customer_id uuid REFERENCES customers(id),
          company_id uuid REFERENCES companies(id),
          status order_status NOT NULL DEFAULT 'received',
          price_mode price_mode NOT NULL DEFAULT 'detal',
          customer_name text NOT NULL,
          customer_phone text NOT NULL,
          customer_email text,
          notes text,
          subtotal numeric(14,2) NOT NULL DEFAULT 0,
          total numeric(14,2) NOT NULL DEFAULT 0,
          odoo_sale_order_id integer,
          odoo_sale_order_name text,
          whatsapp_notified_at timestamp,
          idempotency_key text,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
        CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders(customer_phone);
        CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_uidx ON orders(idempotency_key);

        CREATE TABLE IF NOT EXISTS order_items (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id uuid REFERENCES products(id),
          odoo_product_id integer,
          name text NOT NULL,
          sku text,
          image_url text,
          quantity numeric(14,2) NOT NULL,
          unit_price numeric(14,2) NOT NULL,
          line_total numeric(14,2) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          key text NOT NULL UNIQUE,
          value jsonb NOT NULL,
          updated_at timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS sync_logs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          kind text NOT NULL,
          status text NOT NULL,
          message text,
          meta jsonb,
          created_at timestamp NOT NULL DEFAULT now()
        );
      `);
      console.log('✅ Schema creado');
    }

    // Migraciones ligeras (DB ya existente)
    await client.unsafe(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url text`).catch(() => {});
    await client
      .unsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb`)
      .catch(() => {});

    const db = drizzle(client, { schema });
    const productRows = await client`SELECT id FROM products LIMIT 1`;
    if (productRows.length === 0) {
      console.log('🌱 Seed demo...');
      const email = process.env.ADMIN_EMAIL || 'admin@jhhogar.com';
      const password = process.env.ADMIN_PASSWORD || 'JhHogarAdmin2026!';
      const hash = await bcrypt.hash(password, 10);

      const userRows = await client`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      if (userRows.length === 0) {
        await db.insert(schema.users).values({
          email,
          passwordHash: hash,
          name: 'Admin JH Hogar',
          role: 'owner',
          phone: process.env.ADMIN_NOTIFY_PHONES?.split(',')[0]?.trim() || null,
        });
      }

      for (const c of [
        { odooId: 1, name: 'JH Hogar', slug: 'jh-hogar', sortOrder: 1 },
        { odooId: 2, name: 'Electro JH', slug: 'electro-jh', sortOrder: 2 },
        { odooId: 3, name: 'Muebles JH', slug: 'muebles-jh', sortOrder: 3 },
      ]) {
        const found = await client`SELECT id FROM companies WHERE odoo_id = ${c.odooId} LIMIT 1`;
        if (found.length === 0) await db.insert(schema.companies).values(c);
      }

      const companies = await db.query.companies.findMany();
      const demos = [
        {
          companySlug: 'jh-hogar',
          odooId: 101,
          sku: 'REF-500',
          name: 'Nevera 2 puertas 500L',
          description: 'Eficiencia A+, acero inoxidable, no frost.',
          category: 'Electrodomésticos',
          priceDetal: '899.00',
          priceMayor: '780.00',
          stock: '12',
          featured: true,
        },
        {
          companySlug: 'jh-hogar',
          odooId: 102,
          sku: 'LAV-9KG',
          name: 'Lavadora carga frontal 9kg',
          description: 'Motor inverter, 15 programas.',
          category: 'Electrodomésticos',
          priceDetal: '549.00',
          priceMayor: '475.00',
          stock: '20',
          featured: true,
        },
        {
          companySlug: 'electro-jh',
          odooId: 201,
          sku: 'MIC-25',
          name: 'Microondas 25L digital',
          description: 'Grill, descongelado automático.',
          category: 'Cocina',
          priceDetal: '129.00',
          priceMayor: '105.00',
          stock: '40',
          featured: true,
        },
        {
          companySlug: 'electro-jh',
          odooId: 202,
          sku: 'TV-55',
          name: 'Smart TV 55" 4K',
          description: 'HDR10, Android TV.',
          category: 'TV & Audio',
          priceDetal: '699.00',
          priceMayor: '610.00',
          stock: '15',
          featured: false,
        },
        {
          companySlug: 'muebles-jh',
          odooId: 301,
          sku: 'SOF-3P',
          name: 'Sofá 3 puestos tela',
          description: 'Estructura reforzada, tapizado premium.',
          category: 'Sala',
          priceDetal: '459.00',
          priceMayor: '390.00',
          stock: '8',
          featured: true,
        },
        {
          companySlug: 'muebles-jh',
          odooId: 302,
          sku: 'CAM-Q',
          name: 'Cama Queen + colchón',
          description: 'Base de madera y colchón ortopédico.',
          category: 'Dormitorio',
          priceDetal: '520.00',
          priceMayor: '445.00',
          stock: '10',
          featured: false,
        },
      ];

      for (const p of demos) {
        const company = companies.find((c) => c.slug === p.companySlug);
        if (!company) continue;
        await db.insert(schema.products).values({
          companyId: company.id,
          odooId: p.odooId,
          sku: p.sku,
          name: p.name,
          description: p.description,
          category: p.category,
          priceDetal: p.priceDetal,
          priceMayor: p.priceMayor,
          stock: p.stock,
          featured: p.featured,
          syncedAt: new Date(),
        });
      }

      const shop = await client`SELECT id FROM settings WHERE key = 'shop' LIMIT 1`;
      if (shop.length === 0) {
        await db.insert(schema.settings).values({
          key: 'shop',
          value: {
            brandName: 'JH Hogar',
            tagline: 'Artículos y electrodomésticos para el hogar',
            whatsappCatalogMessage: 'Hola, quiero cotizar productos de JH Hogar',
            debtReminderDays: 7,
            minMayorQtyDefault: 6,
          },
        });
      }
      console.log('✅ Seed demo OK');
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}
