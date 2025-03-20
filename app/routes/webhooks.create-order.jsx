import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    const data = await request.json();
    console.log("Received Order Request:", data);

    // Get the shop URL from the headers or query params
    const shop = request.headers.get('x-shopify-shop-domain') || new URL(request.url).searchParams.get('shop');
    if (!shop) {
      return json({ error: "Shop parameter is required" }, { status: 400 });
    }

    // Get admin API access with shop parameter
    const { admin } = await authenticate.admin(request, shop);

    // Validate required fields
    if (!data.sku || !data.quantity) {
      return json({ 
        error: "Missing required fields", 
        details: "sku and quantity are required" 
      }, { status: 400 });
    }

    // Find product by SKU
    const { products } = await admin.rest.get({
      path: 'products',
      query: { sku: data.sku }
    });

    const product = products.data.find(p => 
      p.variants.some(v => v.sku === data.sku)
    );

    if (!product) {
      return json({ error: "SKU not found" }, { status: 404 });
    }

    const variant = product.variants.find(v => v.sku === data.sku);

    // Create order using REST API
    const response = await admin.rest.post({
      path: 'orders',
      data: {
        order: {
          line_items: [{
            variant_id: variant.id,
            quantity: data.quantity
          }],
          customer: data.email ? { email: data.email } : undefined,
          source_name: "create-order-api"
        }
      },
    });

    return json({
      success: true,
      message: "Order created successfully",
      order: response.data
    });

  } catch (error) {
    console.error("Error:", error);
    return json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
}; 