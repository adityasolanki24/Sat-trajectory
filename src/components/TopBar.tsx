import React from 'react'

type TabKey = 'dashboard' | '3d' | '2d' | 'conjunctions' | 'weather' | 'settings'

export function TopBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: '3d', label: '3D Map' },
    { key: '2d', label: '2D Map' },
    { key: 'conjunctions', label: 'Conjunctions' },
    { key: 'weather', label: 'Space Weather' },
    { key: 'settings', label: 'Settings' }
  ]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px',
      background: '#0b0e14',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }}>
      <div style={{ fontWeight: 700, letterSpacing: 1.5, color: '#e5e7eb' }}>MISSION CONTROL</div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: '8px 12px',
              background: active === t.key ? 'linear-gradient(90deg,#111827,#0b1220)' : 'transparent',
              border: active === t.key ? '1px solid rgba(100,181,246,0.35)' : '1px solid rgba(255,255,255,0.12)',
              color: active === t.key ? '#93c5fd' : '#cbd5e1',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >{t.label}</button>
        ))}
      </div>
    </div>
  )
}


