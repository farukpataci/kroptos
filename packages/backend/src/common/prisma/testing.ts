import { runAsSystem } from './tenant-context';

/**
 * Canlı testler için (integration-spec / e2e): fixture kurma-yıkma ve doğrudan satır
 * sayma sorguları kiracı bağlamı dışında koşar; RLS altında bunlar ya boş döner ya
 * WITH CHECK'e takılır. Bu sarmalayıcı her model işlemini AÇIK sistem bağlamında
 * ("integration-spec:fixture") çalıştırır. Uygulama koduna değil, yalnız test
 * dosyalarına aittir — servis çağrıları runWithTenant(...) ile kiracı olarak yapılır.
 */
export function asSystemClient<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof key !== 'string' || key.startsWith('$') || key.startsWith('_') || !value || typeof value !== 'object') {
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return new Proxy(value, {
        get(model, op) {
          const fn = Reflect.get(model, op);
          return typeof fn === 'function' ? (...args: unknown[]) => runAsSystem('integration-spec:fixture', () => fn.apply(model, args)) : fn;
        },
      });
    },
  });
}
