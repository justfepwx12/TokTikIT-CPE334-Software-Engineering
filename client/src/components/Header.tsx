import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Clock, FileText, PlusCircle, UserCircle, Menu, X, ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Badge from './Badge'
import type { BadgeColor } from './Badge'
import styles from './Header.module.css'

const NAV_LINKS = [
  { label: 'My Tickets', href: '/my-tickets', icon: FileText },
  { label: 'Create Ticket', href: '/create-ticket', icon: PlusCircle },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

const ROLE_BADGE_COLOR: Record<string, BadgeColor> = {
  REQUESTER: 'green',
  IT_STAFF: 'blue',
  ADMIN: 'yellow',
}

function roleLabel(role: string) {
  if (role === 'IT_STAFF') return 'IT Staff'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isLoading, logout } = useAuth()

  // State for mobile hamburger menu
  const [menuOpen, setMenuOpen] = useState(false)
  // State for desktop profile dropdown
  const [profileOpen, setProfileOpen] = useState(false)

  const handleLogout = async () => {
    setMenuOpen(false)
    setProfileOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
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

        {/* Authenticated user identity (BR-04 — from the session, never simulated) */}
        <div className={styles.rightSection}>
          {!isLoading && user && (
            <div className="d-flex align-items-center gap-2">
              <Badge color={ROLE_BADGE_COLOR[user.role] ?? 'gray'}>{roleLabel(user.role)}</Badge>
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
                  <span className={styles.requesterLabel} aria-label={`Signed in as ${user.name}`}>
                    {user.name}
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
                      className="dropdown-item py-2 d-flex align-items-center gap-2"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} /> Log out
                    </button>
                  </li>
                </ul>
              </div>
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
        {!isLoading && user && (
          <div className={styles.mobileRequesterRow}>
            <div className="d-flex align-items-center text-white gap-2">
              <UserCircle size={18} className="me-2" />
              <span className={styles.requesterLabel}>{user.name}</span>
              <Badge color={ROLE_BADGE_COLOR[user.role] ?? 'gray'}>{roleLabel(user.role)}</Badge>
            </div>
            <button type="button" className={styles.changeRequesterButton} onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}
