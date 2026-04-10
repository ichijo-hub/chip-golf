#!/bin/sh
NODE_BIN="/Users/akihito/.nvm/versions/node/v24.14.0/bin"
export PATH="$NODE_BIN:$PATH"
exec "$NODE_BIN/node" --require ./preload-path.js node_modules/.bin/next dev
