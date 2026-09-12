# Logo Netsis — `NETSIS`

Tasarım kaynağı: `docs/logo.agent.md` §1.3. NetOpenX (`NetOpenX50.dll`, COM) ve/veya NOX REST;
ikisi de müşteri LAN'ında çalışır → **Agent zorunlu**, internete açılmaz.

| | |
|---|---|
| Hazırlık | `MOCK_READY` |
| Ağ / COM | Sıfır. `TEST`/`PRODUCTION` → `IntegrationNotVerifiedError` |
| Doküman | `DOCUMENTATION_REQUIRED` — min. sürüm, NOX REST sözleşmesi, login şeması (şube/firma/kullanıcı) doğrulanmadı |
| Oturum anahtarı | `(firma, şube)` — §5.3 |
| Ticari ön koşul | **NetOpenX Runtime lisansı**, istemci sayısına göre; Çözüm Ortağı üzerinden |

Doküman Netsis'i REST sınıfının Faz D referansı olarak önerir (aynı ERP, iki taşıma — çatının
en ucuz laboratuvarı). Mock ve unverified istemciler `../logo-rest` ile paylaşılır.
