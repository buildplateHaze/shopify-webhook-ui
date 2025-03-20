import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    const shopfunnelsOrder = await request.json();
    console.log("Received ShopFunnels Order:", shopfunnelsOrder);

    const { admin } = await authenticate.admin(request);

    // Process each line item
    const lineItems = [];
    for (const item of shopfunnelsOrder.line_items) {
      // Search for product by SKU
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
          query: `sku:${item.sku}`
        }
      });

      if (products.edges.length > 0) {
        const product = products.edges[0].node;
        const variantId = product.variants.edges[0].node.id;
        
        lineItems.push({
          variantId,
          quantity: item.quantity
        });
      }
    }

    // Create Shopify order if products were found
    if (lineItems.length > 0) {
      const orderResponse = await admin.graphql(`
        mutation createOrder($input: OrderInput!) {
          orderCreate(input: $input) {
            order {
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
            lineItems,
            email: shopfunnelsOrder.email,
            // Add other order details as needed
          }
        }
      });

      console.log("Shopify Order Created:", orderResponse);
    }

    return json({ success: true, message: "Order processed" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}; 