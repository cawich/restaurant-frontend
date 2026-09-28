import type { APIRoute } from 'astro';
import { createOrder } from '../../../db/client';
import { sendOrderNotificationWebhook, buildWhatsAppOrderUrl } from '../../../lib/webhook';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      customer_name,
      customer_phone,
      pickup_time,
      payment_method,
      items,
      notes,
    } = body;

    // Validation
    if (!customer_name || !customer_name.trim()) {
      return new Response(JSON.stringify({ error: 'Please provide your name.' }), { status: 400 });
    }

    if (!customer_phone || !customer_phone.trim()) {
      return new Response(JSON.stringify({ error: 'Please provide your phone or WhatsApp number.' }), { status: 400 });
    }

    if (!pickup_time || !pickup_time.trim()) {
      return new Response(JSON.stringify({ error: 'Please select an estimated arrival / pickup time.' }), { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Your cart is empty. Add items from the menu.' }), { status: 400 });
    }

    // Calculate subtotal and tax
    let subtotal = 0;
    const formattedItems = items.map((i: any) => {
      const priceNum = typeof i.price === 'number'
        ? i.price
        : parseFloat(String(i.price).replace(/[^0-9.]/g, '')) || 0;
      const qty = parseInt(i.quantity, 10) || 1;
      const lineTotal = priceNum * qty;
      subtotal += lineTotal;

      return {
        item_name: i.name,
        unit_price: priceNum,
        quantity: qty,
        subtotal: lineTotal,
        notes: i.notes || null,
      };
    });

    const tax = subtotal * 0.125; // 12.5% Belize GST
    const total = subtotal + tax;

    // Payment is pending until collected in person
    const normalizedPaymentMethod = payment_method ? String(payment_method).trim().toLowerCase() : 'pay_on_pickup';

    // Save order flagged as pickup
    const newOrder = await createOrder({
      order_type: 'pickup',
      table_number: 'Pickup',
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      pickup_time: pickup_time.trim(),
      status: 'open',
      payment_method: normalizedPaymentMethod,
      subtotal,
      tax,
      tip: 0,
      total,
      amount_paid: 0,
      change_given: 0,
      notes: notes ? notes.trim() : null,
      items: formattedItems,
    });

    // Fire webhook notification to owner
    await sendOrderNotificationWebhook(newOrder);

    // Build WhatsApp URL
    const whatsappUrl = buildWhatsAppOrderUrl(newOrder);

    return new Response(
      JSON.stringify({
        success: true,
        order: newOrder,
        whatsapp_url: whatsappUrl,
        message: 'Pickup order placed successfully!',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Pickup order error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Server error creating order' }), { status: 500 });
  }
};
