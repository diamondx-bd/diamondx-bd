// Optional server-side order endpoint for future payment verification.
// Deploy with Supabase CLI after configuring the project. Do not expose service keys.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { player_id, product_id, customer_phone, payment_method } = await req.json();
  if (!/^\d{5,15}$/.test(String(player_id ?? "")) ||
      !/^01\d{9}$/.test(String(customer_phone ?? "")) ||
      !["bKash", "Nagad", "Rocket"].includes(payment_method)) {
    return Response.json({ error: "তথ্য সঠিক নয়" }, { status: 400 });
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key);
  const { data: product, error: productError } = await db.from("products")
    .select("id,name,price_bdt,active").eq("id", product_id).eq("active", true).single();
  if (productError || !product) return Response.json({ error: "প্যাকেজ পাওয়া যায়নি" }, { status: 404 });
  const { data, error } = await db.from("orders").insert({
    player_id: String(player_id), product_id: product.id, product_name: product.name,
    price_bdt: product.price_bdt, customer_phone: String(customer_phone),
    payment_method, status: "pending"
  }).select("id,status").single();
  if (error) return Response.json({ error: "অর্ডার তৈরি করা যায়নি" }, { status: 500 });
  return Response.json({ order: data }, { status: 201 });
});
