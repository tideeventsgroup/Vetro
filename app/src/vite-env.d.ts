/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SKIP_AUTH: string;
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_COGNITO_CLIENT_ID: string;
  readonly VITE_BASE_DOMAIN: string;
  readonly VITE_DEV_TENANT_SLUG: string;
  readonly VITE_DEV_ROLE: string;
  readonly VITE_DEV_OFFICER_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
