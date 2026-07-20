# JH Hogar — Jhosuacom

Ecommerce **mayor + detal** conectado al Odoo multi-empresa de JhosuaComercial. Más simple que Catagce: un solo negocio, sin SaaS multi-tenant.

## Qué incluye (MVP)

| Área | Funciones |
|------|-----------|
| **Landing** | Hero JH Hogar (estilo oro/negro), empresas, destacados |
| **Tienda** | Catálogo por empresa, precios detal/mayor, carrito, checkout |
| **WhatsApp** | Aviso a admins de pedido nuevo + confirmación al cliente · link de catálogo |
| **Odoo** | Sync productos multi-empresa · crea cotización (`sale.order`) · deudas partner |
| **Admin** | Dashboard, pedidos, productos, clientes, deudas + notify, sync Odoo |

## Stack

- `apps/web` — Next.js 14 (tienda + admin)
- `apps/api` — NestJS (API + Odoo JSON-RPC + Evolution WhatsApp)
- `packages/db` — Drizzle + Postgres

## Inicio rápido

```bash
cp .env.example .env
# Arranca Postgres (puerto 5433)
docker compose up -d db

pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

- Tienda: http://localhost:3101  
- Admin: http://localhost:3101/admin  
- API: http://localhost:3100/api/health  

**Login demo:** `admin@jhhogar.com` / `JhHogarAdmin2026!`

## Odoo

En `.env`:

```
ODOO_URL=https://tu-odoo
ODOO_DB=...
ODOO_USERNAME=...
ODOO_API_KEY=...
ODOO_COMPANY_IDS=1,2,3
ODOO_MOCK=false
```

Con `ODOO_MOCK=true` (default sin API key) usa el catálogo seed local.

## WhatsApp (Evolution)

```
EVOLUTION_API_URL=...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=jhhogar
ADMIN_NOTIFY_PHONES=1809xxxxxxx
```

Sin Evolution, los mensajes se loguean en consola (mock).

## Flujo pedido

1. Cliente arma carrito (detal o mayor) → checkout  
2. API crea pedido + cliente local  
3. Crea cotización en Odoo  
4. WhatsApp a admins + confirmación al cliente  
5. Admin ve/cambia estado; cliente consulta `/pedido?n=JH26-xxxxx`

## Relación con Catagce

Misma familia (Renace): catálogo B2B + WA + Odoo. JH Hogar elimina multi-seller, planes, AI, inbox/broadcast y workers pesados; añade **writeback de cotizaciones**, **multi-company** y **estado de cuenta / deudas**.

## Deploy (Docker Swarm + Traefik / RenaceNet)

Dominios:
- Web: `https://jhosuacomercial.com`
- API: `https://api.jhosuacomercial.com`

### 1) DNS
Apunta `jhosuacomercial.com`, `www` y `api.jhosuacomercial.com` al VPS (A/AAAA).

### 2) Primera vez en el VPS
```bash
sudo mkdir -p /opt/jhosuacom
sudo git clone -b feat/jh-hogar-mvp https://github.com/ExpertosTI/jhosuacom.git /opt/jhosuacom
cd /opt/jhosuacom
chmod +x deploy.sh
./deploy.sh
```

### 3) Updates
```bash
cd /opt/jhosuacom
DEPLOY_BRANCH=feat/jh-hogar-mvp ./deploy.sh
```

### 4) Configurar Odoo / WhatsApp
```bash
nano /opt/jhosuacom/.env
# ODOO_MOCK=false + credenciales
# EVOLUTION_* + ADMIN_NOTIFY_PHONES
docker service update --force jhosuacom_api
```

### 5) Estado
```bash
docker stack services jhosuacom
docker service logs -f jhosuacom_api
curl -s https://api.jhosuacomercial.com/api/health
```
