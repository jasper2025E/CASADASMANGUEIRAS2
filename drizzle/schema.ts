import { pgTable, text, integer, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  code: text("code"),
  description: text("description").notNull(),
  brand: text("brand"),
  supplier: text("supplier").notNull(),
  unit: text("unit").notNull().default("UN"),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").default(0),
  price: numeric("price", { precision: 12, scale: 2 }),
  category: text("category"),
  barcode: text("barcode"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  supplier: text("supplier").notNull(),
  status: text("status").notNull().default("Rascunho"),
  fulfillmentStage: text("fulfillment_stage").default("pending"),
  items: jsonb("items").notNull().$type<unknown[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventoryBalances = pgTable("inventory_balances", {
  id: text("id").primaryKey(),
  date: timestamp("date").defaultNow(),
  items: jsonb("items").notNull().$type<unknown[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: text("id").primaryKey().default("default"),
  companyName: text("company_name").default("Casa das Mangueiras"),
  cnpj: text("cnpj"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ProductRecord = typeof products.$inferSelect;
export type NewProductRecord = typeof products.$inferInsert;
export type OrderRecord = typeof orders.$inferSelect;
export type NewOrderRecord = typeof orders.$inferInsert;
