# Desktop Application Setup

This application has been converted to run as a desktop application using Electron.

## Running the Desktop App

### Development Mode
```bash
npm run dev
```
This will:
1. Start the Vite dev server
2. Compile Electron TypeScript files
3. Launch the Electron desktop window

### Build for Production
```bash
npm run build:app
```
This will:
1. Build the React app
2. Compile Electron files
3. Package everything into a distributable desktop application

The built application will be in the `release` folder.

## Available Scripts

- `npm run dev` - Run in development mode (desktop app)
- `npm run dev:web` - Run web version only (for testing)
- `npm run build` - Build web and Electron files
- `npm run build:app` - Build and package desktop application
- `npm run electron` - Run Electron with compiled files

## Project Structure

- `electron/main.ts` - Main Electron process
- `electron/preload.ts` - Preload script for secure IPC
- `dist-electron/` - Compiled Electron files
- `dist/` - Built web application files
- `release/` - Packaged desktop applications

