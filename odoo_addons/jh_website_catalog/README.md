# JH Hogar — Catálogo Web (Odoo **18**)

Módulo alineado a las prácticas de tus addons Renace / DEVSS2026 (`18.0.*`, `<list>`, `invisible=`, multi-company).

## Instalación

```bash
# En el servidor Odoo 18
cp -r odoo_addons/jh_website_catalog /path/to/extra-addons/
# Asegura que extra-addons esté en addons_path, luego:
# Apps → Actualizar lista → Instalar "JH Hogar — Catálogo Web"
```

## Uso

1. **Ventas → JH Hogar Web → Catálogos web**
2. Crear catálogo → elegir **empresa**
3. Agregar productos en la pestaña
4. Dejar **Publicado en web** activo
5. En la tienda: Admin → Odoo → **Sincronizar productos**

## API

La sync de JH Hogar:

1. Busca `jh.website.catalog` con `published=True` y `active=True`
2. Une los `product_ids` (filtrados por empresa si aplica)
3. Si el módulo no está instalado → fallback `sale_ok`

Campo en producto: `jh_show_on_website` (store, calculado).
