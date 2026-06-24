import { create } from "zustand";
import type {
  DocumentDraft,
  DocumentItem,
} from "./mockApi";

export interface CellEditState {
  id: string;
  field: "code" | "title" | "category" | "status";
  value: string;
}

export interface ImportSummary {
  inserted: number;
  invalidRows: Array<{ row: number; reason: string }>;
}

type StateUpdater<T> = T | ((current: T) => T);

interface DocumentAdminState {
  documents: DocumentItem[];
  total: number;
  page: number;
  statusFilter: string;
  categoryFilter: string;
  loading: boolean;
  error: string;
  editState: CellEditState | null;
  saving: boolean;
  formOpen: boolean;
  formData: DocumentDraft;
  deleteTarget: DocumentItem | null;
  importing: boolean;
  importSummary: ImportSummary | null;
  importProgress: number;
  importMessage: string;
  searchTerm: string;
  debouncedSearch: string;
  setDocuments: (documents: DocumentItem[]) => void;
  setTotal: (total: number) => void;
  setPage: (page: StateUpdater<number>) => void;
  setStatusFilter: (status: string) => void;
  setCategoryFilter: (category: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setEditState: (state: StateUpdater<CellEditState | null>) => void;
  setSaving: (saving: boolean) => void;
  setFormOpen: (open: boolean) => void;
  setFormData: (data: StateUpdater<DocumentDraft>) => void;
  updateFormData: (patch: Partial<DocumentDraft>) => void;
  setDeleteTarget: (document: DocumentItem | null) => void;
  setImporting: (importing: boolean) => void;
  setImportSummary: (summary: ImportSummary | null) => void;
  setImportProgress: (progress: number) => void;
  setImportMessage: (message: string) => void;
  setSearchTerm: (value: string) => void;
  setDebouncedSearch: (value: string) => void;
  resetForm: () => void;
  appendDocument: (document: DocumentItem) => void;
  replaceDocument: (document: DocumentItem) => void;
  removeDocument: (id: string) => void;
  replaceMany: (documents: DocumentItem[]) => void;
}

const createEmptyForm = (ownerId: string): DocumentDraft => ({
  code: "",
  title: "",
  category: "Policy",
  status: "Draft",
  createdBy: "Alex",
  ownerId,
});

export const useDocumentAdminStore = create<DocumentAdminState>((set) => ({
  documents: [],
  total: 0,
  page: 1,
  statusFilter: "All",
  categoryFilter: "All",
  loading: true,
  error: "",
  editState: null,
  saving: false,
  formOpen: false,
  formData: createEmptyForm("alex"),
  deleteTarget: null,
  importing: false,
  importSummary: null,
  importProgress: 0,
  importMessage: "",
  searchTerm: "",
  debouncedSearch: "",
  setDocuments: (documents) => set({ documents }),
  setTotal: (total) => set({ total }),
  setPage: (page) =>
    set((state) => ({
      page: typeof page === "function" ? page(state.page) : page,
    })),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setEditState: (editState) => set({ editState:editState as any}),
  setSaving: (saving) => set({ saving }),
  setFormOpen: (formOpen) => set({ formOpen }),
  setFormData: (formData) => set({ formData: formData as any }),
  updateFormData: (patch) =>
    set((state) => ({ formData: { ...state.formData, ...patch } })),
  setDeleteTarget: (deleteTarget) => set({ deleteTarget }),
  setImporting: (importing) => set({ importing }),
  setImportSummary: (importSummary) => set({ importSummary }),
  setImportProgress: (importProgress) => set({ importProgress }),
  setImportMessage: (importMessage) => set({ importMessage }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setDebouncedSearch: (debouncedSearch) => set({ debouncedSearch }),
  resetForm: () => set({ formData: createEmptyForm("alex") }),
  appendDocument: (document) =>
    set((state) => ({ documents: [document, ...state.documents] })),
  replaceDocument: (document) =>
    set((state) => ({
      documents: state.documents.map((item) =>
        item.id === document.id ? document : item,
      ),
    })),
  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((item) => item.id !== id),
    })),
  replaceMany: (documents) => set({ documents }),
}));
