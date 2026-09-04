import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useRequester } from '../context/RequesterContext'
import styles from './Header.module.css'


const NAV_LINKS = [
  { label: 'My Tickets', href: '/my-tickets' },
  { label: 'Create Ticket', href: '/create-ticket' },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { requester, isLoading } = useRequester()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleChangeRequester = () => {
    setMenuOpen(false)
    navigate(`/select-requester?redirect=${encodeURIComponent(location.pathname)}`)
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <div className={styles.leftSection}>
            <Link to="/" className={styles.brand} onClick={() => setMenuOpen(false)}>
              TokTickIT
            </Link>

            <nav className={styles.nav} aria-label="Main navigation">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={styles.navLink}
                  data-active={isActive(location.pathname, link.href)}
                  aria-current={isActive(location.pathname, link.href) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className={styles.rightSection}>
            {!isLoading && requester && (
              <>
                <span
                  className={styles.requesterLabel}
                  aria-label={`Simulated requester: ${requester.name}`}
                >
                  {requester.name}
                </span>
                <button
                  type="button"
                  className={styles.changeRequesterButton}
                  onClick={handleChangeRequester}
                >
                  Change Requester
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className={styles.menuToggle}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={styles.menuIcon} data-open={menuOpen} />
          </button>
        </div>

        <nav
          id="mobile-nav"
          className={styles.mobileNav}
          data-open={menuOpen}
          aria-label="Mobile navigation"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={styles.mobileNavLink}
              data-active={isActive(location.pathname, link.href)}
              aria-current={isActive(location.pathname, link.href) ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          {!isLoading && requester && (
            <div className={styles.mobileRequesterRow}>
              <span className={styles.requesterLabel}>{requester.name}</span>
              <button
                type="button"
                className={styles.changeRequesterButton}
                onClick={handleChangeRequester}
              >
                Change Requester
              </button>
            </div>
          )}
        </nav>
      </header>

      {!isLoading && !requester && (
        <div className={styles.simulationBanner} role="status">
          <strong>Simulation Mode:</strong>&nbsp;Please select an active Development Requester to
          simulate the user context.
        </div>
      )}
    </>
  )
}