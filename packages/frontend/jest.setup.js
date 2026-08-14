require('@testing-library/jest-dom');

// next-intl's `useTranslations` returns a function that resolves a message key.
// Components here are written against keys, so echoing the key back keeps
// assertions about *which* message was chosen readable without loading the
// real message catalogue into every test.
jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key, values) => (values ? `${key} ${JSON.stringify(values)}` : key);
    // Components ask `t.has(key)` before falling back to a humanised label. The
    // default answers "every key exists", which keeps assertions about *which*
    // key was chosen straightforward; a test exercising the fallback overrides
    // this mock locally.
    t.has = () => true;
    return t;
  },
  useLocale: () => 'tr',
}));
