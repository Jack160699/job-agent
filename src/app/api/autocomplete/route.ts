import { NextRequest, NextResponse } from "next/server";
import {
  searchAutocompleteCatalog,
  type AutocompleteCatalog,
} from "@/lib/data/autocomplete-catalogs";

const allowed = new Set<AutocompleteCatalog>([
  "skills",
  "degrees",
  "specializations",
  "institutions",
  "companies",
  "industries",
  "certifications",
  "languages",
  "government_departments",
  "government_categories",
  "public_sector_organizations",
  "employment_types",
  "currencies",
  "states",
  "countries",
]);

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") as AutocompleteCatalog;
  const query = request.nextUrl.searchParams.get("q") ?? "";
  if (!allowed.has(type)) {
    return NextResponse.json({ error: "INVALID_CATALOG" }, { status: 400 });
  }
  return NextResponse.json({
    options: searchAutocompleteCatalog(type, query),
  });
}
