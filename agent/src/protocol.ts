/**
 * Protokol TEK KAYNAKTAN gelir: backend çekirdeğindeki AgentProtocol.ts.
 * İki dilde/iki yerde elle yazılan zarf tanımı ilk sürüm uyuşmazlığında sessizce bozulur.
 */
export * from '../../packages/backend/src/integrations/accounting/core/agent/AgentProtocol';
export { readOnlySqlViolation } from '../../packages/backend/src/integrations/accounting/core/catalog/readonly-sql';
export type { CompanyKey } from '../../packages/backend/src/integrations/accounting/core/AccountingTypes';
