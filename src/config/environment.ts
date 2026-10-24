import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z.url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      url.pathname.length > 1
    );
  }),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30000)
    .default(3000),
  DATABASE_QUERY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30000)
    .default(2000),
  WORKER_HEALTH_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(300000)
    .default(30000),
});

export type Environment = z.infer<typeof environmentSchema>;

export class AppConfig {
  constructor(readonly values: Readonly<Environment>) {}
}

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    // No incluir valores: DATABASE_URL puede contener credenciales.
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join('.'))),
    ];
    throw new Error(`Invalid configuration: ${fields.join(', ')}`);
  }
  return new AppConfig(Object.freeze(result.data));
}
