import { json } from "@remix-run/server-runtime";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    const shopfunnelsOrder = await request.json();
    console.log("Received ShopFunnels Order:", shopfunnelsOrder);

    return json({ success: true, message: "Order received" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
};
