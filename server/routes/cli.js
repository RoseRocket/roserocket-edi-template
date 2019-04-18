#! /usr/bin/env node
import * as edi from './edi.js';
import { printFuncError } from '../utils/utils';

// Grab Provided args (excluding args 0-functional call and 1-'cronjob.js').
const [, , ...args] = process.argv;
if (args.length < 4) {
    printFuncError('Incorrect Usage', 'npm run cli [filename] [data/edi] [204/214/990] [in/out]');
    process.exit();
}

const [fileName, fileType, ediType, method, ...addArgs] = args;
if (method != 'in' && method != 'out') {
    printFuncError('Unrecognized Method', 'Please only use "in" or "out" methods');
    process.exit();
}
if (fileType != 'data' && fileType != 'edi') {
    printFuncError('Unrecognized Method', 'Please only use "in" or "out" methods');
    process.exit();
}

if (fileType == 'edi') {
    if (method == 'in') {
        edi.processInboundEDIFile(fileName, ediType);
    } else {
        //edi.processOutboundEDIFile(fileName, ediType);
    }
} else {
    if (method == 'in') {
        edi.processInboundDataFile(fileName, ediType);
    } else {
        edi.processOutboundDataFile(fileName, ediType);
    }
}
