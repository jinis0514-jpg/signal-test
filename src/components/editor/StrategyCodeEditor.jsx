import { useRef, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { setupMonacoStrategyDsl } from '../../lib/monacoStrategyDsl'

const MARKER_OWNER = 'strategy-dsl-parse'

/**
 * @param {object} props
 * @param {string} props.value
 * @param {(v: string) => void} props.onChange
 * @param {{ line: number, message: string } | null} props.errorMarker
 * @param {number} [props.height]
 */
export default function StrategyCodeEditor({ value, onChange, errorMarker, height = 400 }) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 12,
      lineHeight: 20,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      quickSuggestions: { other: true, comments: false, strings: true },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      padding: { top: 8, bottom: 8 },
    })
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    const model = editor.getModel()
    if (!model) return

    const msg = String(errorMarker?.message ?? '').trim()
    if (errorMarker == null || !msg) {
      monaco.editor.setModelMarkers(model, MARKER_OWNER, [])
      return
    }

    const line = Math.max(1, Math.min(errorMarker.line ?? 1, model.getLineCount()))
    const endCol = Math.max(1, model.getLineMaxColumn(line))

    monaco.editor.setModelMarkers(model, MARKER_OWNER, [
      {
        startLineNumber: line,
        endLineNumber: line,
        startColumn: 1,
        endColumn: endCol,
        message: msg,
        severity: monaco.MarkerSeverity.Error,
      },
    ])
  }, [errorMarker, value])

  return (
    <div className="w-full min-h-0 overflow-hidden rounded-lg border border-slate-700/80 bg-[#1e1e1e]">
      <Editor
        height={`${height}px`}
        language="strategyDSL"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        beforeMount={setupMonacoStrategyDsl}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  )
}
