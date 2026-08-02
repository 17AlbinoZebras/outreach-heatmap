'use strict'

const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Patient Heatmap',
    icon: path.join(__dirname, '..', 'src', 'app', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Load the static Next.js export from the out/ directory.
  // assetPrefix: './' in next.config.ts makes all chunk paths relative,
  // so they resolve correctly when the HTML is loaded via file://.
  win.loadFile(path.join(__dirname, '..', 'out', 'index.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
