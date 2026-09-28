import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../../lib/auth';
import { getFilteredOrdersHistory } from '../../../../db/client';

export const GET: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const paymentMethod = url.searchParams.get('paymentMethod') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '300', 10);

    const orders = await getFilteredOrdersHistory({
      startDate,
      endDate,
      paymentMethod,
      status,
      limit,
    });

    return new Response(
      JSON.stringify({
        success: true,
        count: orders.length,
        orders,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Error fetching order history' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
