'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Product } from '@/lib/api';
import { money } from '@/lib/api';
import { useCart } from '@/lib/cart';

function offerMeta(p: Product) {
  const detal = Number(p.priceDetal);
  const mayor = Number(p.priceMayor);
  const hasCut = Number.isFinite(detal) && Number.isFinite(mayor) && mayor > 0 && mayor < detal;
  const pct = hasCut ? Math.round(((detal - mayor) / detal) * 100) : 0;
  return { detal, mayor: hasCut ? mayor : detal, pct, hasCut };
}

export function OffersSlider({ products }: { products: Product[] }) {
  const { add } = useCart();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = products.length;

  const go = useCallback(
    (dir: number) => {
      if (!total) return;
      setIndex((i) => (i + dir + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (paused || total < 2) return;
    const t = setInterval(() => go(1), 5200);
    return () => clearInterval(t);
  }, [paused, total, go]);

  if (!total) return null;

  const current = products[index];
  const meta = offerMeta(current);

  return (
    <section
      className="relative overflow-hidden border-y border-gold/10 bg-ink-2/40"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 85% 50%, rgba(201,149,42,0.12), transparent 55%)',
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-6 py-16 md:grid-cols-2 md:gap-12 md:py-20">
        <div>
          <p className="font-raj text-[11px] font-semibold uppercase tracking-[0.4em] text-gold-light">
            Ofertas de temporada
          </p>
          <h2 className="mt-3 font-display text-5xl tracking-wide text-chrome md:text-6xl">
            Selección <span className="text-gradient-gold">ejecutiva</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-chrome-muted">
            Precios especiales mayor y detal. Cotiza en segundos desde el catálogo vivo.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => go(-1)}
              className="border border-gold/30 p-2.5 text-gold-light transition hover:bg-gold/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => go(1)}
              className="border border-gold/30 p-2.5 text-gold-light transition hover:bg-gold/10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="ml-2 flex gap-1.5">
              {products.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Oferta ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1 transition-all ${
                    i === index ? 'w-8 bg-gold' : 'w-3 bg-gold/25 hover:bg-gold/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.article
            key={current.id}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="relative aspect-[5/4] overflow-hidden bg-ink-4">
              {current.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.imageUrl}
                  alt={current.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="font-display text-8xl text-gold/15">
                    {current.name.slice(0, 2)}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />

              {meta.hasCut && (
                <span className="absolute left-4 top-4 font-raj text-xs font-bold uppercase tracking-[0.2em] text-gold-light">
                  −{meta.pct}%
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                {current.company && (
                  <p className="font-raj text-[10px] uppercase tracking-[0.3em] text-chrome-muted">
                    {current.company.name}
                  </p>
                )}
                <h3 className="mt-1 font-raj text-2xl font-semibold text-chrome md:text-3xl">
                  {current.name}
                </h3>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-4xl text-gradient-gold">
                      {money(meta.mayor)}
                    </span>
                    {meta.hasCut && (
                      <span className="font-raj text-sm text-chrome-muted line-through">
                        {money(meta.detal)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => add(current, 1)}
                    className="inline-flex items-center gap-2 bg-gold px-5 py-2.5 font-raj text-xs font-bold uppercase tracking-[0.18em] text-ink transition hover:bg-gold-light"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>
    </section>
  );
}
