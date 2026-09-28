import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../../lib/auth';
import { updateOrderStatus } from '../../../../db/client';

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { order_id, status, payment_method } = await request.json();

    if (!order_id || !status) {
      return new Response(JSON.stringify({ error: 'Missing order_id or status' }), { status: 400 });
    }

    if (!['open', 'completed', 'cancelled'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400 });
    }

    const success = await updateOrderStatus(order_id, status, payment_method);

    if (success) {
      return new Response(JSON.stringify({ success: true, status, payment_method }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ error: 'Order not found or update failed' }), { status: 404 });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500 });
  }
};
