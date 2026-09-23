"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Barcode,
  Search,
  Plus,
  Trash2,
  Printer,
  Save,
  CheckCircle2,
  X,
  Package,
  Layers,
  Truck,
  CreditCard,
  Building2,
  Calendar,
  UserCheck,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Product, Order } from "@/app/page";

interface ErpOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  organizationName: string;
  destinationOrganizationName?: string;
  currentUserEmail?: string;
  onSaveOrder: (status: "Rascunho" | "Finalizado", orderData: {
    items: Array<Product & { quantity: number; discount?: number; unitPrice?: number }>;
    supplier: string;
    notes?: string;
    orderType?: string;
    transportType?: string;
    paymentTerm?: string;
  }) => Promise<void>;
  onExportPdf?: () => void;
  initialOrder?: Order | null;
}

export function ErpOrderModal({
  open,
  onOpenChange,
  products,
  organizationName,
  destinationOrganizationName = "Centro de Distribuição",
  currentUserEmail = "operador@cdm.com.br",
  onSaveOrder,
  onExportPdf,
  initialOrder,
}: ErpOrderModalProps) {
  const [activeTab, setActiveTab] = useState<"dados" | "itens" | "transporte" | "faturamento">("itens");
  
  // General Data
  const [orderNumber, setOrderNumber] = useState("");
  const [movementType, setMovementType] = useState("Saída / Reposição Filial");
  const [emissionType, setEmissionType] = useState("Própria");
  const [commercialOperation, setCommercialOperation] = useState("Transferência entre Unidades");
  const [salesperson, setSalesperson] = useState(currentUserEmail.split("@")[0] || "Operador");
  const [generalNotes, setGeneralNotes] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("Todos");

  // Transportation
  const [carrierType, setCarrierType] = useState("Frota Própria CDM");
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });
  const [transportNotes, setTransportNotes] = useState("");

  // Billing
  const [paymentCondition, setPaymentCondition] = useState("Transferência Interna (Sem Débito Comercial)");
  const [priceTable, setPriceTable] = useState("Tabela Padrão (Custo Filial)");

  // Item Input Bar State (like in the photo: Código, Q (F2), Descrição, Valor Unit, Qtd, Desconto, Total)
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0);
  const [itemDiscount, setItemDiscount] = useState<number>(0);
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [showProductSearchDropdown, setShowProductSearchDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cart Items
  const [orderItems, setOrderItems] = useState<Array<{
    product: Product;
    quantity: number;
    unitPrice: number;
    discount: number;
  }>>([]);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Sync when initial order is opened or modal opens
  useEffect(() => {
    if (open) {
      if (initialOrder) {
        setOrderNumber(initialOrder.id);
        setSelectedSupplier(initialOrder.supplier || "Todos");
        setOrderItems(
          initialOrder.items.map((item) => ({
            product: item,
            quantity: item.quantity,
            unitPrice: item.price ?? item.cost ?? 10,
            discount: 0,
          }))
        );
      } else {
        const rand = Math.floor(1000 + Math.random() * 9000);
        setOrderNumber(`CDM-${rand}S`);
        setOrderItems([]);
        setSelectedProduct(null);
        setBarcodeInput("");
        setItemQuantity(1);
        setItemDiscount(0);
      }
      setActiveTab("itens");
    }
  }, [open, initialOrder]);

  // Focus barcode input when modal opens or when tab changes to "itens"
  useEffect(() => {
    if (open && activeTab === "itens") {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [open, activeTab]);

  // Handle product selection
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setBarcodeInput(product.barcode || product.code || "");
    const basePrice = product.price ?? product.cost ?? 0;
    setItemUnitPrice(basePrice);
    setShowProductSearchDropdown(false);
    setQuickSearchQuery("");
  };

  // Item line total calculation
  const calculatedLineTotal = useMemo(() => {
    const rawTotal = (itemUnitPrice || 0) * (itemQuantity || 0);
    const afterDiscount = Math.max(0, rawTotal - (itemDiscount || 0));
    return afterDiscount;
  }, [itemUnitPrice, itemQuantity, itemDiscount]);

  // Insert item into the order
  const handleAddItem = () => {
    if (!selectedProduct) {
      toast.error("Selecione um produto através do código ou busca.");
      return;
    }
    if (itemQuantity <= 0) {
      toast.error("A quantidade deve ser maior que zero.");
      return;
    }

    setOrderItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === selectedProduct.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const current = updated[existingIdx];
        const newQty = current.quantity + itemQuantity;
        updated[existingIdx] = {
          ...current,
          quantity: newQty,
          unitPrice: itemUnitPrice,
          discount: current.discount + itemDiscount,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            product: selectedProduct,
            quantity: itemQuantity,
            unitPrice: itemUnitPrice,
            discount: itemDiscount,
          },
        ];
      }
    });

    toast.success(`Item adicionado: ${selectedProduct.description}`);

    // Reset item input
    setSelectedProduct(null);
    setBarcodeInput("");
    setItemQuantity(1);
    setItemUnitPrice(0);
    setItemDiscount(0);
    barcodeInputRef.current?.focus();
  };

  // Search by barcode or code when pressing Enter
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = barcodeInput.trim().toLowerCase();
      if (!code) return;

      const found = products.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === code) ||
          (p.code && p.code.toLowerCase() === code) ||
          p.id.toLowerCase() === code
      );

      if (found) {
        handleSelectProduct(found);
      } else {
        // Fallback: search in description
        const partial = products.filter((p) =>
          p.description.toLowerCase().includes(code)
        );
        if (partial.length === 1) {
          handleSelectProduct(partial[0]);
        } else if (partial.length > 1) {
          setShowProductSearchDropdown(true);
          setQuickSearchQuery(code);
        } else {
          toast.error(`Nenhum produto encontrado para o código "${barcodeInput}".`);
        }
      }
    } else if (e.key === "F2") {
      e.preventDefault();
      setShowProductSearchDropdown(true);
    }
  };

  // Filter products for dropdown lookup
  const searchResults = useMemo(() => {
    if (!quickSearchQuery.trim()) return products.slice(0, 15);
    const q = quickSearchQuery.toLowerCase();
    return products
      .filter(
        (p) =>
          p.description.toLowerCase().includes(q) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          p.supplier.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [products, quickSearchQuery]);

  // Order Totals
  const totals = useMemo(() => {
    let totalDiscount = 0;
    let totalUnits = 0;
    let grossTotal = 0;

    orderItems.forEach((item) => {
      totalUnits += item.quantity;
      totalDiscount += item.discount || 0;
      grossTotal += item.quantity * item.unitPrice;
    });

    const netTotal = Math.max(0, grossTotal - totalDiscount);

    return {
      discount: totalDiscount,
      totalUnits,
      grossTotal,
      netTotal,
      itemCount: orderItems.length,
    };
  }, [orderItems]);

  const money = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // Submit order
  const handleSave = async (status: "Rascunho" | "Finalizado") => {
    if (orderItems.length === 0) {
      toast.error("Adicione ao menos um item ao pedido.");
      return;
    }

    setSaving(true);
    try {
      const itemsPayload = orderItems.map((item) => ({
        ...item.product,
        quantity: item.quantity,
        discount: item.discount,
        unitPrice: item.unitPrice,
      }));

      await onSaveOrder(status, {
        items: itemsPayload,
        supplier: selectedSupplier,
        notes: generalNotes,
        orderType: movementType,
        transportType: carrierType,
        paymentTerm: paymentCondition,
      });

      toast.success(
        status === "Finalizado"
          ? `Pedido ${orderNumber} faturado e enviado ao CD com sucesso!`
          : `Rascunho ${orderNumber} salvo com sucesso!`
      );
      onOpenChange(false);
    } catch {
      toast.error("Ocorreu um erro ao salvar o pedido.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1180px]! w-[95vw]! max-h-[92vh]! p-0 overflow-hidden bg-[#f4f6f8] text-[#1e293b] border border-[#cbd5e1] rounded-xl shadow-2xl flex flex-col">
        {/* Top Window Titlebar (Classic ERP Header with Casa das Mangueiras styling) */}
        <div className="bg-gradient-to-r from-[#190405] via-[#2d070b] to-[#190405] text-white px-5 py-3.5 border-b border-[#4d1015] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#590607] border border-[#85161d] flex items-center justify-center font-bold text-xs shadow-inner">
              CDM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold tracking-wide uppercase text-white m-0">
                  Emissão de Pedidos 00.1.00
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-[#40080b] text-[#fca5a5] border border-[#78171f] font-mono font-bold">
                  {orderNumber}
                </span>
              </div>
              <p className="text-[11px] text-[#d1b8ba] m-0">
                {organizationName} → {destinationOrganizationName}
              </p>
            </div>
          </div>

          {/* ERP Control Badges (Right Header) */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-2 bg-[#2d070b]/80 border border-[#590e14] px-2.5 py-1 rounded">
              <span className="text-[#d1b8ba]">Movimentação:</span>
              <strong className="text-amber-300 font-semibold">{movementType.split(" ")[0]}</strong>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-[#2d070b]/80 border border-[#590e14] px-2.5 py-1 rounded">
              <span className="text-[#d1b8ba]">Emissão:</span>
              <strong className="text-emerald-300 font-semibold">{emissionType}</strong>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-[#d1b8ba] hover:text-white hover:bg-[#590607] p-1.5 rounded-lg transition"
              aria-label="Fechar janela"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Subtabs Bar (Dados Gerais | Itens / Serviços | Adicionais / Transporte | Faturamento) */}
        <div className="bg-[#e9edf2] px-5 pt-2 border-b border-[#cbd5e1] flex items-center gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("dados")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition rounded-t-lg ${
              activeTab === "dados"
                ? "bg-white text-[#790a0e] border-[#790a0e] shadow-xs"
                : "border-transparent text-[#64748b] hover:text-[#1e293b] hover:bg-[#dfe4ea]"
            }`}
          >
            <Building2 size={15} />
            <span>Dados Gerais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("itens")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition rounded-t-lg ${
              activeTab === "itens"
                ? "bg-white text-[#790a0e] border-[#790a0e] shadow-xs"
                : "border-transparent text-[#64748b] hover:text-[#1e293b] hover:bg-[#dfe4ea]"
            }`}
          >
            <Layers size={15} />
            <span>Itens / Serviços</span>
            {orderItems.length > 0 && (
              <span className="bg-[#790a0e] text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {orderItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transporte")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition rounded-t-lg ${
              activeTab === "transporte"
                ? "bg-white text-[#790a0e] border-[#790a0e] shadow-xs"
                : "border-transparent text-[#64748b] hover:text-[#1e293b] hover:bg-[#dfe4ea]"
            }`}
          >
            <Truck size={15} />
            <span>Adicionais / Transporte</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("faturamento")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition rounded-t-lg ${
              activeTab === "faturamento"
                ? "bg-white text-[#790a0e] border-[#790a0e] shadow-xs"
                : "border-transparent text-[#64748b] hover:text-[#1e293b] hover:bg-[#dfe4ea]"
            }`}
          >
            <CreditCard size={15} />
            <span>Faturamento</span>
          </button>
        </div>

        {/* Modal Body / Active Tab View */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: ITENS / SERVIÇOS (CENTRAL VIEW INSPIRED BY THE SCREENSHOT) */}
          {activeTab === "itens" && (
            <div className="flex flex-col gap-4">
              {/* Quick Input Bar (Código, Q F2, Descrição, Valor Unit, Qtd, Desconto, Total, + Adicionar) */}
              <div className="bg-white p-4 rounded-xl border border-[#cbd5e1] shadow-xs">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* Código com leitor de código de barras */}
                  <div className="md:col-span-3">
                    <label className="text-[11px] font-bold text-[#475569] mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Barcode size={14} className="text-[#790a0e]" />
                        Código / EAN‑13
                      </span>
                      <span className="text-[10px] text-[#94a3b8] font-mono">Bipe ou F2</span>
                    </label>
                    <div className="relative">
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={handleBarcodeKeyDown}
                        placeholder="Código, EAN ou F2..."
                        className="w-full h-10 px-3 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#1e293b] focus:bg-white focus:border-[#790a0e] focus:ring-1 focus:ring-[#790a0e] outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Botão Buscar Q (F2) + Descrição do Item Selecionado */}
                  <div className="md:col-span-4 relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-[#475569]">
                        Descrição do Item
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowProductSearchDropdown(!showProductSearchDropdown)}
                        className="text-[11px] font-bold text-[#790a0e] hover:underline flex items-center gap-1"
                      >
                        <Search size={12} />
                        <span>Localizar (F2)</span>
                      </button>
                    </div>

                    <div
                      onClick={() => setShowProductSearchDropdown(true)}
                      className={`w-full h-10 px-3 rounded-lg border flex items-center justify-between cursor-pointer text-xs transition ${
                        selectedProduct
                          ? "bg-[#fdf8f8] border-[#e2b8bb] text-[#1e293b] font-semibold"
                          : "bg-[#f8fafc] border-[#cbd5e1] text-[#94a3b8]"
                      }`}
                    >
                      <span className="truncate">
                        {selectedProduct ? selectedProduct.description : "Clique para buscar no catálogo..."}
                      </span>
                      <ChevronDown size={14} className="shrink-0 text-[#64748b]" />
                    </div>

                    {/* Dropdown de Busca de Produtos */}
                    {showProductSearchDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-[#cbd5e1] rounded-xl shadow-xl overflow-hidden max-h-72 flex flex-col">
                        <div className="p-2 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center gap-2">
                          <Search size={14} className="text-[#64748b]" />
                          <input
                            type="text"
                            value={quickSearchQuery}
                            onChange={(e) => setQuickSearchQuery(e.target.value)}
                            placeholder="Digite nome, código ou fornecedor..."
                            className="w-full text-xs bg-transparent border-0 outline-none text-[#1e293b]"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setShowProductSearchDropdown(false)}
                            className="text-[#94a3b8] hover:text-[#1e293b]"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="overflow-y-auto flex-1 divide-y divide-[#f1f5f9]">
                          {searchResults.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => handleSelectProduct(p)}
                              className="p-2.5 hover:bg-[#fdf2f2] cursor-pointer transition flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-[#1e293b] block">{p.description}</span>
                                <span className="text-[10px] text-[#64748b]">
                                  {p.supplier} · SKU: {p.code || "S/N"} · EAN: {p.barcode || "—"}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-[#790a0e] block">
                                  {money(p.price ?? p.cost ?? 0)}
                                </span>
                                <span className="text-[10px] text-[#64748b]">Estoque: {p.stock} {p.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Valor Unit */}
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-bold text-[#475569] mb-1 block">
                      Valor Unit. (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemUnitPrice || ""}
                      onChange={(e) => setItemUnitPrice(Number(e.target.value))}
                      placeholder="0,00"
                      className="w-full h-10 px-3 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#1e293b] focus:bg-white focus:border-[#790a0e] outline-none transition"
                    />
                  </div>

                  {/* Quantidade */}
                  <div className="md:col-span-1">
                    <label className="text-[11px] font-bold text-[#475569] mb-1 block">
                      Qtd
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={itemQuantity || ""}
                      onChange={(e) => setItemQuantity(Number(e.target.value))}
                      className="w-full h-10 px-2 text-center bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-bold text-[#1e293b] focus:bg-white focus:border-[#790a0e] outline-none transition"
                    />
                  </div>

                  {/* Desconto */}
                  <div className="md:col-span-1">
                    <label className="text-[11px] font-bold text-[#475569] mb-1 block">
                      Desc. (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemDiscount || ""}
                      onChange={(e) => setItemDiscount(Number(e.target.value))}
                      placeholder="0,00"
                      className="w-full h-10 px-2 text-center bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-bold text-[#1e293b] focus:bg-white focus:border-[#790a0e] outline-none transition"
                    />
                  </div>

                  {/* Botão Adicionar Item */}
                  <div className="md:col-span-1 flex gap-1">
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProduct}
                      className="w-full h-10 bg-[#790a0e] hover:bg-[#590607] text-white rounded-lg font-bold flex items-center justify-center p-0"
                      title="Adicionar item ao pedido"
                    >
                      <Plus size={18} />
                    </Button>
                  </div>
                </div>

                {/* Stock Ribbon (Exact indicators shown in the monitor photo) */}
                {selectedProduct && (
                  <div className="mt-3 pt-3 border-t border-[#e2e8f0] flex flex-wrap items-center gap-4 text-xs bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#64748b]">Unidade:</span>
                      <strong className="text-[#1e293b] uppercase">{selectedProduct.unit}</strong>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#64748b]">Estoque Atual:</span>
                      <strong className="text-emerald-700 font-bold">{selectedProduct.stock} {selectedProduct.unit}</strong>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#64748b]">Reservado:</span>
                      <strong className="text-[#64748b]">0,00</strong>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#64748b]">Disponível:</span>
                      <strong className="text-blue-700 font-bold">{selectedProduct.stock} {selectedProduct.unit}</strong>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#64748b]">Custo Médio:</span>
                      <strong className="text-[#1e293b]">{money(selectedProduct.cost ?? 0)}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[#64748b]">Total da Linha:</span>
                      <strong className="text-[#790a0e] font-mono text-sm">{money(calculatedLineTotal)}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Grid / Items Table (Like the table shown on the monitor) */}
              <div className="bg-white rounded-xl border border-[#cbd5e1] overflow-hidden shadow-xs flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f1f5f9] border-b border-[#cbd5e1] text-[#475569] font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Cód Item</th>
                        <th className="py-2.5 px-3">Cód Bar (EAN)</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Descrição</th>
                        <th className="py-2.5 px-2 text-center">Un</th>
                        <th className="py-2.5 px-3 text-right">Qtd</th>
                        <th className="py-2.5 px-3 text-right">Vlr Unit</th>
                        <th className="py-2.5 px-3 text-right">Desconto</th>
                        <th className="py-2.5 px-3 text-right">Valor Liq.</th>
                        <th className="py-2.5 px-2 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {orderItems.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-[#94a3b8]">
                            <Package size={28} className="mx-auto mb-2 opacity-50" />
                            Nenhum item inserido neste pedido. Utilize a barra acima para bipar ou pesquisar.
                          </td>
                        </tr>
                      ) : (
                        orderItems.map((item, index) => {
                          const lineGross = item.quantity * item.unitPrice;
                          const lineNet = Math.max(0, lineGross - item.discount);
                          return (
                            <tr
                              key={`${item.product.id}-${index}`}
                              className="hover:bg-[#fbfbfb] transition"
                            >
                              <td className="py-2.5 px-3 font-mono font-semibold text-[#64748b]">
                                {item.product.code || item.product.id.slice(0, 6)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[#64748b]">
                                {item.product.barcode || "—"}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-[#1e293b]">
                                <div>{item.product.description}</div>
                                <span className="text-[10px] text-[#94a3b8] font-normal">
                                  {item.product.supplier} · {item.product.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center uppercase text-[#64748b]">
                                {item.product.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-[#1e293b]">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[#475569]">
                                {money(item.unitPrice)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[#64748b]">
                                {item.discount > 0 ? money(item.discount) : "0,00"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#790a0e]">
                                {money(lineNet)}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOrderItems((prev) => prev.filter((_, i) => i !== index))
                                  }
                                  className="text-[#94a3b8] hover:text-[#b91c1c] p-1 rounded transition"
                                  title="Remover item"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Totals Ribbon (Exact totals bar from the photo) */}
                <div className="bg-[#f8fafc] border-t border-[#cbd5e1] p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Vlr Desconto:</span>
                      <strong className="font-mono text-xs">{money(totals.discount)}</strong>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Qtd Itens:</span>
                      <strong className="font-mono text-xs">{totals.totalUnits} un</strong>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Total Produtos:</span>
                      <strong className="font-mono text-xs">{money(totals.grossTotal)}</strong>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Total Serviços/Frete:</span>
                      <strong className="font-mono text-xs">R$ 0,00</strong>
                    </div>
                  </div>

                  <div className="bg-[#fdf2f2] px-4 py-1.5 rounded-lg border border-[#f5c2c5] flex items-center gap-3">
                    <span className="text-[11px] font-bold text-[#790a0e] uppercase tracking-wider">
                      TOTAL GERAL:
                    </span>
                    <strong className="text-base font-extrabold text-[#790a0e] font-mono">
                      {money(totals.netTotal)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DADOS GERAIS */}
          {activeTab === "dados" && (
            <div className="bg-white p-5 rounded-xl border border-[#cbd5e1] shadow-xs flex flex-col gap-4">
              <h3 className="text-sm font-bold text-[#1e293b] border-b pb-2">
                Parâmetros Comerciais & Origem / Destino
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#475569] mb-1 block">
                    Unidade Solicitante (Origem)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={organizationName}
                    className="w-full h-10 px-3 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-semibold text-[#1e293b]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#475569] mb-1 block">
                    Destino (Atendimento)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={destinationOrganizationName}
                    className="w-full h-10 px-3 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-semibold text-[#1e293b]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#475569] mb-1 block">
                    Operação Comercial
                  </label>
                  <select
                    value={commercialOperation}
                    onChange={(e) => setCommercialOperation(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b]"
                  >
                    <option>Transferência entre Unidades (Filial ↔ CD)</option>
                    <option>Pedido de Compra de Fornecedor</option>
                    <option>Orçamento de Balcão</option>
                    <option>Venda Direta / Faturamento</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#475569] mb-1 block">
                    Vendedor / Solicitante Responsável
                  </label>
                  <input
                    type="text"
                    value={salesperson}
                    onChange={(e) => setSalesperson(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#475569] mb-1 block">
                  Observações Gerais do Pedido
                </label>
                <textarea
                  rows={3}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Informações adicionais para conferência, separação ou observações fiscais..."
                  className="w-full p-3 bg-white border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b]"
                />
              </div>
            </div>
          )}

          {/* TAB 3: TRANSPORTE */}
          {activeTab === "transporte" && (
            <div className="bg-white p-5 rounded-xl border border-[#cbd5e1] shadow-xs flex flex-col gap-4">
              <h3 className="text-sm font-bold text-[#1e293b] border-b pb-2">
                Logística, Frete & Despacho
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#475569] mb-1 block">
                    Modalidade de Transporte
                  </label>
                  <select
                    value={carrierType}
                    onChange={(e) => setCarrierType(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b]"
                  >
                    <option>Frota Própria CDM (Transferência Rota 1)</option>
                    <option>Retirada Direta no CD</option>
                    <option>Transportadora Terceirizada</option>
                    <option>Entrega Expressa / Motoboy</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#475569] mb-1 block">
                    Previsão de Recebimento
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#475569] mb-1 block">
                  Instruções para Expedição & Motorista
                </label>
                <textarea
                  rows={3}
                  value={transportNotes}
                  onChange={(e) => setTransportNotes(e.target.value)}
                  placeholder="Ex: Entregar pela portaria lateral; conferir volumes lacrados..."
                  className="w-full p-3 bg-white border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b]"
                />
              </div>
            </div>
          )}

          {/* TAB 4: FATURAMENTO */}
          {activeTab === "faturamento" && (
            <div className="bg-white p-5 rounded-xl border border-[#cbd5e1] shadow-xs flex flex-col gap-4">
              <h3 className="text-sm font-bold text-[#1e293b] border-b pb-2">
                Condições de Faturamento & Tabela
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#475569] mb-1 block">
                    Condição de Pagamento / Repasse
                  </label>
                  <select
                    value={paymentCondition}
                    onChange={(e) => setPaymentCondition(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b]"
                  >
                    <option>Transferência Interna (Sem Débito Comercial)</option>
                    <option>À Vista (TED / PIX)</option>
                    <option>Faturado 30 dias</option>
                    <option>Faturado 30/60/90 dias</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#475569] mb-1 block">
                    Tabela de Preço Aplicada
                  </label>
                  <select
                    value={priceTable}
                    onChange={(e) => setPriceTable(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#cbd5e1] rounded-lg text-xs text-[#1e293b]"
                  >
                    <option>Tabela Padrão (Custo Filial)</option>
                    <option>Tabela Venda Varejo</option>
                    <option>Tabela Atacado / Obras</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] text-xs text-[#475569]">
                <strong className="block mb-1 text-[#1e293b]">Resumo Fiscal do Pedido:</strong>
                O pedido será gerado com número de controle interno <b>{orderNumber}</b>. Após faturamento pelo Centro de Distribuição, o documento de transferência acompanha o manifesto de carga e romaneio de expedição.
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar (Identical to the footer in the photo: + Novo, Imprimir, Salvar, Faturar, Fechar) */}
        <div className="bg-[#e9edf2] px-5 py-3 border-t border-[#cbd5e1] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOrderItems([]);
                setSelectedProduct(null);
                setBarcodeInput("");
                toast.info("Campos resetados para novo pedido.");
              }}
              className="text-xs bg-white hover:bg-slate-50 border-[#cbd5e1] text-[#334155]"
            >
              <Plus size={14} className="mr-1" />
              Novo Item
            </Button>

            {onExportPdf && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onExportPdf}
                className="text-xs bg-white hover:bg-slate-50 border-[#cbd5e1] text-[#334155]"
              >
                <Printer size={14} className="mr-1" />
                Imprimir Pedido
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => handleSave("Rascunho")}
              className="text-xs bg-white hover:bg-slate-50 border-[#cbd5e1] text-[#334155] font-semibold"
            >
              <Save size={14} className="mr-1" />
              Salvar Rascunho
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={saving || orderItems.length === 0}
              onClick={() => handleSave("Finalizado")}
              className="text-xs bg-[#790a0e] hover:bg-[#590607] text-white font-bold shadow-sm"
            >
              <CheckCircle2 size={14} className="mr-1" />
              {saving ? "Processando..." : "Faturar & Enviar ao CD"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs text-[#64748b] hover:text-[#1e293b]"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
