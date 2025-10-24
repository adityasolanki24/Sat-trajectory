import React from 'react'

function App() {
  const appStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0c1445 0%, #1a237e 100%)',
    color: 'white',
    fontFamily: 'Inter, sans-serif',
    margin: 0,
    padding: 0
  }

  const headerStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '2rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '2.5rem',
    margin: '0 0 0.5rem 0',
    background: 'linear-gradient(45deg, #64b5f6, #42a5f5)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '1.2rem',
    opacity: 0.8,
    margin: 0
  }

  const mainStyle: React.CSSProperties = {
    padding: '2rem'
  }

  const dashboardStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
    maxWidth: '1200px',
    margin: '0 auto'
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    padding: '2rem',
    textAlign: 'center',
    transition: 'transform 0.2s'
  }

  const cardTitleStyle: React.CSSProperties = {
    margin: '0 0 1rem 0',
    color: '#64b5f6'
  }

  const cardTextStyle: React.CSSProperties = {
    margin: 0,
    opacity: 0.8
  }

  return (
    <div style={appStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>🛰️ Sat Trajectory</h1>
        <p style={subtitleStyle}>ANT61 Satellite Tracking System</p>
      </header>
      <main style={mainStyle}>
        <div style={dashboardStyle}>
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Satellites</h2>
            <p style={cardTextStyle}>Add and track satellites</p>
          </div>
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>3D View</h2>
            <p style={cardTextStyle}>Three.js visualization</p>
          </div>
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Threats</h2>
            <p style={cardTextStyle}>Monitor dangers</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
