import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import bcrypt from 'bcryptjs';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

async function main() {
  const client = postgres(url);
  const db = drizzle(client, { schema });

  const email = process.env.ADMIN_EMAIL || 'admin@jhhogar.com';
  const password = process.env.ADMIN_PASSWORD || 'JhHogarAdmin2026!';
  const hash = await bcrypt.hash(password, 10);

  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email),
  });

  if (!existing) {
    await db.insert(schema.users).values({
      email,
      passwordHash: hash,
      name: 'Admin JH Hogar',
      role: 'owner',
      phone: process.env.ADMIN_NOTIFY_PHONES?.split(',')[0]?.trim() || null,
    });
    console.log(`Admin creado: ${email}`);
  } else {
    console.log(`Admin ya existe: ${email}`);
  }

  const demoCompanies = [
    { odooId: 1, name: 'JH Hogar', slug: 'jh-hogar', sortOrder: 1 },
    { odooId: 2, name: 'Electro JH', slug: 'electro-jh', sortOrder: 2 },
    { odooId: 3, name: 'Muebles JH', slug: 'muebles-jh', sortOrder: 3 },
  ];

  for (const c of demoCompanies) {
    const found = await db.query.companies.findFirst({
      where: (co, { eq }) => eq(co.odooId, c.odooId),
    });
    if (!found) {
      await db.insert(schema.companies).values(c);
    }
  }

  const companies = await db.query.companies.findMany();
  const productCount = await db.query.products.findMany({ limit: 1 });

  if (productCount.length === 0) {
    const demoProducts = [
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

    for (const p of demoProducts) {
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
    console.log(`Productos demo: ${demoProducts.length}`);
  }

  const shopSetting = await db.query.settings.findFirst({
    where: (s, { eq }) => eq(s.key, 'shop'),
  });
  if (!shopSetting) {
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

  console.log('Seed OK');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
