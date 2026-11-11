import pino from 'pino';
import { config } from './config';

/** Logs estruturados em JSON (prontos para agregação/monitorização). */
export const logger = pino({ level: config.logLevel, base: { app: 'bairro-server' } });
