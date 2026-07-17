# 👻 GhostEdit - Secure PDF Editor & Layout Tool

GhostEdit is a premium, secure, and fully-offline desktop PDF editor built on Electron. It enables rich layout operations, drawing, text annotations, highlighting, and advanced secure text redactions (re-rasterized flattening) to protect sensitive information.

---

## 🚀 Key Features

* **🖊️ Rich Annotations:**
  * **Freehand Ink Drawing:** Smooth vector lines with adjustable thickness and opacity.
  * **Text Tool:** Support for multiline text blocks with alignment customization (Left, Center, Right).
  * **Highlighter:** Translucent overlays to highlight key lines.
  * **Redaction Tool:** Visual blackout layers to mark text for secure removal.
* **🔎 Precision Selection & Hit-Testing:**
  * Click to drag, resize, or delete overlays.
  * Precise bounding box hit-testing to select text or drawings anywhere on their bodies.
  * **Text-Selection Highlighting/Redacting:** Double-click or drag-select actual text in the PDF (via native PDF.js text layer elements) to instantly highlight or redact.
* **📂 Advanced Page Layout Operations:**
  * Reorder pages via drag-and-drop.
  * Rotate pages 90° clockwise.
  * Delete unnecessary pages.
  * **Insert Blank Pages:** Add blank pages within your document layout.
  * **Append PDFs:** Load and merge external PDF files locally.
* **🔒 Secure Redaction (Flattened Export):**
  * Settings modal to choose output format (**PNG** for lossless clarity vs. **JPEG** for smaller sizes).
  * Quality controls: **72 DPI** (Draft), **150 DPI** (Standard), and **300 DPI** (High-Resolution Print).
  * Rasterizes pages into flat images, ensuring redacted underlying text can *never* be extracted or recovered.
* **✈️ 100% Secure & Offline:** All dependencies (PDF.js, PDF-Lib, Lucide, SortableJS) are localized to enable offline processing without third-party web requests.

---

## 💻 Tech Stack

* **Core Runtime:** Electron (Node.js + Chromium)
* **Frontend UI:** HTML5, CSS3 (Glassmorphism design system), and Vanilla JavaScript
* **PDF Engines:** PDF.js (Mozilla) & PDF-Lib (JS-based PDF manipulator)
* **Packaging Target:** Electron Builder (NSIS Windows Installer)

---

## 🛠️ Installation & Setup

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (version 18+ recommended) installed.

### 1. Install Dependencies
Run the installation command in your terminal:
```bash
npm install
```
> [!NOTE]
> **Workspace File Lock Error:** If `npm install` fails with an `EBUSY` error on `default_app.asar`, close your active IDE editor temporarily, run `npm install` in your system command prompt/terminal, and then reopen the IDE.

### 2. Run Locally (Development)
Start the desktop application:
```bash
npm start
```

### 3. Debug in VS Code
We provide pre-configured VS Code launch profiles inside `.vscode/launch.json`:
* Open the **Run and Debug** panel (Ctrl+Shift+D).
* Select **`Electron: All`** from the dropdown.
* Press `F5` to launch the app with active debuggers attached to both the **Main Process** and **Renderer Process** (port `9222`).

---

## 📦 Packaging & Windows Code Signing

### Build Installer
To compile and package the app for production (creates an NSIS `.exe` installer inside `dist/`):
```bash
npm run dist
```

### Windows Code Signing Configuration
The builder is configured with `"publisherName": "GhostEdit Developer"`. To sign the built installer:
1. Export your code signing certificate (`.pfx`) to your build environment.
2. Set the following environment variables:
   * **`CSC_LINK`**: Path to your certificate file (or base64 encoded certificate data).
   * **`CSC_KEY_PASSWORD`**: Password for your certificate.
3. Run `npm run dist`. The builder will automatically sign the compiled application.

---

## 📁 Repository Structure

```
├── .vscode/               # VS Code configurations (launch.json debug profiles)
├── vendor/                # Localized dependencies (PDF.js, PDF-Lib, SortableJS, Lucide)
├── main.js                # Electron main process (lifecycle & secure window wrapper)
├── index.html             # UI layout structure & settings modals
├── app.js                 # Frontend application controller (PDF.js rendering & canvas edits)
├── styles.css             # Main styling system (dark mode, glassmorphism UI)
├── package.json           # Node project scripts & packaging build parameters
└── README.md              # Project documentation
```

---

## 📜 License
Internal use only. All rights reserved.
