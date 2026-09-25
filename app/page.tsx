"use client";

import { useEffect, useMemo, useState } from "react";
import { Barcode, Boxes, ChevronDown, ClipboardCheck, FileSpreadsheet, LayoutDashboard, Menu, PackagePlus, Plus, RotateCcw, Search, Settings, ShoppingCart, Upload, Zap, LayoutGrid, Table, LogOut } from "lucide-react";
import productsSeed from "@/lib/initial-products.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast, Toaster } from "sonner";
import { BalanceModule } from "@/components/balance-module";
import { AuthScreen } from "@/components/auth-screen";
import { SettingsModule } from "@/components/settings-module";
import { ProductBarcode } from "@/components/product-barcode";
import { normalizeFulfillmentStage, FULFILLMENT_STAGES, type FulfillmentStage } from "@/components/order-progress";
import { GlobalSystemDashboard } from "@/components/global-system-dashboard";
import { OrdersModule, type OrderSubTab } from "@/components/orders-module";
import { ErpOrderModal } from "@/components/erp-order-modal";
import { ErpSidebar } from "@/components/erp-sidebar";
import { supabase } from "@/lib/supabase";
import { can, type PermissionKey, type UserAccess } from "@/lib/access";
import type { User } from "@supabase/supabase-js";

export type { FulfillmentStage };
export type Product = { id: string; supplier: string; brand: string; code: string; description: string; category: string; unit: string; stock: number; suggested: number; image: string | null; sourceRow: number; cost?: number | null; price?: number | null; ncm?: string; barcode?: string };
export type Order = {
  id: string;
  dbId?: string;
  supplier: string;
  createdAt: string;
  status: "Rascunho" | "Finalizado";
  fulfillmentStage?: FulfillmentStage | "Pending" | "Processing" | "Shipped" | "Delivered";
  originOrganizationId?: string;
  destinationOrganizationId?: string;
  originOrganizationName?: string;
  destinationOrganizationName?: string;
  reviewMessage?: string;
  items: Array<Product & { quantity: number }>;
};
type ImportPreview = { fileName: string; rows: number; duplicates: number; invalid: number; products: Product[] };

const navItems = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard, permission: "dashboard.view" as PermissionKey },
  { id: "order", label: "Pedidos", icon: ShoppingCart, permission: "orders.view" as PermissionKey },
  { id: "products", label: "Produtos", icon: Boxes, permission: "products.view" as PermissionKey },
  { id: "balance", label: "Balanço de estoque", icon: ClipboardCheck, permission: "inventory.view" as PermissionKey },
  { id: "settings", label: "Usuários e acessos", icon: Settings, permission: null },
];

const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().toUpperCase();
const productKey = (product: Pick<Product, "code" | "description" | "supplier">) => product.code ? `COD:${normalize(product.code)}` : `DESC:${normalize(product.description)}|${normalize(product.supplier)}`;
const fromCloudProduct = (product: Record<string, unknown>): Product => ({ id:String(product.id),code:String(product.code||""),description:String(product.description||""),brand:String(product.brand||""),supplier:String(product.supplier||""),category:String(product.category||"Diversos"),unit:String(product.unit||"un"),stock:Number(product.stock)||0,suggested:0,image:product.image_url ? String(product.image_url) : null,sourceRow:0,cost:product.cost===null?null:Number(product.cost),price:product.price===null?null:Number(product.price),ncm:String(product.ncm||""),barcode:String(product.barcode||"") });

function openCatalogDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) return reject(new Error("No IndexedDB"));
    const timer = setTimeout(() => reject(new Error("IndexedDB timeout")), 800);
    const request = indexedDB.open("central-pedido", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("catalog");
    request.onsuccess = () => { clearTimeout(timer); resolve(request.result); };
    request.onerror = () => { clearTimeout(timer); reject(request.error); };
  });
}
async function loadCatalog(): Promise<Product[] | null> {
  try {
    const db = await openCatalogDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("catalog", "readonly");
      const req = tx.objectStore("catalog").get("products");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
async function persistCatalog(products: Product[]) {
  try {
    const db = await openCatalogDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("catalog", "readwrite");
      tx.objectStore("catalog").put(products, "products");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IndexedDB write failure on restricted browsers
  }
}

export default function Home() {
  const [view, setView] = useState("dashboard");
  const [orderTab, setOrderTab] = useState<OrderSubTab>("compose");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>(productsSeed as Product[]);
  const [supplier, setSupplier] = useState("Todos");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("pedido-central-orders") || "[]") as Order[]; } catch { return []; }
  });
  const [onlySelected, setOnlySelected] = useState(false);
  const [productModal, setProductModal] = useState<Product | null>(null);
  const [productModalTab, setProductModalTab] = useState<"dados" | "codigo">("dados");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("Organização");
  const [destinationOrganizationId, setDestinationOrganizationId] = useState<string | null>(null);
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [cloudStatus, setCloudStatus] = useState("Conectando ao banco...");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [savingOrder, setSavingOrder] = useState(false);
  const [erpModalOpen, setErpModalOpen] = useState(false);
  const [erpModalInitialOrder, setErpModalInitialOrder] = useState<Order | null>(null);

  // Shortcut F3 listener to quickly open the ERP Order Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        e.preventDefault();
        setErpModalInitialOrder(null);
        setErpModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSaveErpOrder(
    status: "Rascunho" | "Finalizado",
    orderData: {
      items: Array<Product & { quantity: number; discount?: number; unitPrice?: number }>;
      supplier: string;
      notes?: string;
      orderType?: string;
      transportType?: string;
      paymentTerm?: string;
    }
  ) {
    if (!can(access, "orders.create")) return void toast.error("Seu perfil não pode criar pedidos.");
    if (!orderData.items.length) return void toast.error("Adicione pelo menos um produto ao pedido.");

    const order: Order = {
      id: erpModalInitialOrder?.id || `PED-${String(Date.now()).slice(-6)}`,
      supplier: orderData.supplier || (Array.from(new Set(orderData.items.map((i) => i.supplier))).length === 1 ? orderData.items[0].supplier : "Vários fornecedores"),
      createdAt: new Date().toISOString(),
      status,
      fulfillmentStage: status === "Finalizado" ? "submitted" : "draft",
      originOrganizationId: organizationId || undefined,
      destinationOrganizationId: destinationOrganizationId || undefined,
      originOrganizationName: organizationName,
      destinationOrganizationName: "Centro de Distribuição",
      reviewMessage: orderData.notes,
      items: orderData.items.map((i) => ({ ...i, quantity: i.quantity })),
    };

    try {
      if (organizationId && destinationOrganizationId && user) {
        const { data: saved, error } = await supabase.from("purchase_orders").insert({
          organization_id: organizationId,
          destination_organization_id: destinationOrganizationId,
          order_number: order.id,
          supplier: order.supplier,
          status,
          distribution_status: status === "Finalizado" ? "submitted" : "draft",
          created_by: user.id,
        }).select("id").single();
        if (error || !saved) throw error || new Error("Erro ao salvar pedido no banco");
        order.dbId = saved.id;
        const { error: itemError } = await supabase.from("purchase_order_items").insert(
          orderData.items.map((item) => ({
            order_id: saved.id,
            product_id: item.id,
            quantity: item.quantity,
            unit: item.unit,
          }))
        );
        if (itemError) {
          await supabase.from("purchase_orders").delete().eq("id", saved.id);
          throw itemError;
        }
      }

      const updated = [order, ...orders.filter((o) => o.id !== order.id)];
      setOrders(updated);
      localStorage.setItem("pedido-central-orders", JSON.stringify(updated));
      toast.success(status === "Finalizado" ? "Pedido emitido com sucesso!" : "Rascunho de pedido salvo.");
    } catch {
      toast.error("Não foi possível salvar o pedido. Tente novamente.");
    }
  }

  function handleDirectAccess() {
    const localUser = {
      id: "operador-cdm",
      email: "operador@casadasmangueiras.com",
      user_metadata: { name: "Operador CDM" },
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as unknown as User;
    if (typeof window !== "undefined") {
      localStorage.setItem("cdm-quick-access", "true");
    }
    setUser(localUser);
    setAccess({
      role: "SUPER_ADMIN",
      permissions: [
        "dashboard.view",
        "orders.view",
        "orders.create",
        "orders.edit",
        "orders.finalize",
        "orders.delete",
        "products.view",
        "products.create",
        "products.edit",
        "products.delete",
        "inventory.view",
        "inventory.count",
        "inventory.reconcile",
        "reports.view",
        "settings.view",
        "users.manage",
      ],
      active: true,
    });
    setOrganizationId("cdm-matriz");
    setDestinationOrganizationId("cdm-cd");
    setOrganizationName("Casa das Mangueiras - Matriz");
    setCloudStatus("Modo Operador Ativo");
    setAuthLoading(false);
  }

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("cdm-quick-access") === "true") {
      setTimeout(() => {
        handleDirectAccess();
      }, 0);
      return;
    }

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) setAuthLoading(false);
    }, 600);

    void supabase.auth.getSession().then(({ data }) => {
      resolved = true;
      clearTimeout(timeout);
      if (data.session?.user) {
        setUser(data.session.user);
      }
      setAuthLoading(false);
    }).catch(() => {
      resolved = true;
      clearTimeout(timeout);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      }
      setAuthLoading(false);
    });
    return () => {
      clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.id === "operador-cdm") {
      setTimeout(() => {
        setCloudStatus("Modo Operador Conectado");
      }, 0);
      return;
    }
    let cancelled = false;
    async function connectCloud() {
      setOrganizationId(null);
      setCloudStatus("Sincronizando dados...");
      const { data: memberships, error: membershipError } = await supabase.from("organization_members").select("organization_id,role,permissions,active").eq("user_id", user!.id);
      if (membershipError) { console.error("Falha ao carregar organizações", membershipError); setCloudStatus("Falha na sincronização"); return; }
      const preferredId = localStorage.getItem("central-active-organization");
      const activeMemberships = (memberships || []).filter((item) => item.active);
      let selectedMembership = activeMemberships.find((item) => item.organization_id === preferredId) || activeMemberships[0];
      let orgId = selectedMembership?.organization_id as string | undefined;
      if (!orgId && memberships?.length) {
        setAccess({ role: memberships[0].role, permissions: memberships[0].permissions || [], active: false });
        setCloudStatus("Acesso suspenso pelo administrador");
        return;
      }
      if (!orgId) {
        const { data: existingOrganization } = await supabase.from("organizations").select("id").eq("created_by", user!.id).limit(1).maybeSingle();
        let organization = existingOrganization;
        if (!organization) {
          const result = await supabase.from("organizations").insert({ name: "Casa das Mangueiras", created_by: user!.id }).select("id").single();
          if (result.error) { setCloudStatus("Falha ao criar a organização"); return; }
          organization = result.data;
        }
        orgId = organization.id;
        const { error: memberError } = await supabase.from("organization_members").insert({ organization_id: orgId, user_id: user!.id, role: "support" });
        if (memberError && memberError.code !== "23505") { setCloudStatus("Falha ao autorizar o administrador"); return; }
        selectedMembership = { organization_id: orgId, role: "support", permissions: [], active: true };
        const { count } = await supabase.from("inventory_sectors").select("id", { count:"exact", head:true }).eq("organization_id", orgId);
        if (!count) await supabase.from("inventory_sectors").insert([
          { organization_id:orgId, name:"Loja / Salão", location:"Área de vendas", owner_name:"", status:"Não iniciado", notes:"" },
          { organization_id:orgId, name:"Depósito", location:"Estoque interno", owner_name:"", status:"Não iniciado", notes:"" },
          { organization_id:orgId, name:"Área externa", location:"Pátio", owner_name:"", status:"Não iniciado", notes:"" },
        ]);
      }
      if (!orgId || cancelled) return;
      localStorage.setItem("central-active-organization", orgId);
      setOrganizationId(orgId);
      const resolvedAccess: UserAccess = {
        role: selectedMembership!.role,
        permissions: selectedMembership!.permissions || [],
        active: selectedMembership!.active,
      };
      setAccess(resolvedAccess);
      const { data: organization } = await supabase.from("organizations").select("name,organization_type,parent_organization_id").eq("id", orgId).single();
      setOrganizationName(organization?.name || "Organização");
      setDestinationOrganizationId(organization?.parent_organization_id || orgId);
      const cloudProducts: Product[] = []; let from = 0;
      let pageCount = 0;
      while (pageCount < 10) {
        pageCount++;
        const { data, error } = await supabase.from("products").select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,barcode,image_url").eq("organization_id", orgId).range(from, from + 999);
        if (error) { setCloudStatus("Falha ao carregar produtos"); return; }
        if (data?.length) {
          cloudProducts.push(...data.map((product) => fromCloudProduct(product)));
        }
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      if (!cloudProducts.length) {
        setCloudStatus("Enviando catálogo inicial...");
        for (let index = 0; index < productsSeed.length; index += 400) {
          const batch = (productsSeed as Product[]).slice(index,index+400).map((p)=>({organization_id:orgId,code:p.code||null,description:p.description,brand:p.brand||"",supplier:p.supplier,category:p.category,unit:p.unit,stock:p.stock,cost:p.cost??null,price:p.price??null,ncm:p.ncm||null,image_url:p.image||null,created_by:user!.id}));
          const { data, error } = await supabase.from("products").upsert(batch,{onConflict:"organization_id,product_key",ignoreDuplicates:true}).select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,barcode,image_url");
          if (error) { setCloudStatus("Falha ao enviar o catálogo"); return; }
          cloudProducts.push(...(data || []).map((product) => fromCloudProduct(product)));
        }
      }
      const { data: orderRows, error: ordersError } = await supabase.from("purchase_orders").select("id,organization_id,destination_organization_id,order_number,supplier,status,distribution_status,review_message,created_at,purchase_order_items(quantity,unit,products(id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,barcode,image_url))").or(`organization_id.eq.${orgId},destination_organization_id.eq.${orgId}`).order("created_at", { ascending:false }).limit(250);
      if (ordersError) { setCloudStatus("Produtos sincronizados; falha no histórico"); return; }
      const cloudOrders: Order[] = (orderRows || []).map((row) => ({
        id: row.order_number,
        dbId: row.id,
        supplier: row.supplier,
        createdAt: row.created_at,
        status: row.status as Order["status"],
        fulfillmentStage: normalizeFulfillmentStage(row.distribution_status, row.status),
        originOrganizationId: row.organization_id,
        destinationOrganizationId: row.destination_organization_id,
        originOrganizationName: row.organization_id === orgId ? (organization?.name || "Filial") : "Filial solicitante",
        destinationOrganizationName: "Centro de Distribuição",
        reviewMessage: row.review_message,
        items: (row.purchase_order_items || []).flatMap((item) =>
          item.products
            ? [{ ...fromCloudProduct(item.products as unknown as Record<string, unknown>), quantity: Number(item.quantity) }]
            : []
        ),
      }));
      if (!cancelled) {
        setProducts(cloudProducts);
        setOrders(cloudOrders);
        localStorage.setItem("pedido-central-orders", JSON.stringify(cloudOrders));
        await persistCatalog(cloudProducts);
        setCloudStatus("Dados sincronizados");
      }
    }
    void connectCloud(); return () => { cancelled = true; };
  }, [user, syncAttempt]);

  useEffect(() => {
    void loadCatalog().then((catalog) => { if (catalog?.length) setProducts(catalog); });
  }, []);

  useEffect(() => {
    const context = (document as unknown as { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "search_products",
      title: "Pesquisar produtos",
      description: "Pesquisa produtos cadastrados por código, descrição ou fornecedor.",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input: unknown) {
        const query = String((input as { query?: string }).query || "").toLocaleLowerCase("pt-BR");
        return products.filter((p) => `${p.code} ${p.description} ${p.supplier}`.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 20).map(({ id, code, description, supplier, unit, stock }) => ({ id, code, description, supplier, unit, stock }));
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [products]);

  const suppliers = useMemo(() => Array.from(new Set(products.map((p) => p.supplier))), [products]);
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(products.filter((p) => supplier === "Todos" || p.supplier === supplier).map((p) => p.category)))], [products, supplier]);
  const filtered = useMemo(() => [] as Product[], []);
  const selectedItems = useMemo(() => products.filter((p) => (quantities[p.id] || 0) > 0).map((p) => ({ ...p, quantity: quantities[p.id] })), [products, quantities]);
  const totalUnits = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const visibleNavItems = useMemo(() => navItems.filter((item) => !item.permission || can(access, item.permission)), [access]);

  function setQuantity(id: string, value: number) { setQuantities((current) => ({ ...current, [id]: Math.max(0, Number.isFinite(value) ? value : 0) })); }
  async function saveOrder(status: Order["status"]) {
    if (!can(access, "orders.create")) return void toast.error("Seu perfil não pode criar pedidos.");
    if (!selectedItems.length) return void toast.error("Adicione pelo menos um produto ao pedido.");
    if (savingOrder) return;
    setSavingOrder(true);
    const order: Order = {
      id: `PED-${String(Date.now()).slice(-6)}`,
      supplier: Array.from(new Set(selectedItems.map((item)=>item.supplier))).length === 1 ? selectedItems[0].supplier : "Vários fornecedores",
      createdAt: new Date().toISOString(),
      status,
      fulfillmentStage: status === "Finalizado" ? "submitted" : "draft",
      originOrganizationId: organizationId || undefined,
      destinationOrganizationId: destinationOrganizationId || undefined,
      originOrganizationName: organizationName,
      destinationOrganizationName: "Centro de Distribuição",
      items: selectedItems,
    };
    try {
      if (organizationId && destinationOrganizationId && user) {
        const { data: saved, error } = await supabase.from("purchase_orders").insert({ organization_id:organizationId, destination_organization_id:destinationOrganizationId, order_number:order.id, supplier:order.supplier, status, distribution_status: status === "Finalizado" ? "submitted" : "draft", created_by:user.id }).select("id").single();
        if (error || !saved) throw error || new Error("Pedido não retornado pelo banco");
        order.dbId = saved.id;
        const { error: itemError } = await supabase.from("purchase_order_items").insert(selectedItems.map((item)=>({order_id:saved.id,product_id:item.id,quantity:item.quantity,unit:item.unit})));
        if (itemError) { await supabase.from("purchase_orders").delete().eq("id", saved.id); throw itemError; }
      }
      const updated = [order, ...orders];
      setOrders(updated); localStorage.setItem("pedido-central-orders", JSON.stringify(updated));
      toast.success(status === "Finalizado" ? "Pedido enviado ao Centro de Distribuição." : "Rascunho salvo.");
      if (status === "Finalizado") {
        setQuantities({});
        setOrderTab("history");
      }
    } catch {
      toast.error("Não foi possível salvar o pedido. A seleção foi preservada.");
    } finally {
      setSavingOrder(false);
    }
  }
  async function exportXlsx() {
    if (!can(access, "orders.export")) return void toast.error("Seu perfil não pode exportar pedidos.");
    if (!selectedItems.length) return void toast.error("Não há itens para exportar.");
    const XLSX = await import("xlsx");
    const rows = selectedItems.map((i) => ({ Fornecedor: i.supplier, Código: i.code, Produto: i.description, Categoria: i.category, Estoque: i.stock, Quantidade: i.quantity, Unidade: i.unit }));
    const sheet = XLSX.utils.json_to_sheet(rows); sheet["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 58 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Pedido"); XLSX.writeFile(book, `pedido-${new Date().toISOString().slice(0, 10)}.xlsx`); toast.success("Planilha XLSX baixada.");
  }
  async function exportPdf() {
    if (!can(access, "orders.export")) return void toast.error("Seu perfil não pode exportar pedidos.");
    if (!selectedItems.length) return void toast.error("Não há itens para exportar.");
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" }); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("CDM — Pedido de compra", 14, 16); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Casa das Mangueiras · Emitido em ${new Date().toLocaleString("pt-BR")}`, 14, 22);
    let y = 31; doc.setFillColor(20, 46, 74); doc.rect(14, y - 5, 269, 8, "F"); doc.setTextColor(255, 255, 255); doc.text("FORNECEDOR", 16, y); doc.text("CÓDIGO", 52, y); doc.text("PRODUTO", 82, y); doc.text("ESTOQUE", 232, y); doc.text("PEDIDO", 258, y); y += 8; doc.setTextColor(30, 41, 59);
    selectedItems.forEach((i, index) => { if (y > 190) { doc.addPage(); y = 16; } if (index % 2 === 0) { doc.setFillColor(244, 247, 250); doc.rect(14, y - 5, 269, 8, "F"); } doc.text(i.supplier.slice(0, 18), 16, y); doc.text((i.code || "—").slice(0, 15), 52, y); doc.text(i.description.slice(0, 72), 82, y); doc.text(`${i.stock} ${i.unit}`, 232, y); doc.setFont("helvetica", "bold"); doc.text(`${i.quantity} ${i.unit}`, 258, y); doc.setFont("helvetica", "normal"); y += 8; });
    doc.save(`pedido-${new Date().toISOString().slice(0, 10)}.pdf`); toast.success("PDF baixado.");
  }
  async function saveProduct(product: Product) {
    const requiredPermission = creatingProduct ? "products.create" : "products.edit";
    if (!can(access, requiredPermission)) return void toast.error("Seu perfil não pode salvar produtos.");
    if (!product.description.trim() || !product.supplier.trim()) return void toast.error("Descrição e fornecedor são obrigatórios.");
    const payload = { code:product.code||null,description:product.description.trim(),brand:product.brand.trim(),supplier:product.supplier.trim(),category:product.category.trim()||"Diversos",unit:product.unit.trim()||"un",stock:product.stock,cost:product.cost??null,price:product.price??null,ncm:product.ncm||null,barcode:product.barcode||null,image_url:product.image };
    try {
      let savedProduct = product;
      if (organizationId) {
        if (creatingProduct) {
          const { data, error } = await supabase.from("products").insert({ ...payload, organization_id:organizationId, created_by:user?.id }).select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,barcode,image_url").single();
          if (error || !data) throw error || new Error("Produto não retornado");
          savedProduct = fromCloudProduct(data);
        } else {
          const { data, error } = await supabase.from("products").update(payload).eq("id",product.id).eq("organization_id",organizationId).select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,barcode,image_url").single();
          if (error || !data) throw error || new Error("Produto não atualizado");
          savedProduct = fromCloudProduct(data);
        }
      }
      const updated = creatingProduct ? [savedProduct, ...products] : products.map((item) => item.id === savedProduct.id ? savedProduct : item);
      setProducts(updated); await persistCatalog(updated); setProductModal(null); setCreatingProduct(false);
      toast.success(creatingProduct ? "Produto cadastrado." : "Produto atualizado.");
    } catch { toast.error("Não foi possível salvar o produto. Verifique se o código já existe."); }
  }
  async function inspectImport(file?: File) {
    if (!can(access, "products.import")) return void toast.error("Seu perfil não pode importar produtos.");
    if (!file) return;
    setImporting(true); setImportPreview(null);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: "" });
      const existing = new Set(products.map(productKey)); const inFile = new Set<string>(); const imported: Product[] = [];
      let duplicates = 0, invalid = 0;
      const field = (row: Record<string, unknown>, names: string[]) => { const key = Object.keys(row).find((candidate) => names.includes(normalize(candidate))); return key ? row[key] : ""; };
      raw.forEach((row, index) => {
        const description = String(field(row, ["DESCRICAO", "PRODUTO", "NOME", "ITEM"])).trim();
        const code = String(field(row, ["AUXILIAR", "CODIGO", "COD", "SKU", "REFERENCIA"])).trim();
        const supplierName = String(field(row, ["FORNECEDOR", "FABRICANTE"])).trim() || "Fornecedor não informado";
        if (!description) { invalid++; return; }
        const candidate: Product = { id: `importado-${Date.now()}-${index}`, supplier: supplierName, brand: String(field(row, ["MARCA", "APELIDO"])).trim() || supplierName, code, description, category: String(field(row, ["CATEGORIA", "GRUPO"])).trim() || "Diversos", unit: String(field(row, ["UNIDADE", "UND", "UN"])).trim() || "un", stock: Number(field(row, ["ESTOQUE", "SALDO"])) || 0, suggested: 0, image: null, sourceRow: index + 2, cost: Number(field(row, ["PR CUSTO", "PRECO CUSTO", "CUSTO"])) || null, price: Number(field(row, ["VALOR VENDA AVISTA", "PRECO VENDA", "VENDA"])) || null, ncm: String(field(row, ["NCM"])).trim() };
        const key = productKey(candidate);
        if (existing.has(key) || inFile.has(key)) { duplicates++; return; }
        inFile.add(key); imported.push(candidate);
      });
      setImportPreview({ fileName: file.name, rows: raw.length, duplicates, invalid, products: imported });
    } catch { toast.error("Não foi possível ler a planilha. Use um arquivo XLSX, XLS ou CSV válido."); }
    finally { setImporting(false); }
  }
  async function confirmImport() {
    if (!can(access, "products.import")) return void toast.error("Seu perfil não pode importar produtos.");
    if (!importPreview?.products.length) return;
    setImporting(true);
    try {
      const persisted: Product[] = [];
      if (organizationId && user) {
        for(let index=0;index<importPreview.products.length;index+=300){
          const batch=importPreview.products.slice(index,index+300).map((p)=>({organization_id:organizationId,code:p.code||null,description:p.description,brand:p.brand,supplier:p.supplier,category:p.category,unit:p.unit,stock:p.stock,cost:p.cost??null,price:p.price??null,ncm:p.ncm||null,image_url:p.image,created_by:user.id}));
          const {data,error}=await supabase.from("products").upsert(batch,{onConflict:"organization_id,product_key",ignoreDuplicates:true}).select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,image_url");
          if(error) throw error;
          persisted.push(...(data||[]).map((item)=>fromCloudProduct(item)));
        }
      } else persisted.push(...importPreview.products);
      const updated = [...products, ...persisted]; setProducts(updated); await persistCatalog(updated);
      toast.success(`${persisted.length.toLocaleString("pt-BR")} produtos importados sem duplicidade.`); setImportOpen(false); setImportPreview(null);
    } catch { toast.error("Não foi possível concluir a importação. O catálogo anterior foi preservado."); }
    finally { setImporting(false); }
  }

  function createProduct() {
    if (!can(access, "products.create")) return void toast.error("Seu perfil não pode cadastrar produtos.");
    setCreatingProduct(true);
    setProductModalTab("dados");
    setProductModal({ id:`new-${Date.now()}`,supplier:supplier === "Todos" ? "" : supplier,brand:"",code:"",description:"",category:"Diversos",unit:"un",stock:0,suggested:0,image:null,sourceRow:0,cost:null,price:null,ncm:"",barcode:"" });
  }

  function repeatOrder(order: Order) {
    if (!can(access, "orders.create")) return void toast.error("Seu perfil não pode criar pedidos.");
    setQuantities(Object.fromEntries(order.items.map((item) => [item.id, item.quantity])));
    if (order.items[0]?.supplier) setSupplier(order.items[0].supplier);
    setView("order");
    setOrderTab("compose");
    toast.success("Itens carregados em um novo pedido.");
  }

  async function removeOrder(order: Order) {
    if (!can(access, "orders.manage")) return void toast.error("Seu perfil não pode excluir pedidos.");
    if (!confirm(`Excluir o pedido ${order.id}?`)) return;
    if (order.dbId && organizationId) {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", order.dbId).eq("organization_id", organizationId);
      if (error) return void toast.error("Não foi possível excluir o pedido.");
    }
    const updated = orders.filter((item) => item.id !== order.id);
    setOrders(updated); localStorage.setItem("pedido-central-orders", JSON.stringify(updated));
    toast.success("Pedido excluído.");
  }

  async function updateOrderStage(orderId: string, stage: FulfillmentStage) {
    if (!can(access, "orders.manage")) return void toast.error("Seu perfil não pode alterar etapas.");
    const target = orders.find((o) => o.id === orderId);
    if (!target?.dbId) return;
    const message = stage === "rejected" ? window.prompt("Informe o motivo da rejeição para a filial:")?.trim() || "" : "";
    if (stage === "rejected" && message.length < 3) return void toast.error("Informe o motivo da rejeição.");
    const { error } = await supabase.rpc("transition_distribution_order", { p_order_id:target.dbId, p_status:stage, p_message:message });
    if (error) return void toast.error(error.message.includes("Transição") ? "Siga a próxima etapa do fluxo; não é possível pular etapas." : error.message);
    const updated = orders.map((o) => (o.id === orderId ? { ...o, fulfillmentStage: stage, reviewMessage: message || o.reviewMessage } : o));
    setOrders(updated); localStorage.setItem("pedido-central-orders", JSON.stringify(updated));
    const stageInfo = FULFILLMENT_STAGES.find((s) => s.key === stage);
    toast.success(`Pedido atualizado: ${stageInfo?.label || stage}.`);
  }

  if (authLoading) return <main className="auth-page"><div className="auth-loading">Carregando sistema...</div></main>;
  if (!user) return <AuthScreen onDirectAccess={handleDirectAccess} />;

  const handleSignOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("cdm-quick-access");
    }
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
  };

  return <div className="app-shell">
    <Toaster richColors position="top-right" />
    <ErpSidebar
      currentView={view}
      onNavigate={(targetView) => {
        setView(targetView);
      }}
      onOpenErpOrderModal={() => {
        setErpModalInitialOrder(null);
        setErpModalOpen(true);
      }}
      onOpenImport={() => setImportOpen(true)}
      onOpenLabels={() => {
        if (products.length) {
          setProductModal(products[0]);
          setProductModalTab("codigo");
        }
      }}
      organizationName={organizationName}
      user={user}
      access={access}
      cloudStatus={cloudStatus}
      selectedOrderCount={selectedItems.length}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      onSignOut={handleSignOut}
    />

    {sidebarOpen && <button className="backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}

    <main className="main-area">
      <header className="topbar">
        <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
          <Menu />
        </button>

        {/* Workspace Nav Tabs */}
        <div className="workspace-tabs flex items-center gap-1 overflow-x-auto max-w-2xl py-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? "bg-[#790a0e] text-white shadow-sm"
                    : "text-[#695a5c] hover:bg-[#f6e8ea] hover:text-[#790a0e]"
                }`}
              >
                <Icon size={14} />
                <span>{item.label}</span>
                {item.id === "order" && selectedItems.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isActive ? "bg-white text-[#790a0e]" : "bg-[#790a0e] text-white"}`}>
                    {selectedItems.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="topbar-actions ml-auto flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setErpModalInitialOrder(null);
              setErpModalOpen(true);
            }}
            className="hidden sm:inline-flex items-center gap-2 bg-[#790a0e] hover:bg-[#600609] text-white text-xs font-bold h-8 px-3 shadow-sm border border-[#580508]"
          >
            <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
            <span>Novo Pedido</span>
            <kbd className="hidden md:inline px-1 py-0.2 bg-black/25 rounded text-[10px] font-mono">F3</kbd>
          </Button>

          <div className="flex items-center gap-2 text-xs font-medium text-[#695a5c] bg-[#faf7f7] px-2.5 py-1 rounded-md border border-[#ede5e6]">
            <span className={`sync-dot ${cloudStatus.startsWith("Falha") ? "sync-error" : cloudStatus === "Dados sincronizados" ? "sync-ok" : "sync-loading"}`} />
            <span className="hidden lg:inline">{cloudStatus}</span>
          </div>

          <button
            type="button"
            className="logout-button flex items-center gap-1.5 text-xs text-[#7a6c6e] hover:text-[#790a0e] transition px-2 py-1 rounded hover:bg-[#f6e8ea]"
            onClick={handleSignOut}
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {view === "dashboard" && can(access, "dashboard.view") && (
        <GlobalSystemDashboard
          products={products}
          orders={orders}
          suppliers={suppliers}
          cloudStatus={cloudStatus}
          access={access}
          onUpdateOrderStage={updateOrderStage}
          onRefreshOrders={() => setSyncAttempt((a) => a + 1)}
          onNavigate={(newView, subTab) => {
            setView(newView);
            if (subTab) setOrderTab(subTab);
          }}
          onSelectSupplierForOrder={(supp) => {
            setSupplier(supp);
            setView("order");
            setOrderTab("compose");
          }}
          onCreateProduct={createProduct}
          onImport={() => setImportOpen(true)}
          onOpenErpOrderModal={() => {
            setErpModalInitialOrder(null);
            setErpModalOpen(true);
          }}
        />
      )}

      {view === "order" && can(access, "orders.view") && (
        <OrdersModule
          canCreate={can(access, "orders.create")}
          canExport={can(access, "orders.export")}
          canManage={can(access, "orders.manage")}
          orderTab={!can(access, "orders.create") && orderTab === "compose" ? "history" : orderTab}
          setOrderTab={setOrderTab}
          products={products}
          orders={orders}
          supplier={supplier}
          setSupplier={setSupplier}
          category={category}
          setCategory={setCategory}
          categories={categories}
          suppliers={suppliers}
          quantities={quantities}
          setQuantity={setQuantity}
          setQuantities={setQuantities}
          selectedItems={selectedItems}
          totalUnits={totalUnits}
          filtered={filtered}
          onlySelected={onlySelected}
          setOnlySelected={setOnlySelected}
          savingOrder={savingOrder}
          saveOrder={saveOrder}
          exportPdf={exportPdf}
          exportXlsx={exportXlsx}
          setProductModal={setProductModal}
          setProductModalTab={setProductModalTab}
          removeOrder={removeOrder}
          repeatOrder={repeatOrder}
          updateOrderStage={updateOrderStage}
          onOpenErpModal={(targetOrder) => {
            setErpModalInitialOrder(targetOrder || null);
            setErpModalOpen(true);
          }}
          searchTerm={search}
          setSearchTerm={setSearch}
        />
      )}

      {view === "products" && can(access, "products.view") && (
        <Products
          products={products}
          canCreate={can(access, "products.create")}
          canEdit={can(access, "products.edit")}
          canImport={can(access, "products.import")}
          onEdit={(product, tab = "dados") => {
            setCreatingProduct(false);
            setProductModal(product);
            setProductModalTab(tab);
          }}
          onCreate={createProduct}
          onImport={() => setImportOpen(true)}
        />
      )}

      {view === "balance" && can(access, "inventory.view") && (
        <BalanceModule
          products={products}
          organizationId={organizationId}
          userId={user.id}
          canCount={can(access, "inventory.count")}
          canManage={can(access, "inventory.manage")}
        />
      )}

      {view === "settings" && (
        organizationId ? (
          <SettingsModule
            user={user}
            organizationId={organizationId}
            onOrganizationChange={() => window.location.reload()}
          />
        ) : (
          <section className="content settings-unavailable">
            <div className="panel">
              <Settings size={30} />
              <div>
                <span className="eyebrow">CONFIGURAÇÕES</span>
                <h1>{cloudStatus.startsWith("Falha") ? "Não foi possível carregar agora" : "Preparando sua organização"}</h1>
                <p>{cloudStatus.startsWith("Falha") ? "A conexão foi interrompida. Tente novamente; seus dados locais continuam preservados." : "Estamos conectando sua conta e preparando os dados da empresa."}</p>
              </div>
              <Button onClick={() => setSyncAttempt((attempt) => attempt + 1)} disabled={!cloudStatus.startsWith("Falha")}>
                <RotateCcw size={16} /> Tentar novamente
              </Button>
            </div>
          </section>
        )
      )}
    </main>

    {/* ERP Order Modal */}
    <ErpOrderModal
      open={erpModalOpen}
      onOpenChange={setErpModalOpen}
      products={products}
      initialOrder={erpModalInitialOrder}
      organizationName={organizationName}
      onSaveOrder={handleSaveErpOrder}
    />

    <Dialog open={!!productModal} onOpenChange={(open) => { if (!open) { setProductModal(null); setCreatingProduct(false); } }}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{creatingProduct ? "Cadastrar produto" : "Detalhes do produto"}</DialogTitle>
        </DialogHeader>
        {productModal && <ProductEditor key={`${productModal.id}-${productModalTab}`} product={productModal} initialTab={productModalTab} onSave={saveProduct} />}
      </DialogContent>
    </Dialog>

    <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setImportPreview(null); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Importar novos produtos</DialogTitle>
        </DialogHeader>
        <div className="import-box">
          <label className="file-drop">
            <FileSpreadsheet size={30} />
            <strong>{importing ? "Analisando a planilha..." : "Selecionar planilha de produtos"}</strong>
            <span>XLSX, XLS ou CSV · os produtos repetidos serão ignorados</span>
            <input type="file" accept=".xlsx,.xls,.csv" disabled={importing} onChange={(e) => inspectImport(e.target.files?.[0])} />
          </label>
          {importPreview && (
            <div className="import-result">
              <div>
                <span>Arquivo</span>
                <strong>{importPreview.fileName}</strong>
              </div>
              <div className="import-metrics">
                <article><strong>{importPreview.rows.toLocaleString("pt-BR")}</strong><span>linhas lidas</span></article>
                <article className="success"><strong>{importPreview.products.length.toLocaleString("pt-BR")}</strong><span>produtos novos</span></article>
                <article><strong>{importPreview.duplicates.toLocaleString("pt-BR")}</strong><span>duplicados ignorados</span></article>
                <article><strong>{importPreview.invalid.toLocaleString("pt-BR")}</strong><span>linhas inválidas</span></article>
              </div>
              <p>A comparação usa o código do produto. Sem código, utiliza descrição e fornecedor.</p>
              <Button className="w-full" disabled={!importPreview.products.length} onClick={confirmImport}>
                <Upload size={17} /> Confirmar importação
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

function Products({ products, canCreate, canEdit, canImport, onEdit, onCreate, onImport }: { products: Product[]; canCreate: boolean; canEdit: boolean; canImport: boolean; onEdit: (product: Product, tab?: "dados" | "codigo") => void; onCreate: () => void; onImport: () => void }) {
  const [term, setTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("Todos");
  const [limit, setLimit] = useState(120);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const suppliers = useMemo(() => Array.from(new Set(products.map((p) => p.supplier))).sort((a,b) => a.localeCompare(b, "pt-BR")), [products]);
  const filtered = useMemo(() => products.filter((p) => (supplierFilter === "Todos" || p.supplier === supplierFilter) && `${p.description} ${p.code} ${p.supplier} ${p.brand}`.toLowerCase().includes(term.toLowerCase())), [products, supplierFilter, term]);
  const money = (value?: number | null) => value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <section className="content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CATÁLOGO MESTRE</span>
          <h1>Catálogo de Produtos</h1>
          <p>Produtos, códigos SKU, código de barras EAN‑13, custos, estoque e precificação oficial.</p>
        </div>
        <div className="heading-actions flex items-center gap-2">
          {canCreate && (
            <Button onClick={onCreate} className="bg-[#790a0e] hover:bg-[#600609] text-white">
              <Plus size={16} className="mr-1" /> Novo produto
            </Button>
          )}
          {canImport && (
            <Button variant="outline" onClick={onImport} className="border-[#ded3d5]">
              <Upload size={16} className="mr-1" /> Importar planilha
            </Button>
          )}
        </div>
      </div>

      <div className="products-toolbar flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-1 items-center gap-3 min-w-[280px]">
          <div className="inline-search flex-1">
            <Search size={16} className="text-[#8c7e80]" />
            <Input
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setLimit(120);
              }}
              placeholder="Pesquisar por código SKU, EAN, descrição, marca ou fornecedor..."
            />
          </div>
          <div className="select-wrap">
            <select
              value={supplierFilter}
              onChange={(e) => {
                setSupplierFilter(e.target.value);
                setLimit(120);
              }}
            >
              <option>Todos</option>
              {suppliers.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="font-semibold text-xs py-1 px-3 bg-[#ede5e6] text-[#423638]">
            {filtered.length.toLocaleString("pt-BR")} itens cadastrados
          </Badge>

          <div className="flex items-center bg-[#faf7f7] border border-[#ede5e6] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === "table" ? "bg-white shadow text-[#790a0e] font-bold" : "text-[#7a6c6e] hover:text-[#211718]"
              }`}
              title="Exibição em Tabela ERP"
            >
              <Table size={15} />
              <span className="hidden sm:inline">Tabela</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === "grid" ? "bg-white shadow text-[#790a0e] font-bold" : "text-[#7a6c6e] hover:text-[#211718]"
              }`}
              title="Exibição em Cards"
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="bg-white rounded-xl border border-[#ede5e6] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf7f7] border-b border-[#ede5e6] text-[#7a6c6e] font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Foto</th>
                  <th className="py-2.5 px-3 w-28">Código SKU</th>
                  <th className="py-2.5 px-3">Descrição do Produto</th>
                  <th className="py-2.5 px-3 w-36">Fornecedor / Marca</th>
                  <th className="py-2.5 px-3 w-20 text-center">Unidade</th>
                  <th className="py-2.5 px-3 w-24 text-right">Estoque</th>
                  <th className="py-2.5 px-3 w-28 text-right">Custo</th>
                  <th className="py-2.5 px-3 w-28 text-right">Preço Venda</th>
                  <th className="py-2.5 px-3 w-20 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2ecec]">
                {filtered.slice(0, limit).map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-[#fcf8f8] transition cursor-pointer"
                    onClick={() => canEdit ? onEdit(product, "dados") : undefined}
                  >
                    <td className="py-2 px-3 text-center">
                      <div className="w-9 h-9 rounded bg-[#f6e8ea] flex items-center justify-center overflow-hidden mx-auto border border-[#ede5e6]">
                        {product.image ? (
                          <img src={product.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <PackagePlus className="w-4 h-4 text-[#790a0e]/60" />
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-[#790a0e]">
                      {product.code || "—"}
                    </td>
                    <td className="py-2 px-3 font-semibold text-[#211718]">
                      <div>{product.description}</div>
                      {product.barcode && (
                        <div className="text-[10px] font-mono text-[#8c7e80] flex items-center gap-1 mt-0.5">
                          <Barcode className="w-3 h-3 text-[#790a0e]" />
                          EAN: {product.barcode}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-[#605153]">
                      <div className="font-medium truncate max-w-[140px]">{product.supplier}</div>
                      {product.brand && product.brand !== product.supplier && (
                        <div className="text-[10px] text-[#918183]">{product.brand}</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[#605153]">
                      {product.unit}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">
                      <span className={product.stock <= 5 ? "text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded" : "text-[#211718]"}>
                        {product.stock.toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[#7a6c6e]">
                      {money(product.cost)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                      {money(product.price)}
                    </td>
                    <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="p-1.5 text-[#8c7e80] hover:text-[#790a0e] hover:bg-[#f6e8ea] rounded-md transition"
                        title="Ver / Imprimir código de barras EAN-13"
                        onClick={() => onEdit(product, "codigo")}
                      >
                        <Barcode size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.slice(0, limit).map((product) => (
            <div key={product.id} className="product-card flex items-start justify-between gap-2 p-3">
              <div
                className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                onClick={() => canEdit ? onEdit(product, "dados") : undefined}
              >
                <div className="card-image">
                  {product.image ? <img src={product.image} alt="" /> : <PackagePlus />}
                </div>
                <div className="flex-1 min-w-0">
                  <span>{product.supplier} · {product.code || product.category}</span>
                  <strong>{product.description}</strong>
                  <small>
                    {product.brand !== product.supplier ? `${product.brand} · ` : ""}Estoque: {product.stock} {product.unit}
                  </small>
                  <small className="mt-1 flex gap-3">
                    <b>Custo: {money(product.cost)}</b>
                    <b className="text-emerald-700">Venda: {money(product.price)}</b>
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="p-2 text-[#9c8e90] hover:text-[#790a0e] hover:bg-[#f6e8ea] rounded-lg transition shrink-0"
                title="Ver código de barras EAN-13"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(product, "codigo");
                }}
              >
                <Barcode size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {filtered.length > limit && (
        <div className="load-more mt-4">
          <Button variant="outline" onClick={() => setLimit((value) => value + 120)}>
            Mostrar mais produtos ({(filtered.length - limit).toLocaleString("pt-BR")})
          </Button>
        </div>
      )}
    </section>
  );
}

function ProductEditor({ product, initialTab = "dados", onSave }: { product: Product; initialTab?: "dados" | "codigo"; onSave: (product: Product) => void }) {
  const [tab, setTab] = useState<"dados" | "codigo">(initialTab);
  const [draft, setDraft] = useState(product);

  function loadImage(file?: File) {
    if (!file) return;
    if (file.size > 1_000_000) return void toast.error("A imagem deve ter no máximo 1 MB.");
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, image: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex border-b border-[#ede5e6]">
        <button
          type="button"
          onClick={() => setTab("dados")}
          className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition ${
            tab === "dados"
              ? "border-[#790a0e] text-[#790a0e]"
              : "border-transparent text-[#7a6c6e] hover:text-[#211718]"
          }`}
        >
          Dados cadastrais
        </button>
        <button
          type="button"
          onClick={() => setTab("codigo")}
          className={`pb-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
            tab === "codigo"
              ? "border-[#790a0e] text-[#790a0e]"
              : "border-transparent text-[#7a6c6e] hover:text-[#211718]"
          }`}
        >
          <Barcode className="h-4 w-4" />
          Código de barras EAN‑13
        </button>
      </div>

      {tab === "dados" ? (
        <div className="editor-form">
          <div className="editor-image">
            {draft.image ? <img src={draft.image} alt="" /> : <PackagePlus />}
            <label>
              Trocar imagem
              <input type="file" accept="image/*" onChange={(e) => loadImage(e.target.files?.[0])} />
            </label>
          </div>
          <label>
            Descrição
            <Input required value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <div className="form-row">
            <label>
              Código do produto (SKU)
              <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
            </label>
            <label>
              NCM
              <Input value={draft.ncm || ""} onChange={(e) => setDraft({ ...draft, ncm: e.target.value })} />
            </label>
          </div>

          <div className="rounded-lg border border-[#ede5e6] bg-[#faf7f7] p-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Barcode className="h-4 w-4 text-[#790a0e]" />
              <div>
                <strong className="text-xs text-[#211718] block">Leitura ótica para coletores e inventário</strong>
                <span className="text-[11px] text-[#7a6c6e] block">
                  Código ativo: <span className="font-mono font-semibold text-[#790a0e]">{draft.barcode || draft.code || draft.id}</span>
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTab("codigo")}
              className="text-xs h-7 border-[#ded3d5] text-[#790a0e] hover:bg-[#fdf5f5]"
            >
              Gerar / Ver etiqueta
            </Button>
          </div>

          <div className="form-row">
            <label>
              Fornecedor
              <Input value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} />
            </label>
            <label>
              Marca
              <Input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Categoria
              <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </label>
            <label>
              Unidade
              <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Estoque
              <Input type="number" min="0" step="any" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })} />
            </label>
            <label>
              Custo
              <Input type="number" min="0" step="0.01" value={draft.cost ?? ""} onChange={(e) => setDraft({ ...draft, cost: e.target.value === "" ? null : Number(e.target.value) })} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Preço de venda
              <Input type="number" min="0" step="0.01" value={draft.price ?? ""} onChange={(e) => setDraft({ ...draft, price: e.target.value === "" ? null : Number(e.target.value) })} />
            </label>
          </div>
          <Button onClick={() => onSave(draft)}>Salvar alterações</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ProductBarcode
            product={draft}
            onUpdateCode={(code) => {
              setDraft((d) => ({ ...d, barcode: code, code: d.code || code }));
            }}
          />
          <div className="flex justify-between items-center pt-2 border-t border-[#ede5e6]">
            <Button type="button" variant="outline" size="sm" onClick={() => setTab("dados")}>
              Voltar aos dados do produto
            </Button>
            <Button size="sm" onClick={() => onSave(draft)}>
              Salvar produto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
