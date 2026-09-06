import { useEffect, useState } from 'react'

export function RotatingPhrase({ phrases, className }: { phrases: readonly string[]; className: string }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * phrases.length))
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setIndex((current) => (current + 1) % phrases.length)
    }, 5200)
    return () => window.clearInterval(interval)
  }, [phrases.length])
  return <h1 className={className} key={index}>{phrases[index]}</h1>
}
