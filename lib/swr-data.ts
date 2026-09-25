"use client";

import useSWR, { mutate } from "swr";
import { useCallback } from "react";
import type { Product, Order } from "@/app/page";
import initialProducts from "@/lib/initial-products.json";
import { supabase } from "@/lib/supabase";
import { normalizeFulfillmentStage, type FulfillmentStage } from "@/components/order-progress";

export const SWR_KEYS = {
  products: (orgId?: string | null) => ["cdm", "products", orgId || "local"] as const,
  orders: (orgId?: string | null) => ["cdm", "orders", orgId || "local"] as const,
};

// IndexedDB helpers for offline catalog persistence
function openCatalogDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available"));
    }
    const request = indexedDB.open("central-pedido", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("catalog")) {
        request.result.createObjectStore("catalog");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadCatalogFromDb(): Promise<Product[] | null> {
  try {
    const db = await openCatalogDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("catalog", "readonly");
      const req = tx.objectStore("catalog").get("products");
      req.onsuccess = () => resolve((req.result as Product[]) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function persistCatalogToDb(products: Product[]): Promise<void> {
  try {
    const db = await openCatalogDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("catalog", "readwrite");
      tx.objectStore("catalog").put(products, "products");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IndexedDB error on private/restricted browsers
  }
}

export function loadOrdersFromStorage(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("pedido-central-orders");
    if (!raw) return [];
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

export function persistOrdersToStorage(orders: Order[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("pedido-central-orders", JSON.stringify(orders));
  } catch {
    // Ignore storage quota errors
  }
}

export const fromCloudProduct = (product: Record<string, unknown>): Product => ({
  id: String(product.id),
  code: String(product.code || ""),
  description: String(product.description || ""),
  brand: String(product.brand || ""),
  supplier: String(product.supplier || ""),
  category: String(product.category || "Diversos"),
  unit: String(product.unit || "un"),
  stock: Number(product.stock) || 0,
  suggested: 0,
  image: product.image_url ? String(product.image_url) : null,
  sourceRow: 0,
  cost: product.cost === null || product.cost === undefined ? null : Number(product.cost),
  price: product.price === null || product.price === undefined ? null : Number(product.price),
  ncm: String(product.ncm || ""),
  barcode: String(product.barcode || ""),
});

/**
 * Custom SWR Hook for Products
 * Uses Stale-While-Revalidate to ensure 0ms navigation lag between tabs.
 */
export function useCdmProducts(organizationId?: string | null) {
  const key = SWR_KEYS.products(organizationId);

  const fetcher = async (): Promise<Product[]> => {
    // 1. If we have cached items in IndexedDB, start from them
    const localDbProducts = await loadCatalogFromDb();

    // 2. If organizationId is set, attempt to revalidate from Supabase
    if (organizationId) {
      try {
        const cloudProducts: Product[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("products")
            .select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,barcode,image_url")
            .eq("organization_id", organizationId)
            .range(from, from + 999);

          if (error) break;
          if (data) {
            cloudProducts.push(...data.map((p) => fromCloudProduct(p)));
          }
          if (!data || data.length < 1000) break;
          from += 1000;
        }

        if (cloudProducts.length > 0) {
          void persistCatalogToDb(cloudProducts);
          return cloudProducts;
        }
      } catch {
        // Fallback to local
      }
    }

    // 3. Fallback to IndexedDB or initial seed
    if (localDbProducts && localDbProducts.length > 0) {
      return localDbProducts;
    }

    return initialProducts as Product[];
  };

  const { data, error, isLoading, isValidating, mutate: mutateProducts } = useSWR<Product[]>(
    key,
    fetcher,
    {
      fallbackData: initialProducts as Product[],
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 10000,
      keepPreviousData: true,
    }
  );

  const setProducts = useCallback(
    async (updater: Product[] | ((prev: Product[]) => Product[])) => {
      await mutateProducts(
        (current) => {
          const next = typeof updater === "function" ? updater(current || []) : updater;
          void persistCatalogToDb(next);
          return next;
        },
        { revalidate: false }
      );
    },
    [mutateProducts]
  );

  return {
    products: data || (initialProducts as Product[]),
    isLoading,
    isValidating,
    error,
    mutateProducts,
    setProducts,
  };
}

/**
 * Custom SWR Hook for Orders
 * Uses Stale-While-Revalidate with instant local cache and background cloud sync.
 */
export function useCdmOrders(organizationId?: string | null) {
  const key = SWR_KEYS.orders(organizationId);

  const fetcher = async (): Promise<Order[]> => {
    // 1. Read local storage
    const localOrders = loadOrdersFromStorage();

    // 2. If organizationId is set, fetch latest from Supabase
    if (organizationId) {
      try {
        const { data: orderRows, error } = await supabase
          .from("purchase_orders")
          .select(
            "id,organization_id,destination_organization_id,order_number,supplier,status,distribution_status,review_message,created_at,purchase_order_items(quantity,unit,products(id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,barcode,image_url))"
          )
          .or(`organization_id.eq.${organizationId},destination_organization_id.eq.${organizationId}`)
          .order("created_at", { ascending: false })
          .limit(250);

        if (!error && orderRows) {
          const cloudOrders: Order[] = orderRows.map((row) => ({
            id: row.order_number,
            dbId: row.id,
            supplier: row.supplier,
            createdAt: row.created_at,
            status: row.status as Order["status"],
            fulfillmentStage: normalizeFulfillmentStage(row.distribution_status, row.status),
            originOrganizationId: row.organization_id,
            destinationOrganizationId: row.destination_organization_id,
            originOrganizationName: "Casa das Mangueiras",
            destinationOrganizationName: "Centro de Distribuição",
            reviewMessage: row.review_message,
            items: (row.purchase_order_items || []).flatMap((item) =>
              item.products
                ? [{ ...fromCloudProduct(item.products as unknown as Record<string, unknown>), quantity: Number(item.quantity) }]
                : []
            ),
          }));

          if (cloudOrders.length > 0) {
            persistOrdersToStorage(cloudOrders);
            return cloudOrders;
          }
        }
      } catch {
        // Fallback to local
      }
    }

    return localOrders;
  };

  const { data, error, isLoading, isValidating, mutate: mutateOrders } = useSWR<Order[]>(
    key,
    fetcher,
    {
      fallbackData: typeof window !== "undefined" ? loadOrdersFromStorage() : [],
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 10000,
      keepPreviousData: true,
    }
  );

  const setOrders = useCallback(
    async (updater: Order[] | ((prev: Order[]) => Order[])) => {
      await mutateOrders(
        (current) => {
          const next = typeof updater === "function" ? updater(current || []) : updater;
          persistOrdersToStorage(next);
          return next;
        },
        { revalidate: false }
      );
    },
    [mutateOrders]
  );

  return {
    orders: data || [],
    isLoading,
    isValidating,
    error,
    mutateOrders,
    setOrders,
  };
}

/**
 * Global trigger helper to invalidate/revalidate across any component
 */
export function revalidateCdm(type: "products" | "orders" | "all", orgId?: string | null) {
  if (type === "products" || type === "all") {
    void mutate(SWR_KEYS.products(orgId));
  }
  if (type === "orders" || type === "all") {
    void mutate(SWR_KEYS.orders(orgId));
  }
}
