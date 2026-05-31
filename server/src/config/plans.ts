export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    storageGB: 15,
    prices: { TRY: 0, USD: 0, EUR: 0 },
  },
  {
    id: '100gb',
    name: '100 GB',
    storageGB: 100,
    prices: { TRY: 29, USD: 0.99, EUR: 0.99 },
  },
  {
    id: '200gb',
    name: '200 GB',
    storageGB: 200,
    prices: { TRY: 49, USD: 1.49, EUR: 1.49 },
  },
  {
    id: '500gb',
    name: '500 GB',
    storageGB: 500,
    prices: { TRY: 99, USD: 2.99, EUR: 2.99 },
  },
  {
    id: '1tb',
    name: '1 TB',
    storageGB: 1024,
    prices: { TRY: 149, USD: 4.49, EUR: 4.49 },
    originalPrices: { TRY: 199, USD: 5.99, EUR: 5.99 },
    badge: 'Most Popular ⭐',
  },
  {
    id: '2tb',
    name: '2 TB',
    storageGB: 2048,
    prices: { TRY: 199, USD: 5.99, EUR: 5.99 },
    originalPrices: { TRY: 299, USD: 8.99, EUR: 8.99 },
    badge: 'Best Value 🔥',
  },
] as const;

export type Plan = (typeof PLANS)[number];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
};

export const PAYMENT_INFO = {
  TRY: {
    label: 'İş Bankası (TRY)',
    iban: process.env.PAYMENT_IBAN_TRY ?? '',
    active: true,
  },
  USD: {
    label: 'İş Bankası (USD)',
    iban: process.env.PAYMENT_IBAN_USD ?? '',
    active: true,
  },
  EUR: {
    label: 'İş Bankası (EUR)',
    iban: process.env.PAYMENT_IBAN_EUR ?? '',
    active: true,
  },
  HUF: {
    label: 'HUF',
    iban: '',
    active: false,
    comingSoon: true,
  },
} as const;

export type Currency = keyof typeof PAYMENT_INFO;
