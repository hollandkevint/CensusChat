import { CorsOptions } from 'cors';

interface Config {
  environment: string;
  port: number;
  isDevelopment: boolean;
  isProduction: boolean;
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

export const config: Config = {
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  database: {
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'censuschat',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      ssl: process.env.POSTGRES_SSL === 'true',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
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