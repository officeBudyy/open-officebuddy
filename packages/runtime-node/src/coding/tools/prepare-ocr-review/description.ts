export const PREPARE_OCR_REVIEW_TOOL_DESCRIPTION = `Build OCR review contact sheets from a PDF and the structured JSON produced by extract_text_from_pdf.

The tool reuses page PNGs captured by extract_text_from_pdf transcription mode, validates the version-2 source fingerprint, crops risky OCR lines by their saved quadrilateral boxes, and returns contact sheets as images in the same tool result. Stale/legacy OCR JSON and missing captures are rejected instead of silently falling back to ad-hoc page rendering.

Use it after extract_text_from_pdf(mode="transcription"). The manifest maps every tile to page, line, OCR text, and confidence. Review the image itself before changing text. If a character is not visually confirmable, keep [待核对]; never repair it from semantics, totals, or expected formulas.

If this tool reports a rendering/capture error, stop the run and surface the error. Do not fall back to rendering or reading pages one by one.

Input
  - input: source PDF path
  - ocrJson (optional): OCR JSON path. Default: the latest successful transcription extraction output, then <input>.ocr.json
  - output (optional): output prefix. Default: <input>.ocr-review
  - confidenceBelow (optional): include lines below this 0..100 score. Default 75
  - samplePerPage (optional): deterministic non-anomaly line samples per page. Default 1
  - includePageOverview (optional): include full-page overview tiles. Transcription/full-audit modes cover every page. Default true
  - reviewMode (optional): "sampled" | "transcription" | "full_audit". Default "transcription"
  - maxTiles (optional): requested total tile cap. Transcription mode also enforces its adaptive page-based cap; full-audit may use up to 512
  - dpi (optional): must match the captured-page DPI; use extraction DPI to change it

Output
  One text manifest plus one or more PNG image content blocks. PNGs and a JSON manifest are also written beside the requested output prefix.`;
