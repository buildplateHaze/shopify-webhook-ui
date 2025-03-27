import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    // Get the webhook data
    const data = await request.json();
    console.log("Received webhook data:", data);

    // Get shop from query parameter or header
    const shop = request.headers.get('x-shopify-shop-domain') || 
                new URL(request.url).searchParams.get('shop');

    if (!shop) {
      return json({ error: "Shop parameter is required" }, { status: 400 });
    }

    // Get admin access
    const { admin } = await authenticate.admin(request, shop);

    // Create the order
    const response = await admin.rest.post({
      path: 'orders',
      data: {
        order: {
          line_items: [{
            title: data.product_title || "Custom Product",
            price: data.price || "0.00",
            quantity: data.quantity || 1
          }],
          customer: {
            email: data.email || "customer@example.com"
          },
          financial_status: "paid",
          source_name: "Webhook Order",
          tags: ["webhook"]
        }
      }
    });

    console.log("Order created:", response);

    return json({ 
      success: true, 
      message: "Order created successfully",
      order: response.data 
    });

  } catch (error) {
    console.error("Error processing webhook:", error);
    return json({ 
      error: "Failed to process webhook", 
      details: error.message 
    }, { status: 500 });
  }
}; 