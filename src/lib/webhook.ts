import type { DbOrder } from '../db/client';

/**
 * Returns a human-friendly label for payment methods.
 */
export function formatPaymentMethod(method?: string): string {
  const m = (method || '').toLowerCase().trim();
  if (m === 'pay_on_pickup' || m === 'unpaid') {
    return '⏳ Pending on Pickup/Delivery';
  }
  if (m === 'cash' || m === 'cash_bzd' || m === 'cash_usd') {
    return '💵 Cash';
  }
  if (m === 'cardpayment' || m === 'card') {
    return '💳 Card Payment (Counter POS)';
  }
  if (m === 'transfer') {
    return '🏦 Bank Transfer';
  }
  if (m === 'digiwallet') {
    return '📱 DigiWallet Mobile Pay';
  }
  return method ? method.replace('_', ' ').toUpperCase() : '💵 Cash on Pickup';
}

/**
 * Dispatches a webhook notification to the restaurant owner when a pickup order is placed.
 */
export async function sendOrderNotificationWebhook(order: DbOrder): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.ORDER_WEBHOOK_URL;
  const restaurantPhone = process.env.WHATSAPP_NUMBER || '5016362275';

  const itemsSummary = order.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ');
  const paymentSourceLabel = formatPaymentMethod(order.payment_method);

  // Formatted message text
  const messageText = `🌮 *NEW PICKUP ORDER #${order.order_number}* 🌮\n` +
    `👤 Customer: ${order.customer_name}\n` +
    `📞 Phone: ${order.customer_phone || 'Not provided'}\n` +
    `⏰ Pickup Time: ${order.pickup_time || 'ASAP'}\n` +
    `💳 Payment Source: ${paymentSourceLabel}\n` +
    `🍽️ Items: ${itemsSummary}\n` +
    `💰 Total: $${Number(order.total).toFixed(2)} BZD\n` +
    `📝 Notes: ${order.notes || 'None'}\n` +
    `📍 Flagged as: PICKUP`;

  console.log('📣 [Order Notification Webhook]:\n', messageText);

  if (!webhookUrl) {
    // If webhook is not yet configured in .env, log and return gracefully
    return {
      success: true,
      error: 'ORDER_WEBHOOK_URL not configured. Notification logged locally.',
    };
  }

  try {
    // Determine payload format: supports Discord/Slack webhooks or custom endpoints
    let payload: any;

    if (webhookUrl.includes('discord.com/api/webhooks')) {
      payload = {
        username: 'Sal y Limón Pickup Alert',
        avatar_url: 'https://sal-y-limon.com/sal-y-limon-logo.jpg',
        embeds: [
          {
            title: `🛍️ New Pickup Order #${order.order_number}`,
            color: 12336173, // #bc3c2d warm Mexican red
            fields: [
              { name: 'Customer', value: order.customer_name, inline: true },
              { name: 'Phone', value: order.customer_phone || 'N/A', inline: true },
              { name: 'Arrival / Pickup Time', value: `⏰ ${order.pickup_time || 'ASAP'}`, inline: true },
              { name: 'Payment Source', value: paymentSourceLabel, inline: true },
              { name: 'Total', value: `$${Number(order.total).toFixed(2)} BZD`, inline: true },
              { name: 'Special Notes', value: order.notes || 'None', inline: true },
              { name: 'Items', value: itemsSummary, inline: false },
            ],
            footer: { text: 'Sal y Limón POS & Kitchen Alert' },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } else if (webhookUrl.includes('hooks.slack.com')) {
      payload = {
        text: `🛍️ *NEW PICKUP ORDER #${order.order_number}*\n*Customer:* ${order.customer_name} (${order.customer_phone})\n*Pickup Time:* ${order.pickup_time}\n*Payment Source:* ${paymentSourceLabel}\n*Items:* ${itemsSummary}\n*Total:* $${Number(order.total).toFixed(2)} BZD`,
      };
    } else {
      // Generic JSON Webhook (Zapier, Make, custom backend, WhatsApp API)
      payload = {
        event: 'order.pickup.created',
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        pickup_time: order.pickup_time,
        payment_method: order.payment_method,
        payment_source: paymentSourceLabel,
        table_number: order.table_number,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        notes: order.notes,
        created_at: order.created_at || new Date().toISOString(),
      };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`⚠️ Webhook delivery failed with status ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error('⚠️ [Webhook Exception]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Builds a direct WhatsApp message URL so customer or owner can verify in WhatsApp with 1 tap.
 */
export function buildWhatsAppOrderUrl(order: DbOrder, restaurantNumber = '5016362275'): string {
  const itemsText = order.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ');
  const paymentSourceLabel = formatPaymentMethod(order.payment_method);
  const text = `Hello Sal y Limón! I placed Pickup Order #${order.order_number}.\n` +
    `Name: ${order.customer_name}\n` +
    `Pickup Time: ${order.pickup_time}\n` +
    `Payment Source: ${paymentSourceLabel}\n` +
    `Items: ${itemsText}\n` +
    `Total: $${Number(order.total).toFixed(2)} BZD\n` +
    (order.notes ? `Notes: ${order.notes}` : '');

  return `https://wa.me/${restaurantNumber}?text=${encodeURIComponent(text)}`;
}
