import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";

// Function to fetch all Shopify products and match by SKU
async function getShopifyVariantId(admin, sku) {
  try {
    const { products } = await admin.rest.get({
      path: 'products',
    });

    for (let product of products.data) {
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
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    // Clone the request for multiple body reads
    const requestClone = request.clone();
    
    // Try Shopify webhook authentication first
    try {
      const { topic, shop, admin } = await authenticate.webhook(requestClone);
      // If this succeeds, handle Shopify webhook...
      return json({ success: true });
    } catch (e) {
      // If Shopify auth fails, check for ShopFunnels webhook
      console.log("Not a Shopify webhook, checking for ShopFunnels...");
    }

    const webhookData = await request.json();
    console.log("Received Webhook Payload:", webhookData);

    // Extract data from ShopFunnels format
    const { customerEmail, items, billingAddress, shippingAddress } = webhookData;

    if (!items || !Array.isArray(items)) {
      return json({ error: "'items' field is missing or not an array" }, { status: 400 });
    }

    // For ShopFunnels webhook, we'll need the shop parameter
    const shop = request.headers.get('x-shopify-shop-domain') || new URL(request.url).searchParams.get('shop');
    if (!shop) {
      return json({ error: "Shop parameter is required" }, { status: 400 });
    }

    // Get admin API access for the specific shop
    const { admin } = await authenticate.admin(request, shop);

    const lineItems = [];
    for (let item of items) {
      const variantId = await getShopifyVariantId(admin, item.sku);
      if (variantId) {
        lineItems.push({ 
          variant_id: variantId, 
          quantity: item.quantity 
        });
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
          customer: { 
            email: customerEmail,
          },
          billing_address: {
            name: billingAddress.name,
            address1: billingAddress.address,
            address2: billingAddress.address2,
            city: billingAddress.city,
            province: billingAddress.state,
            zip: billingAddress.zipCode,
            country_code: billingAddress.country,
            phone: billingAddress.phone,
            company: billingAddress.companyName
          },
          shipping_address: {
            name: shippingAddress.name,
            address1: shippingAddress.address,
            address2: shippingAddress.address2,
            city: shippingAddress.city,
            province: shippingAddress.state,
            zip: shippingAddress.zipCode,
            country_code: shippingAddress.country,
            phone: shippingAddress.phone,
            company: shippingAddress.companyName
          }
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