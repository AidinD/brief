#!/usr/bin/env node
/**
 * Print the command that schedules the morning run. Registers nothing itself.
 *
 * A task that starts something every time you log in is persistent
 * configuration on somebody's machine, so it is theirs to install. This prints
 * exactly what to run, with the settings that matter spelled out rather than
 * buried in a GUI.
 *
 * ## Why two triggers
 *
 * A daily time alone is wrong for a desktop: the machine is often off at 07:00,
 * and a missed trigger is simply missed. `StartWhenAvailable` fixes that - the
 * task runs as soon as the machine is up again - and a logon trigger covers the
 * case where it was off long enough for Windows to give up.
 *
 * Two triggers means it can fire twice. That is fine, and deliberately so: the
 * once-a-day promise is kept by `morning.mjs`, which does nothing if today's
 * brief already exists. A guard in the script survives reboots, clock changes
 * and somebody running it by hand; a guard in the scheduler does not.
 *
 *   node scripts/schedule.mjs [--at HH:MM]
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireDataDir } from '../src/domain/paths.js';

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = requireDataDir();

const atIndex = process.argv.indexOf('--at');
const at = atIndex === -1 ? '07:00' : process.argv[atIndex + 1];
if (!/^\d{2}:\d{2}$/.test(at)) {
  console.error('--at wants HH:MM, e.g. --at 06:45');
  process.exit(1);
}

console.log(`# Run this in PowerShell. It registers one task for your account only.
# Nothing here needs administrator rights.

$action = New-ScheduledTaskAction -Execute "node.exe" \`
  -Argument "scripts\\morning.mjs" \`
  -WorkingDirectory "${repoDir}"

# Two triggers, and the script is what stops it running twice.
$daily = New-ScheduledTaskTrigger -Daily -At ${at}
$logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# StartWhenAvailable is the one that matters: the machine is often off at ${at},
# and without it a missed trigger is just missed.
$settings = New-ScheduledTaskSettingsSet \`
  -StartWhenAvailable \`
  -DontStopIfGoingOnBatteries \`
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) \`
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName "Brief morning" \`
  -Description "Writes today's Brief. Does nothing if today's already exists." \`
  -Action $action -Trigger $daily, $logon -Settings $settings -Force

# Check it, and try it now without waiting for tomorrow:
#   Get-ScheduledTask "Brief morning" | Get-ScheduledTaskInfo
#   Start-ScheduledTask "Brief morning"
#
# It writes what it did to:
#   ${join(dataDir, 'morning.log')}
# A morning with no brief and a morning with no news look identical from the
# outside, and that file is the only thing that tells them apart.
#
# To remove it:
#   Unregister-ScheduledTask "Brief morning" -Confirm:$false`);
