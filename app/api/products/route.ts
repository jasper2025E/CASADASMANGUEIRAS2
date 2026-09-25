import { NextRequest, NextResponse } from "next/server";
import initialProducts from "@/lib/initial-products.json";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const category = (searchParams.get("category") || "").trim();
  const supplier = (searchParams.get("supplier") || "").trim();
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Number(searchParams.get("offset")) || 0;

  let results = initialProducts as typeof initialProducts;

  if (supplier && supplier !== "Todos") {
    results = results.filter((p) => p.supplier === supplier);
  }

  if (category && category !== "Todas") {
    results = results.filter((p) => p.category === category);
  }

  if (search) {
    results = results.filter(
      (p) =>
        p.description?.toLowerCase().includes(search) ||
        p.code?.toLowerCase().includes(search) ||
        p.supplier?.toLowerCase().includes(search) ||
        p.brand?.toLowerCase().includes(search)
    );
  }

  const paginated = results.slice(offset, offset + limit);

  return NextResponse.json({
    total: results.length,
    offset,
    limit,
    items: paginated,
  });
}

