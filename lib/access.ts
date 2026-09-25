export const permissionGroups = [
  { label: "Visão geral", items: [{ key: "dashboard.view", label: "Visualizar dashboard geral" }] },
  { label: "Pedidos internos", items: [
    { key: "orders.view", label: "Visualizar pedidos da unidade" },
    { key: "orders.create", label: "Criar pedido para o CD" },
    { key: "orders.export", label: "Exportar pedidos" },
    { key: "orders.manage", label: "Aprovar, separar ou receber pedidos" },
  ] },
  { label: "Produtos", items: [
    { key: "products.view", label: "Consultar catálogo global" },
    { key: "products.create", label: "Cadastrar produtos globais" },
    { key: "products.edit", label: "Editar produtos globais" },
    { key: "products.import", label: "Importar catálogo" },
  ] },
  { label: "Estoque", items: [
    { key: "inventory.view", label: "Consultar estoque da unidade" },
    { key: "inventory.count", label: "Realizar contagens" },
    { key: "inventory.manage", label: "Gerenciar inventário" },
  ] },
  { label: "Administração", items: [
    { key: "reports.view", label: "Ver relatórios da unidade" },
    { key: "users.view", label: "Visualizar equipe" },
    { key: "users.manage", label: "Gerenciar equipe da unidade" },
    { key: "settings.manage", label: "Alterar configurações" },
  ] },
] as const;

export type PermissionKey = typeof permissionGroups[number]["items"][number]["key"];
export type MemberRole =
  | "GERENTE_GERAL" | "SUBGERENTE" | "AUXILIAR_GERENTE"
  | "GERENTE_ESTOQUE" | "GERENTE_REPOSICAO" | "FISCAL_LOJA"
  | "FUNCIONARIO_COMPRAS" | "RECEBEDOR_CONFERENTE" | "SEPARADOR"
  | "CAIXA" | "VENDEDOR" | "ADMIN_CD" | "SUPER_ADMIN";

export const roleLabels: Record<MemberRole, string> = {
  GERENTE_GERAL: "Gerente geral", SUBGERENTE: "Subgerente", AUXILIAR_GERENTE: "Auxiliar de gerente",
  GERENTE_ESTOQUE: "Gerente de estoque", GERENTE_REPOSICAO: "Gerente de reposição", FISCAL_LOJA: "Fiscal de loja",
  FUNCIONARIO_COMPRAS: "Funcionário de compras", RECEBEDOR_CONFERENTE: "Recebedor / conferente",
  SEPARADOR: "Separador", CAIXA: "Caixa", VENDEDOR: "Vendedor", ADMIN_CD: "Administrador do CD",
  SUPER_ADMIN: "Super administrador",
};

export const assignableRoles: MemberRole[] = ["GERENTE_GERAL","SUBGERENTE","AUXILIAR_GERENTE","GERENTE_ESTOQUE","GERENTE_REPOSICAO","FISCAL_LOJA","FUNCIONARIO_COMPRAS","RECEBEDOR_CONFERENTE","SEPARADOR","CAIXA","VENDEDOR"];
const allPermissions = permissionGroups.flatMap((group) => group.items.map((item) => item.key));
export const rolePresets: Record<MemberRole, PermissionKey[]> = {
  GERENTE_GERAL: ["dashboard.view","orders.view","orders.create","orders.export","orders.manage","products.view","inventory.view","inventory.count","inventory.manage","reports.view","users.view","users.manage","settings.manage"],
  SUBGERENTE: ["dashboard.view","orders.view","orders.create","orders.export","orders.manage","products.view","inventory.view","inventory.count","inventory.manage","reports.view","users.view","users.manage"],
  AUXILIAR_GERENTE: ["dashboard.view","orders.view","orders.create","orders.export","orders.manage","products.view","inventory.view","reports.view","users.view","users.manage"],
  GERENTE_ESTOQUE: ["dashboard.view","orders.view","orders.create","orders.manage","products.view","inventory.view","inventory.count","inventory.manage"],
  GERENTE_REPOSICAO: ["dashboard.view","orders.view","orders.create","orders.export","products.view","inventory.view"],
  FISCAL_LOJA: ["dashboard.view","products.view","inventory.view","reports.view"],
  FUNCIONARIO_COMPRAS: ["dashboard.view","orders.view","orders.create","orders.export","products.view","inventory.view"],
  RECEBEDOR_CONFERENTE: ["orders.view","orders.manage","products.view","inventory.view"],
  SEPARADOR: ["orders.view","orders.manage","products.view","inventory.view"],
  CAIXA: ["products.view","inventory.view"], VENDEDOR: ["products.view","inventory.view"],
  ADMIN_CD: [...allPermissions], SUPER_ADMIN: [...allPermissions],
};
export type UserAccess = { role: MemberRole; permissions: string[]; active: boolean };
export function can(access: UserAccess | null, permission: PermissionKey) {
  if (!access?.active) return false;
  if (access.role === "SUPER_ADMIN" || access.role === "ADMIN_CD") return true;
  return access.permissions.length > 0 ? access.permissions.includes(permission) : rolePresets[access.role].includes(permission);
}
