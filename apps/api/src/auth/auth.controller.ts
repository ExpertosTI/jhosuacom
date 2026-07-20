import { Body, Controller, Get, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { CurrentUser, Public } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private jwt: JwtService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) throw new UnauthorizedException('Credenciales requeridas');

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user || !user.active) throw new UnauthorizedException('Usuario o contraseña inválidos');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Usuario o contraseña inválidos');

    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  @Get('me')
  me(@CurrentUser() user: { sub: string; email: string; name: string; role: string }) {
    return { user };
  }
}
