import { json } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";
import crypto from 'crypto';

// Function to find variant by SKU using GraphQL
async function findVariantBySku(admin, sku) {
  try {
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
                    price
                  }
                }
              }
            }
          }
        }
      }
    `, {
      variables: {
        query: `sku:${sku}`
      }
    });

    if (products.edges.length > 0) {
      const variant = products.edges[0].node.variants.edges[0].node;
      return {
        variantId: variant.id,
        price: variant.price
      };
    }
    return null;
  } catch (error) {
    console.error("Error finding variant:", error);
    return null;
  }
}

// Validate request body
function validateRequestBody(data) {
  const errors = [];
  
  if (!data.sku || typeof data.sku !== 'string') {
    errors.push("SKU is required and must be a string");
  }
  
  if (!data.quantity || typeof data.quantity !== 'number' || data.quantity < 1) {
    errors.push("Quantity is required and must be a positive number");
  }
  
  if (data.email && typeof data.email !== 'string') {
    errors.push("Email must be a string if provided");
  }
  
  return errors;
}

// Verify API credentials
function verifyApiRequest(request) {
  const apiKey = request.headers.get('x-api-key');
  const timestamp = request.headers.get('x-timestamp');
  const signature = request.headers.get('x-signature');

  // Check if required headers are present
  if (!apiKey || !timestamp || !signature) {
    return false;
  }

  // Verify API key
  if (apiKey !== process.env.SHOPIFY_API_KEY) {
    return false;
  }

  // Verify timestamp is within 5 minutes
  const timestampAge = Date.now() - parseInt(timestamp);
  if (timestampAge > 5 * 60 * 1000) { // 5 minutes
    return false;
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(`${apiKey}${timestamp}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Default component export
export default function CreateOrder() {
  return (
    <div>
      <h1>Create Order API Endpoint</h1>
      <p>This is an API endpoint for creating orders. Use POST method to create orders.</p>
    </div>
  );
}

// Loader for GET requests
export const loader = async ({ request }) => {
  return json({
    message: "Use POST method to create orders",
    documentation: "See README for API documentation"
  });
};

// Action for POST requests
export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    let admin;
    
    // Try session-based auth first
    try {
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
    } catch (e) {
      // If session auth fails, try API key auth
      if (!verifyApiRequest(request)) {
        return json({ error: "Unauthorized" }, { status: 401 });
      }
      // Get shop from header or query param
      const shop = request.headers.get('x-shopify-shop-domain') || 
                  new URL(request.url).searchParams.get('shop');
      if (!shop) {
        return json({ error: "Shop parameter required for API key auth" }, { status: 400 });
      }
      const authResult = await authenticate.admin(request, shop);
      admin = authResult.admin;
    }

    // Parse and validate request body
    const data = await request.json();
    const validationErrors = validateRequestBody(data);
    if (validationErrors.length > 0) {
      return json({ errors: validationErrors }, { status: 400 });
    }

    // Find variant by SKU
    const variant = await findVariantBySku(admin, data.sku);
    if (!variant) {
      return json({ error: "SKU not found" }, { status: 404 });
    }

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
            variantId: variant.variantId,
            quantity: data.quantity
          }],
          email: data.email
        }
      }
    });

    return json({
      success: true,
      message: "Order created successfully",
      order: response.draftOrderCreate.draftOrder
    });

  } catch (error) {
    console.error("Error creating order:", error);
    return json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
};
