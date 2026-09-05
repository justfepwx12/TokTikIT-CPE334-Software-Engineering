import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Clock, FileText, PlusCircle, UserCircle, Menu, X, ChevronDown } from 'lucide-react'
import { useRequester } from '../hooks/useRequester'
import styles from './Header.module.css'

const NAV_LINKS = [
  { label: 'My Tickets', href: '/my-tickets', icon: FileText },
  { label: 'Create Ticket', href: '/create-ticket', icon: PlusCircle },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { requester, isLoading } = useRequester()
  
  // State for mobile hamburger menu
  const [menuOpen, setMenuOpen] = useState(false)
  // State for desktop profile dropdown
  const [profileOpen, setProfileOpen] = useState(false)

  const handleChangeRequester = () => {
    setMenuOpen(false)
    setProfileOpen(false)
    navigate(`/select-requester?redirect=${encodeURIComponent(location.pathname)}`)
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <div className={styles.leftSection}>
            {/* TokTickIT Application Identity */}
            <Link to="/" className={styles.brand} onClick={() => setMenuOpen(false)}>
              <Clock size={20} className="me-2" />
              TokTickIT
            </Link>

            {/* Desktop Navigation */}
            <nav className={styles.nav} aria-label="Main navigation">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon
                const active = isActive(location.pathname, link.href)
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={styles.navLink}
                    data-active={active}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={18} className="me-2" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Development Requester Identity Display (Profile Dropdown) */}
          <div className={styles.rightSection}>
            {!isLoading && requester && (
              <div className="d-flex align-items-center dropdown position-relative">
                {/* Profile Trigger */}
                <button
                  type="button"
                  className="btn d-flex align-items-center gap-2 text-white border-0"
                  style={{ background: 'transparent' }}
                  onClick={() => setProfileOpen(!profileOpen)}
                  aria-expanded={profileOpen}
                >
                  <UserCircle size={20} />
                  <span className={styles.requesterLabel} aria-label={`Simulated requester: ${requester.name}`}>
                    {requester.name}
                  </span>
                  <ChevronDown size={16} className="opacity-75" />
                </button>
                
                {/* Dropdown Menu */}
                <ul 
                  className={`dropdown-menu dropdown-menu-end shadow-sm border-0 mt-2 ${profileOpen ? 'show' : ''}`} 
                  style={profileOpen ? { display: 'block', position: 'absolute', top: '100%', right: '0' } : {}}
                >
                  <li>
                    <button
                      type="button"
                      className="dropdown-item py-2"
                      onClick={handleChangeRequester}
                    >
                      Change Requester
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className={styles.menuToggle}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} color="white" /> : <Menu size={24} color="white" />}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        <nav id="mobile-nav" className={styles.mobileNav} data-open={menuOpen}>
          {NAV_LINKS.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                to={link.href}
                className={styles.mobileNavLink}
                data-active={isActive(location.pathname, link.href)}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={18} className="me-2" />
                {link.label}
              </Link>
            )
          })}
          {!isLoading && requester && (
            <div className={styles.mobileRequesterRow}>
              <div className="d-flex align-items-center text-white">
                <UserCircle size={18} className="me-2" />
                <span className={styles.requesterLabel}>{requester.name}</span>
              </div>
              <button type="button" className={styles.changeRequesterButton} onClick={handleChangeRequester}>
                Change
              </button>
            </div>
          )}
        </nav>
      </header>

      {!isLoading && !requester && (
        <div className={styles.simulationBanner} role="status">
          <strong>Simulation Mode:</strong>&nbsp;Please select an active Development Requester to simulate the user context.
        </div>
      )}
    </>
  )
}