import { registerAs } from '@nestjs/config';

export interface EwayConfig {
  apiKey: string;
  password: string;
  publicApiKey: string;
  mode: 'sandbox' | 'production';
  mockMode: boolean;
  baseUrl: string;
}

export default registerAs(
  'eway',
  (): EwayConfig => {
    const mode = (process.env.EWAY_PAYMENT_MODE || 'sandbox').toLowerCase() as
      | 'sandbox'
      | 'production';

    const baseUrl =
      mode === 'production'
        ? process.env.EWAY_PRODUCTION_URL || 'https://api.ewaypayments.com'
        : process.env.EWAY_SANDBOX_URL ||
          'https://api.sandbox.ewaypayments.com';

    // Auto-enable mock mode if credentials are incomplete
    const apiKey = process.env.EWAY_API_KEY || '';
    const password = process.env.EWAY_PASSWORD || '';
    const hasCredentials = Boolean(apiKey && password);
    const mockMode =
      process.env.EWAY_SANDBOX_MOCK === 'true' || !hasCredentials;

    return {
      apiKey,
      password,
      publicApiKey: process.env.EWAY_PUBLIC_API_KEY || '',
      mode,
      mockMode,
      baseUrl,
    };
  },
);
