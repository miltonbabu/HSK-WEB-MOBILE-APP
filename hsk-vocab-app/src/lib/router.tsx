'use client'

import NextLink from 'next/link'
import { useRouter, usePathname, useSearchParams as nextUseSearchParams } from 'next/navigation'
import { type ReactNode, useCallback, useMemo } from 'react'

type LinkProps = {
  to: string
  children: ReactNode
  className?: string
  replace?: boolean
  onClick?: (e: React.MouseEvent) => void
  [key: string]: unknown
}

export function Link({ to, children, className, replace, onClick }: LinkProps) {
  return (
    <NextLink href={to} className={className} onClick={onClick} replace={replace}>
      {children}
    </NextLink>
  )
}

export function useNavigate() {
  const router = useRouter()
  return useCallback(
    (to: string | number, options?: { replace?: boolean }) => {
      if (typeof to === 'number') {
        if (to < 0) router.back()
        else router.forward()
        return
      }
      if (options?.replace) {
        router.replace(to)
      } else {
        router.push(to)
      }
    },
    [router],
  )
}

export function useLocation() {
  const pathname = usePathname()
  const searchParams = nextUseSearchParams()
  const search = useMemo(() => {
    const sp = searchParams?.toString()
    return sp ? `?${sp}` : ''
  }, [searchParams])
  return useMemo(() => ({ pathname, search, hash: '' }), [pathname, search])
}

export function useSearchParams() {
  const params = nextUseSearchParams()
  return [params, () => {}] as const
}

export function Outlet({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter()
  useMemo(() => {
    if (replace) router.replace(to)
    else router.push(to)
  }, [router, to, replace])
  return null
}