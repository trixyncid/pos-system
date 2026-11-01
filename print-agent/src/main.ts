/**
 * Yi Ci Pang print agent. Start it on the cashier PC (the setup script adds
 * it to Windows startup). Settings come from agent.json beside the program,
 * or from the command line:
 *
 *   yicipang-print-agent.exe --origin https://pos.yicipang.example [--port 9123]
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { createHandler, VERSION, type AgentConfig } from "./agent.ts"

function loadConfig(): AgentConfig {
  const config: AgentConfig = { port: 9123, allowedOrigins: ["http://localhost:3000", "http://localhost:3001"] }
  const file = join(dirname(process.execPath), "agent.json")
  const local = existsSync(file) ? file : existsSync("agent.json") ? "agent.json" : null
  if (local) {
    const saved = JSON.parse(readFileSync(local, "utf8")) as Partial<AgentConfig>
    if (saved.port) config.port = saved.port
    if (saved.allowedOrigins?.length) config.allowedOrigins = saved.allowedOrigins
  }
  const args = process.argv.slice(2)
  const origins = args.flatMap((arg, i) => (arg === "--origin" && args[i + 1] ? [args[i + 1]!.replace(/\/$/, "")] : []))
  if (origins.length) config.allowedOrigins = origins
  const port = args.indexOf("--port")
  if (port >= 0 && args[port + 1]) config.port = Number(args[port + 1])
  return config
}

const config = loadConfig()
const log = (line: string) => console.log(`${new Date().toISOString()}  ${line}`)
Bun.serve({ hostname: "127.0.0.1", port: config.port, fetch: createHandler(config, log) })
log(`Yi Ci Pang print agent ${VERSION} on http://127.0.0.1:${config.port}`)
log(`Allowed POS: ${config.allowedOrigins.join(", ")}`)
