import { redirect } from 'next/navigation';

/**
 * The marketplace integrations screen was folded into the integrations hub;
 * this path survived the move rendering nothing at all. Keeping it as a
 * redirect means an old bookmark lands on the page that replaced it instead of
 * on a blank screen or a 404.
 */
export default function MarketplacePage({ params }: { params: { tenantPublicId: string } }) {
  redirect(`/t/${params.tenantPublicId}/integrations`);
}
