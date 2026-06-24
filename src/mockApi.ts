export type DocumentStatus =
  | "Draft"
  | "Pending Review"
  | "Approved"
  | "Archived";
export type DocumentCategory =
  | "Policy"
  | "Procedure"
  | "Contract"
  | "Training"
  | "Report";

export interface DocumentItem {
  id: string;
  code: string;
  title: string;
  category: DocumentCategory;
  status: DocumentStatus;
  createdBy: string;
  createdDate: string;
  ownerId: string;
  updatedAt: string;
}

export interface DocumentsResponse {
  items: DocumentItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DocumentFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  category?: string;
  role?: "ADMIN" | "STAFF";
  userId?: string;
}

export interface DocumentDraft {
  code: string;
  title: string;
  category: DocumentCategory;
  status: DocumentStatus;
  createdBy: string;
  ownerId: string;
}

const buildQuery = (filters: DocumentFilters) => {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.role) params.set("role", filters.role);
  if (filters.userId) params.set("userId", filters.userId);
  return params.toString();
};

export async function getDocuments(
  filters: DocumentFilters,
): Promise<DocumentsResponse> {
  const response = await fetch(`/documents?${buildQuery(filters)}`);
  if (!response.ok) {
    throw new Error("Failed to load documents");
  }
  return response.json() as Promise<DocumentsResponse>;
}

export async function createDocument(
  payload: DocumentDraft,
): Promise<DocumentItem> {
  const response = await fetch("/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Unable to create document");
  }
  return response.json() as Promise<DocumentItem>;
}

export async function updateDocument(
  id: string,
  payload: Partial<DocumentItem>,
): Promise<DocumentItem> {
  const response = await fetch(`/documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Unable to save changes");
  }
  return response.json() as Promise<DocumentItem>;
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/documents/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error("Unable to delete document");
  }
}

export async function importDocuments(
  rows: Array<Record<string, string | undefined>>,
): Promise<{
  inserted: number;
  invalidRows: Array<{ row: number; reason: string }>;
}> {
  const response = await fetch("/documents/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error("Import failed");
  }
  return response.json() as Promise<{
    inserted: number;
    invalidRows: Array<{ row: number; reason: string }>;
  }>;
}
