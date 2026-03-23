async function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];

    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
        console.log(`Alma CLI — manage your Alma app

Usage:
  alma status                          Check if Alma is running
  alma health                          Detailed health check

  alma config get [path]               Read settings (e.g., "tts.auto")
  alma config set <path> <value>       Update a setting
  alma config list                     List all settings (JSON)

  alma providers                       List configured providers
  alma provider add <name> <type>      Add a new provider (flags: --api-key, --base-url, --models)
  alma provider delete <id>            Remove a provider
  alma providers <id> models           List models for a provider
  alma models                          List all available models
  alma model set <provider:model>      Set default model

  alma threads [limit]                 List recent threads
  alma thread create <title>           Create a new thread
  alma thread delete <id>              Delete a thread
  alma thread search <query>           Search threads
  alma thread compact <id>             Compact a thread's context
  alma thread messages <id> [limit]    Show messages in a thread
  alma thread switch <id>              Switch current chat to a different thread

  alma memory list                     List all memories
  alma memory search <query>           Search memories
  alma memory add <content>            Add a new memory
  alma memory delete <id>              Delete a memory
  alma memory stats                    Memory statistics

  alma voices                          List available TTS voices

  alma image models                    List available image generation models
  alma image generate ...              Generate an image (supports --model, --reference)
  alma image edit ...                  Edit an image (supports --model)

  alma skill list                      List installed skills
  alma skill search <query>            Search skills (via skills.sh)
  alma skill find <query>              Alias for search
  alma skill install <source>          Install a skill (skills.sh or GitHub)
  alma skill update                    Check and update installed skills
  alma skill uninstall <name>          Remove an installed skill

  alma heartbeat [status]               Heartbeat agent status
  alma heartbeat config                 Show heartbeat config
  alma heartbeat enable                 Enable heartbeat
  alma heartbeat disable                Disable heartbeat
  alma heartbeat interval <minutes>       Set heartbeat interval in minutes
  alma heartbeat patrol <enable|disable|config>  Group chat proactive patrol

  alma cron list                        List cron jobs
  alma cron add <name> <type> <sched>   Add a cron job (type: at|every|cron)
  alma cron remove <id>                 Remove a cron job
  alma cron run <id>                    Run a cron job now
  alma cron enable <id>                 Enable a cron job
  alma cron disable <id>                Disable a cron job
  alma cron history <id>                Show job run history

  alma usage                           Usage statistics
  alma export                          Export all data to file
  alma import <file>                   Import data from file

  alma workspace list                  List workspaces
  alma workspace set <id> <path>       Update workspace path

  alma soul                            Show SOUL.md content
  alma soul edit                       Open SOUL.md path for editing
  alma soul set <content>              Replace SOUL.md content
  alma soul append-trait <desc>        Add an evolved personality trait

  alma version                         Show Alma version
  alma update [check|download|install]  Check/download/install updates
  alma dm <userId> <message>            Send a private DM to a Telegram user
  alma msg delete <chatId> <messageId>  Delete (retract) a message
  alma sing generate "lyrics/desc"      Generate a song (Suno via PiAPI)
  alma sing config <piapi-api-key>      Configure PiAPI API key
  alma emotion status                   Show current emotion state
  alma emotion set-base <mood> <energy> <valence> <desc>
  alma emotion set-context <chatId> <mood> <valence> <trigger>
  alma emotion get [chatId]             Get blended emotion (JSON)

  alma browser status                   Chrome Relay connection status
  alma browser tabs                     List open Chrome tabs
  alma browser open [url]               Open a new tab (optionally with URL)
  alma browser goto <tabId> <url>       Navigate tab to URL
  alma browser click <tabId> <selector> Click element by CSS selector
  alma browser type <tabId> <sel> <text> [--enter]  Type into input field
  alma browser screenshot [tabId]       Take screenshot (prints file path)
  alma browser read <tabId>             Read page content as markdown
  alma browser read-dom <tabId>         List interactive DOM elements (JSON)
  alma browser eval <tabId> <code>      Execute JavaScript in page
  alma browser scroll <tabId> <up|down> [amount]  Scroll page
  alma browser back <tabId>             Go back in history
  alma browser forward <tabId>          Go forward in history

  alma help                            Show this help

Environment:
  ALMA_API_URL    API base URL (default: http://localhost:23001)`);
        return;
    }

    // ── Status ──────────────────────────────────────────────
    