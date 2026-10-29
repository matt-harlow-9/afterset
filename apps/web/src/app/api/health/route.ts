import { getPool } from "@/lib/db";

export async function GET() {
  try {
    await getPool().query("select 1");
    return Response.json({ status: "ok", db: "up" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return Response.json({ status: "error", db: "down", message }, { status: 503 });
  }
}
