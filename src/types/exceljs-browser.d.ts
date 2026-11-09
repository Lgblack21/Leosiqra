// Build browser exceljs (tanpa polyfill Node) — tipenya sama dengan paket 'exceljs'.
declare module 'exceljs/dist/exceljs.min.js' {
  import ExcelJS from 'exceljs';
  export default ExcelJS;
}
