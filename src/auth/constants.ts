import { JwtSignOptions } from '@nestjs/jwt';

type ExpiresIn = JwtSignOptions['expiresIn'];

export const jwtConstants = {
  accessSecret: process.env.ACCESS_TOKEN_SECRET ?? 'defaultAccessSecret',
  refreshSecret: process.env.REFRESH_TOKEN_SECRET ?? 'defaultRefreshSecret',

  accessExpiration: (process.env.ACCESS_TOKEN_EXPIRATION ?? '15m') as ExpiresIn,

  refreshExpiration: (process.env.REFRESH_TOKEN_EXPIRATION ??
    '7d') as ExpiresIn,
};
