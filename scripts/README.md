# Developer scripts

This directory contains the project's deployment and environment utilities. Run
them from the repository root directly or through their npm aliases.

## Commands

| Command | npm alias | Purpose |
| --- | --- | --- |
| `./scripts/deploy "message"` | `npm run deploy -- "message"` | Build, commit, and push the current branch to start deployment. |
| `./scripts/deploy-status` | `npm run deploy:status` | Show local Git and remote status without modifying anything. |
| `./scripts/watch-deploy` | `npm run deploy:watch` | Follow Watchtower logs on the AWS server until Control + C is pressed. |
| `./scripts/doctor` | `npm run doctor` | Check the complete local development and deployment environment. |
| `./scripts/logs` | `npm run logs` | Show running AWS containers and the latest 30 Watchtower log lines. |
| `./scripts/update-server` | `npm run update-server` | Show Docker Compose, image, and container status on AWS. This command does not update the server. |

## Requirements

- Node.js and npm
- Git with GitHub SSH authentication configured
- Docker with the Compose plugin
- AWS access through `~/Desktop/AWSGOOB.pem`

The AWS status commands connect to `ubuntu@98.88.81.139`. They only read logs
and container state. They do not change services, images, or containers.

`doctor` exits with a non-zero status when a critical environment check fails.
A dirty working tree is reported for awareness but is not itself a failure.
