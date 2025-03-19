import { json } from "@remix-run/node";
import { shopifyApp } from "@shopify/shopify-app-remix";

export const action = async ({ request }) => {
  try {
    const shopfunnelsOrder = await request.json();

    console.log("Received ShopFunnels Order:", shopfunnelsOrder);

    // Map ShopFunnels order to Shopify format
    const shopifyOrder = {
      line_items: shopfunnelsOrder.items.map(item => ({
        title: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      customer: {
        first_name: shopfunnelsOrder.customer.first_name,
        last_name: shopfunnelsOrder.customer.last_name,
        email: shopfunnelsOrder.customer.email
      },
      financial_status: "paid"
    };

    // Initialize Shopify API Client
    const shopify = shopifyApp();
    const session = await shopify.sessionStorage.load(request);

    if (!session) {
      return json({ error: "Shopify session not found" }, { status: 401 });
    }

    const shopifyResponse = await fetch(
      `https://${session.shop}/admin/api/2024-01/orders.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": session.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ order: shopifyOrder }),
      }
    );

    if (!shopifyResponse.ok) {
      throw new Error("Failed to create order in Shopify");
    }

    console.log("Order created in Shopify:", await shopifyResponse.json());
    return json({ success: true });
  } catch (error) {
    console.error("Error processing ShopFunnels webhook:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
};
