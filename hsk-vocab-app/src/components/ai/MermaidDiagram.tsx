import { useState, useRef, useEffect } from 'react'

interface MermaidDiagramProps {
  chart: string
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const svgKey = useRef(0)

  useEffect(() => {
    let cancelled = false
    let mermaid: any = null

    async function render() {
      try {
        if (!mermaid) {
          const mod = await import('mermaid')
          mermaid = mod.default || mod
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: { htmlLabels: true, curve: 'basis', padding: 15 },
            themeVariables: {
              fontSize: '18px',
            },
          })
        }

        const id = `mermaid-${svgKey.current++}`
        const { svg } = await mermaid.render(id, chart.trim())
        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = svg
        const svgEl = containerRef.current.querySelector('svg')
        if (svgEl) {
          const viewBox = svgEl.getAttribute('viewBox')
          const width = svgEl.getAttribute('width')
          const height = svgEl.getAttribute('height')

          if (!viewBox && width && height) {
            svgEl.setAttribute('viewBox', `0 0 ${parseFloat(width)} ${parseFloat(height)}`)
          }
          svgEl.style.width = '100%'
          svgEl.style.height = 'auto'
          svgEl.style.maxWidth = '100%'
          svgEl.style.display = 'block'
        }

        setError(null)
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError(msg)
        }
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [chart])

  if (error) {
    return (
      <div className="my-3 p-4 rounded-2xl bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/30">
        <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
          Could not render diagram
        </div>
        <pre className="text-[11px] text-red-500 dark:text-red-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
          {chart}
        </pre>
      </div>
    )
  }

  return (
    <div className="my-3 p-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-ink-100/60 dark:border-white/10 shadow-sm overflow-x-auto overflow-y-auto max-h-[600px]">
      <div
        ref={containerRef}
        className="min-h-[150px] w-full"
        style={{ minWidth: '600px' }}
      >
        <div className="text-xs text-ink-400 dark:text-ink-500 italic flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></span>
          Loading diagram...
        </div>
      </div>
    </div>
  )
}
