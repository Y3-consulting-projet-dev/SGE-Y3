import { useState } from "react";
import { getRhReports } from "@/api/rhOverview";
import { useAsync } from "./useAsync";

export function useRhReports() {
  const { data, isLoading, error } = useAsync(getRhReports, []);
  const [formatOverrides, setFormatOverrides] = useState({});

  const rows = data?.exports || [];

  function getActiveFormat(row) {
    return formatOverrides[row.id] || row.format || row.availableFormats?.[0] || "PDF";
  }

  function setFormat(rowId, fmt) {
    setFormatOverrides((prev) => ({ ...prev, [rowId]: fmt }));
  }

  return { rows, isLoading, error, getActiveFormat, setFormat };
}
