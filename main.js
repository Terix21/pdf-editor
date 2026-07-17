const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Register custom scheme 'app' as privileged standard scheme to allow fetch API
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "GhostEdit • Secure PDF Editor & Redactor",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  // Deny all permission requests (camera, microphone, geolocation, etc.) to prevent OS prompts
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });

  // Load via our custom protocol
  mainWindow.loadURL('app://./index.html');
}

app.whenReady().then(() => {
  // Set up custom protocol handler to serve local assets securely
  protocol.handle('app', (request) => {
    const parsedUrl = new URL(request.url);
    let pathname = parsedUrl.pathname;
    
    // Normalize root requests to index.html
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }
    
    // Build local path relative to the app directory
    const filePath = path.normalize(path.join(__dirname, pathname));
    
    // Return a net.fetch response of the file URL
    return net.fetch(pathToFileURL(filePath).href);
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
