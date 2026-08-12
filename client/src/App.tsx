import { useState } from 'react'

function App() {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = () => {
    setIsLoading(true)
    // จำลองสถานะ Loading 2 วินาที
    setTimeout(() => {
      setIsLoading(false)
    }, 2000)
  }

  return (
    <div className="min-vh-100 bg-white d-flex flex-column justify-content-center align-items-center text-center p-4">
      {/* App Title */}
      <h1 className="fw-bold mb-3 display-3 text-success d-flex align-items-center gap-2" style={{ color: '#004d2d' }}>
        <span>⏱</span> TokTikIT
      </h1>

      {/* LET GO Button & Loading State */}
      {isLoading ? (
        <div className="d-flex align-items-center gap-2 fw-semibold fs-5" style={{ color: '#004d2d' }}>
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          Loading...
        </div>
      ) : (
        <button
          onClick={handleClick}
          className="btn btn-lg text-white px-5 py-3 fw-bold shadow-sm rounded-3"
          style={{ backgroundColor: '#004d2d', borderColor: '#004d2d' }}
        >
          LET GO 
        </button>
      )}
    </div>
  )
}

export default App