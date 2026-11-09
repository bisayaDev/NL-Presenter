// Runs electron-vite with ELECTRON_RUN_AS_NODE cleared. Some hosts (e.g. VS Code
// extensions) set it, which makes Electron start as plain Node and break the app.
const { spawn } = require('node:child_process')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const bin = require('node:path').join(__dirname, '../node_modules/electron-vite/bin/electron-vite.js')
const child = spawn(process.execPath, [bin, ...process.argv.slice(2)], { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))
