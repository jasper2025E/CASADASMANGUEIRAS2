"use client";

import React, { useState, useMemo, useSyncExternalStore } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  BarChart3,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  PackageCheck,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Order, Product } from "@/app/page";

const emptySubscribe = () => () => {};

interface CategorySalesChartProps {
  orders: Order[];
  products: Product[];
  onNavigateToOrders?: () => void;
  onOpenNewOrder?: () => void;
}

export interface CategorySalesData {
  category: string;
  volume: number;
  totalValue: number;
  orderCount: number;
  percentage: number;
  color: string;
}

const CATEGORY_PALETTE = [
  "#790a0e", // Vinho CDM
  "#0284c7", // Azul Petróleo
  "#16a34a", // Verde Esmeralda
  "#ea580c", // Laranja Cobalto
  "#7c3aed", // Roxo Industrial
  "#d97706", // Âmbar Dourado
  "#0d9488", // Verde Petróleo
  "#2563eb", // Azul Royal
  "#db2777", // Rosa Forte
  "#475569", // Ardósia
];

export function CategorySalesChart({
  orders,
  products,
  onNavigateToOrders,
  onOpenNewOrder,
}: CategorySalesChartProps) {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [periodDays, setPeriodDays] = useState<number>(30); // Default strictly to 30 days as requested
  const [metricMode, setMetricMode] = useState<"volume" | "value">("volume");

  // Quick lookup map for product prices/costs/categories if not present in item
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
      if (p.code) map.set(p.code, p);
    }
    return map;
  }, [products]);

  // Aggregate category sales in the specified period (default last 30 days)
  const { chartData, totalVolume, totalRevenue, totalOrdersInPeriod, topCategory } =
    useMemo(() => {
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(now.getDate() - periodDays);

      // Filter orders by date range
      const filteredOrders = orders.filter((order) => {
        if (periodDays === 0) return true; // 0 = Todo o histórico
        if (!order.createdAt) return true;
        const orderDate = new Date(order.createdAt);
        return !isNaN(orderDate.getTime()) && orderDate >= cutoffDate;
      });

      const categoryMap = new Map<
        string,
        { volume: number; totalValue: number; orderIds: Set<string> }
      >();

      let grandTotalVolume = 0;
      let grandTotalRevenue = 0;

      for (const order of filteredOrders) {
        if (!order.items || !Array.isArray(order.items)) continue;

        for (const item of order.items) {
          const qty = Number(item.quantity) || 0;
          if (qty <= 0) continue;

          // Resolve category
          const fallbackProduct = productMap.get(item.id) || (item.code ? productMap.get(item.code) : undefined);
          const rawCategory =
            item.category?.trim() || fallbackProduct?.category?.trim() || "Diversos";
          const category = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);

          // Resolve item unit value
          const unitPrice =
            item.price !== null && item.price !== undefined && item.price > 0
              ? Number(item.price)
              : item.cost !== null && item.cost !== undefined && item.cost > 0
              ? Number(item.cost)
              : fallbackProduct?.price || fallbackProduct?.cost || 0;

          const itemTotalValue = qty * unitPrice;

          grandTotalVolume += qty;
          grandTotalRevenue += itemTotalValue;

          const existing = categoryMap.get(category) || {
            volume: 0,
            totalValue: 0,
            orderIds: new Set<string>(),
          };

          existing.volume += qty;
          existing.totalValue += itemTotalValue;
          existing.orderIds.add(order.id);

          categoryMap.set(category, existing);
        }
      }

      // Format sorted chart entries
      const sortedEntries: CategorySalesData[] = Array.from(categoryMap.entries())
        .map(([category, data], index) => {
          const percentage =
            grandTotalVolume > 0 ? (data.volume / grandTotalVolume) * 100 : 0;
          return {
            category,
            volume: data.volume,
            totalValue: data.totalValue,
            orderCount: data.orderIds.size,
            percentage,
            color: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length],
          };
        })
        .sort((a, b) => b.volume - a.volume);

      const top = sortedEntries.length > 0 ? sortedEntries[0] : null;

      return {
        chartData: sortedEntries,
        totalVolume: grandTotalVolume,
        totalRevenue: grandTotalRevenue,
        totalOrdersInPeriod: filteredOrders.length,
        topCategory: top,
      };
    }, [orders, periodDays, productMap]);

  const currencyFormat = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="bg-white border border-[#e5dcdd] rounded-xl p-5 shadow-xs mb-6">
      {/* Header with Title and Control Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#eee6e7]">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#fbf3f4] text-[#790a0e] flex items-center justify-center shrink-0 border border-[#f3dedf] shadow-xs">
            <BarChart3 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#211718] tracking-tight">
                Volume de Produtos Vendidos por Categoria
              </h2>
              <Badge
                variant="secondary"
                className="bg-[#fbf3f4] text-[#790a0e] border-[#f1d0d2] text-[11px] font-semibold"
              >
                Últimos {periodDays === 0 ? "Todos os" : periodDays} dias
              </Badge>
            </div>
            <p className="text-xs text-[#7d6e70] mt-0.5">
              Análise quantitativa de saídas e pedidos expedidos consolidada por linha de produto
            </p>
          </div>
        </div>

        {/* Action and Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Metric mode toggle */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setMetricMode("volume")}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                metricMode === "volume"
                  ? "bg-white text-[#790a0e] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Volume (Unidades)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("value")}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                metricMode === "value"
                  ? "bg-white text-[#790a0e] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Faturamento (R$)
            </button>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 bg-[#f8fafc] border border-slate-200 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPeriodDays(7)}
              className={`px-2 py-1 rounded font-medium transition ${
                periodDays === 7 ? "bg-white text-[#0f172a] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7d
            </button>
            <button
              type="button"
              onClick={() => setPeriodDays(30)}
              className={`px-2 py-1 rounded font-medium transition ${
                periodDays === 30 ? "bg-[#790a0e] text-white shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
              title="Padrão: Últimos 30 dias"
            >
              30d
            </button>
            <button
              type="button"
              onClick={() => setPeriodDays(60)}
              className={`px-2 py-1 rounded font-medium transition ${
                periodDays === 60 ? "bg-white text-[#0f172a] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              60d
            </button>
            <button
              type="button"
              onClick={() => setPeriodDays(0)}
              className={`px-2 py-1 rounded font-medium transition ${
                periodDays === 0 ? "bg-white text-[#0f172a] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
              title="Todo o histórico"
            >
              Tudo
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        <div className="p-3 rounded-lg border border-slate-200/80 bg-[#f8fafc] flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <PackageCheck size={13} className="text-[#790a0e]" />
            Volume Total Vendido
          </span>
          <div className="mt-1">
            <strong className="text-xl font-bold text-slate-800">
              {totalVolume.toLocaleString("pt-BR")}{" "}
              <span className="text-xs font-normal text-slate-500">un.</span>
            </strong>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200/80 bg-[#f8fafc] flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <TrendingUp size={13} className="text-emerald-600" />
            Categoria Líder
          </span>
          <div className="mt-1 truncate">
            <strong className="text-base font-bold text-slate-800 block truncate">
              {topCategory ? topCategory.category : "Nenhuma"}
            </strong>
            <span className="text-[11px] text-slate-500">
              {topCategory
                ? `${topCategory.volume.toLocaleString("pt-BR")} un (${topCategory.percentage.toFixed(0)}%)`
                : "Sem movimentação"}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200/80 bg-[#f8fafc] flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <DollarSign size={13} className="text-emerald-700" />
            Movimentação Estimada
          </span>
          <div className="mt-1">
            <strong className="text-base font-bold text-emerald-800">
              {currencyFormat(totalRevenue)}
            </strong>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200/80 bg-[#f8fafc] flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <ShoppingBag size={13} className="text-[#0284c7]" />
            Pedidos no Período
          </span>
          <div className="mt-1">
            <strong className="text-xl font-bold text-slate-800">
              {totalOrdersInPeriod}{" "}
              <span className="text-xs font-normal text-slate-500">pedidos</span>
            </strong>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      {chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-2">
          {/* Recharts Bar Chart (3 Cols on Desktop) */}
          <div className="lg:col-span-3 h-[320px] w-full pt-2">
            {!isMounted ? (
              <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-lg animate-pulse">
                <span className="text-xs text-slate-400">Carregando gráfico...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 15, right: 15, left: -5, bottom: 45 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="category"
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                    height={50}
                    tick={{ fill: "#475569", fontSize: 11, fontWeight: 500 }}
                    stroke="#cbd5e1"
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    stroke="#cbd5e1"
                    allowDecimals={false}
                    tickFormatter={(val) =>
                      metricMode === "volume"
                        ? Number(val).toLocaleString("pt-BR")
                        : `R$ ${Number(val) >= 1000 ? `${(Number(val) / 1000).toFixed(0)}k` : val}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(121, 10, 14, 0.05)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload as CategorySalesData;
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-xs min-w-[200px]">
                          <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: data.color }}
                            />
                            <strong className="text-slate-900 font-bold text-sm truncate">
                              {data.category}
                            </strong>
                          </div>

                          <div className="space-y-1.5 text-slate-600">
                            <div className="flex justify-between items-center">
                              <span>Volume de vendas:</span>
                              <strong className="text-slate-900 font-bold">
                                {data.volume.toLocaleString("pt-BR")} un.
                              </strong>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Participação no período:</span>
                              <strong className="text-[#790a0e] font-bold">
                                {data.percentage.toFixed(1)}%
                              </strong>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Faturamento est.:</span>
                              <strong className="text-emerald-700 font-bold">
                                {currencyFormat(data.totalValue)}
                              </strong>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                              <span>Presente em:</span>
                              <span>{data.orderCount} pedido(s)</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey={metricMode === "volume" ? "volume" : "totalValue"}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={55}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Ranking & Top Categories Sidebar (1 Col on Desktop) */}
          <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-4 pt-3 lg:pt-0 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Ranking por Volume
                </span>
                <span className="text-[11px] text-slate-400">
                  {chartData.length} categorias
                </span>
              </div>

              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {chartData.slice(0, 6).map((item, idx) => (
                  <div
                    key={item.category}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100/80 transition border border-slate-100"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-800 truncate">
                          {idx + 1}. {item.category}
                        </span>
                      </div>
                      <span className="font-bold text-[#790a0e] shrink-0">
                        {item.volume.toLocaleString("pt-BR")} un
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(4, item.percentage)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
              {onNavigateToOrders && (
                <button
                  type="button"
                  onClick={onNavigateToOrders}
                  className="text-xs text-[#790a0e] font-semibold hover:underline flex items-center gap-1"
                >
                  Ver todos pedidos
                  <ChevronRight size={13} />
                </button>
              )}
              {onOpenNewOrder && (
                <button
                  type="button"
                  onClick={onOpenNewOrder}
                  className="text-xs font-bold px-2.5 py-1 bg-[#790a0e] hover:bg-[#63070b] text-white rounded shadow-xs"
                >
                  Novo Pedido (F3)
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State when no orders in the chosen period */
        <div className="p-8 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-xl my-2">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2">
            <ShoppingBag size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Nenhuma venda registrada nos últimos {periodDays} dias
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Assim que novos pedidos forem emitidos e registrados pelo PDV ou catálogo, o volume por
            categoria será contabilizado e desenhado automaticamente no gráfico.
          </p>

          <div className="flex items-center justify-center gap-2">
            {periodDays !== 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPeriodDays(0)}
                className="text-xs"
              >
                Ver Todo o Histórico
              </Button>
            )}
            {onOpenNewOrder && (
              <Button
                size="sm"
                onClick={onOpenNewOrder}
                className="text-xs bg-[#790a0e] hover:bg-[#600609] text-white"
              >
                Lançar Pedido de Venda
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
