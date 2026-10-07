import { verifyActivationEmail } from "@/lib/activate-actions";

export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email") ?? "";
  const formData = new FormData();
  formData.set("email", email);
  const result = await verifyActivationEmail({ ok: false }, formData);
  return Response.json(result);
}
