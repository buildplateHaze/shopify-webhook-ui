import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    // Authenticate and get webhook data
    const { topic, shop, admin, payload } = await authenticate.webhook(request);
    
    console.log('Webhook received:', {
      topic,
      shop,
      payload
    });

    // Handle different webhook topics
    switch (topic) {
      case "orders/create":
        console.log('New order created:', payload);
        // Handle new order
        break;
      
      case "orders/updated":
        console.log('Order updated:', payload);
        // Handle order update
        break;
      
      case "orders/cancelled":
        console.log('Order cancelled:', payload);
        // Handle order cancellation
        break;

      default:
        return json({ error: "Unhandled webhook topic" }, { status: 400 });
    }

    return json({ success: true });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return json({ 
      error: "Webhook processing failed", 
      details: error.message 
    }, { status: 500 });
  }
}; 