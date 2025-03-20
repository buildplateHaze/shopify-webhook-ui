import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";
import crypto from 'crypto';

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

// Verify request signature
function verifyRequest(request, rawBody) {
  const timestamp = request.headers.get('x-timestamp');
  const signature = request.headers.get('x-signature');

  // Check if required headers are present
  if (!timestamp || !signature) {
    return false;
  }

  // Verify timestamp is within 5 minutes
  const timestampAge = Date.now() - parseInt(timestamp);
  if (timestampAge > 5 * 60 * 1000) { // 5 minutes
    return false;
  }

  // Create expected signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(timestamp + rawBody)
    .digest('hex');

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export const action = async ({ request }) => {
  console.log("Received request to /api/create-order");
  
  // Only allow POST requests
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Verify request signature
    if (!verifyRequest(request, rawBody)) {
      return json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse the raw body
    const body = JSON.parse(rawBody);
    console.log("Received order request:", body);

    // Get shop from query parameter
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    console.log("Shop from URL:", shop);
    
    if (!shop) {
      return json({ error: "Shop parameter is required" }, { status: 400 });
    }

    // Get admin access using offline token
    const { admin } = await authenticate.admin(request, shop);

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
      details: error.message,
      stack: error.stack // Include stack trace in development
    }, { status: 500 });
  }
}; 