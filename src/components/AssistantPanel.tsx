import React, { useMemo, useState } from 'react'

type AssistantCommand = {
  name: string
  args?: Record<string, any>
}

export type AssistantResponse = {
  title?: string
  rationale?: string
  commands: AssistantCommand[]
}

type AssistantPanelProps = {
  buildState: () => any
  onExecutePlan: (commands: AssistantCommand[]) => void
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({ buildState, onExecutePlan }) => {
  const [msg, setMsg] = useState('')
  const [auto, setAuto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resp, setResp] = useState<AssistantResponse | null>(null)
  const [collapsed, setCollapsed] = useState(true) // Start collapsed
  const [hasEmergency, setHasEmergency] = useState(false)
  const lastStateRef = React.useRef<string>('')

  const canExec = useMemo(() => !!resp && resp.commands && resp.commands.length > 0, [resp])

  // Auto-trigger AI when threats are detected
  React.useEffect(() => {
    const state = buildState()
    
    // Check for collision risks
    if (state.detectedCollisionRisks && state.detectedCollisionRisks.length > 0) {
      const highestRisk = state.detectedCollisionRisks[0]
      const riskKey = `collision_${highestRisk.targetName}_${highestRisk.missDistanceKm}_${highestRisk.tcaDate}`
      
      if (lastStateRef.current !== riskKey) {
        if (highestRisk && (highestRisk.riskLevel === 'CRITICAL' || highestRisk.riskLevel === 'HIGH')) {
          console.log('[AI] Auto-detecting conjunction risk:', highestRisk)
          lastStateRef.current = riskKey
          setHasEmergency(true)
          setCollapsed(false)
          ask('collision_alert')
          return; // Process this alert
        }
      }
    }
    
    // Check for space weather threats
    if (state.spaceWeatherThreats && state.spaceWeatherThreats.length > 0) {
      const threat = state.spaceWeatherThreats[state.spaceWeatherThreats.length - 1] // Latest threat
      const threatKey = `weather_${threat.eventType}_${threat.startTime}_${threat.affectedSatellites.join('_')}`
      
      if (lastStateRef.current !== threatKey) {
        if (threat && (threat.severity === 'Critical' || threat.severity === 'High')) {
          console.log('[AI] Auto-detecting space weather threat:', threat)
          lastStateRef.current = threatKey
          setHasEmergency(true)
          setCollapsed(false)
          ask('space_weather_alert')
          return; // Process this alert
        }
      }
    }
    
    // No emergency, allow auto-collapse
    if (hasEmergency && !state.detectedCollisionRisks?.length && !state.spaceWeatherThreats?.length) {
      setTimeout(() => {
        setHasEmergency(false)
        setCollapsed(true)
      }, 3000)
    }
  }, [buildState, hasEmergency])

  const ask = async (trigger?: string) => {
    try {
      setLoading(true)
      const r = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: buildState(), userMessage: msg, trigger })
      })
      const data = await r.json()
      setResp(data)
      if (auto && data?.commands?.length) onExecutePlan(data.commands)
    } catch (e) {
      console.error('assistant failed', e)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', right: 16, top: 80, width: collapsed ? 200 : 380, maxHeight: collapsed ? 'auto' : 'calc(100vh - 100px)', overflowY: 'auto', background: 'rgba(7,11,20,0.95)', border: hasEmergency ? '2px solid #ef4444' : '1px solid rgba(100,116,139,0.3)', borderRadius: 12, padding: 14, zIndex: 50, boxShadow: hasEmergency ? '0 0 24px rgba(239,68,68,0.5)' : '0 8px 32px rgba(0,0,0,0.4)', transition: 'all 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? 0 : 10 }}>
        <div style={{ fontWeight: 700, color: hasEmergency ? '#ef4444' : '#60a5fa', fontSize: 15 }}>
          {hasEmergency ? 'ALERT' : 'AI Ops Copilot'}
        </div>
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          style={{ background: 'transparent', border: '1px solid rgba(100,116,139,0.4)', color: '#94a3b8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!collapsed && (<>

      <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Ask for actions…" style={{ width: '100%', height: 70, background: '#0b1220', color: '#e5e7eb', border: '1px solid #243044', borderRadius: 6, padding: 8 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={()=>ask(undefined)} disabled={loading} style={{ flex: 1, padding: '6px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{loading? 'Thinking…':'Suggest'}</button>
        <label style={{ display:'flex', alignItems:'center', gap:6, color:'#e5e7eb', fontSize: 12 }}>
          <input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} /> Auto‑execute
        </label>
      </div>

      {resp && (
        <div style={{ marginTop: 10, background:'#0b1220', border:'1px solid #243044', borderRadius:6, padding:8, color:'#cbd5e1' }}>
          {resp.title && <div style={{ fontWeight:700, marginBottom:6 }}>{resp.title}</div>}
          {resp.rationale && <div style={{ opacity:0.9, marginBottom:8 }}>{resp.rationale}</div>}
          {resp.commands?.length>0 ? (
            <div>
              {resp.commands.map((c, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <code style={{ fontSize:12, background:'#0a1020', padding:'4px 6px', borderRadius:4 }}>{c.name}{c.args?` ${JSON.stringify(c.args)}`:''}</code>
                </div>
              ))}
              <button onClick={()=>onExecutePlan(resp.commands)} style={{ marginTop:6, padding:'6px 10px', background:'#10b981', color:'#062019', fontWeight:700, border:'none', borderRadius:6, cursor:'pointer' }}>Execute all</button>
            </div>
          ) : <div>No commands.</div>}
        </div>
      )}
      </>)}
    </div>
  )
}


