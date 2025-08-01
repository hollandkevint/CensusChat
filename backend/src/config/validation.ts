import Joi from 'joi';

// Environment variable validation schema
const envSchema = Joi.object({
  // Node environment
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  
  // Server configuration
  PORT: Joi.number().port().default(3001),
  
  // CORS configuration
  CORS_ORIGIN: Joi.string().required(),
  
  // JWT configuration
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(64).required(),
    })
    .messages({
      'string.min': 'JWT_SECRET must be at least {#limit} characters long',
      'any.required': 'JWT_SECRET is required for security',
    }),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  
  // PostgreSQL configuration
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().port().default(5432),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string()
    .required()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(16).required(),
    }),
  POSTGRES_SSL: Joi.boolean().default(false),
  
  // Redis configuration
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string()
    .allow('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(16).required(),
    }),
  
  // DuckDB configuration
  DUCKDB_PATH: Joi.string().default('./data/census.duckdb'),
  DUCKDB_MEMORY: Joi.boolean().default(false),
  
  // Census API configuration
  CENSUS_API_URL: Joi.string().uri().default('https://api.census.gov'),
  CENSUS_API_KEY: Joi.string().allow(''),
}).unknown();

export const validateEnv = () => {
  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
  });
  
  if (error) {
    console.error('❌ Environment validation failed:');
    error.details.forEach((detail) => {
      console.error(`  - ${detail.message}`);
    });
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Running in development mode with invalid configuration');
    }
  }
  
  return value;
};