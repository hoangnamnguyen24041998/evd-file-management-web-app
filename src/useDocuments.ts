import { useEffect } from "react";
import {
  getDocuments,
  type DocumentCategory,
  type DocumentStatus,
  type DocumentsResponse,
} from "./mockApi";
import { useDocumentAdminStore } from "./documentAdminStore";

const PAGE_SIZE = 6;
const role = "ADMIN" as "ADMIN" | "STAFF";
const currentUserId = "alex";

export const useDocuments = () => {
  const {
    page,
    debouncedSearch,
    statusFilter,
    categoryFilter,
    setDocuments,
    setTotal,
    setLoading,
    setError,
  } = useDocumentAdminStore();

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true);
        setError("");
        const response: DocumentsResponse = await getDocuments({
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          status: statusFilter as DocumentStatus,
          category: categoryFilter as DocumentCategory,
          role,
          userId: currentUserId,
        });
        setDocuments(response.items);
        setTotal(response.total);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load documents",
        );
        setDocuments([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    void loadDocuments();
  }, [
    page,
    debouncedSearch,
    statusFilter,
    categoryFilter,
    setDocuments,
    setError,
    setLoading,
    setTotal,
  ]);
};
