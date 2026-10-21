import{readFileSync}from'node:fs';import{resolve}from'node:path';import{validateConfiguration}from'../src/core.mjs';
const file=resolve(process.argv[2]||'config.json');try{validateConfiguration(JSON.parse(readFileSync(file,'utf8')));console.log(`Configuration valid: ${file}`)}catch(error){console.error(`Configuration invalid: ${file}\n${error.message}`);process.exitCode=1}
