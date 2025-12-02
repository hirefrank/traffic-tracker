#!/usr/bin/env node

/**
 * Push routes.yaml to Cloudflare Workers secrets
 *
 * Reads routes.yaml, validates, and pushes ORIGIN, ORIGIN_LABEL, and ROUTES secrets.
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

const ROUTES_FILE = 'routes.yaml';

function pushSecret(name, value) {
  try {
    // Use printf to handle special characters properly
    execSync(`printf '%s' '${value.replace(/'/g, "'\\''")}' | wrangler secret put ${name}`, {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    return true;
  } catch (err) {
    return false;
  }
}

function main() {
  // Check if routes.yaml exists
  let yamlContent;
  try {
    yamlContent = readFileSync(ROUTES_FILE, 'utf8');
  } catch (err) {
    console.error(`Error: Could not read ${ROUTES_FILE}`);
    console.error('Create routes.yaml from routes.example.yaml first.');
    process.exit(1);
  }

  // Parse YAML
  let config;
  try {
    config = yaml.load(yamlContent);
  } catch (err) {
    console.error(`Error: Invalid YAML in ${ROUTES_FILE}`);
    console.error(err.message);
    process.exit(1);
  }

  // Validate origin
  if (!config.origin || !config.origin.address) {
    console.error('Error: routes.yaml must have an origin with an address');
    process.exit(1);
  }

  // Validate routes
  const routes = config.routes;
  if (!Array.isArray(routes) || routes.length === 0) {
    console.error('Error: routes.yaml must contain a non-empty routes array');
    process.exit(1);
  }

  for (const route of routes) {
    if (!route.id || !route.label || !route.destination) {
      console.error('Error: Each route must have id, label, and destination');
      console.error('Invalid route:', route);
      process.exit(1);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(route.id)) {
      console.error(`Error: Route id "${route.id}" must be URL-safe (alphanumeric, hyphens, underscores only)`);
      process.exit(1);
    }
  }

  // Display what we're pushing
  console.log('Configuration:');
  console.log(`  Origin: ${config.origin.address}`);
  if (config.origin.label) {
    console.log(`  Origin Label: ${config.origin.label}`);
  }
  console.log(`\nRoutes (${routes.length}):`);
  for (const route of routes) {
    const status = route.active === false ? ' (archived)' : '';
    console.log(`  - ${route.id}: ${route.label}${status}`);
  }

  // Push secrets
  console.log('\nPushing secrets to Cloudflare...\n');

  // Push ORIGIN
  console.log('Pushing ORIGIN...');
  if (!pushSecret('ORIGIN', config.origin.address)) {
    console.error('Failed to push ORIGIN');
    process.exit(1);
  }

  // Push ORIGIN_LABEL if provided
  if (config.origin.label) {
    console.log('Pushing ORIGIN_LABEL...');
    if (!pushSecret('ORIGIN_LABEL', config.origin.label)) {
      console.error('Failed to push ORIGIN_LABEL');
      process.exit(1);
    }
  }

  // Push ROUTES
  console.log('Pushing ROUTES...');
  const jsonRoutes = JSON.stringify(routes);
  if (!pushSecret('ROUTES', jsonRoutes)) {
    console.error('Failed to push ROUTES');
    process.exit(1);
  }

  console.log('\nDone! All secrets updated.');
}

main();
