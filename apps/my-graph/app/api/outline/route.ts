import { NextResponse } from "next/server";
import { outline } from "@/lib/outline";

/** Reconstruído a cada request, como `/api/graph`: ler um arquivo custa milissegundos,
 *  e um cache seria uma segunda verdade sobre se a página está velha. */
export const dynamic = "force-dynamic";

export function GET(req: Request) {
	const id = new URL(req.url).searchParams.get("id") ?? "";
	const o = outline(id);
	if (!o) return NextResponse.json({ error: `sem contrato "${id}"` }, { status: 404 });
	return NextResponse.json(o, { headers: { "cache-control": "no-store" } });
}
