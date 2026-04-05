import { Component } from 'react'
import ErrorState from './ErrorState'
import Button from './Button'

/**
 * 섹션 단위 Error Boundary — 한 블록 오류가 전체 페이지를 죽이지 않게
 */
export default class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    const { error } = this.state
    const {
      children,
      title = '이 영역을 표시할 수 없습니다',
      fallbackDescription,
    } = this.props

    if (error) {
      const msg = error?.message ?? String(error ?? '')
      return (
        <div className="my-1">
          <ErrorState
            title={title}
            description={fallbackDescription ?? msg}
            onRetry={() => this.setState({ error: null })}
            retryLabel="다시 시도"
          />
          <div className="mt-2 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => window.location.reload()}
            >
              새로고침
            </Button>
          </div>
        </div>
      )
    }
    return children
  }
}
