import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    // Try to authenticate with Shopify
    const { admin } = await authenticate.admin(request);
    
    const data = await request.json();
    console.log("Received Order Request:", data);

    // Get the shop URL from the headers or query params
    const shop = request.headers.get('x-shopify-shop-domain') || new URL(request.url).searchParams.get('shop');
    if (!shop) {
      return json({ error: "Shop parameter is required" }, { status: 400 });
    }

    // Find product by SKU
    const { products } = await admin.graphql(`
      query getProductBySKU($query: String!) {
        products(first: 1, query: $query) {
          edges {
            node {
              id
              variants(first: 1) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `, {
      variables: {
        query: `sku:${data.sku}`
      }
    });

    if (products.edges.length === 0) {
      return json({ error: "SKU not found" }, { status: 404 });
    }

    const variantId = products.edges[0].node.variants.edges[0].node.id;

    // Create draft order
    const response = await admin.graphql(`
      mutation createDraftOrder($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        input: {
          lineItems: [{
            variantId,
            quantity: data.quantity
          }],
          email: data.email
        }
      }
    });

    if (response.draftOrderCreate.userErrors.length > 0) {
      return json({ 
        error: "Failed to create order",
        details: response.draftOrderCreate.userErrors 
      }, { status: 400 });
    }

    return json({
      success: true,
      message: "Order created successfully",
      orderId: response.draftOrderCreate.draftOrder.id
    });

  } catch (error) {
    console.error("Error:", error);
    return json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
}; 