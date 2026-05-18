import ReactDOM from 'react-dom/client'
import AppRoot from './AppRoot'
import './index.css'
import { initTheme, useTheme } from './hooks/useTheme'

initTheme()

function ThemeBootstrap() {
  useTheme()
  return <AppRoot />
}

ReactDOM.createRoot(document.getElementById('root')).render(<ThemeBootstrap />)
