export const permissionGroups = [
  { label: "Visão geral", items: [{ key: "dashboard.view", label: "Visualizar dashboard geral" }] },
  { label: "Pedidos", items: [
    { key: "orders.view", label: "Visualizar pedidos e histórico" },
    { key: "orders.create", label: "Criar pedidos" },
    { key: "orders.export", label: "Exportar PDF e planilhas" },
    { key: "orders.manage", label: "Alterar etapas e excluir pedidos" },
  ] },
  { label: "Produtos", items: [
    { key: "products.view", label: "Visualizar catálogo" },
    { key: "products.create", label: "Cadastrar produtos" },
    { key: "products.edit", label: "Editar e excluir produtos" },
    { key: "products.import", label: "Importar planilhas" },
  ] },
  { label: "Balanço de estoque", items: [
    { key: "inventory.view", label: "Visualizar balanço" },
    { key: "inventory.count", label: "Realizar contagens" },
    { key: "inventory.manage", label: "Gerenciar setores e conferências" },
  ] },
  { label: "Administração", items: [
    { key: "users.view", label: "Visualizar equipe" },
    { key: "users.manage", label: "Gerenciar usuários e acessos" },
    { key: "settings.manage", label: "Alterar configurações da empresa" },
  ] },
] as const;

export type PermissionKey = typeof permissionGroups[number]["items"][number]["key"];
export type MemberRole = "support" | "admin" | "director" | "manager" | "checker" | "inspector" | "sales" | "viewer";

export const roleLabels: Record<MemberRole, string> = {
  support: "Suporte",
  admin: "Administrador",
  director: "Diretor",
  manager: "Gerente",
  checker: "Conferente",
  inspector: "Fiscal",
  sales: "Vendas",
  viewer: "Consulta",
};

export const assignableRoles: MemberRole[] = ["admin", "director", "manager", "checker", "inspector", "sales", "viewer"];

export const rolePresets: Record<MemberRole, PermissionKey[]> = {
  support: permissionGroups.flatMap((group) => group.items.map((item) => item.key)),
  admin: permissionGroups.flatMap((group) => group.items.map((item) => item.key)),
  director: ["dashboard.view","orders.view","orders.create","orders.export","orders.manage","products.view","products.create","products.edit","products.import","inventory.view","inventory.count","inventory.manage","users.view"],
  manager: ["dashboard.view","orders.view","orders.create","orders.export","orders.manage","products.view","products.create","products.edit","products.import","inventory.view","inventory.count","inventory.manage","users.view"],
  checker: ["products.view","inventory.view","inventory.count"],
  inspector: ["dashboard.view","orders.view","products.view","inventory.view","inventory.count","inventory.manage"],
  sales: ["dashboard.view","orders.view","orders.create","orders.export","products.view"],
  viewer: ["dashboard.view","orders.view","products.view","inventory.view"],
};

export type UserAccess = { role: MemberRole; permissions: string[]; active: boolean; slug?: string };

export function can(access: UserAccess | null, permission: PermissionKey) {
  return !!access?.active && (access.role === "support" || access.permissions.includes(permission));
}
