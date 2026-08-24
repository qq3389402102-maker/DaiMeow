const { spawn, execSync } = require('child_process');

// PowerShell script that polls XInput right stick in a loop
const PS_SCRIPT = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)]
public struct XINPUT_GAMEPAD {
    public ushort wButtons;
    public byte bLeftTrigger, bRightTrigger;
    public short sThumbLX, sThumbLY, sThumbRX, sThumbRY;
}
[StructLayout(LayoutKind.Sequential)]
public struct XINPUT_STATE {
    public uint dwPacketNumber;
    public XINPUT_GAMEPAD Gamepad;
}
public class XI {
    [DllImport("xinput1_4.dll")]
    public static extern int XInputGetState(int i, ref XINPUT_STATE s);
}
"@
$state = New-Object XINPUT_STATE
while ($true) {
    $r = [XI]::XInputGetState(0, [ref]$state)
    if ($r -eq 0) {
        $rx = $state.Gamepad.sThumbRX / 32767.0
        $ry = $state.Gamepad.sThumbRY / 32767.0
        Write-Host "$rx $ry"
    } else {
        Write-Host "none"
    }
    Start-Sleep -Milliseconds 50
}
`;

class GamepadPoller {
  constructor(petWindow) {
    this.petWindow = petWindow;
    this.proc = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;

    try {
      this.proc = spawn('powershell', [
        '-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT
      ], {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });

      let buffer = '';
      this.proc.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'none') continue;
          const parts = trimmed.split(' ');
          if (parts.length < 2) continue;
          const rx = parseFloat(parts[0]);
          const ry = parseFloat(parts[1]);
          if (isNaN(rx) || isNaN(ry)) continue;

          const DEADZONE = 0.15;
          const relX = Math.abs(rx) > DEADZONE ? rx : 0;
          const relY = Math.abs(ry) > DEADZONE ? ry : 0;

          if (this.petWindow && !this.petWindow.isDestroyed()) {
            this.petWindow.webContents.send('pet:gamepad-pos', { relX, relY });
          }
        }
      });

      this.proc.on('error', (err) => {
        console.error('[GamepadPoller] PowerShell error:', err.message);
      });

      // PowerShell 进程退出时重置状态（崩溃后允许重启）
      this.proc.on('exit', () => {
        this.proc = null;
        this.running = false;
      });
    } catch (err) {
      console.error('[GamepadPoller] Failed to start:', err.message);
    }
  }

  stop() {
    this.running = false;
    if (this.proc) {
      try {
        // force kill 整个进程树，避免 PowerShell 在 Start-Sleep 中不响应 kill
        execSync(`taskkill /F /T /PID ${this.proc.pid}`, { windowsHide: true, stdio: 'ignore' });
      } catch {
        // 进程可能已退出，忽略
      }
      this.proc = null;
    }
  }
}

module.exports = { GamepadPoller };
