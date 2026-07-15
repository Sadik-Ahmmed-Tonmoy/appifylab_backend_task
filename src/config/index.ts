import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const corsOrigins = (() => {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) return ['http://localhost:3000', 'http://localhost:3001', 'http://72.61.147.37:3002'];
  return raw.split(',').map(o => o.trim()).filter(Boolean);
})();

export default {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || '5016',
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS || '12',
  base_url_server: process.env.BASE_URL_SERVER || 'http://localhost:5016',
  base_url_client: process.env.BASE_URL_CLIENT || 'http://localhost:3000',
  cors_origins: corsOrigins,
  email: {
    nodemailer_email: process.env.NODE_MAILER_EMAIL,
    nodemailer_pass: process.env.NODE_MAILER_PASSWORD,
    brevo_api_key: process.env.BREVO_API_KEY,
    sender_name: process.env.EMAIL_SENDER_NAME,
    sender_email: process.env.EMAIL,
  },
  jwt: {
    access_secret: assertEnv('JWT_ACCESS_SECRET'),
    access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN ,
    refresh_secret: assertEnv('JWT_REFRESH_SECRET'),
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN , 
    refresh_expires_in_For_keep_Login: process.env.JWT_REFRESH_EXPIRES_IN_For_keep_Login , 
  },
  do_space: {
    endpoints: process.env.DO_SPACE_ENDPOINT,
    access_key: process.env.DO_SPACE_ACCESS_KEY,
    secret_key: process.env.DO_SPACE_SECRET_KEY,
    bucket: process.env.DO_SPACE_BUCKET,
    region: process.env.DO_SPACE_REGION || 'us-east-1',
  },
};
