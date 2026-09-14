import * as os from 'os';
import * as path from 'path';
import { loadConfig, DEFAULT_DATA_DIR } from './config';
import { Agent, AGENT_VERSION } from './agent';
import { DpapiProtector, Vault } from './vault';
import { enroll } from './enrollment';

/**
 * Kullanım:
 *   node dist/agent/src/main.js enroll <KAYIT_KODU> [https://kroptos.example/api/agents/enroll]
 *   node dist/agent/src/main.js            # servis modu (pm2 / Windows servisi altında)
 *
 * Yapılandırma: %ProgramData%\KroptOS\Agent\agent.json (yoksa varsayılanlar).
 * Loglar HİÇBİR ZAMAN kimlik içermez; executor zarfı loglamaz.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const log = (l: string) => console.log(`${new Date().toISOString()} ${l}`);
  const [cmd, arg1, arg2] = process.argv.slice(2);

  if (cmd === 'enroll') {
    if (!arg1) throw new Error('kayıt kodu gerekli');
    const vault = new Vault(path.join(config.dataDir, 'vault.bin'), new DpapiProtector());
    vault.load();
    const enrollUrl = arg2 ?? config.serverUrl.replace(/^ws/, 'http').replace(/\/tunnel$/, '/enroll');
    const r = await enroll(vault, {
      enrollUrl,
      code: arg1,
      name: config.agentName,
      agentVersion: AGENT_VERSION,
      osVersion: `${os.platform()} ${os.release()}`,
    });
    log(`[enroll] kayıt tamam agentId=${r.agentId} (kasa: ${path.join(config.dataDir, 'vault.bin')})`);
    return;
  }

  const agent = new Agent(config, { protector: new DpapiProtector(), fetch: (u, i) => fetch(u, i as any) as any, log });
  log(`[agent] v${AGENT_VERSION} başlıyor — veri dizini ${config.dataDir || DEFAULT_DATA_DIR}, katalog ${agent.catalog.size} sorgu`);
  agent.start();
  const shutdown = () => {
    log('[agent] durduruluyor');
    agent.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(`${new Date().toISOString()} [agent] BAŞLATILAMADI: ${e?.message ?? e}`);
  process.exit(1);
});
