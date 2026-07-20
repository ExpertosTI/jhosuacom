import { NextRequest, NextResponse } from 'next/server';

function internalApiBase() {
  return (process.env.INTERNAL_API_URL || 'http://jhosuacom_api:3000').replace(/\/$/, '');
}

async function proxy(req: NextRequest, path: string[]) {
  const suffix = path.length ? path.join('/') : '';
  const url = `${internalApiBase()}/api/${suffix}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');

  let body: ArrayBuffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.arrayBuffer();
  }

  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
    });

    return new NextResponse(res.body, {
      status: res.status,
      headers: res.headers,
    });
  } catch (err) {
    return NextResponse.json(
      {
        message: 'API unreachable from web',
        target: url,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

type Ctx = { params: { path: string[] } };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
