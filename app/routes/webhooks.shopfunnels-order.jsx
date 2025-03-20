import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";

// Function to fetch all Shopify products and match by SKU
async function getShopifyVariantId(shop, accessToken, sku) {
  try {
    const response = await fetch(
      `https://${shop}/admin/api/2023-10/products.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    const products = data.products;

    for (let product of products) {
      for (let variant of product.variants) {
        if (variant.sku === sku) {
          return variant.id;
        }
      }
    }
  } catch (error) {
    console.error("Error fetching Shopify products:", error);
  }
  return null;
}

export const action = async ({ request }) => {
  const { topic, shop, admin } = await authenticate.webhook(request);

  if (topic !== "SHOPFUNNELS_ORDER") {
    return json({ message: "Wrong topic" }, { status: 400 });
  }

  try {
    const webhookData = await request.json();
    console.log("Received Webhook Payload:", webhookData);

    const { customerEmail, items } = webhookData;

    if (!items || !Array.isArray(items)) {
      return json({ error: "'items' field is missing or not an array" }, { status: 400 });
    }

    if (!customerEmail) {
      return json({ error: "'customerEmail' field is missing or invalid" }, { status: 400 });
    }

    const lineItems = [];
    for (let item of items) {
      const variantId = await getShopifyVariantId(shop, admin.accessToken, item.sku);
      if (variantId) {
        lineItems.push({ variant_id: variantId, quantity: item.quantity });
      } else {
        console.error(`No matching Shopify SKU found for ${item.sku}`);
      }
    }

    if (lineItems.length === 0) {
      return json({ error: "No valid Shopify products found for this order." }, { status: 400 });
    }

    // Create the order using admin API
    const response = await admin.rest.post({
      path: 'orders',
      data: {
        order: {
          line_items: lineItems,
          customer: { email: customerEmail }
        }
      },
    });

    console.log('Shopify Order Created:', response);
    
    return json({ 
      success: true, 
      message: 'Order processed successfully',
      shopifyResponse: response
    });

  } catch (error) {
    console.error("Webhook Error:", error);
    return json({ 
      error: "Failed to create Shopify order", 
      details: error.message 
    }, { status: 500 });
  }
}; 