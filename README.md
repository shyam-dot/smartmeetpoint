<p align="center">
  <h1 align="center">📍 MeetHub</h1>
  <p align="center">
    Find the perfect meeting spot between multiple locations.
    <br />
    <a href="#getting-started"><strong>Get Started »</strong></a>
    <br />
    <br />
    <a href="#features">Features</a>
    ·
    <a href="https://github.com/shyam-dot/MeetHub/issues">Report Bug</a>
    ·
    <a href="https://github.com/shyam-dot/MeetHub/issues">Request Feature</a>
  </p>
</p>

---

MeetHub is a frontend web app that calculates the geographic midpoint between multiple locations, displays realistic travel ETAs, and suggests nearby places. Enter any number of cities, addresses, or landmarks and see where everyone should meet.

live demo : smartmeetpoint.netlify.app

> **🎉 Zero Setup Required!** MeetHub runs entirely on free, open-source APIs. No API keys, tokens, or backend servers are needed to start.

## Features

- **Multi-location input** — Add unlimited friends with editable names and locations
- **Real-time geocoding** — Powered by Nominatim (OpenStreetMap)
- **Midpoint calculation** — Geographic center mathematically computed locally
- **Travel ETAs & Fairness** — Real-time driving, walking, or cycling ETAs using OSRM
- **Smart Suggestions** — Nearby cafés, restaurants, and bars fetched via Overpass API
- **Interactive map** — Lightweight Leaflet integration with beautiful monochrome styling
- **Zero storage** — No database, no accounts, complete privacy

## Tech Stack

| Technology                  | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| **React 18**                | UI component rendering                       |
| **Leaflet**                 | Interactive interactive map display          |
| **Nominatim (OSM)**         | Forward and reverse geocoding                |
| **Project OSRM**            | Route calculations and drive/walk/bike ETAs  |
| **Overpass API**            | Fetching nearby meeting venues               |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v14+
- _No API keys required!_

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/MeetHub.git
   cd MeetHub
   ```

2. Start the app
   ```bash
   npm install
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter a location in the input field and click **Add**
2. Repeat for as many friends as you like (you can click the `✎` icon to edit later)
3. Choose your preferred travel mode (🚗, 🚲, or 🚶)
4. Click **🔍 Find Meeting Point**
5. View the interactive map and review:
   - 📍 **The Meeting Point** — coordinates and fairness score
   - 🕐 **Travel Times** — exactly how long it takes each person to travel
   - 🏪 **Nearby Places** — suggested venues directly around the midpoint

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
