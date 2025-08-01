import { CorsOptions } from 'cors';
import { validateEnv } from './validation';

// Validate environment variables on startup
validateEnv();

interface Config {
  environment: string;
  port: number;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  cors: CorsOptions;
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  database: {
    postgres: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl: boolean;
    };
    redis: {
      host: string;
      port: number;
      password?: string;
    };
    duckdb: {
      path: string;
      memory: boolean;
    };
  };
  api: {
    census: {
      baseUrl: string;
      apiKey?: string;
    };
  };
}

// Helper function to ensure required environment variables
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config: Config = {
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  },
  
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  database: {
    postgres: {
      host: requireEnv('POSTGRES_HOST'),
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: requireEnv('POSTGRES_DB'),
      user: requireEnv('POSTGRES_USER'),
      password: requireEnv('POSTGRES_PASSWORD'),
      ssl: process.env.POSTGRES_SSL === 'true',
    },
    redis: {
      host: requireEnv('REDIS_HOST'),
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
    duckdb: {
      path: process.env.DUCKDB_PATH || './data/census.duckdb',
      memory: process.env.DUCKDB_MEMORY === 'true',
    },
  },
  
  api: {
    census: {
      baseUrl: process.env.CENSUS_API_URL || 'https://api.census.gov',
      apiKey: process.env.CENSUS_API_KEY,
    },
  },
};

// Log configuration status (without sensitive values)
console.log('✅ Configuration loaded successfully');
console.log(`   Environment: ${config.environment}`);
console.log(`   Port: ${config.port}`);
console.log(`   CORS Origins: ${Array.isArray(config.cors.origin) ? config.cors.origin.join(', ') : config.cors.origin}`);