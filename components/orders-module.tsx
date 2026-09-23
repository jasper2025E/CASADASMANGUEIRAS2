"use client";

import React, { useState, useMemo, useCallback } from "react";
import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
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
  filtered,
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
}: OrdersModuleProps) {
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);

  const handleSetOrderTab = React.useCallback(setOrderTab, [setOrderTab]);
  const handleSetSupplier = React.useCallback(setSupplier, [setSupplier]);
  const handleSetCategory = React.useCallback(setCategory, [setCategory]);
  const handleSetQuantity = React.useCallback(setQuantity, [setQuantity]);
  const handleSetOnlySelected = React.useCallback(setOnlySelected, [setOnlySelected]);
  const handleSaveOrder = React.useCallback(saveOrder, [saveOrder]);
  const handleExportPdf = React.useCallback(exportPdf, [exportPdf]);
  const handleExportXlsx = React.useCallback(exportXlsx, [exportXlsx]);
  const handleSetProductModal = React.useCallback(setProductModal, [setProductModal]);
  const handleSetProductModalTab = React.useCallback(setProductModalTab, [setProductModalTab]);
  const handleRemoveOrder = React.useCallback(removeOrder, [removeOrder]);
  const handleRepeatOrder = React.useCallback(repeatOrder, [repeatOrder]);
  const handleUpdateOrderStage = React.useCallback(updateOrderStage, [updateOrderStage]);
  const handleSetSelectedOrderForModal = React.useCallback(setSelectedOrderForModal, [setSelectedOrderForModal]);

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

          <div className="supplier-selector">
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
                }}
              >
                <option>Todos</option>{suppliers.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <ChevronDown size={15} />
            </div>
            <Badge variant="secondary">
              {products.filter((p) => supplier === "Todos" || p.supplier === supplier).length.toLocaleString("pt-BR")} produtos
            </Badge>
          </div>

          <div className="order-layout">
            <div className="catalog-card">
              <div className="catalog-toolbar">
                <div>
                  <h2>{supplier === "Todos" ? "Todos os produtos" : `Produtos de ${supplier}`}</h2>
                  <span>{filtered.length} produtos encontrados</span>
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
                {filtered.map((product) => {
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
                            <span>{product.code || product.category}</span>
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
                          <strong>{product.description}</strong>
                          <span>
                            {product.category} · unidade: {product.unit}
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

      {/* LAYER 2: HISTÓRICO & ATENDIMENTO (RASTREAMENTO) */}
      {orderTab === "history" && (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">REGISTROS & RASTREAMENTO</span>
              <h1>Histórico de pedidos</h1>
              <p>
                Acompanhe recebimento, aprovação, separação, despacho e entrega pelo Centro de Distribuição.
              </p>
            </div>
            <div className="heading-actions">
              <Button onClick={() => setOrderTab("compose")}>
                <PlusCircle size={16} /> Novo pedido
              </Button>
            </div>
          </div>

          <div className="panel table-panel">
            <div className="history-head">
              <span>Pedido</span>
              <span>Origem / destino</span>
              <span>Data</span>
              <span>Itens</span>
              <span>Atendimento (Etapa)</span>
              <span>Ações</span>
            </div>

            {orders.length ? (
              orders.map((order) => {
                const currentStage = normalizeFulfillmentStage(
                  order.fulfillmentStage,
                  order.status
                );
                return (
                  <div className="history-row" key={order.dbId || order.id}>
                    <strong>{order.id}</strong>
                    <span>{order.originOrganizationName || "Filial"} → {order.destinationOrganizationName || "Centro de Distribuição"}</span>
                    <span>{new Date(order.createdAt).toLocaleString("pt-BR")}</span>
                    <span>{order.items.length} itens</span>

                    {/* Progress indicator for order fulfillment stages */}
                    <div className="fulfillment-cell">
                      <OrderProgressStepper
                        stage={currentStage}
                        onSelectStage={(newStage) =>
                          updateOrderStage(order.id, newStage)
                        }
                        interactive={canManage}
                      />
                    </div>

                    <div className="row-actions">
                      <button
                        onClick={() => setSelectedOrderForModal(order)}
                        title="Ver detalhes e etapas"
                      >
                        <Eye size={16} />
                      </button>
                      {canManage && <button
                        onClick={() => {
                          repeatOrder(order);
                          setOrderTab("compose");
                        }}
                        title="Repetir pedido no carrinho"
                      >
                        <RotateCcw size={16} />
                      </button>}
                      <button
                        className="danger"
                        onClick={() => void removeOrder(order)}
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-panel tall">
                <Archive />
                <strong>Histórico vazio</strong>
                <span>
                  Salve um rascunho ou finalize um pedido na aba &quot;Montar Pedido&quot;.
                </span>
                {canCreate && <Button
                  variant="outline"
                  onClick={() => setOrderTab("compose")}
                  className="mt-3"
                >
                  Ir para Montar Pedido
                </Button>}
              </div>
            )}
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
