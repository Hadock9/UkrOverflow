import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Прокручує вікно на початок при зміні маршруту (pathname, search, hash).
 * Покриває кліки по тегах (/tags/:tag, /news?tag=) та звичайну навігацію.
 */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const id = hash.slice(1)
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, search, hash])

  return null
}
