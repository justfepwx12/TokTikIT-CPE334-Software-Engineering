import { useState, useEffect } from 'react'
import { checkSystem } from './api'

function App() {
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isOnline, setIsOnline] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const status = await checkSystem()
      setIsOnline(status.online)
    } catch (err) {
      setIsOnline(false)
      setError('Backend is unavailable. Please check if the server is running.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  return (
    <div className="min-vh-100 bg-white d-flex flex-column justify-content-center align-items-center text-center p-4">
      <h1 className="fw-bold mb-4 display-3" style={{ color: '#004d2d' }}>
        TokTikIT
      </h1>

      {/* 1. Loading State */}
      {isLoading && (
        <div className="d-flex align-items-center gap-2 fw-semibold fs-5 my-3" style={{ color: '#004d2d' }}>
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          Checking backend health...
        </div>
      )}

      {/* 2. Connection Error State */}
      {error && !isLoading && (
        <div className="alert alert-danger shadow-sm rounded-3 px-4 py-3 mb-4" role="alert" style={{ maxWidth: '400px' }}>
          <div className="fw-bold mb-1">Backend Connection Error</div>
          <div>{error}</div>
        </div>
      )}

      {/* 3. Success State (Issue 2) */}
      {isOnline && !error && !isLoading && (
        <div className="alert alert-success shadow-sm rounded-3 px-4 py-3 mb-4" role="alert" style={{ maxWidth: '400px', backgroundColor: '#e6f4ea', borderColor: '#004d2d', color: '#004d2d' }}>
          <div className="fw-bold mb-1">Backend Status</div>
          <div><strong>Status:</strong> ok</div>
          <div><strong>Service:</strong> TokTikIT API</div>
        </div>
      )}

      <button
        onClick={fetchHealth}
        disabled={isLoading}
        className="btn btn-lg text-white px-5 py-3 fw-bold shadow-sm rounded-3"
        style={{ backgroundColor: '#004d2d', borderColor: '#004d2d' }}
      >
        {isLoading ? 'CHECKING...' : 'RE-CHECK HEALTH'}
      </button>
    </div>
  )
}

export default App