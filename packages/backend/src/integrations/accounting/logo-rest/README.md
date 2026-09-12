# Logo Tiger REST Servis — `LOGO-REST`

Tasarım kaynağı: `docs/logo.agent.md`. Bu klasör o dokümanın **REST sınıfı** connector'ıdır
(Tiger 3 / Tiger Wings / Enterprise). **GO3, Start, Tiger Plus ve Go Plus Logo REST tarafından
desteklenmez** (§1.1, doğrulandı) — onlar için tek yol COM (`logo-objects`) ve Agent'tır; bu turda yazılmadı.

## Durum

| | |
|---|---|
| Hazırlık | `MOCK_READY` |
| Ağ | Sıfır. `TEST`/`PRODUCTION` → `IntegrationNotVerifiedError` |
| Doğrulanmış tek uç | `POST {host}:{port}/api/v1/token` — Basic `clientId:clientSecret`, gövde `grant_type=password, username, password, firmno` (`logo-rest.session.ts`) |
| Doğrulanmamış | token ömrü, veri uç yolları, alan adları, hata sözlüğü, `periodNo`'nun iletimi, `externalRef`'in yazılacağı alan |
| Ticari ön koşul | ClientId/Secret yalnızca **Logo Çözüm Ortağı**'na verilir; bu olmadan test edilemez |

## Çatıdan alınan kurallar

- **Token anahtarı = firmno** (§5.3). `LogoRestSessionManager` firma başına ayrı token tutar; iki firma asla aynı token'ı paylaşmaz (spec'te kanıtlı).
- `companyId` credential alanı = Logo `firmno`; `AccountingService.create` bununla varsayılan `AccountingCompany`'yi açar.
- Logo'ya özgü adlar (`LOGICALREF`, `FICHENO`…) çekirdeğe ve mock'a girmez (§5.6).
- Cari eşleştirme anahtarı VKN/TCKN; isim asla anahtar değildir (§7.4).
- `cancelInvoice` `DOCUMENTATION_REQUIRED`: `externalRef` alanı doğrulanmadan iptal ve otomatik yazma açılmaz (§7.3).
- `stockSync: NOT_SUPPORTED` — stok ERP→KroptOS akışı bu çatının değil, mevcut `warehouse-settings/logo-stock` yolunun işi.

## Bilinçli kapsam dışı (bu turda)

- KroptOS Agent (.NET Windows Service), tünel, enrollment, `AgentTransport` — §4. Bugün müşteri ağına
  doğrudan ulaşmak gerekir; **32001 portunu internete açmak bir yöntem değildir**. Agent gelene kadar
  `PRODUCTION` kapalı kalır.
- Credential'ın `AGENT_LOCAL` saklanması (§4.4.3). Agent yokken mevcut `encryption.util` yolu kullanılır.
- `logo-objects` (GO3, COM) ve `netsis`.

## Sıradaki adım

Çözüm Ortağı ClientId/Secret + Tiger test ortamı → `buildLogoRestTokenRequest` ile ilk gerçek token
çağrısı → `expires_in` ve gövde biçimi (JSON vs form) doğrulanır → `lastVerifiedAt` yazılır.
