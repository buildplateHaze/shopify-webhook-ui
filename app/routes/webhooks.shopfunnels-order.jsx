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

  // Verify ShopFunnels webhook secret
  const webhookSecret = request.headers.get('x-webhook-secret');
  if (!webhookSecret || webhookSecret !== 'ayrYqOYpx2LPVDhp') {
    return json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  try {
    const webhookData = await request.json();
    console.log("Received Webhook Payload:", webhookData);

    // Get admin API access using the default session
    const { admin } = await authenticate.admin(request);

    const lineItems = [];
    for (let item of webhookData.items) {
      const variantId = await getShopifyVariantId(admin, item.sku);
      if (variantId) {
        lineItems.push({ 
          variant_id: variantId, 
          quantity: item.quantity,
          price: item.total / item.quantity
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
            email: webhookData.customerEmail,
          },
          total_price: webhookData.total,
          subtotal_price: webhookData.subTotal,
          total_shipping_price_set: {
            shop_money: {
              amount: webhookData.shippingAmount,
              currency_code: webhookData.currency || "USD"
            }
          },
          billing_address: {
            name: webhookData.customerName || webhookData.billingAddress.name,
            address1: webhookData.billingAddress.address,
            address2: webhookData.billingAddress.address2,
            city: webhookData.billingAddress.city,
            province: webhookData.billingAddress.state,
            zip: webhookData.billingAddress.zipCode,
            country_code: webhookData.billingAddress.country,
            phone: webhookData.billingAddress.phone,
            company: webhookData.billingAddress.companyName
          },
          shipping_address: {
            name: webhookData.customerName || webhookData.shippingAddress.name,
            address1: webhookData.shippingAddress.address,
            address2: webhookData.shippingAddress.address2,
            city: webhookData.shippingAddress.city,
            province: webhookData.shippingAddress.state,
            zip: webhookData.shippingAddress.zipCode,
            country_code: webhookData.shippingAddress.country,
            phone: webhookData.shippingAddress.phone,
            company: webhookData.shippingAddress.companyName
          },
          financial_status: webhookData.paid ? "paid" : "pending",
          source_name: "ShopFunnels",
          tags: ["ShopFunnels"]
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