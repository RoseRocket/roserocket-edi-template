#! /usr/bin/env node
import * as edi from './edi.js';
// Grab Provided args (excluding args 0-functional call and 1-'cronjob.js').
const [, , ...args] = process.argv;
const ds = new Date();
console.log(`Crontab Execute -- ${ds.toUTCString()}`);
console.log(`Executing CronJob - Load inbound EDI files`);
edi.processInboundFiles();
