import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // Subscribe to webhooks after authentication
  const { admin } = await authenticate.admin(request);
  
  try {
    // Create webhook subscriptions using GraphQL
    const response = await admin.graphql(`
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookUrl: URL!) {
        webhookSubscriptionCreate(
          topic: $topic,
          webhookSubscription: {
            format: JSON,
            callbackUrl: $webhookUrl
          }
        ) {
          userErrors {
            field
            message
          }
          webhookSubscription {
            id
          }
        }
      }
    `, {
      variables: {
        topic: "ORDERS_CREATE",
        webhookUrl: "https://shopify-webhook-ui-production.up.railway.app/webhooks/order-create"
      },
    });

    const responseJson = await response.json();
    console.log('Webhook subscription response:', responseJson);

  } catch (error) {
    console.error('Error creating webhook subscription:', error);
  }

  return json({ 
    webhookEndpoint: "/webhooks/order-create",
    appUrl: "https://shopify-webhook-ui-production.up.railway.app"
  });
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/additional">Additional page</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
