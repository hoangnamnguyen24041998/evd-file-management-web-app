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

const STORAGE_KEY = "evd-documents-gh-pages";
const initialDocuments: DocumentItem[] = [
  {
    id: "doc-001",
    code: "POL-001",
    title: "Information Security Policy",
    category: "Policy",
    status: "Approved",
    createdBy: "Alice",
    createdDate: "2026-06-01",
    ownerId: "alice",
    updatedAt: "2026-06-01",
  },
  {
    id: "doc-002",
    code: "PROC-002",
    title: "Incident Escalation Procedure",
    category: "Procedure",
    status: "Pending Review",
    createdBy: "Bob",
    createdDate: "2026-06-04",
    ownerId: "bob",
    updatedAt: "2026-06-04",
  },
  {
    id: "doc-003",
    code: "CTR-003",
    title: "Vendor Master Agreement",
    category: "Contract",
    status: "Draft",
    createdBy: "Clara",
    createdDate: "2026-06-06",
    ownerId: "clara",
    updatedAt: "2026-06-06",
  },
  {
    id: "doc-004",
    code: "TRN-004",
    title: "Data Handling Training",
    category: "Training",
    status: "Approved",
    createdBy: "Alice",
    createdDate: "2026-06-08",
    ownerId: "alice",
    updatedAt: "2026-06-08",
  },
];

function readDocuments(): DocumentItem[] {
  if (typeof window === "undefined") {
    return [...initialDocuments];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDocuments));
    return [...initialDocuments];
  }

  try {
    return JSON.parse(raw) as DocumentItem[];
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDocuments));
    return [...initialDocuments];
  }
}

function writeDocuments(items: DocumentItem[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

function toSearchableText(value: string) {
  return value.toLowerCase().trim();
}

function applyFilters(items: DocumentItem[], filters: DocumentFilters) {
  const searchText = toSearchableText(filters.search ?? "");
  const statusFilter = filters.status;
  const categoryFilter = filters.category;

  const filtered = items.filter((item) => {
    const matchesSearch =
      !searchText ||
      toSearchableText(item.title).includes(searchText) ||
      toSearchableText(item.code).includes(searchText);

    const matchesStatus =
      !statusFilter || statusFilter === "All" || item.status === statusFilter;
    const matchesCategory =
      !categoryFilter ||
      categoryFilter === "All" ||
      item.category === categoryFilter;
    const matchesOwner =
      filters.role !== "STAFF" || item.ownerId === (filters.userId ?? "alex");

    return matchesSearch && matchesStatus && matchesCategory && matchesOwner;
  });

  return filtered.sort((a, b) => b.createdDate.localeCompare(a.createdDate));
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

const resolveApiUrl = (path: string) => {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\//, "")}`;
};

async function tryFetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  try {
    const response = await fetch(resolveApiUrl(path), init);
    if (!response.ok) {
      return undefined;
    }
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : undefined;
  } catch {
    return undefined;
  }
}

export async function getDocuments(
  filters: DocumentFilters,
): Promise<DocumentsResponse> {
  const response = await tryFetchJson<DocumentsResponse>(
    `/documents?${buildQuery(filters)}`,
  );
  if (response) {
    return response;
  }

  const docs = readDocuments();
  const filtered = applyFilters(docs, filters);
  const pageSize = filters.pageSize;
  const start = (filters.page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page: filters.page,
    pageSize,
  };
}

export async function createDocument(
  payload: DocumentDraft,
): Promise<DocumentItem> {
  const response = await tryFetchJson<DocumentItem>("/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response) {
    return response;
  }

  const docs = readDocuments();
  const item: DocumentItem = {
    id: `doc-${Date.now()}`,
    code: payload.code.trim().toUpperCase(),
    title: payload.title.trim(),
    category: payload.category,
    status: payload.status,
    createdBy: payload.createdBy.trim(),
    createdDate: new Date().toISOString().slice(0, 10),
    ownerId: payload.ownerId,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  const next = [item, ...docs];
  writeDocuments(next);
  return item;
}

export async function updateDocument(
  id: string,
  payload: Partial<DocumentItem>,
): Promise<DocumentItem> {
  const response = await tryFetchJson<DocumentItem>(`/documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response) {
    return response;
  }

  const docs = readDocuments();
  const index = docs.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error("Document not found");
  }

  const updated: DocumentItem = {
    ...docs[index],
    ...payload,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  docs[index] = updated;
  writeDocuments(docs);
  return updated;
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await tryFetchJson<void>(`/documents/${id}`, {
    method: "DELETE",
  });
  if (response !== undefined || typeof window === "undefined") {
    return;
  }

  const docs = readDocuments().filter((item) => item.id !== id);
  writeDocuments(docs);
}

export async function importDocuments(
  rows: Array<Record<string, string | undefined>>,
): Promise<{
  inserted: number;
  invalidRows: Array<{ row: number; reason: string }>;
}> {
  const response = await tryFetchJson<{
    inserted: number;
    invalidRows: Array<{ row: number; reason: string }>;
  }>("/documents/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  });
  if (response) {
    return response;
  }

  const docs = readDocuments();
  const invalidRows: Array<{ row: number; reason: string }> = [];
  let inserted = 0;

  rows.forEach((row, index) => {
    const code = String(row.code ?? "")
      .trim()
      .toUpperCase();
    const title = String(row.title ?? "").trim();
    const category = String(row.category ?? "").trim() as DocumentCategory;
    const status = String(row.status ?? "").trim() as DocumentStatus;
    const createdBy = String(row.createdBy ?? "Alex").trim();

    const validCategory = [
      "Policy",
      "Procedure",
      "Contract",
      "Training",
      "Report",
    ].includes(category);
    const validStatus = [
      "Draft",
      "Pending Review",
      "Approved",
      "Archived",
    ].includes(status);

    if (
      !code ||
      !title ||
      !validCategory ||
      !validStatus ||
      code.length < 3 ||
      title.length < 4
    ) {
      invalidRows.push({
        row: index + 1,
        reason: "Missing or invalid code/title/category/status",
      });
      return;
    }

    docs.unshift({
      id: `doc-${Date.now()}-${index}`,
      code,
      title,
      category,
      status,
      createdBy,
      createdDate: new Date().toISOString().slice(0, 10),
      ownerId: createdBy.toLowerCase(),
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    inserted += 1;
  });

  writeDocuments(docs);
  return { inserted, invalidRows };
}
