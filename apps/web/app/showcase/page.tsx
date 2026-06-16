'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { SHOWCASE_PROJECTS, type ShowcaseProject } from '@/lib/showcase'

const TALLY_SHOWCASE_ID = 'NpPPjW'

function useTally() {
  useEffect(() => {
    if (document.querySelector('script[src*="tally.so"]')) return
    const s = document.createElement('script')
    s.src = 'https://tally.so/widgets/embed.js'
    s.async = true
    document.head.appendChild(s)
  }, [])
}

const t = {
  bg:       '#0C0B0A',
  bg2:      '#131210',
  bg3:      '#1C1916',
  border:   '#252220',
  border2:  '#34302B',
  text:     '#EDE9E3',
  text2:    '#B0A99F',
  muted:    '#706B65',
  faint:    '#403C38',
  accent:   '#C5A253',
  accentLow:'rgba(197,162,83,0.10)',
  accentMid:'rgba(197,162,83,0.28)',
}

const ALL_TAGS = ['All', ...Array.from(new Set(SHOWCASE_PROJECTS.map(p => p.tag))).sort()]

function ShowcaseCard({ project }: { project: ShowcaseProject }) {
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const domain = (() => { try { return new URL(project.url).hostname.replace('www.', '') } catch { return project.url } })()

  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        background: t.bg2,
        border: `1px solid ${hovered ? t.border2 : t.border}`,
        borderRadius: 12,
        textDecoration: 'none',
        boxShadow: hovered ? `0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px ${t.border2}` : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'box-shadow 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.15s',
      }}
    >
      {/* Thumbnail — overflow:hidden here, not on card, so expandable section isn't clipped */}
      <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: t.bg3, borderRadius: '11px 11px 0 0' }}>
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)', transform: hovered ? 'scale(1.04)' : 'scale(1)' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${t.bg3} 0%, #201E1B 100%)` }}>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 56, fontWeight: 700, color: t.faint, letterSpacing: '-0.04em', userSelect: 'none' }}>{project.name[0]}</span>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(to top, ${t.bg2}, transparent)`, pointerEvents: 'none' }} />
        {/* Tag */}
        <div style={{ position: 'absolute', top: 12, right: 12, padding: '3px 10px', background: 'rgba(12,11,10,0.75)', backdropFilter: 'blur(8px)', borderRadius: 20, border: `1px solid ${t.border}`, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.text2 }}>
          {project.tag}
        </div>
      </div>

      {/* Body — logo badge sits here so it isn't clipped by the thumbnail's overflow:hidden */}
      <div style={{ padding: '36px 20px 20px', position: 'relative' }}>
        {/* Logo badge */}
        <div style={{ position: 'absolute', top: -20, left: 20, width: 50, height: 50, padding: 7, borderRadius: 10, background: t.bg2, border: `1px solid ${t.border2}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          {project.logo ? (
            <img src={project.logo} alt={`${project.name} logo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.accentLow, color: t.accent, fontFamily: 'DM Sans, sans-serif', fontSize: 16, fontWeight: 700 }}>
              {project.name[0]}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8, marginTop: 8 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: t.text, lineHeight: 1.3 }}>
            {project.name}
          </div>
          <svg style={{ flexShrink: 0, marginTop: 2, color: hovered ? t.accent : t.muted, transition: 'color 0.15s' }} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 11.5L11.5 2.5M6.5 2.5H11.5V7.5" />
          </svg>
        </div>
        <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.65, margin: '0 0 14px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {project.description}
        </p>

        {/* Domain + toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted, letterSpacing: '0.02em' }}>
            {domain}
          </div>
          {project.howUsed && project.howUsed.length > 0 && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setExpanded(v => !v) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.05em',
                color: expanded ? t.accent : t.faint,
                transition: 'color 0.15s',
                flexShrink: 0,
              }}
            >
              how we used argens
              <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', fontSize: 9 }}>▾</span>
            </button>
          )}
        </div>

        {/* Expandable how-we-used section */}
        {project.howUsed && project.howUsed.length > 0 && (
          <div style={{
            overflow: 'hidden',
            maxHeight: expanded ? 400 : 0,
            opacity: expanded ? 1 : 0,
            transition: 'max-height 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.22s ease',
          }}>
            <ul style={{ margin: '12px 0 0', padding: '12px 0 0 0', borderTop: `1px solid ${t.border}`, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {project.howUsed.map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: t.text2, lineHeight: 1.6 }}>
                  <span style={{ color: t.accent, fontSize: 10, marginTop: 3, flexShrink: 0 }}>◆</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </a>
  )
}

export default function ShowcasePage() {
  useTally()
  const [activeTag, setActiveTag] = useState('All')
  const filtered = activeTag === 'All' ? SHOWCASE_PROJECTS : SHOWCASE_PROJECTS.filter(p => p.tag === activeTag)

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text }}>
      <style>{`
        * { box-sizing: border-box; }
        @media (max-width: 767px) {
          .sc-grid { grid-template-columns: 1fr !important; }
          .sc-header { padding: 100px 20px 48px !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .sc-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 clamp(16px,4vw,40px)', height: 58, background: 'rgba(12,11,10,0.88)', backdropFilter: 'blur(18px) saturate(130%)', borderBottom: `1px solid ${t.border}` }}>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/" style={{ fontSize: 13, color: t.muted, textDecoration: 'none' }}>← Back</Link>
          <Link href="/signup" style={{ padding: '7px 16px', background: t.accent, borderRadius: 7, fontSize: 13, fontWeight: 600, color: t.bg, textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="sc-header" style={{ padding: 'clamp(96px,12vw,140px) clamp(20px,4vw,40px) 56px', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse at 50% 0%, rgba(197,162,83,0.09) 0%, transparent 70%)', borderRadius: '50%' }} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 20, border: `1px solid ${t.accentMid}`, background: t.accentLow, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.accent, marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, flexShrink: 0 }} />
            Built with Argens
          </div>
          <h1 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 'clamp(32px,5vw,56px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08, margin: '0 0 18px', color: t.text }}>
            Products shipping<br />on Argens
          </h1>
          <p style={{ fontSize: 16, color: t.muted, lineHeight: 1.75, margin: '0 0 28px', maxWidth: 480, marginInline: 'auto' }}>
            Developers are building with Argens to give their agents real spending power. See what they ship.
          </p>
          <button
            data-tally-open={TALLY_SHOWCASE_ID}
            data-tally-layout="modal"
            data-tally-width="480"
            style={{ padding: '10px 22px', borderRadius: 8, border: `1px solid ${t.border2}`, background: 'transparent', color: t.text2, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}
          >
            Submit your project →
          </button>
          {SHOWCASE_PROJECTS.length === 0 && (
            <div style={{ marginTop: 32, padding: '16px 24px', background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, display: 'inline-block' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: t.muted }}>No projects yet — check back soon.</div>
            </div>
          )}
        </div>
      </div>

      {SHOWCASE_PROJECTS.length > 0 && (
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 clamp(20px,4vw,40px) 96px' }}>
          {/* Tag filter */}
          {ALL_TAGS.length > 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 40, paddingBottom: 32, borderBottom: `1px solid ${t.border}` }}>
              {ALL_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1px solid ${activeTag === tag ? t.accentMid : t.border}`,
                    background: activeTag === tag ? t.accentLow : 'transparent',
                    color: activeTag === tag ? t.accent : t.muted,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    letterSpacing: '0.04em',
                  }}
                >
                  {tag}
                  {tag !== 'All' && (
                    <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>
                      {SHOWCASE_PROJECTS.filter(p => p.tag === tag).length}
                    </span>
                  )}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.faint }}>
                {filtered.length} project{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Grid */}
          <div className="sc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {filtered.map(p => <ShowcaseCard key={p.name} project={p} />)}
          </div>

          {/* Submit CTA */}
          <div style={{ marginTop: 64, padding: '32px 36px', background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 16, fontWeight: 600, marginBottom: 6, color: t.text }}>Built something with Argens?</div>
              <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.6 }}>Ship it here. Send us a note with your project name, a short description, and a thumbnail.</div>
            </div>
            <a href="mailto:hello@argens.xyz?subject=Showcase submission" style={{ padding: '10px 22px', background: t.accent, borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: t.bg, textDecoration: 'none', flexShrink: 0 }}>
              Submit your project →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
