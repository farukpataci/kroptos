export interface RefreshSemantics {
  /**
   * Yenilemede yeni refresh token dönebilir mi (rotasyon olasılığı/davranışı var mı).
   * Not: Sıklık sağlayıcıya göre değişir (Sage/Xero her yenilemede, QBO ~24 saatte bir).
   */
  rotatesOnRefresh: boolean;

  /**
   * Yenileme cevabı alınamadığında (ağ kopukluğu/timeout) eski refresh token
   * ne kadar süre daha kullanılabilir (0 = anında ölür / tolerans yok).
   * Xero: 30 dakika (1_800_000 ms); Sage: 0 ms.
   * Not: staleTokenUseIsDestructive: true olduğunda bu süre ezilir ve 0 kabul edilir.
   */
  previousTokenGraceMs: number;

  /**
   * Bu kadar gün boyunca yenilenmezse refresh token ölür (hareketsizlik süresi).
   * null = süresiz. Xero: 60 gün; Sage: 31 gün; QBO: 100 gün.
   */
  inactivityLimitDays: number | null;

  /**
   * Eski veya şüpheli bir refresh token ile deneme yapılmasının tüm yetkilendirme
   * zincirini kalıcı olarak iptal edip etmeyeceği (yıkıcı ceza).
   * Sage: false, Xero: false, QuickBooks Online: true.
   * true olduğunda previousTokenGraceMs ne olursa olsun ezilir, asla eski token'la
   * tekrar denenmez; belirsizlikte kapalı tarafa düşülerek doğrudan reauthorization_required verilir.
   */
  staleTokenUseIsDestructive: boolean;
}

