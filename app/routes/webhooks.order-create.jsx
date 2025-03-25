import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    // Authenticate the webhook
    const { topic, shop, admin, payload } = await authenticate.webhook(request);
    
    console.log('Webhook received:', {
      topic,
      shop,
      payload
    });

    // Handle the order creation
    if (topic === "orders/create") {
      // Process the order data from payload
      const order = payload;
      console.log('New order received:', order);

      // You can perform additional actions here
      // For example, update your database, send notifications, etc.

      return json({ success: true });
    }

    return json({ error: "Unhandled webhook topic" }, { status: 400 });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return json({ 
      error: "Webhook processing failed", 
      details: error.message 
    }, { status: 500 });
  }
}; 