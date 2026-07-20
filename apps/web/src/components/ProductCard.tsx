'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { PriceMode, Product } from '@/lib/api';
import { money, unitPrice } from '@/lib/api';
import { useCart } from '@/lib/cart';

function productImages(product: Product): string[] {
  const fromGallery = (product.imageUrls || []).filter(Boolean);
  if (fromGallery.length) return fromGallery;
  return product.imageUrl ? [product.imageUrl] : [];
}

export function ProductCard({
  product,
  priceMode,
}: {
  product: Product;
  priceMode: PriceMode;
}) {
  const { add } = useCart();
  const price = unitPrice(product, priceMode, priceMode === 'mayor' ? product.minMayorQty : 1);
  const images = productImages(product);
  const [idx, setIdx] = useState(0);
  const current = images[idx] || null;
  const multi = images.length > 1;

  function prev(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIdx((i) => (i - 1 + images.length) % images.length);
  }

  function next(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIdx((i) => (i + 1) % images.length);
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="group relative overflow-hidden border border-gold/15 bg-gradient-to-b from-ink-3/80 to-ink-2/90 transition hover:border-gold/35 hover:shadow-gold"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-4">
        <AnimatePresence mode="wait">
          {current ? (
            <motion.img
              key={current + idx}
              src={current}
              alt={product.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-display text-5xl text-gold/20">{product.name.slice(0, 2)}</span>
            </div>
          )}
        </AnimatePresence>

        {multi && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={prev}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 border border-gold/30 bg-ink/70 p-1.5 text-gold-light opacity-80 backdrop-blur transition hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Foto siguiente"
              onClick={next}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 border border-gold/30 bg-ink/70 p-1.5 text-gold-light opacity-80 backdrop-blur transition hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Foto ${i + 1}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIdx(i);
                  }}
                  className={`h-1.5 w-1.5 rounded-full transition ${
                    i === idx ? 'bg-gold' : 'bg-chrome/40'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {product.company && (
          <span className="absolute left-3 top-3 z-10 border border-gold/30 bg-ink/80 px-2 py-0.5 font-raj text-[10px] font-bold uppercase tracking-widest text-gold-light backdrop-blur">
            {product.company.name}
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div>
          {product.sku && (
            <p className="font-raj text-[10px] uppercase tracking-[0.2em] text-chrome-muted">
              {product.sku}
            </p>
          )}
          <h3 className="mt-1 font-raj text-lg font-semibold leading-tight text-chrome">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-sm text-chrome-muted">{product.description}</p>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-2xl text-gradient-gold">{money(price)}</p>
            <p className="font-raj text-[10px] uppercase tracking-widest text-chrome-muted">
              {priceMode === 'mayor' ? `Mayor (+${product.minMayorQty}u)` : 'Detalle'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => add(product, priceMode === 'mayor' ? product.minMayorQty : 1)}
            className="inline-flex items-center gap-1 border border-gold/40 bg-gold/10 px-3 py-2 font-raj text-xs font-bold uppercase tracking-wider text-gold-light transition hover:bg-gold hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </button>
        </div>
      </div>
    </motion.article>
  );
}
