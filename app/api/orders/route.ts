import { NextRequest, NextResponse } from "next/server";

// In-memory / server-side fallback storage for demo / fast responses
let serverOrders: Array<{
  id: string;
  supplier: string;
  createdAt: string;
  status: string;
  fulfillmentStage: string;
  items: Array<{ id: string; description: string; quantity: number; unit: string; price?: number | null; cost?: number | null }>;
}> = [
  {
    id: "PED-982144",
    supplier: "Force Line",
    createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    status: "Finalizado",
    fulfillmentStage: "in_transit",
    items: [
      { id: "1", description: "MANGUEIRA CRISTAL 1/2 X 2,0MM 50M", quantity: 10, unit: "rl", price: 120, cost: 75 },
      { id: "2", description: "ABRACADEIRA ROSCA SEM FIM 1/2 X 3/4", quantity: 100, unit: "pc", price: 2.5, cost: 1.2 },
    ],
  },
  {
    id: "PED-982145",
    supplier: "Jamaica",
    createdAt: new Date(Date.now() - 3600 * 1000 * 26).toISOString(),
    status: "Finalizado",
    fulfillmentStage: "delivered",
    items: [
      { id: "3", description: "MANGUEIRA JARDIM TRANCADA SILICONADA 20M", quantity: 15, unit: "un", price: 89, cost: 52 },
    ],
  },
  {
    id: "PED-982146",
    supplier: "Tubo PU",
    createdAt: new Date(Date.now() - 3600 * 1000 * 50).toISOString(),
    status: "Finalizado",
    fulfillmentStage: "separated",
    items: [
      { id: "4", description: "TUBO POLIURETANO PU AZUL 8MM 100M", quantity: 5, unit: "rl", price: 145, cost: 90 },
    ],
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const supplier = searchParams.get("supplier");
  const status = searchParams.get("status");

  let filtered = [...serverOrders];
  if (supplier && supplier !== "Todos") {
    filtered = filtered.filter((o) => o.supplier === supplier);
  }
  if (status) {
    filtered = filtered.filter((o) => o.status === status);
  }

  return NextResponse.json({
    total: filtered.length,
    orders: filtered,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newOrder = {
      id: body.id || `PED-${String(Date.now()).slice(-6)}`,
      supplier: body.supplier || "Fornecedor Diversos",
      createdAt: new Date().toISOString(),
      status: body.status || "Finalizado",
      fulfillmentStage: body.fulfillmentStage || (body.status === "Finalizado" ? "submitted" : "draft"),
      items: body.items || [],
    };
    serverOrders = [newOrder, ...serverOrders];
    return NextResponse.json({ success: true, order: newOrder }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
