/**
 * Единый список ключей SystemSetting ↔ process.env для импорта из окружения процесса.
 * Используется в POST import-env и в UI подсказки «что будет импортировано».
 */
export type SettingsImportEnvEntry = {
  key: string;
  env: string;
  sensitive?: boolean;
};

/** Порядок как в админском импорте (общие → платежи → почта → интеграции). */
export const SETTINGS_IMPORT_ENV_MAP: SettingsImportEnvEntry[] = [
  { key: 'site_url', env: 'NEXT_PUBLIC_URL' },
  { key: 'portal_title', env: 'PORTAL_TITLE' },
  { key: 'resend_from', env: 'RESEND_FROM' },
  { key: 'resend_notify_email', env: 'RESEND_NOTIFY_EMAIL' },
  { key: 'contact_phone', env: 'CONTACT_PHONE' },
  { key: 'company_legal_address', env: 'COMPANY_LEGAL_ADDRESS' },
  { key: 'scorm_max_size_mb', env: 'SCORM_MAX_SIZE_MB' },
  { key: 'paykeeper_server', env: 'PAYKEEPER_SERVER' },
  { key: 'paykeeper_login', env: 'PAYKEEPER_LOGIN' },
  { key: 'paykeeper_password', env: 'PAYKEEPER_PASSWORD', sensitive: true },
  { key: 'paykeeper_secret', env: 'PAYKEEPER_SECRET', sensitive: true },
  { key: 'paykeeper_use_test', env: 'PAYKEEPER_USE_TEST' },
  { key: 'paykeeper_test_server', env: 'PAYKEEPER_TEST_SERVER' },
  { key: 'paykeeper_test_login', env: 'PAYKEEPER_TEST_LOGIN' },
  { key: 'paykeeper_test_password', env: 'PAYKEEPER_TEST_PASSWORD', sensitive: true },
  { key: 'paykeeper_test_secret', env: 'PAYKEEPER_TEST_SECRET', sensitive: true },
  { key: 'email_transport', env: 'EMAIL_TRANSPORT' },
  { key: 'resend_api_key', env: 'RESEND_API_KEY', sensitive: true },
  { key: 'smtp_host', env: 'SMTP_HOST' },
  { key: 'smtp_port', env: 'SMTP_PORT' },
  { key: 'smtp_user', env: 'SMTP_USER' },
  { key: 'smtp_password', env: 'SMTP_PASSWORD', sensitive: true },
  { key: 'smtp_secure', env: 'SMTP_SECURE' },
  { key: 'telegram_admin_chat_ids', env: 'TELEGRAM_ADMIN_CHAT_IDS' },
  { key: 'telegram_bot_token', env: 'TELEGRAM_BOT_TOKEN', sensitive: true },
  { key: 'telegram_webhook_secret', env: 'TELEGRAM_WEBHOOK_SECRET', sensitive: true },
  { key: 'cron_secret', env: 'CRON_SECRET', sensitive: true },
  { key: 'nextauth_url', env: 'NEXTAUTH_URL' },
  { key: 'openai_api_key', env: 'OPENAI_API_KEY', sensitive: true },
  { key: 'deepseek_api_key', env: 'DEEPSEEK_API_KEY', sensitive: true },
];
