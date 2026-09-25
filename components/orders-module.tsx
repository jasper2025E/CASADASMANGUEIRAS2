"use client";

import React, { useState, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { AutoSizer as BaseAutoSizer } from "react-virtualized-auto-sizer";
import Image from "next/image";
import {
  ShoppingCart,
  Clock,
  BarChart3,
  Check,
  RotateCcw,
  Trash2,
  Eye,
  Archive,
  Boxes,
  ChevronDown,
  SlidersHorizontal,
  PackagePlus,
  Barcode,
  Minus,
  Plus,
  FileDown,
  Download,
  Printer,
  ClipboardList,
  PlusCircle,
  ArrowRight,
  Search,
  X,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Product, Order } from "@/app/page";
import {
  OrderProgressStepper,
  OrderDetailProgress,
  normalizeFulfillmentStage,
  FULFILLMENT_STAGES,
  type FulfillmentStage,
} from "@/components/order-progress";

export type OrderSubTab = "compose" | "history" | "analytics";

export interface AutoSizerProps {
  children: (params: { height: number; width: number }) => ReactNode;
  className?: string;
  style?: React.CSSProperties;
  defaultHeight?: number;
  defaultWidth?: number;
}

export function AutoSizer({ children, className, style, defaultHeight = 600, defaultWidth = 800 }: AutoSizerProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div className={className} style={{ width: "100%", height: defaultHeight, ...style }}>
        {children({ height: defaultHeight, width: defaultWidth })}
      </div>
    );
  }

  return (
    <BaseAutoSizer
      className={className}
      style={style}
      renderProp={({ height, width }) => {
        return children({ height: height ?? defaultHeight, width: width ?? defaultWidth });
      }}
    />
  );
}

interface OrdersModuleProps {
  canCreate: boolean;
  canExport: boolean;
  canManage: boolean;
  orderTab: OrderSubTab;
  setOrderTab: (tab: OrderSubTab) => void;
  products: Product[];
  orders: Order[];
  supplier: string;
  setSupplier: (supplier: string) => void;
  category: string;
  setCategory: (category: string) => void;
  categories: string[];
  suppliers: string[];
  quantities: Record<string, number>;
  setQuantity: (id: string, qty: number) => void;
  setQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  selectedItems: Array<Product & { quantity: number }>;
  totalUnits: number;
  filtered: Product[];
  onlySelected: boolean;
  setOnlySelected: React.Dispatch<React.SetStateAction<boolean>>;
  savingOrder: boolean;
  saveOrder: (status: "Rascunho" | "Finalizado") => Promise<void>;
  exportPdf: () => void;
  exportXlsx: () => void;
  setProductModal: (product: Product | null) => void;
  setProductModalTab: (tab: "dados" | "codigo") => void;
  removeOrder: (order: Order) => void;
  repeatOrder: (order: Order) => void;
  updateOrderStage: (orderId: string, stage: FulfillmentStage) => void;
  onOpenErpModal?: (order?: Order) => void;
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
}

const supplierColors: Record<string, string> = {
  "Force Line": "#ea580c",
  Jamaica: "#a16207",
  "Tubo PU": "#7c3aed",
  Sucção: "#b91c1c",
  Bariflex: "#15803d",
};

export function OrdersModule({
  canCreate,
  canExport,
  canManage,
  orderTab,
  setOrderTab,
  products,
  orders,
  supplier,
  setSupplier,
  category,
  setCategory,
  categories,
  suppliers,
  quantities,
  setQuantity,
  selectedItems,
  totalUnits,
  filtered: _filtered,
  onlySelected,
  setOnlySelected,
  savingOrder,
  saveOrder,
  exportPdf,
  exportXlsx,
  setProductModal,
  setProductModalTab,
  removeOrder,
  repeatOrder,
  updateOrderStage,
  onOpenErpModal,
  searchTerm,
  setSearchTerm,
}: OrdersModuleProps) {
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("Todos");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  // Product Name Search in Fazer Pedido ("sem ser somente pelo fornecedor")
  const [localProductSearch, setLocalProductSearch] = useState("");
  const [searchAllSuppliers, setSearchAllSuppliers] = useState(true);
  const activeProductSearch = searchTerm !== undefined ? searchTerm : localProductSearch;

  const handleSetProductSearch = React.useCallback(
    (value: string) => {
      if (setSearchTerm) setSearchTerm(value);
      setLocalProductSearch(value);
    },
    [setSearchTerm]
  );

  const normalizeText = React.useCallback((text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }, []);

  // Filter products by product name (description), SKU, brand, barcode, and optional supplier/category
  const displayProducts = useMemo(() => {
    const query = normalizeText(activeProductSearch);
    const tokens = query.split(/\s+/).filter(Boolean);

    return products.filter((p) => {
      // "Somente adicionados" filter
      if (onlySelected && (quantities[p.id] || 0) <= 0) {
        return false;
      }

      // Supplier filter:
      // If a search query is typed and searchAllSuppliers is TRUE, search across all suppliers without restriction!
      // Otherwise, if no query or searchAllSuppliers is FALSE, respect selected supplier.
      if (supplier !== "Todos") {
        if (!query || !searchAllSuppliers) {
          if (p.supplier !== supplier) return false;
        }
      }

      // Category filter:
      if (category !== "Todas" && p.category !== category) {
        return false;
      }

      // Match all query tokens against product name / description, SKU code, brand, barcode, supplier, category
      if (tokens.length > 0) {
        const searchable = `${normalizeText(p.description)} ${normalizeText(p.code || "")} ${normalizeText(p.brand || "")} ${normalizeText(p.barcode || "")} ${normalizeText(p.supplier || "")} ${normalizeText(p.category || "")}`;
        if (!tokens.every((t) => searchable.includes(t))) {
          return false;
        }
      }

      return true;
    });
  }, [products, activeProductSearch, searchAllSuppliers, supplier, category, onlySelected, quantities, normalizeText]);

  // Aggregate matching suppliers when search query is typed
  const searchStats = useMemo(() => {
    const query = normalizeText(activeProductSearch);
    const tokens = query.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;

    const supplierCounts: Record<string, number> = {};
    let totalMatches = 0;

    products.forEach((p) => {
      const searchable = `${normalizeText(p.description)} ${normalizeText(p.code || "")} ${normalizeText(p.brand || "")} ${normalizeText(p.barcode || "")} ${normalizeText(p.supplier || "")} ${normalizeText(p.category || "")}`;
      if (tokens.every((t) => searchable.includes(t))) {
        totalMatches++;
        supplierCounts[p.supplier] = (supplierCounts[p.supplier] || 0) + 1;
      }
    });

    const inCurrentSupplier = supplier !== "Todos" ? (supplierCounts[supplier] || 0) : totalMatches;
    const inOtherSuppliers = totalMatches - inCurrentSupplier;

    return {
      totalMatches,
      inCurrentSupplier,
      inOtherSuppliers,
      supplierCounts,
    };
  }, [products, activeProductSearch, supplier, normalizeText]);

  const handleSetOrderTab = React.useCallback((tab: OrderSubTab) => setOrderTab(tab), [setOrderTab]);
  const handleSetSupplier = React.useCallback((sup: string) => setSupplier(sup), [setSupplier]);
  const handleSetCategory = React.useCallback((cat: string) => setCategory(cat), [setCategory]);
  const handleSetQuantity = React.useCallback((id: string, qty: number) => setQuantity(id, qty), [setQuantity]);
  const handleSetOnlySelected = React.useCallback((val: boolean | ((v: boolean) => boolean)) => setOnlySelected(val), [setOnlySelected]);
  const handleSaveOrder = React.useCallback((status: "Rascunho" | "Finalizado") => saveOrder(status), [saveOrder]);
  const handleSetProductModal = React.useCallback((p: Product | null) => setProductModal(p), [setProductModal]);
  const handleSetProductModalTab = React.useCallback((tab: "dados" | "codigo") => setProductModalTab(tab), [setProductModalTab]);

  // Filtered orders for ERP grid
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Search term
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(query);
        const matchesOrigin = (order.originOrganizationName || "").toLowerCase().includes(query);
        const matchesDest = (order.destinationOrganizationName || "").toLowerCase().includes(query);
        const matchesSupplier = (order.supplier || "").toLowerCase().includes(query);
        const matchesItems = order.items.some((it) => it.description.toLowerCase().includes(query) || (it.code && it.code.toLowerCase().includes(query)));
        if (!matchesId && !matchesOrigin && !matchesDest && !matchesSupplier && !matchesItems) {
          return false;
        }
      }

      // Status
      if (historyStatusFilter !== "Todos") {
        const currentStage = normalizeFulfillmentStage(order.fulfillmentStage, order.status);
        if (historyStatusFilter === "Pendente" && currentStage !== "submitted" && currentStage !== "received") return false;
        if (historyStatusFilter === "Em Separação" && currentStage !== "separating") return false;
        if (historyStatusFilter === "Em Trânsito" && currentStage !== "shipped") return false;
        if (historyStatusFilter === "Concluído" && currentStage !== "delivered") return false;
        if (historyStatusFilter === "Rejeitado" && currentStage !== "rejected") return false;
      }

      // Date Range
      if (historyStartDate) {
        const orderDate = new Date(order.createdAt).toISOString().split("T")[0];
        if (orderDate < historyStartDate) return false;
      }
      if (historyEndDate) {
        const orderDate = new Date(order.createdAt).toISOString().split("T")[0];
        if (orderDate > historyEndDate) return false;
      }

      return true;
    });
  }, [orders, historySearch, historyStatusFilter, historyStartDate, historyEndDate]);

  const money = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // Keep selected modal order synced if stage changes
  const activeModalOrder = useMemo(() => selectedOrderForModal
    ? orders.find((o) => o.id === selectedOrderForModal.id) || selectedOrderForModal
    : null, [selectedOrderForModal, orders]);

  return (
    <section className="content order-content">
      {/* 3-Layer Integrated Submodule Tabs */}
      <div className="order-subtabs flex items-center gap-2 p-1.5 bg-[#ede6e7] rounded-xl w-max max-w-full overflow-x-auto mb-5 shadow-2xs">
        {canCreate && <button
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            orderTab === "compose"
              ? "bg-white text-[#790a0e] shadow-xs"
              : "text-[#5c4e50] hover:text-[#211718]"
          }`}
          onClick={() => handleSetOrderTab("compose")}
        >
          <ShoppingCart size={15} />
          <span>1. Montar Pedido</span>
          {selectedItems.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#f6e8ea] text-[#790a0e] text-[10px] font-extrabold">
              {selectedItems.length}
            </span>
          )}
        </button>}

        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            orderTab === "history"
              ? "bg-white text-[#790a0e] shadow-xs"
              : "text-[#5c4e50] hover:text-[#211718]"
          }`}
          onClick={() => handleSetOrderTab("history")}
        >
          <Clock size={15} />
          <span>2. Histórico & Atendimento</span>
          {orders.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#f6e8ea] text-[#790a0e] text-[10px] font-extrabold">
              {orders.length}
            </span>
          )}
        </button>

        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            orderTab === "analytics"
              ? "bg-white text-[#790a0e] shadow-xs"
              : "text-[#5c4e50] hover:text-[#211718]"
          }`}
          onClick={() => handleSetOrderTab("analytics")}
        >
          <BarChart3 size={15} />
          <span>3. Painel de Pedidos</span>
        </button>
      </div>

      {/* LAYER 1: MONTAR NOVO PEDIDO */}
      {orderTab === "compose" && (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">REPOSIÇÃO INTERNA</span>
              <h1>Montar novo pedido</h1>
              <p>Selecione os produtos que sua filial precisa receber do Centro de Distribuição.</p>
            </div>
            {canCreate && <div className="heading-actions">
              <Button
                variant="outline"
                disabled={savingOrder}
                onClick={() => handleSaveOrder("Rascunho")}
              >
                Salvar rascunho
              </Button>
              <Button
                disabled={savingOrder}
                onClick={() => handleSaveOrder("Finalizado")}
              >
                <Check size={17} /> {savingOrder ? "Enviando..." : "Enviar ao CD"}
              </Button>
            </div>}
          </div>

          <div className="supplier-selector flex-wrap gap-3">
            <div>
              <span>Filtro informativo</span>
              <strong>O destino do pedido é sempre o Centro de Distribuição</strong>
            </div>
            <div className="select-wrap supplier-select">
              <Boxes size={17} />
              <select
                value={supplier}
                onChange={(e) => {
                  handleSetSupplier(e.target.value);
                  handleSetCategory("Todas");
                  if (e.target.value !== "Todos") {
                    setSearchAllSuppliers(false);
                  }
                }}
              >
                <option>Todos</option>{suppliers.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <ChevronDown size={15} />
            </div>
            {supplier !== "Todos" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleSetSupplier("Todos");
                  setSearchAllSuppliers(true);
                }}
                className="text-xs text-[#790a0e] hover:bg-[#f6e8ea] h-8 px-2.5 font-bold cursor-pointer"
              >
                <Globe size={13} className="mr-1.5" /> Ver todos os fornecedores
              </Button>
            )}
            <Badge variant="secondary" className="ml-auto">
              {products.filter((p) => supplier === "Todos" || p.supplier === supplier).length.toLocaleString("pt-BR")} produtos cadastrados
            </Badge>
          </div>

          <div className="order-layout">
            <div className="catalog-card">
              {/* Product Search & Scope Bar - Permite buscar pelo nome do produto sem se limitar ao fornecedor */}
              <div className="p-3.5 bg-gradient-to-b from-[#faf6f6] to-white border-b border-[#eee6e7] flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search input for product name */}
                  <div className="relative flex-1 min-w-[280px]">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#790a0e]" />
                    <input
                      type="text"
                      value={activeProductSearch}
                      onChange={(e) => handleSetProductSearch(e.target.value)}
                      placeholder="Pesquisar produto pelo nome, código SKU, marca ou especificação..."
                      className="w-full h-10 pl-9 pr-9 bg-white border border-[#d8cbcd] rounded-lg text-xs font-semibold text-[#211718] placeholder:text-[#8c7e80] focus:border-[#790a0e] focus:ring-1 focus:ring-[#790a0e] outline-none shadow-2xs transition"
                    />
                    {activeProductSearch && (
                      <button
                        type="button"
                        onClick={() => handleSetProductSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8c7e80] hover:text-[#211718] p-1 rounded cursor-pointer"
                        title="Limpar pesquisa"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Search scope switch */}
                  <div className="flex items-center gap-1 bg-[#ede6e7] p-1 rounded-lg shrink-0">
                    <button
                      type="button"
                      onClick={() => setSearchAllSuppliers(true)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                        searchAllSuppliers || supplier === "Todos"
                          ? "bg-white text-[#790a0e] shadow-xs"
                          : "text-[#5c4e50] hover:text-[#211718]"
                      }`}
                      title="Buscar produtos em todos os fornecedores cadastrados"
                    >
                      <Globe size={13} />
                      <span>Todos os fornecedores</span>
                    </button>

                    {supplier !== "Todos" && (
                      <button
                        type="button"
                        onClick={() => setSearchAllSuppliers(false)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                          !searchAllSuppliers
                            ? "bg-white text-[#790a0e] shadow-xs"
                            : "text-[#5c4e50] hover:text-[#211718]"
                        }`}
                        title={`Restringir ao fornecedor ${supplier}`}
                      >
                        <Boxes size={13} />
                        <span>Apenas {supplier}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Search stats and supplier pills */}
                {searchStats && searchStats.totalMatches > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#f0e4e5] text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-[#7a6c6e]">
                        {searchStats.totalMatches} produto{searchStats.totalMatches > 1 ? "s" : ""} encontrado{searchStats.totalMatches > 1 ? "s" : ""}:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchAllSuppliers(true);
                          handleSetSupplier("Todos");
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                          searchAllSuppliers || supplier === "Todos"
                            ? "bg-[#790a0e] text-white"
                            : "bg-[#f4eded] text-[#5c4e50] hover:bg-[#e8dedf] border border-[#e0d6d7]"
                        }`}
                      >
                        <span>Todos os fornecedores</span>
                        <span className={`px-1 py-0.2 rounded-full text-[9px] font-black ${searchAllSuppliers || supplier === "Todos" ? "bg-white/20 text-white" : "bg-black/5 text-[#790a0e]"}`}>
                          {searchStats.totalMatches}
                        </span>
                      </button>
                      {Object.entries(searchStats.supplierCounts).map(([supName, count]) => {
                        const isSelectedSupplier = supplier === supName && !searchAllSuppliers;
                        return (
                          <button
                            key={supName}
                            type="button"
                            onClick={() => {
                              handleSetSupplier(supName);
                              setSearchAllSuppliers(false);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                              isSelectedSupplier
                                ? "bg-[#790a0e] text-white"
                                : "bg-[#f4eded] text-[#5c4e50] hover:bg-[#e8dedf] border border-[#e0d6d7]"
                            }`}
                          >
                            <span>{supName}</span>
                            <span className={`px-1 py-0.2 rounded-full text-[9px] font-black ${isSelectedSupplier ? "bg-white/20 text-white" : "bg-black/5 text-[#790a0e]"}`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {supplier !== "Todos" && !searchAllSuppliers && searchStats.inOtherSuppliers > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchAllSuppliers(true);
                          handleSetSupplier("Todos");
                        }}
                        className="text-[11px] font-bold text-[#790a0e] hover:underline flex items-center gap-1 cursor-pointer bg-[#fdf2f3] px-2 py-0.5 rounded border border-[#f5c6cb]"
                      >
                        <Globe size={12} />
                        <span>Ver +{searchStats.inOtherSuppliers} em outros fornecedores</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="catalog-toolbar">
                <div>
                  <h2>
                    {activeProductSearch.trim()
                      ? (searchAllSuppliers || supplier === "Todos"
                          ? `Resultados para "${activeProductSearch}" (Todos os Fornecedores)`
                          : `Resultados para "${activeProductSearch}" em ${supplier}`)
                      : (supplier === "Todos" ? "Todos os produtos" : `Produtos de ${supplier}`)}
                  </h2>
                  <span>{displayProducts.length} produtos encontrados</span>
                </div>
                <div className="filters">
                  <div className="select-wrap">
                    <SlidersHorizontal size={16} />
                    <select
                      value={category}
                      onChange={(e) => handleSetCategory(e.target.value)}
                    >
                      {categories.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                  <button
                    className={onlySelected ? "filter-active" : ""}
                    onClick={() => handleSetOnlySelected((v) => !v)}
                  >
                    Somente adicionados
                  </button>
                </div>
              </div>

              <div className="product-list-head">
                <span>Produto</span>
                <span>Estoque</span>
                <span>Quantidade do pedido</span>
              </div>

              <div className="product-list" style={{ height: "600px", width: "100%" }}>
                {displayProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-[#7a6c6e] h-full">
                    <div className="w-12 h-12 rounded-full bg-[#f6e8ea] text-[#790a0e] flex items-center justify-center mb-3">
                      <Search size={22} />
                    </div>
                    <strong className="text-base text-[#211718] mb-1">
                      Nenhum produto encontrado
                    </strong>
                    <p className="text-xs text-[#7a6c6e] max-w-md mb-4">
                      {activeProductSearch
                        ? `Não encontramos nenhum item correspondente a "${activeProductSearch}"${supplier !== "Todos" && !searchAllSuppliers ? ` no fornecedor ${supplier}` : ""}.`
                        : "Nenhum produto disponível com os filtros atuais."}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {supplier !== "Todos" && !searchAllSuppliers && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setSearchAllSuppliers(true);
                            handleSetSupplier("Todos");
                          }}
                          className="bg-[#790a0e] hover:bg-[#600609] text-white text-xs font-bold"
                        >
                          <Globe size={14} className="mr-1.5" /> Buscar em todos os fornecedores
                        </Button>
                      )}
                      {activeProductSearch && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetProductSearch("")}
                          className="text-xs font-bold"
                        >
                          <X size={14} className="mr-1.5" /> Limpar pesquisa
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <AutoSizer>
                    {({ height, width }: { height: number; width: number }) => (
                      <div style={{ height, width, overflowY: "auto" }}>
                        {displayProducts.map((product) => {
                          const quantity = quantities[product.id] || 0;
                          return (
                            <article
                              className={`product-row ${quantity > 0 ? "has-quantity" : ""}`}
                              key={product.id}
                            >
                              <div className="product-main">
                                <button
                                  className="product-image"
                                  onClick={() => {
                                    handleSetProductModal(product);
                                    handleSetProductModalTab("dados");
                                  }}
                                  aria-label={`Editar ${product.description}`}
                                >
                                  {product.image ? (
                                    <Image
                                      src={product.image}
                                      alt={product.description}
                                      width={48}
                                      height={48}
                                      className="w-full h-full object-cover rounded"
                                    />
                                  ) : (
                                    <PackagePlus size={25} />
                                  )}
                                </button>
                                <div>
                                  <div className="product-meta flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-xs">{product.code || product.category}</span>
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#ede6e7] text-[#4a3b3d] border border-[#ded5d6]">
                                        <Boxes size={10} className="text-[#790a0e]" />
                                        {product.supplier}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSetProductModal(product);
                                        handleSetProductModalTab("codigo");
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#f6e8ea] text-[#790a0e] hover:bg-[#eed5d8] border border-[#eed5d8] transition cursor-pointer"
                                      title="Código de barras EAN-13"
                                    >
                                      <Barcode size={12} />
                                      <span>EAN‑13</span>
                                    </button>
                                  </div>
                                  <strong className="text-sm font-bold text-[#1e293b] leading-tight block mt-0.5">
                                    {product.description}
                                  </strong>
                                  <span className="text-xs text-[#64748b]">
                                    {product.category} · unidade: {product.unit} {product.brand ? `· marca: ${product.brand}` : ""}
                                  </span>
                                </div>
                              </div>

                              <div className="stock">
                                <strong>{product.stock}</strong>
                                <span>{product.unit}</span>
                              </div>

                              <div className="quantity-control">
                                <button
                                  onClick={() => handleSetQuantity(product.id, quantity - 1)}
                                  disabled={quantity === 0}
                                  aria-label="Diminuir"
                                >
                                  <Minus size={16} />
                                </button>
                                <input
                                  aria-label={`Quantidade de ${product.description}`}
                                  type="number"
                                  min="0"
                                  value={quantity || ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    handleSetQuantity(product.id, Number(e.target.value))
                                  }
                                />
                                <button
                                  onClick={() => handleSetQuantity(product.id, quantity + 1)}
                                  aria-label="Aumentar"
                                >
                                  <Plus size={16} />
                                </button>
                                <span>{product.unit}</span>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </AutoSizer>
                )}
              </div>
            </div>

            <aside className="order-summary">
              <div className="summary-title">
                <div>
                  <ShoppingCart size={19} />
                  <h2>Resumo do pedido</h2>
                </div>
                <Badge>{selectedItems.length} itens</Badge>
              </div>

              {selectedItems.length === 0 ? (
                <div className="empty-summary">
                  <ShoppingCart size={29} />
                  <strong>Seu pedido está vazio</strong>
                  <span>Informe a quantidade ao lado dos produtos.</span>
                </div>
              ) : (
                <div className="summary-items">
                  {selectedItems.slice(0, 8).map((item) => (
                    <div key={item.id}>
                      <i style={{ background: supplierColors[item.supplier] }} />
                      <div>
                        <strong>{item.description}</strong>
                        <span>{item.supplier}</span>
                      </div>
                      <b>
                        {item.quantity} {item.unit}
                      </b>
                      <button
                        onClick={() => setQuantity(item.id, 0)}
                        aria-label="Remover"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {selectedItems.length > 8 && (
                    <p>+ {selectedItems.length - 8} outros produtos</p>
                  )}
                </div>
              )}

              <div className="summary-total">
                <span>Total solicitado</span>
                <strong>
                  {totalUnits.toLocaleString("pt-BR")}{" "}
                  <small>unidades/medidas</small>
                </strong>
              </div>

              {canExport && <><div className="export-label">EXPORTAR OU COMPARTILHAR</div>
              <div className="export-grid">
                <button onClick={exportPdf}>
                  <FileDown size={18} />
                  <span>Baixar PDF</span>
                </button>
                <button onClick={exportXlsx}>
                  <Download size={18} />
                  <span>Baixar XLSX</span>
                </button>
                <button onClick={() => window.print()}>
                  <Printer size={18} />
                  <span>Imprimir</span>
                </button>
              </div></>}

              {canCreate && <Button
                className="w-full"
                disabled={savingOrder}
                onClick={() => saveOrder("Finalizado")}
              >
                <Check size={17} />{" "}
                {savingOrder ? "Enviando..." : "Enviar pedido ao CD"}
              </Button>}
            </aside>
          </div>
        </>
      )}

      {/* LAYER 2: HISTÓRICO & ATENDIMENTO (RASTREAMENTO ERP) */}
      {orderTab === "history" && (
        <>
          <div className="page-heading flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <span className="eyebrow text-xs uppercase tracking-wider text-[#790a0e] font-bold">
                GERENCIAMENTO & RASTREAMENTO ERP
              </span>
              <h1 className="text-xl font-extrabold text-[#1e293b]">Pedido de Compra / Venda</h1>
              <p className="text-xs text-[#64748b]">
                Acompanhe o status comercial, separação, expedição e entrega pelo Centro de Distribuição.
              </p>
            </div>
            <div className="heading-actions flex items-center gap-2">
              <Button
                onClick={() => onOpenErpModal ? onOpenErpModal() : setOrderTab("compose")}
                className="bg-[#790a0e] hover:bg-[#590607] text-white font-bold text-xs shadow-sm flex items-center gap-2"
              >
                <PlusCircle size={15} />
                <span>+ Novo Pedido (F3)</span>
              </Button>
            </div>
          </div>

          {/* ERP Structured Filter Toolbar (Directly modeled on the ERP photo) */}
          <div className="bg-white p-3.5 rounded-xl border border-[#cbd5e1] shadow-xs mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end text-xs">
              {/* Pesquisar por */}
              <div className="lg:col-span-4">
                <label className="text-[11px] font-bold text-[#475569] mb-1 block">
                  Pesquisar por (Id, Filial, Fornecedor ou Item):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Digite o código, filial, fornecedor..."
                    className="w-full h-9 px-3 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b] focus:bg-white focus:border-[#790a0e] outline-none"
                  />
                  {historySearch && (
                    <button
                      onClick={() => setHistorySearch("")}
                      className="absolute right-2 top-2 text-[#94a3b8] hover:text-[#1e293b]"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Período Data Inicial */}
              <div className="lg:col-span-2">
                <label className="text-[11px] font-bold text-[#475569] mb-1 block">
                  Período Inicial:
                </label>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b] focus:bg-white focus:border-[#790a0e] outline-none"
                />
              </div>

              {/* Período Data Final */}
              <div className="lg:col-span-2">
                <label className="text-[11px] font-bold text-[#475569] mb-1 block">
                  Período Final:
                </label>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b] focus:bg-white focus:border-[#790a0e] outline-none"
                />
              </div>

              {/* Status do Pedido */}
              <div className="lg:col-span-2">
                <label className="text-[11px] font-bold text-[#475569] mb-1 block">
                  Status:
                </label>
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="w-full h-9 px-2.5 bg-white border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b] focus:border-[#790a0e] outline-none"
                >
                  <option value="Todos">Todos os Status</option>
                  <option value="Pendente">Pendente (Aprovação)</option>
                  <option value="Em Separação">Em Separação (CD)</option>
                  <option value="Em Trânsito">Em Trânsito</option>
                  <option value="Concluído">Concluído / Entregue</option>
                  <option value="Rejeitado">Rejeitado</option>
                </select>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="lg:col-span-2 flex items-center gap-1.5 justify-end">
                {canExport && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportPdf}
                      className="h-9 px-2.5 text-xs bg-white hover:bg-slate-50 border-[#cbd5e1] text-[#334155]"
                      title="Exportar PDF do Histórico"
                    >
                      <Printer size={13} className="mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportXlsx}
                      className="h-9 px-2.5 text-xs bg-white hover:bg-slate-50 border-[#cbd5e1] text-[#334155]"
                      title="Exportar Excel"
                    >
                      <Download size={13} className="mr-1" />
                      XLSX
                    </Button>
                  </>
                )}
                {(historySearch || historyStatusFilter !== "Todos" || historyStartDate || historyEndDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setHistorySearch("");
                      setHistoryStatusFilter("Todos");
                      setHistoryStartDate("");
                      setHistoryEndDate("");
                    }}
                    className="h-9 px-2 text-xs text-[#64748b] hover:text-[#b91c1c]"
                    title="Limpar todos os filtros"
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ERP Orders Table */}
          <div className="bg-white rounded-xl border border-[#cbd5e1] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f1f5f9] border-b border-[#cbd5e1] text-[#475569] font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Id Pedido</th>
                    <th className="py-2.5 px-3">Origem / Destino</th>
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-2 text-center">Itens</th>
                    <th className="py-2.5 px-3 text-right">Valor Total</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Atendimento / Etapa</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filteredOrders.length ? (
                    filteredOrders.map((order) => {
                      const currentStage = normalizeFulfillmentStage(
                        order.fulfillmentStage,
                        order.status
                      );
                      const orderTotalVal = order.items.reduce(
                        (sum, item) => sum + (item.quantity * (item.price ?? item.cost ?? 0)),
                        0
                      );

                      // Status dot styling matching the photo
                      let statusBadge = {
                        dot: "bg-blue-500",
                        label: "Pendente",
                        bg: "bg-blue-50 text-blue-700 border-blue-200",
                      };
                      if (currentStage === "separating") {
                        statusBadge = {
                          dot: "bg-amber-500",
                          label: "Em Separação",
                          bg: "bg-amber-50 text-amber-700 border-amber-200",
                        };
                      } else if (currentStage === "shipped") {
                        statusBadge = {
                          dot: "bg-purple-500",
                          label: "Em Trânsito",
                          bg: "bg-purple-50 text-purple-700 border-purple-200",
                        };
                      } else if (currentStage === "delivered") {
                        statusBadge = {
                          dot: "bg-emerald-500",
                          label: "Concluído",
                          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
                        };
                      } else if (currentStage === "rejected") {
                        statusBadge = {
                          dot: "bg-rose-500",
                          label: "Rejeitado",
                          bg: "bg-rose-50 text-rose-700 border-rose-200",
                        };
                      }

                      return (
                        <tr
                          key={order.dbId || order.id}
                          className="hover:bg-[#fbfbfb] transition"
                        >
                          <td className="py-3 px-3 font-mono font-bold text-[#790a0e]">
                            {order.id}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-[#1e293b] block">
                              {order.originOrganizationName || "Filial CDM"}
                            </span>
                            <span className="text-[10px] text-[#64748b]">
                              → {order.destinationOrganizationName || "Centro de Distribuição"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[#64748b] text-[11px] whitespace-nowrap">
                            {new Date(order.createdAt).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="bg-[#f1f5f9] text-[#475569] font-bold px-2 py-0.5 rounded text-[11px]">
                              {order.items.length} un
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-[#1e293b]">
                            {money(orderTotalVal)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.bg}`}>
                              <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <OrderProgressStepper
                              stage={currentStage}
                              onSelectStage={(newStage) =>
                                updateOrderStage(order.id, newStage)
                              }
                              interactive={canManage}
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedOrderForModal(order)}
                                title="Ver detalhes e rastreamento"
                                className="p-1.5 text-[#64748b] hover:text-[#790a0e] hover:bg-[#fdf2f2] rounded transition"
                              >
                                <Eye size={15} />
                              </button>
                              {onOpenErpModal && (
                                <button
                                  onClick={() => onOpenErpModal(order)}
                                  title="Abrir no Emissor ERP"
                                  className="p-1.5 text-[#64748b] hover:text-[#790a0e] hover:bg-[#fdf2f2] rounded transition"
                                >
                                  <SlidersHorizontal size={14} />
                                </button>
                              )}
                              {canManage && (
                                <button
                                  onClick={() => {
                                    repeatOrder(order);
                                    setOrderTab("compose");
                                  }}
                                  title="Repetir pedido"
                                  className="p-1.5 text-[#64748b] hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                >
                                  <RotateCcw size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => void removeOrder(order)}
                                title="Excluir pedido"
                                className="p-1.5 text-[#94a3b8] hover:text-red-600 hover:bg-red-50 rounded transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#94a3b8]">
                        <Archive size={32} className="mx-auto mb-2 opacity-50" />
                        <div className="font-semibold text-sm text-[#475569] mb-1">
                          Nenhum pedido encontrado
                        </div>
                        <p className="text-xs text-[#94a3b8] max-w-sm mx-auto mb-3">
                          {orders.length === 0
                            ? "Nenhum pedido foi realizado ainda. Crie um novo pedido no catálogo ou emissor."
                            : "Nenhum pedido corresponde aos filtros pesquisados. Tente limpar os filtros."}
                        </p>
                        {canCreate && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenErpModal ? onOpenErpModal() : setOrderTab("compose")}
                            className="text-xs bg-white text-[#790a0e] border-[#790a0e]/40"
                          >
                            <PlusCircle size={14} className="mr-1" />
                            Criar Novo Pedido
                          </Button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* LAYER 3: PAINEL OPERACIONAL DE PEDIDOS */}
      {orderTab === "analytics" && (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">ANÁLISE DE REPOSIÇÃO</span>
              <h1>Painel operacional de pedidos</h1>
              <p>Métricas do fluxo entre filiais e Centro de Distribuição.</p>
            </div>
            <div className="heading-actions">
              <Button onClick={() => setOrderTab("compose")}>
                <Plus size={17} /> Criar pedido
              </Button>
            </div>
          </div>

          <div className="metric-grid">
            <div>
              <span>Pedidos cadastrados</span>
              <strong>{orders.length}</strong>
              <small>Solicitações internas registradas</small>
            </div>
            <div>
              <span>Pedidos concluídos</span>
              <strong className="text-emerald-700">
                {orders.filter((o) => normalizeFulfillmentStage(o.fulfillmentStage,o.status) === "delivered").length}
              </strong>
              <small>Recebidos pelas filiais</small>
            </div>
            <div>
              <span>Rascunhos em aberto</span>
              <strong className="text-amber-700">
                {orders.filter((o) => o.status === "Rascunho").length}
              </strong>
              <small>Em edição no sistema</small>
            </div>
            <div>
              <span>Fornecedores informativos</span>
              <strong>{suppliers.length}</strong>
              <small>Catálogos ativos no sistema</small>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="panel">
              <div className="panel-heading">
                <h2>Produtos por fornecedor</h2>
                <span>Informação auxiliar do catálogo</span>
              </div>
              {suppliers.map((name) => {
                const count = products.filter((p) => p.supplier === name).length;
                const pct = products.length ? Math.round((count / products.length) * 100) : 0;
                return (
                  <div className="supplier-line" key={name}>
                    <i style={{ background: supplierColors[name] || "#790a0e" }} />
                    <div>
                      <strong>{name}</strong>
                      <span>{count} produtos cadastrados</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <b>{pct}%</b>
                      <button
                        onClick={() => {
                          setSupplier(name);
                          setOrderTab("compose");
                        }}
                        className="text-xs text-[#790a0e] hover:underline font-semibold"
                      >
                        Filtrar &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="panel">
              <div className="panel-heading flex items-center justify-between">
                <div>
                  <h2>Pedidos recentes</h2>
                  <span>{orders.length} registros</span>
                </div>
                <button
                  onClick={() => setOrderTab("history")}
                  className="text-xs text-[#790a0e] font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Ver todos</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {orders.length ? (
                orders.slice(0, 6).map((order) => {
                  const stage = normalizeFulfillmentStage(
                    order.fulfillmentStage,
                    order.status
                  );
                  const stageConf =
                    FULFILLMENT_STAGES.find((s) => s.key === stage) ||
                    FULFILLMENT_STAGES[0];
                  const StageIcon = stageConf.icon;

                  return (
                    <div className="recent-order" key={order.id}>
                      <div>
                        <strong>{order.id}</strong>
                        <span>
                          {order.originOrganizationName || "Filial"} → Centro de Distribuição ·{" "}
                          {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${stageConf.badgeBg} ${stageConf.badgeText} ${stageConf.badgeBorder}`}
                        >
                          <StageIcon size={12} />
                          {stageConf.label}
                        </span>
                      </div>
                      <b>{order.items.length} itens</b>
                    </div>
                  );
                })
              ) : (
                <div className="empty-panel">
                  <ClipboardList />
                  <strong>Nenhum pedido salvo</strong>
                  <span>Os pedidos finalizados aparecerão aqui.</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal for Order Details & Interactive Fulfillment Progress */}
      <Dialog
        open={!!activeModalOrder}
        onOpenChange={(open) => !open && setSelectedOrderForModal(null)}
      >
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido {activeModalOrder?.id}</DialogTitle>
          </DialogHeader>

          {activeModalOrder && (
            <div className="order-detail flex flex-col gap-4">
              <div className="order-detail-meta flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <strong className="text-sm text-[#211718]">
                    {activeModalOrder.originOrganizationName || "Filial solicitante"} → {activeModalOrder.destinationOrganizationName || "Centro de Distribuição"}
                  </strong>
                  <span className="text-xs text-[#7a6c6e]">
                    {new Date(activeModalOrder.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                <Badge
                  variant={
                    activeModalOrder.status === "Finalizado" ? "default" : "secondary"
                  }
                >
                  {activeModalOrder.status}
                </Badge>
              </div>

              {/* Expanded fulfillment progress indicator */}
              <OrderDetailProgress
                stage={normalizeFulfillmentStage(
                  activeModalOrder.fulfillmentStage,
                  activeModalOrder.status
                )}
                onSelectStage={(newStage) =>
                  updateOrderStage(activeModalOrder.id, newStage)
                }
                reviewMessage={activeModalOrder.reviewMessage}
              />
              {canManage && normalizeFulfillmentStage(activeModalOrder.fulfillmentStage,activeModalOrder.status) === "received" && <Button variant="outline" className="border-red-200 text-red-700" onClick={()=>updateOrderStage(activeModalOrder.id,"rejected")}>Rejeitar e informar motivo</Button>}

              <div className="order-detail-list">
                {activeModalOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b border-[#ede5e6]"
                  >
                    <div>
                      <strong className="text-xs text-[#211718] block">
                        {item.description}
                      </strong>
                      <span className="text-[11px] text-[#7a6c6e]">
                        {item.code || item.category} · {item.supplier}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {item.quantity} {item.unit}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#ede5e6]">
                {canCreate && <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    repeatOrder(activeModalOrder);
                    setSelectedOrderForModal(null);
                    setOrderTab("compose");
                  }}
                  className="flex items-center gap-1.5"
                >
                  <RotateCcw size={15} /> Repetir este pedido
                </Button>}
                <span className="text-xs font-bold text-[#790a0e]">
                  Total:{" "}
                  {activeModalOrder.items
                    .reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0)
                    .toLocaleString("pt-BR")}{" "}
                  unidades
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
