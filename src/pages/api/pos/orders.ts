import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../lib/auth';
import { createOrder, getRecentOrders, getTodaySales } from '../../../db/client';

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const orders = await getRecentOrders(40);
    const summary = await getTodaySales();
    return new Response(JSON.stringify({ orders, summary }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { table_number, customer_name, payment_method, items, subtotal, tax, tip, total, amount_paid, change_given, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Order must contain at least one item' }), { status: 400 });
    }

    const newOrder = await createOrder({
      table_number: table_number || 'Takeout',
      customer_name: customer_name || 'Walk-in',
      status: 'completed',
      payment_method: payment_method || 'cash_bzd',
      subtotal: parseFloat(subtotal) || 0,
      tax: parseFloat(tax) || 0,
      tip: parseFloat(tip) || 0,
      total: parseFloat(total) || 0,
      amount_paid: parseFloat(amount_paid) || parseFloat(total) || 0,
      change_given: parseFloat(change_given) || 0,
      notes: notes || null,
      items: items.map((i: any) => ({
        item_name: i.name,
        unit_price: parseFloat(i.price.replace(/[^0-9.]/g, '')) || 0,
        quantity: parseInt(i.quantity, 10) || 1,
        subtotal: (parseFloat(i.price.replace(/[^0-9.]/g, '')) || 0) * (parseInt(i.quantity, 10) || 1),
        notes: i.notes || null,
      })),
    });

    return new Response(JSON.stringify({ success: true, order: newOrder }), { status: 201 });
  } catch (err: any) {
    console.error('POS order error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
