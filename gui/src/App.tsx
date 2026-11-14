import { AppShell } from './components/layout/AppShell'
import { PageTransition } from './components/layout/PageTransition'
import { useHashPage } from './hooks/useHashPage'
import { ComplexityPage } from './pages/Complexity'
import { Dashboard } from './pages/Dashboard'
import { DatasetPage } from './pages/Dataset'
import { DetectionPage } from './pages/Detection'
import { ResultsPage } from './pages/Results'
import { ThreatsPage } from './pages/Threats'

function App() {
  const [activePage, navigate] = useHashPage()

  function renderPage() {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard />
      case 'Dataset':
        return <DatasetPage />
      case 'Threats':
        return <ThreatsPage />
      case 'Detection':
        return <DetectionPage />
      case 'Results & Evaluation':
        return <ResultsPage />
      case 'Complexity Analysis':
        return <ComplexityPage />
    }
  }

  return (
    <AppShell activePage={activePage} onNavigate={navigate}>
      <PageTransition pageKey={activePage}>{renderPage()}</PageTransition>
    </AppShell>
  )
}

export default App
