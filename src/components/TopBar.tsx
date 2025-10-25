import React from 'react'

type TabKey = 'dashboard' | '3d' | '2d' | 'conjunctions' | 'weather' | 'settings'

export function TopBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: '3d', label: '3D Map' },
    { key: '2d', label: '2D Map' },
    { key: 'conjunctions', label: 'Conjunctions' }
  ]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      background: 'linear-gradient(180deg, #0a0e17 0%, #070b14 100%)',
      borderBottom: '1px solid rgba(51,65,85,0.5)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
    }}>
      <div style={{ fontWeight: 700, letterSpacing: 2, color: '#f0f9ff', fontSize: 16 }}>MISSION CONTROL</div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: '8px 14px',
              background: active === t.key ? 'linear-gradient(135deg,#1e40af 0%,#3b82f6 100%)' : 'rgba(15,23,42,0.6)',
              border: active === t.key ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(71,85,105,0.4)',
              color: active === t.key ? '#f0f9ff' : '#94a3b8',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: active === t.key ? 600 : 400,
              transition: 'all 0.2s',
              boxShadow: active === t.key ? '0 0 12px rgba(59,130,246,0.3)' : 'none'
            }}
          >{t.label}</button>
        ))}
      </div>
    </div>
  )
}


