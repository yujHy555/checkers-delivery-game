# ⚡ Checkers Sixty60 Hyper - 3D Arcade Van Delivery Game

An interactive, 3D isometric & third-person delivery game built with **Three.js** and **Vite**, featuring arcade vehicle handling, dynamic suspension, power drifts, skid marks, jump ramps, and a fully rigged 3D driver character with van entry/exit and door animations.

Designed for desktop, laptop, and mobile touch devices.

---

## 🎮 Live Local Preview
The development server is running locally:
- **Local URL**: [http://localhost:3000/](http://localhost:3000/)

---

## ✨ Features

1. **Triple-AAA Arcade Vehicle Physics**:
   - **Raycast Spring-Damper Suspension**: 4 independent springs with realistic compression, bounce, and high jump landing thud.
   - **Weight Transfer Inertia**: Dynamic chassis body roll on sharp turns, squat during rapid acceleration, and nose-dive under hard braking.
   - **Drifting Mechanics**: Handbrake drift (`Space` or on-screen drift button) initiates controllable power slides with dynamic tire smoke particles.
   - **Dynamic Skid Marks**: Procedural 3D tire mark ribbon meshes generated when tires lose traction.
   - **Stunt Jump Ramps**: Placed along the avenue to launch the van and test arcade air stabilization.

2. **Checkers Sixty60 Hyper Delivery Van**:
   - Authentic two-tone split livery: Vibrant emerald green top and turquoise/cyan bottom with the distinctive white lightning bolt divider.
   - "Checkers Hyper" bold branding on side panels and roof, with "NOW ON SIXTY60" circular clock emblems.
   - Lifted off-road suspension with black flared arches and chunky all-terrain treaded tires on star alloy wheels.
   - Aerodynamic rooftop rear spoiler / wing.
   - **Animated Doors**:
     - *Driver front door*: Swings open 65° for driver entry and exit.
     - *Side sliding door*: Shifts outward 0.08m and slides backward 1.05m along the side rail.
     - *Rear barn doors*: Dual doors swing open 120° outward to reveal the cargo hold.
   - Stocked cargo area with Checkers Sixty60 branded kraft paper grocery delivery bags.

3. **Mixamo-Compatible Rigged Driver Character**:
   - Fully articulated skeletal bone hierarchy (`mixamorigHips`, `mixamorigSpine`, `mixamorigChest`, `mixamorigNeck`, `mixamorigHead`, arms, legs, and feet).
   - Dressed in Checkers Sixty60 cyan racing suit and helmet with tinted visor.
   - **Dynamic State Machine**:
     - *Driving*: Seated in cockpit holding the steering wheel (which rotates with steering angle).
     - *Entering/Exiting*: Seamless transitions walking up to the door and stepping inside or out.
     - *On Foot Walk / Run*: Procedural walk and sprint cycles with natural limb kinematics.
     - *Carrying Bag*: Holds paper grocery bags with both hands cradled forward.
     - *Door Interaction*: Opens sliding and rear doors to grab customer delivery bags.

4. **Camera System**:
   - **3D Isometric View**: Elevated 45-degree isometric projection for a miniature city arcade perspective.
   - **Third-Person Dynamic Chase View**: Behind-the-van camera with speed FOV kick, drift lag, and suspension framing.
   - **On-Foot Orbital Follow**: Tracks the driver when walking around outside the vehicle.
   - Toggle seamlessly with the `C` key or on-screen camera button.

5. **Delivery Gameplay Loop**:
   - Central Checkers Supermarket hub and suburban neighborhood.
   - Active orders with 3D glowing beacon light cylinders and bouncing GPS arrows.
   - Minimap radar showing real-time van position, orientation, and delivery pins.
   - Delivery bag doorstep drop-off, celebratory particle bursts, score tally, and delivery chimes.

6. **Web Audio API Procedural Synthesizer**:
   - Engine acceleration roar and RPM pitch shifting.
   - Filtered noise tire screeching when drifting.
   - Door sliding and latch clunks.
   - Major arpeggio delivery fanfare chime.

7. **Drag-and-Drop Blender GLB / GLTF Loader**:
   - Drop any custom `.glb` or `.gltf` model exported from Blender directly into the running game window to preview and test it with physics and animations!

---

## 🕹️ Controls

### Desktop Keyboard & Mouse
| Key | Action |
| --- | --- |
| `W` / `Up Arrow` | Accelerate / Drive Forward / Walk Forward |
| `S` / `Down Arrow` | Brake / Reverse / Walk Backward |
| `A` / `D` / `Left` / `Right` | Steer Left / Right |
| `Space` | Handbrake Drift |
| `Shift` | Sprint (when on foot) |
| `E` / `F` | Enter / Exit Van |
| `H` | Toggle Side Sliding Door |
| `G` | Toggle Rear Barn Doors |
| `Enter` / `Q` | Grab Delivery Bag from Van / Place at Doorstep |
| `C` | Toggle Camera (Isometric ⟷ Third-Person) |
| `R` | Reset Van Upright |

### Mobile / Tablet Touch Controls
- **Virtual Joystick**: Left-thumb analog steering and movement.
- **GAS & BRAKE Pedals**: Touch buttons on right for acceleration and braking.
- **DRIFT Button**: Big yellow drift button for power slides.
- **Action Buttons**: `DELIV`, `E/EXIT`, `SLIDE`, `REAR`, and `CAM`.

---

## 🛠️ Blender Rigging & Export Guidelines

### 1. Vehicle Rigging Structure
When creating and exporting your low-poly van in Blender:
- **Scale**: Use Metric, Unit Scale `1.0`, Meters. Van dimensions: ~`3.4m` (L) x `1.48m` (W) x `1.95m` (H).
- **Node Hierarchy**:
  ```text
  CheckersHyperVan (Armature or Parent Group)
  ├── chassis (Main body, interior, roof wing)
  │   ├── door_driver (Hinged at front pillar, Y-rotation)
  │   ├── door_slide (Translate X +0.08m, Z -1.05m along body rail)
  │   ├── door_rear_L (Hinged at left rear corner, Y-rotation -120°)
  │   ├── door_rear_R (Hinged at right rear corner, Y-rotation +120°)
  │   └── steering_wheel (Hinged at steering column, Z-rotation)
  ├── wheel_FL (Front-left wheel center origin)
  ├── wheel_FR (Front-right wheel center origin)
  ├── wheel_RL (Rear-left wheel center origin)
  └── wheel_RR (Rear-right wheel center origin)
  ```
- **Pivots**: Ensure wheel object origins are centered exactly at the axle hub. Door origins should be on the hinge line.
- **Export Settings**: File -> Export -> `glTF 2.0 (.glb)`. Check:
  - Format: `glTF Binary (.glb)`
  - Transform: `+Y Up`
  - Geometry: `Apply Modifiers`, `Normals`
  - Animation: `Include Animations`

### 2. Mixamo Rigged Character
- Upload your character mesh in T-pose to [Mixamo.com](https://www.mixamo.com/).
- Select standard Mixamo animations (*Idle, Walking, Running, Holding Object*).
- Download as **FBX with Skin**, import into Blender, and export as `.glb`.

---

## 🚀 GitHub & Vercel Deployment Workflow

### 1. Push to GitHub
Create a new repository on your GitHub account (e.g., `checkers-sixty60-game`), then run:
```bash
git remote add origin https://github.com/<YOUR_USERNAME>/checkers-sixty60-game.git
git push -u origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com/) and click **Add New Project**.
2. Select your imported GitHub repository `checkers-sixty60-game`.
3. Vercel automatically detects the `vite` framework and `vercel.json` configuration:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Click **Deploy**. Your 3D Checkers Sixty60 game will be live globally on an `https://*.vercel.app` domain in seconds!
