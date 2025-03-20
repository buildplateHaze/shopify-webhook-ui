import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";

// Function to find variant by SKU
async function findVariantBySku(admin, sku) {
  try {
    const { products } = await admin.rest.get({
      path: 'products',
    });

    // Look through all products and their variants for matching SKU
    for (const product of products.data) {
      for (const variant of product.variants) {
        if (variant.sku === sku) {
          return variant.id;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Error finding variant:", error);
    throw error;
  }
}

export const action = async ({ request }) => {
  // Only allow POST requests
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Get shop from query parameter
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    
    if (!shop) {
      return json({ error: "Shop parameter is required" }, { status: 400 });
    }

    // Get admin access
    const { admin } = await authenticate.admin(request, shop);

    // Parse request body
    const body = await request.json();
    console.log("Received order request:", body);

    // Validate required fields
    if (!body.sku || !body.quantity) {
      return json({
        error: "Missing required fields",
        details: "sku and quantity are required"
      }, { status: 400 });
    }

    // Find variant ID by SKU
    const variantId = await findVariantBySku(admin, body.sku);
    if (!variantId) {
      return json({ error: "Product with specified SKU not found" }, { status: 404 });
    }

    // Create order
    const orderData = {
      line_items: [{
        variant_id: variantId,
        quantity: body.quantity
      }],
      customer: body.email ? { email: body.email } : undefined,
      tags: ["API"],
      source_name: "api"
    };

    const response = await admin.rest.post({
      path: 'orders',
      data: { order: orderData }
    });

    console.log("Order created:", response);

    return json({
      success: true,
      message: "Order created successfully",
      order: response.data
    });

  } catch (error) {
    console.error("Error creating order:", error);
    return json({
      error: "Failed to create order",
      details: error.message
    }, { status: 500 });
  }
}; 