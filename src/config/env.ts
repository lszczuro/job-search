export type AppConfig = {
  port: number;
  refreshCron: string;
  timezone: string;
  knownStack: string[];
  profileKeywords: string[];
  allowedCities: string[];
  databasePath: string;
  importPhrase: string;
  nfty: {
    endpoint: string | null;
    login: string | null;
    password: string | null;
    clickUrl: string | null;
  };
};

export function parseEnv(env: Record<string, string | undefined>): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    refreshCron: env.REFRESH_CRON ?? "*/30 * * * *",
    timezone: env.APP_TIMEZONE ?? "Europe/Warsaw",
    knownStack: (env.KNOWN_STACK ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    profileKeywords: (env.PROFILE_KEYWORDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    allowedCities: (env.ALLOWED_CITIES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    databasePath: env.DATABASE_PATH ?? "./data/job-search.db",
    importPhrase: env.IMPORT_PHRASE ?? env.PROFILE_KEYWORDS ?? "ai llm",
    nfty: {
      endpoint: env.NFTY_ENDPOINT ?? null,
      login: env.NFTY_LOGIN ?? null,
      password: env.NFTY_PASSWORD ?? null,
      clickUrl: env.NFTY_CLICK_URL ?? null
    }
  };
}
