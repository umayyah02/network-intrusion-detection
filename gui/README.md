
# INIDS — Frontend Setup Guide

INIDS (Intelligent Network Intrusion Detection System) uses React, TypeScript, Vite, Tailwind CSS and Recharts for its frontend.

The frontend communicates with a separate C++ backend API.

## Requirements

- Node.js 20.19+ or 22.12+ (use a compatible Node.js release)
- npm
- Git (for cloning the repository)
- C++ backend running for live dataset, detection and evaluation features

## 1. Clone the Repository

```bash
git clone https://github.com/umayyah02/network-intrusion-detection.git
cd network-intrusion-detection/gui
```

## 2. Install Dependencies

```bash
npm ci
```

This installs all required packages using `package-lock.json`, including Tailwind CSS and its Vite plugin.

## 3. Configure the Backend URL (Optional)

By default, the frontend connects to:

```text
http://127.0.0.1:8080
```

If your C++ backend uses a different address or port, create a file named `.env.local` inside the `gui` directory:

```env
VITE_API_BASE_URL=http://127.0.0.1:8081
```

Replace the URL with your actual backend address.

Restart the Vite development server after changing `.env.local`.

Note: Port 8081 is only an example. The standard INIDS backend port is 8080.

## 4. Run the Frontend

```bash
npm run dev
```

Open the local URL displayed by Vite, normally:

http://localhost:5173/

For Windows PowerShell systems that block `npm.ps1`, use:

```powershell
npm.cmd run dev
```

## 5. Production Build

```bash
npm run build
```

## 6. Backend Requirement

The React frontend and C++ backend are separate processes.

The backend must be compiled and started independently. The default backend address is:

```text
http://127.0.0.1:8080
```

To check whether the backend is reachable, visit:

http://127.0.0.1:8080/api/health

Start the backend with the appropriate data directory, dataset and port configuration. See the repository's backend documentation and API contract for build instructions.

The frontend can open without the backend, but Dashboard metrics, Dataset Preview, Detection, Threats, Evaluation and Complexity Analysis require a working backend.

## 7. Troubleshooting

### Cannot find package '@tailwindcss/vite'

Run `npm ci` inside `gui` and ensure the latest committed `package.json` and `package-lock.json` have been pulled.

### Failed to fetch

Check that the C++ backend is running, that `VITE_API_BASE_URL` points to the correct address, and that the backend permits requests from the frontend origin.

### npm.ps1 cannot be loaded

On Windows PowerShell, use `npm.cmd` instead of `npm`.

### Vite port 5173 is unavailable

Vite may choose another available port. Open the URL displayed in the terminal.

## Important

Do not commit `node_modules`, `dist`, or local `.env.local` files.

Use a separate feature branch and pull request for changes to the shared project.
