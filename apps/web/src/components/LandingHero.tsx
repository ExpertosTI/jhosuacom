'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, type CatalogResponse, type Product } from '@/lib/api';
import { ProductCard } from './ProductCard';
import { OffersSlider } from './OffersSlider';

export function LandingHero() {
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<CatalogResponse['companies']>([]);
  const [wa, setWa] = useState<string | null>(null);

  useEffect(() => {
    api<CatalogResponse>('/public/catalog')
      .then((data) => {
        setCompanies(data.companies);
        setProducts(data.products);
      })
      .catch(() => {});
    api<{ url: string | null }>('/public/whatsapp-link')
      .then((d) => setWa(d.url))
      .catch(() => {});
  }, []);

  const offers = useMemo(() => {
    const withCut = products.filter((p) => Number(p.priceMayor) < Number(p.priceDetal));
    const featured = products.filter((p) => p.featured);
    const pool = withCut.length ? withCut : featured.length ? featured : products;
    return pool.slice(0, 8);
  }, [products]);

  const featured = useMemo(
    () => products.filter((p) => p.featured).slice(0, 6),
    [products],
  );

  return (
    <>
      {/* HERO — una composición: marca + línea + CTA */}
      <section className="relative flex min-h-[92vh] flex-col justify-end overflow-hidden px-6 pb-16 pt-28 md:px-10 md:pb-20">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4 }}
          style={{
            background: `
              radial-gradient(ellipse 90% 60% at 70% 20%, rgba(201,149,42,0.16), transparent 55%),
              radial-gradient(ellipse 50% 40% at 10% 80%, rgba(212,220,232,0.04), transparent 50%),
              linear-gradient(180deg, #080808 0%, #0c0c0c 40%, #111 100%)
            `,
          }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-24 h-[420px] w-[420px] rounded-full opacity-[0.07]"
          animate={{ rotate: 360 }}
          transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
          style={{
            background:
              'conic-gradient(from 0deg, transparent, #C9952A, transparent, #F5C842, transparent)',
          }}
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="font-raj text-[11px] font-semibold uppercase tracking-[0.5em] text-gold-light/90">
              Jhosua Comercial
            </p>
            <h1 className="mt-4 font-display text-[clamp(4.2rem,14vw,8.5rem)] leading-[0.82] tracking-wide text-gradient-gold">
              JH HOGAR
            </h1>
            <p className="mt-5 max-w-lg font-raj text-sm font-medium uppercase tracking-[0.28em] text-chrome-muted md:text-base">
              Artículos y electrodomésticos para el hogar
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-chrome-muted/90">
              Catálogo mayor y detal. Cotiza, confirma por WhatsApp y sigue tu pedido en un solo
              flujo.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.7 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/tienda"
              className="inline-flex items-center gap-2 bg-gold px-8 py-3.5 font-raj text-sm font-bold uppercase tracking-[0.22em] text-ink transition hover:bg-gold-light"
            >
              Explorar catálogo
              <ArrowRight className="h-4 w-4" />
            </Link>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-gold/30 px-7 py-3.5 font-raj text-sm font-bold uppercase tracking-[0.22em] text-gold-light transition hover:border-gold/55 hover:bg-gold/5"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            )}
          </motion.div>
        </div>
      </section>

      {/* OFERTAS — slider ejecutivo */}
      {offers.length > 0 && <OffersSlider products={offers} />}

      {/* EMPRESAS — una sección, un propósito */}
      {companies.length > 0 && (
        <section className="px-6 py-20 md:px-10">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="max-w-xl"
            >
              <p className="font-raj text-[11px] font-semibold uppercase tracking-[0.4em] text-gold-light">
                Multi-empresa
              </p>
              <h2 className="mt-3 font-display text-5xl tracking-wide text-chrome md:text-6xl">
                Líneas <span className="text-gradient-gold">JH</span>
              </h2>
              <p className="mt-3 text-sm text-chrome-muted">
                Cada empresa con su catálogo. Elige la línea y cotiza al instante.
              </p>
            </motion.div>

            <div className="mt-12 divide-y divide-gold/10 border-y border-gold/10">
              {companies.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                >
                  <Link
                    href={`/tienda?empresa=${c.slug}`}
                    className="group flex items-center justify-between gap-4 py-6 transition hover:bg-gold/[0.03]"
                  >
                    <span className="font-display text-3xl tracking-wide text-chrome transition group-hover:text-gradient-gold md:text-4xl">
                      {c.name}
                    </span>
                    <span className="font-raj text-[10px] font-bold uppercase tracking-[0.3em] text-chrome-muted transition group-hover:text-gold-light">
                      Ver catálogo →
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DESTACADOS */}
      {featured.length > 0 && (
        <section className="border-t border-gold/10 bg-ink-2/30 px-6 py-20 md:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex items-end justify-between gap-4">
              <div>
                <p className="font-raj text-[11px] font-semibold uppercase tracking-[0.4em] text-gold-light">
                  Catálogo vivo
                </p>
                <h2 className="mt-2 font-display text-5xl tracking-wide text-chrome">
                  Destacados
                </h2>
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

      {/* CTA final */}
      <section className="px-6 py-24 text-center md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl"
        >
          <h2 className="font-display text-5xl tracking-wide text-gradient-gold md:text-6xl">
            Cotiza hoy
          </h2>
          <p className="mt-4 text-sm text-chrome-muted">
            Mayorista o detal — mismo catálogo, precios claros, respuesta por WhatsApp.
          </p>
          <Link
            href="/tienda"
            className="mt-8 inline-flex items-center gap-2 bg-gold px-8 py-3.5 font-raj text-sm font-bold uppercase tracking-[0.22em] text-ink transition hover:bg-gold-light"
          >
            Ir a la tienda
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>
    </>
  );
}
