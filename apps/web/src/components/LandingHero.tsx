'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, MessageCircle, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type CatalogResponse, type Product } from '@/lib/api';
import { ProductCard } from './ProductCard';

export function LandingHero() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<CatalogResponse['companies']>([]);
  const [wa, setWa] = useState<string | null>(null);

  useEffect(() => {
    api<CatalogResponse>('/public/catalog')
      .then((data) => {
        setCompanies(data.companies);
        setFeatured(data.products.filter((p) => p.featured).slice(0, 6));
      })
      .catch(() => {});
    api<{ url: string | null }>('/public/whatsapp-link')
      .then((d) => setWa(d.url))
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="relative flex min-h-[88vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(201,149,42,0.18), transparent 70%)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: -28, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <p className="mb-4 font-raj text-xs font-semibold uppercase tracking-[0.45em] text-gold-light/80">
            Jhosua Comercial
          </p>
          <h1 className="font-display text-[clamp(4.5rem,16vw,9rem)] leading-[0.85] tracking-wide text-gradient-gold">
            JH HOGAR
          </h1>
          <p className="mx-auto mt-5 max-w-md font-raj text-sm font-medium uppercase tracking-[0.28em] text-chrome-muted md:text-base">
            Artículos y electrodomésticos para el hogar
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="relative mt-12 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/tienda"
            className="inline-flex items-center gap-2 bg-gold px-7 py-3.5 font-raj text-sm font-bold uppercase tracking-[0.2em] text-ink transition hover:bg-gold-light"
          >
            <Store className="h-4 w-4" />
            Ver catálogo
            <ArrowRight className="h-4 w-4" />
          </Link>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-gold/35 px-7 py-3.5 font-raj text-sm font-bold uppercase tracking-[0.2em] text-gold-light transition hover:bg-gold/10"
            >
              <MessageCircle className="h-4 w-4" />
              Pedir por WhatsApp
            </a>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 font-raj text-[10px] uppercase tracking-[0.4em] text-chrome-muted/60"
        >
          Mayor · Detal · Multi-empresa
        </motion.div>
      </section>

      {companies.length > 0 && (
        <section className="border-y border-gold/10 bg-ink-2/50 px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-display text-4xl tracking-wide text-chrome md:text-5xl">
              Nuestras <span className="text-gradient-gold">empresas</span>
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-sm text-chrome-muted">
              Catálogos sincronizados desde Odoo — elige la línea y cotiza al instante.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {companies.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Link
                    href={`/tienda?empresa=${c.slug}`}
                    className="block border border-gold/15 bg-ink-3/60 px-6 py-8 text-center transition hover:border-gold/40 hover:shadow-gold"
                  >
                    <p className="font-display text-3xl text-gradient-gold">{c.name}</p>
                    <p className="mt-2 font-raj text-[10px] uppercase tracking-[0.3em] text-chrome-muted">
                      Ver productos
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl tracking-wide text-chrome md:text-5xl">
                  Destacados
                </h2>
                <p className="mt-2 text-sm text-chrome-muted">Selección lista para cotizar</p>
              </div>
              <Link
                href="/tienda"
                className="font-raj text-xs font-bold uppercase tracking-widest text-gold-light hover:underline"
              >
                Ver todo →
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} priceMode="detal" />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
