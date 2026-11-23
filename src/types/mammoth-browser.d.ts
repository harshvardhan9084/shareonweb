// Minimal typing for the browser bundle of mammoth (DOCX → HTML). The npm
// package ships no types for the prebuilt browser script, so we declare the
// exact surface this tool uses.
declare module 'mammoth/mammoth.browser.min.js' {
  export interface MammothMessage {
    type: string
    message: string
  }
  export interface MammothResult {
    value: string
    messages: MammothMessage[]
  }
  export interface MammothInput {
    arrayBuffer: ArrayBuffer
  }
  export interface MammothApi {
    convertToHtml(input: MammothInput, options?: Record<string, unknown>): Promise<MammothResult>
    extractRawText(input: MammothInput): Promise<{ value: string; messages: MammothMessage[] }>
  }
  const mammoth: MammothApi
  export default mammoth
}
