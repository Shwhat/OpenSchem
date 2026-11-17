# Technical

## Architecture

| Part | Technology |
|---|---|
| Server | Go, a single program using only the standard library |
| Interface | Plain HTML, CSS and JavaScript, built into one page by the server |
| Storage | JSON files in the data folder; projects as `.osp` files |
| Passwords | PBKDF2-SHA256 hashes |
| Packaging | A Docker image from scratch, for amd64 and arm64 |

## Updates

- A new version is installed by pulling the new image and restarting the container.
- A new version resets the saved ribbon layout so new buttons appear.
- The version is shown at the top of this guide.

## Third-party components

| Component | Used for | License |
|---|---|---|
| jsPDF | PDF export | MIT |
| svg2pdf.js | Vector drawings in PDF export | MIT |
| Go standard library | Server | BSD 3-Clause |
