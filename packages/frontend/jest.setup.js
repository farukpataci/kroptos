require('@testing-library/jest-dom');

// next-intl's `useTranslations` returns a function that resolves a message key.
// Components here are written against keys, so echoing the key back keeps
// assertions about *which* message was chosen readable without loading the
// real message catalogue into every test.
jest.mock('next-intl', () => ({
  useTranslations: () => (key, values) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
  useLocale: () => 'tr',
}));
