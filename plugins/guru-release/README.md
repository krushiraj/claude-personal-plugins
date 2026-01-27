# guru-release

Guided deployment workflow for Guru staging and production releases.

## Features

- **Full workflow commands**: `/guru-release:staging` and `/guru-release:production` for complete guided deployments
- **Individual phase commands**: Run specific phases like review, version, push, env check, or verify
- **Release notes generation**: Automatically extracts ticket IDs from commits and PRs, formats Slack-ready messages
- **Cross-repo awareness**: Detects related changes in misc, shared, and pp that may affect guru
- **Server env verification**: SSH checks for guru-env on all staging/production servers
- **Checkpoint confirmations**: Stops for user approval at critical steps

## Quick Start

### Full Staging Deployment
```
/guru-release:staging
```
This guides you through the complete staging deployment with checkpoints at each phase.

### Full Production Deployment
```
/guru-release:production
```
Promotes staging to production with appropriate checkpoints.

### Individual Commands
Use these when you need to run a specific phase or recover from an interrupted deployment:

```
/guru-release:review staging    # Review changes and generate release notes
/guru-release:version 1.3.16    # Create version commit and tag
/guru-release:push staging      # Push and merge to release branch
/guru-release:env staging       # Check server environment files
/guru-release:verify staging    # Run smoke tests
```

## Commands Reference

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/guru-release:staging` | Full staging deployment workflow with checkpoints | None |
| `/guru-release:production` | Full production deployment workflow | None |
| `/guru-release:review` | Review changes and generate release notes | `staging` or `production` |
| `/guru-release:version` | Create version commit and tag | Optional: version number (reads current from package.json) |
| `/guru-release:push` | Push changes and merge to release branch | `staging` or `production` |
| `/guru-release:env` | Verify guru-env on servers | `staging` or `production` |
| `/guru-release:verify` | Run smoke tests and verify deployment | `staging` or `production` |

## Deployment Workflow

### Staging Deployment Phases

1. **Review** - Generate diff and release notes, check for cross-repo changes
2. **Version** - Read current version from package.json, create version commit and tag (e.g., v1.3.16)
3. **Push** - Push tags to origin, rebase staging branch from sprint
4. **Environment** - Verify guru-env on all staging servers
5. **Build** - Monitor Jenkins build (automatic trigger)
6. **Verify** - Run smoke tests

### Production Deployment Phases

1. **Review** - Generate diff between staging and production
2. **Push** - Rebase production branch from staging
3. **Environment** - Verify guru-env on all production servers
4. **Build** - Monitor Jenkins build (automatic trigger)
5. **Verify** - Run smoke tests

### Branch Flow
```
sprint → release/staging/guru → release/production/guru
```

## Output Files

During the review phase, the plugin creates files in `js/guru/`:

- **`guru-release-notes.md`** - Formatted release notes with:
  - Slack-ready announcement message
  - List of tickets with descriptions
  - Cross-repo changes (if any)

- **`guru-diff.txt`** - Full git diff for review

### Slack Message Format
```
Triggered build for Guru v1.3.16 Staging, this includes:
- [ID-1945] Fix for journal title
- [ID-1909] Fix for HTML parser to parse pmid with strict checks
- [ID-1889] Log ES query and timings together
```

## Server Configuration

### Staging Servers (SSH aliases)
- `stage-node-london-1`
- `stage-node-virginia-1`
- `stage-node-virginia-2`
- `stage-workers-virginia-1`
- `stage-workers-virginia-2`

### Production Servers (SSH aliases)
- `production-node-london-1`
- `production-node-virginia-1`
- `production-node-virginia-2`
- `production-workers-virginia-1`
- `production-workers-virginia-2`

**Note**: Workers require mandatory env vars in `/mount/data/guru/guru-env` or deployment will fail.

## Jenkins URLs

- Staging build: http://localhost:8090/job/Guru%20staging/
- Production build: http://localhost:8090/job/Guru%20production/
- Manual staging deploy: http://localhost:8090/job/Deploy%20staging%20-%20js-guru/
- Smoke tests: http://localhost:8090/job/Guru%20smoke%20tests/

## Tips & Troubleshooting

See `skills/guru-deployment/references/tips.md` for accumulated deployment knowledge including:

- Known flaky tests to ignore
- Common issues and fixes
- Cross-repo change detection
- Rollback procedures
- PR and commit conventions

## Plugin Components

```
guru-release/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── commands/                 # Slash commands
│   ├── staging.md
│   ├── production.md
│   ├── review.md
│   ├── version.md
│   ├── push.md
│   ├── env.md
│   └── verify.md
├── agents/
│   └── release-notes-generator.md
├── skills/
│   └── guru-deployment/
│       ├── SKILL.md
│       └── references/
│           └── tips.md
└── README.md
```

## Updating the Plugin

### Adding New Tips

When you learn something during a deployment, update `skills/guru-deployment/references/tips.md`:

```bash
# Edit the tips file directly
vim ~/.claude/plugins/guru-release/skills/guru-deployment/references/tips.md
```

### Modifying Commands

Command files are in `~/.claude/plugins/guru-release/commands/`. Edit them to adjust workflow steps or add new functionality.

## Version History

- **0.1.0** - Initial release with staging and production deployment workflows
