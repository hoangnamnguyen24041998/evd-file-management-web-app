import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  createDocument,
  deleteDocument,
  getDocuments,
  importDocuments,
  type DocumentCategory,
  type DocumentDraft,
  type DocumentItem,
  type DocumentStatus,
  type DocumentsResponse,
  updateDocument,
} from "./mockApi";

const statusOptions: DocumentStatus[] = [
  "Draft",
  "Pending Review",
  "Approved",
  "Archived",
];
const categoryOptions: DocumentCategory[] = [
  "Policy",
  "Procedure",
  "Contract",
  "Training",
  "Report",
];
const PAGE_SIZE = 6;
const role = "ADMIN" as "ADMIN" | "STAFF";
const currentUserId = "alex";

interface CellEditState {
  id: string;
  field: "code" | "title" | "category" | "status";
  value: string;
}

interface ImportSummary {
  inserted: number;
  invalidRows: Array<{ row: number; reason: string }>;
}

const validateField = (field: CellEditState["field"], value: string) => {
  if (field === "code") {
    if (!value.trim()) return "Code is required";
    if (value.trim().length < 3) return "Code must be at least 3 characters";
    return "";
  }
  if (field === "title") {
    if (!value.trim()) return "Title is required";
    if (value.trim().length < 4) return "Title must be at least 4 characters";
    return "";
  }
  if (field === "category") {
    return categoryOptions.includes(value as DocumentCategory)
      ? ""
      : "Choose a valid category";
  }
  if (field === "status") {
    return statusOptions.includes(value as DocumentStatus)
      ? ""
      : "Choose a valid status";
  }
  return "";
};

function DocumentAdminApp() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editState, setEditState] = useState<CellEditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<DocumentDraft>({
    code: "",
    title: "",
    category: "Policy",
    status: "Draft",
    createdBy: "Alex",
    ownerId: currentUserId,
  });
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(
    null,
  );
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true);
        setError("");
        const response: DocumentsResponse = await getDocuments({
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          status: statusFilter,
          category: categoryFilter,
          role,
          userId: currentUserId,
        });
        setDocuments(response.items);
        setTotal(response.total);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load documents",
        );
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [page, debouncedSearch, statusFilter, categoryFilter]);

  const canDelete = role !== "STAFF";

  const stats = useMemo(() => {
    const approved = documents.filter(
      (item) => item.status === "Approved",
    ).length;
    const pending = documents.filter(
      (item) => item.status === "Pending Review",
    ).length;
    return { approved, pending };
  }, [documents]);

  async function handleSaveNewDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!formData.code.trim() || !formData.title.trim()) {
      setError("Code and title are required");
      return;
    }

    try {
      setSaving(true);
      const created = await createDocument(formData);
      setDocuments((existing) => [created, ...existing]);
      setTotal((value) => value + 1);
      setFormOpen(false);
      setFormData({
        code: "",
        title: "",
        category: "Policy",
        status: "Draft",
        createdBy: "Alex",
        ownerId: currentUserId,
      });
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create document",
      );
    } finally {
      setSaving(false);
    }
  }

  const beginEdit = (doc: DocumentItem, field: CellEditState["field"]) => {
    setEditState({ id: doc.id, field, value: doc[field] });
  };

  const saveCellEdit = async () => {
    if (!editState) return;
    const errorMessage = validateField(editState.field, editState.value);
    if (errorMessage) {
      setError(errorMessage);
      return;
    }

    try {
      setSaving(true);
      const updated = await updateDocument(editState.id, {
        [editState.field]: editState.value,
      });
      setDocuments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditState(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await deleteDocument(deleteTarget.id);
      setDocuments((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
      setTotal((current) => Math.max(0, current - 1));
      setDeleteTarget(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete document",
      );
    } finally {
      setSaving(false);
    }
  };

  const importFile = async (file: File) => {
    setImporting(true);
    setImportProgress(0);
    setImportSummary(null);
    setImportMessage("Preparing import…");

    const isExcel =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.name.toLowerCase().endsWith(".xls");
    const parseFile = async () => {
      if (isExcel) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json<Record<string, string | undefined>>(
          sheet,
          { defval: "" },
        );
      }

      return new Promise<Record<string, string | undefined>[]>(
        (resolve, reject) => {
          Papa.parse<Record<string, string | undefined>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (
              results: Papa.ParseResult<Record<string, string | undefined>>,
            ) => resolve(results.data),
            error: reject,
          });
        },
      );
    };

    try {
      const rows = await parseFile();
      const chunkSize = 250;
      const results: Array<Record<string, string | undefined>> = [];
      for (let index = 0; index < rows.length; index += chunkSize) {
        const chunk = rows.slice(index, index + chunkSize);
        results.push(...chunk);
        setImportProgress(
          Math.round(((index + chunk.length) / Math.max(rows.length, 1)) * 100),
        );
        setImportMessage(
          `Processed ${Math.min(index + chunk.length, rows.length)} of ${rows.length} rows`,
        );
      }
      const summary = await importDocuments(results);
      setImportSummary(summary);
      setImportMessage(`Imported ${summary.inserted} valid rows`);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      setImportProgress(100);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await getDocuments({
        page: 1,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        status: statusFilter,
        category: categoryFilter,
        role,
        userId: currentUserId,
      });
      setDocuments(response.items);
      setTotal(response.total);
      setPage(1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to refresh documents",
      );
    }
  };

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Module File Management</p>
          <h1>Document Administration</h1>
          <p className="subtitle">
            Search, maintain and import documents with inline editing and
            role-aware controls.
          </p>
        </div>
        <div className="toolbar-actions">
          <label className="search-box">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Fill document code or title"
              aria-label="Search documents"
            />
          </label>
          <button type="button" onClick={() => setFormOpen(true)}>
            Create document
          </button>
          <label className="import-button">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importFile(file);
                }
              }}
            />
            <span>{importing ? "Importing…" : "Import"}</span>
          </label>
        </div>
      </header>

      <section className="stats-grid">
        <article>
          <strong>{total}</strong>
          <span>Total documents</span>
        </article>
        <article>
          <strong>{stats.approved}</strong>
          <span>Approved</span>
        </article>
        <article>
          <strong>{stats.pending}</strong>
          <span>Pending review</span>
        </article>
      </section>

      <section className="filters-row">
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="All">All</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Category</span>
          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="All">All</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Role</span>
          <input value={role} readOnly />
        </label>
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {importSummary ? (
        <div className="alert info">
          Imported {importSummary.inserted} rows. Invalid rows:{" "}
          {importSummary.invalidRows.length}
          {importSummary.invalidRows.length > 0 ? (
            <div>
              {importSummary.invalidRows.slice(0, 5).map((item) => (
                <div key={item.row}>
                  Row {item.row}: {item.reason}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {importing ? (
        <div className="progress-card">
          <div className="progress-label">{importMessage}</div>
          <div className="progress-bar">
            <div style={{ width: `${importProgress}%` }} />
          </div>
        </div>
      ) : null}

      <div className="table-card">
        {loading ? (
          <div className="state">Loading documents…</div>
        ) : documents.length === 0 ? (
          <div className="state">No documents match the current filters.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created by</th>
                  <th>Created date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const isEditing = editState?.id === doc.id;
                  return (
                    <tr key={doc.id}>
                      <td>
                        {isEditing && editState?.field === "code" ? (
                          <input
                            value={editState.value}
                            onChange={(event) =>
                              setEditState((current) =>
                                current
                                  ? { ...current, value: event.target.value }
                                  : current,
                              )
                            }
                            onBlur={saveCellEdit}
                          />
                        ) : (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => beginEdit(doc, "code")}
                          >
                            {doc.code}
                          </button>
                        )}
                      </td>
                      <td>
                        {isEditing && editState?.field === "title" ? (
                          <input
                            value={editState.value}
                            onChange={(event) =>
                              setEditState((current) =>
                                current
                                  ? { ...current, value: event.target.value }
                                  : current,
                              )
                            }
                            onBlur={saveCellEdit}
                          />
                        ) : (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => beginEdit(doc, "title")}
                          >
                            {doc.title}
                          </button>
                        )}
                      </td>
                      <td>
                        {isEditing && editState?.field === "category" ? (
                          <select
                            value={editState.value}
                            onChange={(event) =>
                              setEditState((current) =>
                                current
                                  ? { ...current, value: event.target.value }
                                  : current,
                              )
                            }
                            onBlur={saveCellEdit}
                          >
                            {categoryOptions.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => beginEdit(doc, "category")}
                          >
                            {doc.category}
                          </button>
                        )}
                      </td>
                      <td>
                        {isEditing && editState?.field === "status" ? (
                          <select
                            value={editState.value}
                            onChange={(event) =>
                              setEditState((current) =>
                                current
                                  ? { ...current, value: event.target.value }
                                  : current,
                              )
                            }
                            onBlur={saveCellEdit}
                          >
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`status-badge ${doc.status.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {doc.status}
                          </span>
                        )}
                      </td>
                      <td>{doc.createdBy}</td>
                      <td>{doc.createdDate}</td>
                      <td>
                        <div className="actions-cell">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => beginEdit(doc, "title")}
                          >
                            Edit
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              className="danger"
                              onClick={() => setDeleteTarget(doc)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pagination">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          Previous
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
        >
          Next
        </button>
      </div>

      {formOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Create document</h2>
            <form onSubmit={handleSaveNewDocument} className="form-grid">
              <label>
                <span>Code</span>
                <input
                  value={formData.code}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>Title</span>
                <input
                  value={formData.title}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>Category</span>
                <select
                  value={formData.category}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      category: event.target.value as DocumentCategory,
                    }))
                  }
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  value={formData.status}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      status: event.target.value as DocumentStatus,
                    }))
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Created by</span>
                <input
                  value={formData.createdBy}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      createdBy: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card narrow">
            <h2>Delete document</h2>
            <p>Delete {deleteTarget.title}? This action cannot be undone.</p>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? "Deleting…" : "Confirm delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DocumentAdminApp;
