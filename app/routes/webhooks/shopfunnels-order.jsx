// app/routes/webhooks/shopfunnels-order.jsx
import { json } from '@remix-run/node';
import { shopifyApi } from '@shopify/shopify-api';

export const action = async ({ request }) => {
  try {
    const shopfunnelsOrder = await request.json();

    // Map ShopFunnels order to Shopify order format
    const shopifyOrder = {
      line_items: shopfunnelsOrder.items.map(item => ({
        title: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      customer: {
        first_name: shopfunnelsOrder.customer.first_name,
        last_name: shopfunnelsOrder.customer.last_name,
        email: shopfunnelsOrder.customer.email,
      },
      financial_status: 'paid',
    };

    // Initialize Shopify API client
    const shopifyClient = new shopifyApi.clients.Rest({
      domain: process.env.SHOPIFY_SHOP_DOMAIN,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    });

    // Send order to Shopify
    const response = await shopifyClient.post({
      path: 'orders',
      data: { order: shopifyOrder },
      type: 'application/json',
    });

    return json({ success: true, order: response.body.order });
  } catch (error) {
    console.error('Error creating Shopify order:', error);
    return json({ error: 'Failed to create order' }, { status: 500 });
  }
};
