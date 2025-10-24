# Sat Trajectory - ANT61 Satellite Safety System

## 🎯 Challenge Summary
Build a system where satellite operators can:
1. Input multiple satellites with orbital parameters
2. Receive real-time notifications of dangerous situations
3. Get suggested actions to minimize damage
4. Execute actions through the interface

## 🚨 Key Threats to Address

### 1. Conjunction Events
- **Problem**: Satellites coming close to space debris/asteroids
- **Risk**: Collisions that destroy satellites and create debris
- **Solution**: Real-time conjunction detection and avoidance maneuvers

### 2. CME Events (Coronal Mass Ejection)
- **Problem**: Dense particle streams from the Sun
- **Risk**: Destruction of onboard electronics
- **Solution**: Space weather monitoring and protective actions

## 🛠️ System Components

### Data Integration
- Space-Track.org for conjunction data
- NASA Space Weather Prediction Center
- ESA Space Debris Office
- USSTRATCOM Space Surveillance Network

### Core Features
- Multi-satellite input system
- Real-time threat monitoring
- 3D visualization of orbital threats
- Decision support with suggested actions
- Action execution interface

### Technical Stack
- **Backend**: Python, FastAPI, Astropy
- **Frontend**: React, Three.js
- **Database**: PostgreSQL/MongoDB
- **Real-time**: WebSockets, Redis

## 📊 Success Metrics
- Real-time threat detection accuracy
- Response time to dangerous situations
- User interface usability
- Action execution effectiveness

---
**ANT61 Hackathon October 2025**
