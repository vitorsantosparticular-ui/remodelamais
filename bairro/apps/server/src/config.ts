/** Configuração por variáveis de ambiente (ver .env.example na raiz de bairro/). */
const env = process.env;
export const config = {
  port: Number(env.PORT ?? 3001),
  host: env.HOST ?? '0.0.0.0',
  redisUrl: env.REDIS_URL || null,
  webOrigin: (env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
  cookieSecure: env.COOKIE_SECURE === 'true',
  logLevel: env.LOG_LEVEL ?? 'info',
  sessionDays: 30,
  /** Idade mínima sem consentimento parental em Portugal (RGPD art. 8.º; Lei 58/2019). */
  minAge: 13,
  /** Até esta idade a conta é tratada como de menor (privacidade reforçada por omissão). */
  adultAge: 18,
  maxRoomsPerUser: 10,
};
