import { inspectDataProvider, type DataProviderEnvironment, type SimulationDataProvider } from '../repositories/simulationRepositoryFactory'

/**
 * סביבת ריצה של היישום. ‏development היא ברירת המחדל המקומית; staging ו־production
 * מחייבות ספק נתונים אמיתי (Supabase) ואינן מורשות לרוץ מול אחסון demo מקומי.
 */
export type AppEnvironment = 'development' | 'staging' | 'production'

export interface RuntimeEnvironment extends DataProviderEnvironment {
  VITE_APP_ENV?: string
}

export interface RuntimeConfiguration {
  appEnvironment: AppEnvironment
  dataProvider: SimulationDataProvider
}

/** נזרקת בזמן boot כאשר התצורה אינה חוקית לסביבה שנבחרה. */
export class RuntimeConfigurationError extends Error {
  constructor(
    message: string,
    readonly appEnvironment: AppEnvironment,
    readonly dataProvider: SimulationDataProvider,
  ) {
    super(message)
    this.name = 'RuntimeConfigurationError'
  }
}

export function resolveAppEnvironment(raw?: string): AppEnvironment {
  const value = raw?.trim().toLowerCase()
  if (value === 'production') return 'production'
  if (value === 'staging') return 'staging'
  return 'development'
}

/**
 * מאמתת שהשילוב של סביבת הריצה וספק הנתונים חוקי. staging ו־production חייבות
 * להשתמש ב־Supabase; ניסיון להעלות אותן מול ספק local נכשל מיד ובאופן גלוי,
 * כדי שאחסון demo מקומי לעולם לא ישרת נתוני פיילוט אמיתיים.
 */
export function assertRuntimeConfiguration(environment: RuntimeEnvironment): RuntimeConfiguration {
  const appEnvironment = resolveAppEnvironment(environment.VITE_APP_ENV)
  const dataProvider = inspectDataProvider(environment)

  if (appEnvironment !== 'development' && dataProvider === 'local') {
    throw new RuntimeConfigurationError(
      `סביבת ${appEnvironment} אינה יכולה לרוץ עם ספק הנתונים המקומי (local). ` +
        'יש להגדיר VITE_DATA_PROVIDER=supabase עבור staging ו־production כדי שנתוני הדגמה מקומיים לא ישרתו משתמשים אמיתיים.',
      appEnvironment,
      dataProvider,
    )
  }

  return { appEnvironment, dataProvider }
}
