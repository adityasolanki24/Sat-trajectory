// Core satellite and orbital data types
export interface Satellite {
  id: string;
  name: string;
  noradId: string;
  tle: {
    line1: string;
    line2: string;
  };
  orbitalParams: {
    inclination: number; // degrees
    raan: number; // Right Ascension of Ascending Node
    eccentricity: number;
    argumentOfPerigee: number;
    meanAnomaly: number;
    meanMotion: number; // revolutions per day
    semiMajorAxis: number; // km
    period: number; // minutes
  };
  position: {
    x: number;
    y: number;
    z: number;
  };
  velocity: {
    x: number;
    y: number;
    z: number;
  };
  status: 'active' | 'safe_mode' | 'maneuvering' | 'offline';
  lastUpdate: Date;
}

// Threat detection types
export interface ConjunctionEvent {
  id: string;
  satelliteId: string;
  debrisId: string;
  debrisName: string;
  closestApproachTime: Date;
  closestApproachDistance: number; // km
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  probabilityOfCollision: number; // 0-1
  relativeVelocity: number; // km/s
  actionRequired: boolean;
}

export interface SpaceWeatherEvent {
  id: string;
  type: 'cme' | 'solar_flare' | 'geomagnetic_storm';
  severity: 'minor' | 'moderate' | 'strong' | 'severe' | 'extreme';
  startTime: Date;
  peakTime: Date;
  endTime: Date;
  kIndex?: number; // Geomagnetic activity index
  description: string;
  impactOnSatellites: 'minimal' | 'moderate' | 'severe';
  actionRequired: boolean;
}

// Action types for satellite operations
export interface SuggestedAction {
  id: string;
  satelliteId: string;
  type: 'orbit_adjustment' | 'safe_mode' | 'attitude_change' | 'communication_delay' | 'mitigation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  parameters?: {
    deltaV?: number; // m/s
    direction?: 'prograde' | 'retrograde' | 'normal' | 'anti-normal' | 'radial' | 'anti-radial';
    duration?: number; // minutes
    safeModeLevel?: 'minimal' | 'standard' | 'maximum';
  };
  estimatedEffectiveness: number; // 0-1
  estimatedCost: number; // fuel cost or risk assessment
  executeBy: string;
}

// API response types
export interface CelestrakResponse {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  TLE_LINE0: string;
  TLE_LINE1: string;
  TLE_LINE2: string;
}

export interface NOAAWeatherData {
  time_tag: string;
  kp: number;
  ap: number;
  kp_3hour: number;
  ap_3hour: number;
  kp_1hour: number;
  ap_1hour: number;
}

export interface NASACMEData {
  activityID: string;
  catalog: string;
  startTime: string;
  sourceLocation: string;
  activeRegionNum: number;
  linkedEvents: string[];
  link: string;
  note: string;
  instruments: Array<{
    displayName: string;
  }>;
  cmeAnalyses: Array<{
    time21_5: string;
    latitude: number;
    longitude: number;
    halfAngle: number;
    speed: number;
    type: string;
    isMostAccurate: boolean;
    note: string;
    catalog: string;
  }>;
}

// Dashboard state types
export interface DashboardState {
  satellites: Satellite[];
  activeThreats: (ConjunctionEvent | SpaceWeatherEvent)[];
  suggestedActions: SuggestedAction[];
  spaceWeatherStatus: {
    kIndex: number;
    geomagneticStorm: boolean;
    solarFlareActivity: 'quiet' | 'minor' | 'moderate' | 'strong';
  };
  systemStatus: 'operational' | 'warning' | 'critical';
}

// Component props types
export interface SatelliteCardProps {
  satellite: Satellite;
  onAction: (action: SuggestedAction) => void;
}

export interface ThreatAlertProps {
  threat: ConjunctionEvent | SpaceWeatherEvent;
  onDismiss: (threatId: string) => void;
}

export interface OrbitVisualizationProps {
  satellites: Satellite[];
  threats: ConjunctionEvent[];
  onSatelliteSelect: (satelliteId: string) => void;
}
