import { Webhook } from "svix"; 
import connectDB from "@/config/db";
import User from "@/models/User";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req) {
  const wh = new Webhook(process.env.SIGNING_SECRET);
  const headerPayload = headers();

  const svixHeaders = {
    "svix-id": headerPayload.get("svix-id"),
    "svix-timestamp": headerPayload.get("svix-timestamp"),
    "svix-signature": headerPayload.get("svix-signature"),
  };

  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt;
  try {
    evt = wh.verify(body, svixHeaders);
  } catch (err) {
    console.error("❌ Webhook verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { data, type } = evt;

  const userData = {
    clerkId: data.id, // ✅ Matches schema now
    email: data.email_addresses[0].email_address,
    name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
    image: data.image_url,
  };

  await connectDB();

  try {
    switch (type) {
      case "user.created":
        await User.create(userData);
        console.log("✅ User created:", userData);
        break;

      case "user.updated":
        await User.findOneAndUpdate({ clerkId: data.id }, userData, { new: true });
        console.log("✅ User updated:", userData);
        break;

      case "user.deleted":
        await User.findOneAndDelete({ clerkId: data.id });
        console.log("✅ User deleted:", data.id);
        break;

      default:
        console.log("ℹ️ Unhandled event type:", type);
        break;
    }
  } catch (err) {
    console.error("❌ Database operation failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ message: "Event received" });
}
