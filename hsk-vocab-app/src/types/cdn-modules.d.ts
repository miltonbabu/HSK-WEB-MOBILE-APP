declare module 'https://esm.sh/@mlc-ai/web-llm@0.2.78' {
  export interface InitProgressReport {
    progress: number
    text: string
  }
  export interface MLCEngineInterface {
    chat: (opts: any) => Promise<any>
    reload: (modelId: string, opts?: any) => Promise<void>
    unload: () => Promise<void>
  }
  export function CreateMLCEngine(modelId: string, opts?: any): Promise<MLCEngineInterface>
  export const prebuiltAppConfig: { model_list: any[] }
}

declare module 'https://esm.sh/mermaid@11.15.0' {
  const mermaid: {
    initialize: (opts: any) => void
    render: (id: string, chart: string) => Promise<{ svg: string }>
  }
  export default mermaid
}

declare module 'qrcode' {
  export function toDataURL(text: string, opts?: any): Promise<string>
  export function toCanvas(canvas: any, text: string, opts?: any): Promise<void>
}