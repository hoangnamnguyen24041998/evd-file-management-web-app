import { http, HttpResponse } from "msw";

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

const STORAGE_KEY = "evd-documents-msw";

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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDocuments));
    return initialDocuments;
  }

  return JSON.parse(raw) as DocumentItem[];
}

function writeDocuments(items: DocumentItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function filterDocuments(items: DocumentItem[], url: URL) {
  const search = url.searchParams.get("search")?.toLowerCase() ?? "";
  const status = url.searchParams.get("status") ?? "All";
  const category = url.searchParams.get("category") ?? "All";
  const role = url.searchParams.get("role") ?? "ADMIN";
  const userId = url.searchParams.get("userId") ?? "alex";

  const filtered = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search) ||
      item.code.toLowerCase().includes(search);
    const matchesStatus = !status || status === "All" || item.status === status;
    const matchesCategory =
      !category || category === "All" || item.category === category;
    const matchesOwner = role !== "STAFF" || item.ownerId === userId;
    return matchesSearch && matchesStatus && matchesCategory && matchesOwner;
  });

  return filtered.sort((a, b) => b.createdDate.localeCompare(a.createdDate));
}

export const handlers = [
  http.get("/documents", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "6");
    const docs = filterDocuments(readDocuments(), url);
    const start = (page - 1) * pageSize;

    return HttpResponse.json({
      items: docs.slice(start, start + pageSize),
      total: docs.length,
      page,
      pageSize,
    });
  }),

  http.post("/documents", async ({ request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    const docs = readDocuments();
    const item: DocumentItem = {
      id: `doc-${Date.now()}`,
      code: String(payload.code ?? "")
        .trim()
        .toUpperCase(),
      title: String(payload.title ?? "").trim(),
      category: String(payload.category ?? "Policy") as DocumentCategory,
      status: String(payload.status ?? "Draft") as DocumentStatus,
      createdBy: String(payload.createdBy ?? "Alex").trim(),
      createdDate: new Date().toISOString().slice(0, 10),
      ownerId: String(payload.ownerId ?? "alex"),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const next = [item, ...docs];
    writeDocuments(next);
    return HttpResponse.json(item, { status: 201 });
  }),

  http.put("/documents/:id", async ({ params, request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    const docs = readDocuments();
    const index = docs.findIndex((item) => item.id === params.id);
    if (index === -1) {
      return HttpResponse.json(
        { message: "Document not found" },
        { status: 404 },
      );
    }

    const updated: DocumentItem = {
      ...docs[index],
      ...(payload as Partial<DocumentItem>),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    docs[index] = updated;
    writeDocuments(docs);
    return HttpResponse.json(updated);
  }),

  http.delete("/documents/:id", ({ params }) => {
    const docs = readDocuments().filter((item) => item.id !== params.id);
    writeDocuments(docs);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/documents/import", async ({ request }) => {
    const payload = (await request.json()) as Array<
      Record<string, string | undefined>
    >;
    const docs = readDocuments();
    const invalidRows: Array<{ row: number; reason: string }> = [];
    let inserted = 0;

    payload.forEach((row, index) => {
      const code = String(row.code ?? "")
        .trim()
        .toUpperCase();
      const title = String(row.title ?? "").trim();
      const category = String(row.category ?? "").trim() as DocumentCategory;
      const status = String(row.status ?? "").trim() as DocumentStatus;
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
        createdBy: String(row.createdBy ?? "Alex").trim(),
        createdDate: new Date().toISOString().slice(0, 10),
        ownerId: String(row.createdBy ?? "alex").toLowerCase(),
        updatedAt: new Date().toISOString().slice(0, 10),
      });
      inserted += 1;
    });

    writeDocuments(docs);
    return HttpResponse.json({ inserted, invalidRows });
  }),
];
