# Logo GO3 / Go Plus / Tiger Plus — `LOGO-OBJECTS`

Tasarım kaynağı: `docs/logo.agent.md` §1.2, §4. **COM sınıfı** sağlayıcı: GO3 için REST yolu yoktur,
tek yol Logo Objects (`UnityApplication`, `Login(kullanıcı, şifre, firmaNo, dönemNo)`) ve COM yalnızca
Logo'nun kurulu olduğu Windows makinesinde çalışır → **Agent zorunlu.**

| | |
|---|---|
| Hazırlık | `MOCK_READY` — Faz B COM duman testi (bit genişliği, STA, oturum sınırı) ölçülmeden öteye geçmez (§9.1) |
| Ağ / COM | Sıfır. `TEST`/`PRODUCTION` → `IntegrationNotVerifiedError` |
| Doküman | `DOCUMENTATION_REQUIRED` — resmî açık geliştirici dokümanı yok; nesne/metot adları ikincil kaynaktan |
| Oturum anahtarı | `(firmaNo, dönemNo)` — Login çağrısı ikisini de kilitler (§5.3) |

Mock ve unverified istemciler `../logo-rest` ile paylaşılır; iki sağlayıcı arasındaki gerçek fark
kimlik şeması ve taşıma katmanıdır (REST vs COM köprüsü), ikisi de Agent gelene kadar yazılmaz.
