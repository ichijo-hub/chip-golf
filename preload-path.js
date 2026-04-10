// Ensure nvm's node is in PATH before any native modules (Turbopack) use it
const NODE_BIN = '/Users/akihito/.nvm/versions/node/v24.14.0/bin';
if (!process.env.PATH.includes(NODE_BIN)) {
  process.env.PATH = `${NODE_BIN}:${process.env.PATH}`;
}
