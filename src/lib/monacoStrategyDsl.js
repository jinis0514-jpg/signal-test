/**
 * Monaco: 전략 DSL 언어 등록 (토큰 하이라이트 + 자동완성)
 * 한 번만 등록 (HMR 시 중복 방지)
 */

let strategyDslMonacoRegistered = false

const DSL_ID = 'strategyDSL'

export function setupMonacoStrategyDsl(monaco) {
  if (strategyDslMonacoRegistered) return
  strategyDslMonacoRegistered = true

  monaco.languages.register({ id: DSL_ID })

  monaco.languages.setMonarchTokensProvider(DSL_ID, {
    tokenizer: {
      root: [
        [/^#.*$/, 'comment'],
        [/\b(entry|exit|risk)\s*:/, 'keyword'],
        [/\b(entry|exit|risk)\b/, 'keyword'],
        [/\b(and|or)\b/i, 'keyword'],
        [/\b(rsi|close|volume)\b/, 'type'],
        [/\b(ma|ema|sma)\s*\(/, 'type.identifier'],
        [/\d+\.?\d*%?/, 'number'],
        [/[<>]=?/, 'operator'],
        [/[=]/, 'operator'],
        [/:/, 'delimiter'],
        [/[(),]/, 'delimiter.parenthesis'],
      ],
    },
  })

  monaco.languages.setLanguageConfiguration(DSL_ID, {
    comments: { lineComment: '#' },
    brackets: [
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
  })

  const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages

  monaco.languages.registerCompletionItemProvider(DSL_ID, {
    triggerCharacters: [' ', ':', '\n', 'r', 'e', 'm', 's', 't'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const snip = (label, insertText, detail, kind = CompletionItemKind.Snippet) => ({
        label,
        kind,
        detail,
        insertText,
        range,
        insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
      })

      const plain = (label, insertText, detail, kind = CompletionItemKind.Keyword) => ({
        label,
        kind,
        detail,
        insertText,
        range,
      })

      return {
        suggestions: [
          snip('entry', 'entry:\n  ', '진입 섹션'),
          snip('exit', 'exit:\n  ', '청산 섹션'),
          snip('risk', 'risk:\n  ', '리스크 섹션'),
          plain('rsi', 'rsi', 'RSI 지표'),
          snip('rsi(기간)', 'rsi(${1:14})', 'RSI(기간)'),
          snip('close > ma', 'close > ma(${1:20})', '종가 vs 이동평균'),
          snip('close > ema', 'close > ema(${1:20})', '종가 vs EMA'),
          snip('volume 배수', 'volume > ${1:2}', '거래량 평균 대비 배수'),
          snip('stop_loss', 'stop_loss: ${1:2}%', '손절 %'),
          snip('take_profit', 'take_profit: ${1:5}%', '익절 %'),
          snip('rsi_period', 'rsi_period: ${1:14}', 'RSI 기간 (risk)'),
          plain('and', 'and ', '조건 AND (줄 시작)'),
          plain('or', 'or ', '조건 OR'),
        ],
      }
    },
  })
}

export { DSL_ID }
