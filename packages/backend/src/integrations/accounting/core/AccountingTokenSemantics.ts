export interface RefreshSemantics {
  /**
   * Yenilemede yeni refresh token dönüyor mu (rotasyon var mı).
   */
  rotatesOnRefresh: boolean;

  /**
   * Yenileme cevabı alınamadığında (ağ kopukluğu/timeout) eski refresh token
   * ne kadar süre daha kullanılabilir (0 = anında ölür / tolerans yok).
   * Xero: 30 dakika (1_800_000 ms); Sage: 0 ms.
   */
  previousTokenGraceMs: number;

  /**
   * Bu kadar gün boyunca yenilenmezse refresh token ölür (hareketsizlik süresi).
   * null = süresiz. Xero: 60 gün; Sage: 31 gün.
   */
  inactivityLimitDays: number | null;
}
