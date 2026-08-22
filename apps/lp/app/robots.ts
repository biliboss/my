//! O `robots.txt`, e o ponteiro pro sitemap.
//!
//! Uma linha que só existe pra que o sitemap seja ACHADO: um sitemap correto
//! que ninguém aponta é um arquivo que só o dono do site lê.
//!
//! depends_on: apps/lp/app/sitemap.ts
//! impacts:    —

import { SITE } from "@biliboss/lp-slices/slices";
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/" },
		sitemap: `${SITE}/sitemap.xml`,
	};
}
