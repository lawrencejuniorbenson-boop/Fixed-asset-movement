/**
 * frontend/src/services/fleetData.js
 * Master Institutional Fleet & Driver Register for Corporate Transport & Logistics Unit.
 */

export const INSTITUTIONAL_FLEET = [
  {
    id: 'VEH-01',
    reg_number: 'GN-4421-24',
    name: 'Mercedes-Benz Sprinter Cargo Van',
    category: 'Heavy Logistics Van',
    capacity: '3.5 Tons / 14 m³',
    depot_bay: 'Depot Bay 1 - Central Logistics Garage',
    fuel_type: 'Diesel',
    mileage: '42,150 km',
    assigned_driver_default: 'Yaw Darko',
    condition: 'EXCELLENT',
    features: ['Hydraulic Tail-Lift', 'Heavy Padded Tie-Downs', 'Security Deadlocks', 'GPS Telematics']
  },
  {
    id: 'VEH-02',
    reg_number: 'GT-8832-23',
    name: 'Isuzu Forward Heavy Box Truck',
    category: 'Heavy Cargo Truck',
    capacity: '7.5 Tons / 28 m³',
    depot_bay: 'Depot Bay 2 - Central Depot Yard',
    fuel_type: 'Diesel',
    mileage: '68,400 km',
    assigned_driver_default: 'Emmanuel Tetteh',
    condition: 'EXCELLENT',
    features: ['High-Capacity Enclosed Box', 'Heavy Safe Skid Mounts', 'Dual Side-Loading Doors', 'Shock Dampeners']
  },
  {
    id: 'VEH-03',
    reg_number: 'GE-1904-22',
    name: 'Toyota Hilux Double Cabin 4x4',
    category: 'Express Dispatch & Escort',
    capacity: '1.0 Ton',
    depot_bay: 'Depot Bay 3 - Head Office Yard',
    fuel_type: 'Diesel',
    mileage: '51,200 km',
    assigned_driver_default: 'Ibrahim Mensah',
    condition: 'EXCELLENT',
    features: ['All-Weather Canopy', 'Rapid Transit Escort', 'High-Value Asset Lockbox', 'IT Hardware Transit']
  },
  {
    id: 'VEH-04',
    reg_number: 'GW-5510-24',
    name: 'Hyundai HD72 Flatbed Cargo Truck',
    category: 'Heavy Flatbed Carrier',
    capacity: '5.0 Tons / 20 m³',
    depot_bay: 'Depot Bay 4 - Heavy Fleet Yard',
    fuel_type: 'Diesel',
    mileage: '33,900 km',
    assigned_driver_default: 'Samuel Addo',
    condition: 'GOOD',
    features: ['Heavy Tarpaulin Weather Cover', 'Industrial Electric Winch', 'Reinforced Side Gates']
  },
  {
    id: 'VEH-05',
    reg_number: 'GT-9011-23',
    name: 'Nissan NV350 Urban Delivery Van',
    category: 'Urban Enclosed Van',
    capacity: '1.5 Tons / 8 m³',
    depot_bay: 'Depot Bay 5 - Airport City Depot',
    fuel_type: 'Petrol',
    mileage: '29,800 km',
    assigned_driver_default: 'Kwabena Frimpong',
    condition: 'EXCELLENT',
    features: ['Climate Protected', 'Dual Sliding Cargo Doors', 'Archival Record & Document Shelving']
  }
];

export const INSTITUTIONAL_DRIVERS = [
  {
    id: 7,
    staff_id: 'EMP-0189',
    name: 'Yaw Darko',
    email: 'transport.officer@bank.internal',
    phone: '+233 27 772 0189',
    license_class: 'Class F (Heavy Goods & Fleet Logistics)',
    job_title: 'Senior Transport & Logistics Officer',
    experience_years: 9,
    base_depot: 'Central Logistics Depot'
  },
  {
    id: 101,
    staff_id: 'EMP-0195',
    name: 'Emmanuel Tetteh',
    email: 'etetteh@ad.bank.internal',
    phone: '+233 24 660 0195',
    license_class: 'Class D (Heavy Commercial Trucks)',
    job_title: 'Heavy Vehicle & Box Truck Specialist',
    experience_years: 12,
    base_depot: 'Central Logistics Depot'
  },
  {
    id: 102,
    staff_id: 'EMP-0204',
    name: 'Ibrahim Mensah',
    email: 'imensah@ad.bank.internal',
    phone: '+233 20 551 0204',
    license_class: 'Class C (Light Commercial & Van)',
    job_title: 'Logistics Van & Express Dispatch Driver',
    experience_years: 7,
    base_depot: 'Airport City Branch Depot'
  },
  {
    id: 103,
    staff_id: 'EMP-0211',
    name: 'Samuel Addo',
    email: 'saddo@ad.bank.internal',
    phone: '+233 24 883 0211',
    license_class: 'Class D (Commercial Carrier)',
    job_title: 'Flatbed Carrier & Equipment Operator',
    experience_years: 10,
    base_depot: 'Central Fleet Yard'
  }
];

