// Three export buttons in the Miftaxul colour code: CSV green, Excel blue,
// PDF red. Each one is a plain <button> so the parent decides what it does —
// typically converting the current table rows to the matching file.
export default function ExportButtons({ onCsv, onXlsx, onPdf, disabled }) {
  return (
    <div className="flex items-center gap-2">
      {onCsv && (
        <button type="button" onClick={onCsv} disabled={disabled} className="btn-success">
          CSV
        </button>
      )}
      {onXlsx && (
        <button type="button" onClick={onXlsx} disabled={disabled} className="btn-info">
          Excel XLSX
        </button>
      )}
      {onPdf && (
        <button type="button" onClick={onPdf} disabled={disabled} className="btn-danger">
          PDF
        </button>
      )}
    </div>
  );
}
