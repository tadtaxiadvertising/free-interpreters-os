import React from "react";

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
}

interface RbacTableProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  emptyMessage?: string;
  action?: React.ReactNode;
}

export function RbacTable<T extends { id: string | number }>({
  title,
  data,
  columns,
  emptyMessage = "No se encontraron datos",
  action,
}: RbacTableProps<T>) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
        {action && <div>{action}</div>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.01]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`text-left text-xs font-semibold text-slate-400 uppercase tracking-widest px-6 py-4 ${col.className || ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                {columns.map((col, i) => (
                  <td key={i} className={`px-6 py-4 text-sm ${col.className || ""}`}>
                    {typeof col.accessor === "function"
                      ? col.accessor(item)
                      : (item[col.accessor] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center text-slate-500 italic">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
