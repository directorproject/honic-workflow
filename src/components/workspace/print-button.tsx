"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow print:hidden"
    >
      Print or save as PDF
    </button>
  );
}
