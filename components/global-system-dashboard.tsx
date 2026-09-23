"use client";

import React, { useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  Boxes,
  AlertTriangle,
  ShoppingCart,
  Truck,
  CheckCircle2,
  Clock,
  Barcode,
  FileSpreadsheet,
  Plus,
  ArrowRight,
  ClipboardCheck,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Product, Order } from "@/app/page";
import {
  type FulfillmentStage,
  normalizeFulfillmentStage,
  FULFILLMENT_STAGES,
} from "@/components/order-progress";

import { KanbanModule } from "@/components/kanban-module";
import { type UserAccess } from "@/lib/access";

interface GlobalSystemDashboardProps {
  products: Product[];
  orders: Order[];
  suppliers: string[];
  cloudStatus: string;
  access: UserAccess | null;
  onNavigate: (view: string, subTab?: "compose" | "history" | "analytics") => void;
  onSelectSupplierForOrder: (supplier: string) => void;
  onCreateProduct: () => void;
  onImport: () => void;
  onUpdateOrderStage: (orderId: string, stage: FulfillmentStage, message?: string) => void;
  onRefreshOrders: () => void; // ADDED
}

const supplierColors: Record<string, string> = {
  "Force Line": "#ea580c",
  Jamaica: "#a16207",
  "Tubo PU": "#7c3aed",
  Sucção: "#b91c1c",
  Bariflex: "#15803d",
};

export function GlobalSystemDashboard({
  products,
  orders,
  suppliers,
  cloudStatus,
  access,
  onNavigate,
  onSelectSupplierForOrder,
  onCreateProduct,
  onImport,
  onUpdateOrderStage,
  onRefreshOrders,
}: GlobalSystemDashboardProps) {
  // 1. Stock Valuation & Metrics
  const stats = useMemo(() => {
    let stockCostTotal = 0;
    let stockRetailTotal = 0;
    let totalPhysicalUnits = 0;
    let itemsWithCost = 0;
    let itemsWithPrice = 0;
    let itemsWithBarcode = 0;
    let itemsWithNcm = 0;
    let zeroStockCount = 0;
    let lowStockCount = 0;

    for (const p of products) {
      const stock = Number(p.stock) || 0;
      totalPhysicalUnits += stock;

      if (p.cost !== null && p.cost !== undefined && p.cost > 0) {
        itemsWithCost++;
        stockCostTotal += stock * p.cost;
      }
      if (p.price !== null && p.price !== undefined && p.price > 0) {
        itemsWithPrice++;
        stockRetailTotal += stock * p.price;
      }
      if (p.barcode && p.barcode.trim()) {
        itemsWithBarcode++;
      }
      if (p.ncm && p.ncm.trim()) {
        itemsWithNcm++;
      }

      if (stock === 0) {
        zeroStockCount++;
      } else if (stock <= 5) {
        lowStockCount++;
      }
    }

    const projectedMargin =
      stockRetailTotal > 0
        ? ((stockRetailTotal - stockCostTotal) / stockRetailTotal) * 100
        : 0;

    // Supplier stats
    const supplierStats = suppliers.map((name) => {
      const suppProducts = products.filter((p) => p.supplier === name);
      const units = suppProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
      const costValue = suppProducts.reduce(
        (sum, p) => sum + (p.cost ? (Number(p.stock) || 0) * p.cost : 0),
        0
      );
      return {
        name,
        count: suppProducts.length,
        units,
        costValue,
        percentage: products.length > 0 ? (suppProducts.length / products.length) * 100 : 0,
      };
    });

    // Category distribution
    const categoryMap: Record<string, number> = {};
    for (const p of products) {
      const cat = p.category || "Diversos";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }
    const categoriesSorted = Object.entries(categoryMap)
      .map(([name, count]) => ({
        name,
        count,
        pct: products.length > 0 ? (count / products.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Brands
    const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));

    // Orders & Fulfillment pipeline
    const completedOrders = orders.filter((o) => o.status === "Finalizado");
    const draftOrders = orders.filter((o) => o.status === "Rascunho");
    const deliveredOrders = orders.filter(
      (o) => normalizeFulfillmentStage(o.fulfillmentStage, o.status) === "delivered"
    );
    const inTransitOrders = orders.filter((o) => {
      const stage = normalizeFulfillmentStage(o.fulfillmentStage, o.status);
      return ["received", "approved", "separating", "shipped"].includes(stage);
    });

    // Critical low stock items (top 5 prioritized)
    const criticalItems = [...products]
      .filter((p) => (Number(p.stock) || 0) <= 5)
      .sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0))
      .slice(0, 5);

    return {
      stockCostTotal,
      stockRetailTotal,
      projectedMargin,
      totalPhysicalUnits,
      itemsWithCost,
      itemsWithPrice,
      itemsWithBarcode,
      itemsWithNcm,
      zeroStockCount,
      lowStockCount,
      supplierStats,
      categoriesSorted,
      brandsCount: brands.length,
      completedOrdersCount: completedOrders.length,
      draftOrdersCount: draftOrders.length,
      deliveredOrdersCount: deliveredOrders.length,
      inTransitOrdersCount: inTransitOrders.length,
      criticalItems,
    };
  }, [products, orders, suppliers]);

  const currency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <section className="content">
      {/* Executive Page Heading */}
      <div className="page-heading">
        <div>
          <span className="eyebrow flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#790a0e]" />
            PAINEL EXECUTIVO GLOBAL
          </span>
          <h1>Visão geral do sistema</h1>
          <p>
            Centro de comando integrado da Casa das Mangueiras: catálogo mestre,
            valoração patrimonial, saúde do estoque, compras e inventário físico.
          </p>
        </div>

        <div className="heading-actions flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={onImport}
            className="flex items-center gap-1.5"
          >
            <FileSpreadsheet size={16} /> Importar catálogo
          </Button>
          <Button
            variant="outline"
            onClick={onCreateProduct}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} /> Novo produto
          </Button>
          <Button
            onClick={() => onNavigate("order", "compose")}
            className="flex items-center gap-1.5"
          >
            <ShoppingCart size={16} /> Criar pedido
          </Button>
        </div>
      </div>

      {/* 6 Top Strategic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-6">
        {/* KPI 1: Valor em Estoque (Custo) */}
        <div className="bg-white border border-[#e5dcdd] rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#756668] uppercase tracking-wider">
              Patrimônio (Custo)
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#fbf3f4] text-[#790a0e] flex items-center justify-center">
              <DollarSign size={15} />
            </div>
          </div>
          <div className="my-2">
            <strong className="text-xl font-extrabold text-[#790a0e] block">
              {currency(stats.stockCostTotal)}
            </strong>
            <small className="text-[11px] text-[#8c7d7f]">
              {stats.itemsWithCost} de {products.length} itens com custo
            </small>
          </div>
          <div className="pt-2 border-t border-[#f3ecec] text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
            <TrendingUp size={12} /> Custo avaliado em estoque
          </div>
        </div>

        {/* KPI 2: Valor Projetado de Venda & Margem */}
        <div className="bg-white border border-[#e5dcdd] rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#756668] uppercase tracking-wider">
              Venda Projetada
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="my-2">
            <strong className="text-xl font-extrabold text-emerald-800 block">
              {currency(stats.stockRetailTotal)}
            </strong>
            <small className="text-[11px] text-[#8c7d7f]">
              Margem bruta est.: <b>{stats.projectedMargin.toFixed(1)}%</b>
            </small>
          </div>
          <div className="pt-2 border-t border-[#f3ecec] text-[10px] text-[#756668] font-medium">
            Potencial de faturamento
          </div>
        </div>

        {/* KPI 3: Volume Físico Total */}
        <div className="bg-white border border-[#e5dcdd] rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#756668] uppercase tracking-wider">
              Unidades Físicas
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Boxes size={15} />
            </div>
          </div>
          <div className="my-2">
            <strong className="text-2xl font-extrabold text-[#211718] block">
              {stats.totalPhysicalUnits.toLocaleString("pt-BR")}
            </strong>
            <small className="text-[11px] text-[#8c7d7f]">
              Peças, metros e barras
            </small>
          </div>
          <div className="pt-2 border-t border-[#f3ecec] text-[10px] text-blue-700 font-medium">
            Volume total inventariado
          </div>
        </div>

        {/* KPI 4: Catálogo Mestre */}
        <div className="bg-white border border-[#e5dcdd] rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#756668] uppercase tracking-wider">
              Catálogo Mestre
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Building2 size={15} />
            </div>
          </div>
          <div className="my-2">
            <strong className="text-2xl font-extrabold text-[#211718] block">
              {products.length.toLocaleString("pt-BR")}
            </strong>
            <small className="text-[11px] text-[#8c7d7f]">
              {suppliers.length} fornecedores · {stats.brandsCount} marcas
            </small>
          </div>
          <div className="pt-2 border-t border-[#f3ecec] text-[10px] text-purple-700 font-medium">
            Base unificada ativa
          </div>
        </div>

        {/* KPI 5: Ruptura & Estoque Crítico */}
        <div className="bg-white border border-[#e5dcdd] rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#756668] uppercase tracking-wider">
              Ruptura / Alerta
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="my-2">
            <strong className="text-2xl font-extrabold text-amber-700 block">
              {stats.zeroStockCount}
            </strong>
            <small className="text-[11px] text-[#8c7d7f]">
              {stats.lowStockCount} itens com estoque baixo (≤ 5)
            </small>
          </div>
          <div className="pt-2 border-t border-[#f3ecec] text-[10px] text-amber-800 font-medium">
            Necessitam reposição
          </div>
        </div>

        {/* KPI 6: Pedidos & Fulfillment */}
        <div className="bg-white border border-[#e5dcdd] rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#756668] uppercase tracking-wider">
              Fluxo de Pedidos
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Truck size={15} />
            </div>
          </div>
          <div className="my-2">
            <strong className="text-2xl font-extrabold text-[#211718] block">
              {orders.length}
            </strong>
            <small className="text-[11px] text-[#8c7d7f]">
              {stats.inTransitOrdersCount} em andamento · {stats.deliveredOrdersCount} entregues
            </small>
          </div>
          <div className="pt-2 border-t border-[#f3ecec] text-[10px] text-emerald-700 font-semibold">
            {stats.completedOrdersCount} finalizados
          </div>
        </div>
      </div>

      {/* Main Grid: Analytical Breakdown Cards */}
      {(access?.role === "ADMIN_CD" || access?.role === "SUPER_ADMIN") && (
        <section className="panel bg-white border border-[#e5dcdd] rounded-xl p-5 shadow-xs mb-6">
          <h2 className="text-base font-bold text-[#211718] mb-4">Painel Kanban (ADMIN CD)</h2>
          <KanbanModule orders={orders} onRefresh={onRefreshOrders} />
        </section>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Panel 1: Presença e Valoração por Fornecedor */}
        <div className="panel bg-white border border-[#e5dcdd] rounded-xl p-5 shadow-xs">
          <div className="panel-heading flex items-center justify-between pb-3 border-b border-[#eee6e7] mb-3">
            <div>
              <h2 className="text-base font-bold text-[#211718]">
                Estoque por Fornecedor
              </h2>
              <span className="text-xs text-[#7d6e70]">
                Valoração e representatividade
              </span>
            </div>
            <button
              onClick={() => onNavigate("order", "analytics")}
              className="text-xs text-[#790a0e] font-semibold hover:underline flex items-center gap-1"
            >
              <span>Ver painel</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {stats.supplierStats.map((item) => (
              <div
                key={item.name}
                className="p-2.5 rounded-lg border border-[#f3ecec] hover:border-[#e2d5d7] transition bg-[#faf7f7]/60"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: supplierColors[item.name] || "#790a0e" }}
                    />
                    <strong className="text-xs text-[#211718] font-bold">
                      {item.name}
                    </strong>
                  </div>
                  <button
                    onClick={() => onSelectSupplierForOrder(item.name)}
                    className="text-[11px] text-[#790a0e] hover:underline font-semibold"
                    title={`Montar pedido direto de ${item.name}`}
                  >
                    Montar pedido &rarr;
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#7d6e70] mb-1.5">
                  <span>
                    {item.count} produtos · {item.units.toLocaleString("pt-BR")} un.
                  </span>
                  <span className="font-semibold text-[#211718]">
                    {currency(item.costValue)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#ede5e6] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(5, item.percentage)}%`,
                      background: supplierColors[item.name] || "#790a0e",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Distribuição por Categorias */}
        <div className="panel bg-white border border-[#e5dcdd] rounded-xl p-5 shadow-xs">
          <div className="panel-heading flex items-center justify-between pb-3 border-b border-[#eee6e7] mb-3">
            <div>
              <h2 className="text-base font-bold text-[#211718]">
                Categorias Principais
              </h2>
              <span className="text-xs text-[#7d6e70]">
                Mix de produtos do catálogo
              </span>
            </div>
            <button
              onClick={() => onNavigate("products")}
              className="text-xs text-[#790a0e] font-semibold hover:underline flex items-center gap-1"
            >
              <span>Ver catálogo</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
            {stats.categoriesSorted.slice(0, 7).map((cat) => (
              <div
                key={cat.name}
                className="flex flex-col gap-1 p-2 rounded-lg bg-[#faf7f7]"
              >
                <div className="flex items-center justify-between text-xs">
                  <strong className="text-[#211718] font-semibold">
                    {cat.name}
                  </strong>
                  <span className="text-[#7d6e70] font-medium">
                    {cat.count} itens ({cat.pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-[#ede5e6] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#790a0e] h-full rounded-full"
                    style={{ width: `${Math.max(4, cat.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 3: Integridade Cadastral & Nuvem */}
        <div className="panel bg-white border border-[#e5dcdd] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="panel-heading flex items-center justify-between pb-3 border-b border-[#eee6e7] mb-3">
              <div>
                <h2 className="text-base font-bold text-[#211718]">
                  Qualidade da Base
                </h2>
                <span className="text-xs text-[#7d6e70]">
                  Auditoria de cadastro e compliance
                </span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {cloudStatus === "Dados sincronizados" ? "Cloud OK" : "Sincronizando"}
              </Badge>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#5c4e50] font-medium flex items-center gap-1">
                    <Barcode size={13} className="text-[#790a0e]" />
                    Código de Barras / QR
                  </span>
                  <strong className="text-[#211718]">
                    {((stats.itemsWithBarcode / (products.length || 1)) * 100).toFixed(0)}%
                  </strong>
                </div>
                <div className="w-full bg-[#ede5e6] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#790a0e] h-full rounded-full"
                    style={{
                      width: `${(stats.itemsWithBarcode / (products.length || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#5c4e50] font-medium">NCM Fiscal Preenchido</span>
                  <strong className="text-[#211718]">
                    {((stats.itemsWithNcm / (products.length || 1)) * 100).toFixed(0)}%
                  </strong>
                </div>
                <div className="w-full bg-[#ede5e6] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full"
                    style={{
                      width: `${(stats.itemsWithNcm / (products.length || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#5c4e50] font-medium">Preço de Custo Informado</span>
                  <strong className="text-[#211718]">
                    {((stats.itemsWithCost / (products.length || 1)) * 100).toFixed(0)}%
                  </strong>
                </div>
                <div className="w-full bg-[#ede5e6] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full"
                    style={{
                      width: `${(stats.itemsWithCost / (products.length || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#5c4e50] font-medium">Preço de Venda Definido</span>
                  <strong className="text-[#211718]">
                    {((stats.itemsWithPrice / (products.length || 1)) * 100).toFixed(0)}%
                  </strong>
                </div>
                <div className="w-full bg-[#ede5e6] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full"
                    style={{
                      width: `${(stats.itemsWithPrice / (products.length || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#eee6e7] flex items-center justify-between text-xs">
            <span className="text-[#7d6e70]">Inventário de estoque</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("balance")}
              className="text-xs flex items-center gap-1"
            >
              <ClipboardCheck size={14} /> Balanço físico
            </Button>
          </div>
        </div>
      </div>

      {/* Secondary Grid: Alertas de Reposição & Atividades Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Alertas Críticos de Reposição */}
        <div className="panel bg-white border border-[#e5dcdd] rounded-xl p-5 shadow-xs">
          <div className="panel-heading flex items-center justify-between pb-3 border-b border-[#eee6e7] mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                <AlertTriangle size={15} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#211718]">
                  Alertas de Reposição Imediata
                </h2>
                <span className="text-xs text-[#7d6e70]">
                  Itens com estoque zerado ou em nível crítico
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate("order", "compose")}
              className="text-xs"
            >
              Pedir agora
            </Button>
          </div>

          {stats.criticalItems.length > 0 ? (
            <div className="space-y-2">
              {stats.criticalItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-[#f3ecec] bg-[#fdf9f9] hover:bg-[#faf4f4] transition"
                >
                  <div className="min-w-0 pr-2">
                    <strong className="block text-xs font-bold text-[#211718] truncate">
                      {item.description}
                    </strong>
                    <span className="text-[11px] text-[#7d6e70]">
                      {item.code || "Sem código"} · Fornecedor: <b>{item.supplier}</b>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant={item.stock === 0 ? "destructive" : "secondary"}
                      className="text-xs font-bold"
                    >
                      {item.stock} {item.unit}
                    </Badge>
                    <button
                      onClick={() => onSelectSupplierForOrder(item.supplier)}
                      className="text-xs text-[#790a0e] font-semibold hover:underline"
                      title={`Comprar de ${item.supplier}`}
                    >
                      Repor &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-emerald-700 flex flex-col items-center gap-1">
              <CheckCircle2 size={24} />
              <span className="text-sm font-semibold">
                Estoque 100% abastecido!
              </span>
              <small className="text-xs text-[#7d6e70]">
                Nenhum produto em nível crítico no momento.
              </small>
            </div>
          )}
        </div>

        {/* Atividades Recentes do Sistema */}
        <div className="panel bg-white border border-[#e5dcdd] rounded-xl p-5 shadow-xs">
          <div className="panel-heading flex items-center justify-between pb-3 border-b border-[#eee6e7] mb-3">
            <div>
              <h2 className="text-base font-bold text-[#211718]">
                Atividades & Pedidos Recentes
              </h2>
              <span className="text-xs text-[#7d6e70]">
                Últimos registros sincronizados
              </span>
            </div>
            <button
              onClick={() => onNavigate("order", "history")}
              className="text-xs text-[#790a0e] font-semibold hover:underline flex items-center gap-1"
            >
              <span>Ver histórico</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {orders.length > 0 ? (
            <div className="space-y-2.5">
              {orders.slice(0, 5).map((order) => {
                const stageKey = normalizeFulfillmentStage(
                  order.fulfillmentStage,
                  order.status
                );
                const stageConf =
                  FULFILLMENT_STAGES.find((s) => s.key === stageKey) ||
                  FULFILLMENT_STAGES[0];
                const StageIcon = stageConf.icon;

                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-[#f3ecec] bg-[#faf7f7]"
                  >
                    <div>
                      <strong className="block text-xs font-bold text-[#211718]">
                        {order.id} · {order.supplier}
                      </strong>
                      <span className="text-[11px] text-[#7d6e70]">
                        {new Date(order.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                        {order.items.length} itens solicitados
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${stageConf.badgeBg} ${stageConf.badgeText} ${stageConf.badgeBorder}`}
                      >
                        <StageIcon size={11} />
                        {stageConf.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-[#7d6e70] flex flex-col items-center gap-1">
              <Clock size={24} className="opacity-40" />
              <span className="text-sm font-semibold">
                Nenhum pedido recente
              </span>
              <small className="text-xs">
                Inicie um novo pedido para começar o fluxo operacional.
              </small>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
